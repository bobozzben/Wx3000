#Requires -Version 5.1
param(
    [switch]$Silent,
    [switch]$Force,
    [string]$InstallRoot = "C:\Wx3000",
    [string]$GitHubRepo = "bobozzben/Wx3000",
    [ValidateSet("Menu", "Check", "ForceUpdate", "EnableSchedule", "DisableSchedule", "ShowLog", "Configure")]
    [string]$Action = "Menu"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. 若非 Silent 排程背景模式，檢查並自動提權為系統管理員
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    if ($Silent) {
        Write-Error "Silent 自動更新模式需要系統管理員 (Administrator / SYSTEM) 權限。"
        exit 1
    }
    Write-Host "[提示] 正在請求以「系統管理員」身分啟動 Wx3000 自動更新工具..." -ForegroundColor Yellow
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -InstallRoot `"$InstallRoot`" -Action $Action"
    if ($Force) { $argList += " -Force" }
    Start-Process powershell.exe -ArgumentList $argList -Verb RunAs
    exit
}

$ApiServiceName = "Wx3000Api"
$ApiPort = 5007
$AgentPort = 5009
$AgentServiceName = "Wx3000Agent"
$ScheduledTaskName = "Wx3000_DailyAutoUpdate"
$VersionFile = Join-Path $InstallRoot "version.txt"
$AgentVersionFile = Join-Path $InstallRoot "agent_version.txt"
$AgentDir = Join-Path $InstallRoot "LocalAgent"
$LogFile = Join-Path $InstallRoot "update.log"
$ConfigFile = Join-Path $InstallRoot "updater.config.json"

# 確保安裝根目錄存在，並將更新腳本自身同步複製到 C:\Wx3000\ 供排程呼叫
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
$localScriptPath = Join-Path $InstallRoot "Update-Wx3000.ps1"
$localBatPath = Join-Path $InstallRoot "Update-Wx3000.bat"
if ($PSCommandPath -and ($PSCommandPath -ne $localScriptPath)) {
    Copy-Item -Path $PSCommandPath -Destination $localScriptPath -Force -ErrorAction SilentlyContinue
    $sourceBat = Join-Path (Split-Path -Parent $PSCommandPath) "Update-Wx3000.bat"
    if (Test-Path $sourceBat) {
        Copy-Item -Path $sourceBat -Destination $localBatPath -Force -ErrorAction SilentlyContinue
    }
}

# LocalAgent 只應由本機存取；移除舊版安裝時對外開放 18889 的防火牆規則
Remove-NetFirewallRule -DisplayName "Wx3000 LocalAgent (Port 18889)" -ErrorAction SilentlyContinue

function Write-UpdateLog([string]$Message, [string]$Color = "White") {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logLine -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $Silent) {
        Write-Host $logLine -ForegroundColor $Color
    }
}

function Get-UpdaterConfig {
    if (Test-Path $ConfigFile) {
        try {
            return Get-Content -Path $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch {}
    }
    return [PSCustomObject]@{
        GitHubRepo  = $GitHubRepo
        GitHubToken = ""
        DailyTime   = "03:00"
    }
}

function Save-UpdaterConfig($cfg) {
    $cfg | ConvertTo-Json -Depth 5 | Set-Content -Path $ConfigFile -Encoding UTF8
}

function Get-LocalVersion {
    if (Test-Path $VersionFile) {
        return (Get-Content -Path $VersionFile -Raw -Encoding UTF8).Trim()
    }
    return "尚未紀錄版本"
}

function Get-LocalAgentVersion {
    if (Test-Path $AgentVersionFile) {
        return (Get-Content -Path $AgentVersionFile -Raw -Encoding UTF8).Trim()
    }
    return "尚未紀錄版本"
}

function Test-BackendInstalled {
    return [bool](Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue)
}

function Test-AgentInstalled {
    return (Test-Path (Join-Path $AgentDir "Wx3000Agent*.exe"))
}

function Get-AgentExeName {
    if (Test-Path (Join-Path $AgentDir "Wx3000Agent.exe")) { return "Wx3000Agent.exe" }
    return "Wx3000Agent_L2.exe"
}

function Stop-LocalAgent {
    Stop-Service -Name $AgentServiceName -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "Wx3000Agent", "Wx3000Agent_L2", "WbaseBridge", "DBFBridge" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 回傳 $true 表示已啟動；$false 表示目前無人登入，等下次登入由開機自啟動項目啟動
function Start-LocalAgent([string]$AgentExeName) {
    if (Get-Service -Name $AgentServiceName -ErrorAction SilentlyContinue) {
        Start-Service -Name $AgentServiceName -ErrorAction Stop
        return $true
    }

    # 與 Install-Wx3000.ps1 相同的無視窗啟動器，開機自啟動項目也指向這個檔案
    $targetExe = Join-Path $AgentDir $AgentExeName
    $vbsLauncher = Join-Path $AgentDir "Start-LocalAgent-Hidden.vbs"
    $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$AgentDir"
WshShell.Run Chr(34) & "$targetExe" & Chr(34), 0, False
"@
    [System.IO.File]::WriteAllText($vbsLauncher, $vbsContent, [System.Text.Encoding]::Default)

    $isSystem = [Security.Principal.WindowsIdentity]::GetCurrent().IsSystem
    if (-not $isSystem) {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsLauncher`"" -WorkingDirectory $AgentDir
        return $true
    }

    # 排程以 SYSTEM 執行時直接啟動會落在 Session 0，報表預覽視窗不會出現在使用者桌面，
    # 因此透過一次性排程在已登入使用者的工作階段啟動 (S-1-5-32-545 = BUILTIN\Users)
    if (-not (Get-Process -Name "explorer" -ErrorAction SilentlyContinue)) { return $false }
    $startTaskName = "Wx3000_StartLocalAgent"
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsLauncher`"" -WorkingDirectory $AgentDir
    $principal = New-ScheduledTaskPrincipal -GroupId "S-1-5-32-545" -RunLevel Limited
    Register-ScheduledTask -TaskName $startTaskName -Action $action -Principal $principal -Force | Out-Null
    Start-ScheduledTask -TaskName $startTaskName
    Start-Sleep -Seconds 3
    Unregister-ScheduledTask -TaskName $startTaskName -Confirm:$false -ErrorAction SilentlyContinue
    return $true
}

function Wait-AgentListening([int]$TimeoutSeconds = 15) {
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        if (Get-NetTCPConnection -LocalPort $AgentPort -State Listen -ErrorAction SilentlyContinue) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Save-ReleaseAsset($Asset, [string]$OutFile, $Cfg) {
    $dlHeaders = @{ "User-Agent" = "Wx3000-AutoUpdater" }
    if ($Cfg.GitHubToken -and $Cfg.GitHubToken.Trim() -ne "") {
        $dlHeaders["Authorization"] = "Bearer $($Cfg.GitHubToken.Trim())"
        $dlHeaders["Accept"] = "application/octet-stream"
        Invoke-WebRequest -Uri $Asset.url -Headers $dlHeaders -OutFile $OutFile -UseBasicParsing
    } else {
        Invoke-WebRequest -Uri $Asset.browser_download_url -Headers $dlHeaders -OutFile $OutFile -UseBasicParsing
    }
}

function Get-ScheduledTaskStatus {
    $task = Get-ScheduledTask -TaskName $ScheduledTaskName -ErrorAction SilentlyContinue
    if (-not $task) { return "未啟用" }
    $info = Get-ScheduledTaskInfo -TaskName $ScheduledTaskName -ErrorAction SilentlyContinue
    $lastRun = if ($info -and $info.LastRunTime -gt [datetime]"2000-01-01") { $info.LastRunTime.ToString("yyyy-MM-dd HH:mm") } else { "尚無執行紀錄" }
    return "已啟用 (狀態: $($task.State), 上次執行: $lastRun)"
}

function Invoke-GitHubReleaseUpdate([switch]$ForceUpdate) {
    $cfg = Get-UpdaterConfig
    $repo = if ($cfg.GitHubRepo) { $cfg.GitHubRepo } else { $GitHubRepo }
    $localVer = Get-LocalVersion
    $agentVer = Get-LocalAgentVersion

    # 依本機實際安裝的元件更新：主機更新後端與 LocalAgent，員工工作站只更新 LocalAgent
    $hasBackend = Test-BackendInstalled
    $hasAgent = Test-AgentInstalled

    Write-UpdateLog "=== 開始檢查 GitHub Release 更新 ($repo) ===" "Cyan"
    Write-UpdateLog "本機目前版本: 後端 $localVer / LocalAgent $agentVer" "Gray"

    if (-not $hasBackend -and -not $hasAgent) {
        Write-UpdateLog "[提示] 本機尚未安裝後端或 LocalAgent，請先執行 Install-Wx3000.bat 安裝。" "Yellow"
        return $false
    }

    $headers = @{
        "User-Agent" = "Wx3000-AutoUpdater"
        "Accept"     = "application/vnd.github+json"
    }
    if ($cfg.GitHubToken -and $cfg.GitHubToken.Trim() -ne "") {
        $headers["Authorization"] = "Bearer $($cfg.GitHubToken.Trim())"
    }

    $releaseUrl = "https://api.github.com/repos/$repo/releases/latest"
    try {
        $release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers -Method Get -TimeoutSec 20
    } catch {
        Write-UpdateLog "[錯誤] 無法從 GitHub 取得最新 Release 資訊 ($releaseUrl): $($_.Exception.Message)" "Red"
        Write-UpdateLog "提示：請確認本機網路連線，以及 GitHub 倉庫已建立至少一個正式 Release (例如 v1.0.0)。" "Yellow"
        return $false
    }

    $remoteTag = $release.tag_name
    if (-not $remoteTag) {
        Write-UpdateLog "[提示] GitHub 上尚未發佈任何 Release 版本。" "Yellow"
        return $false
    }

    Write-UpdateLog "GitHub 最新版本: $remoteTag (發佈時間: $($release.published_at))" "Green"

    $updateBackend = $hasBackend -and ($ForceUpdate -or ($localVer -ne $remoteTag))
    $updateAgent = $hasAgent -and ($ForceUpdate -or ($agentVer -ne $remoteTag))

    # 尋找 Wx3000_Server_*.zip 與 Wx3000_LocalAgent_*.zip 資產
    $serverAsset = $release.assets | Where-Object { $_.name -like "Wx3000_Server*.zip" } | Select-Object -First 1
    $agentAsset = $release.assets | Where-Object { $_.name -like "Wx3000_LocalAgent*.zip" } | Select-Object -First 1
    if ($updateBackend -and -not $serverAsset) {
        Write-UpdateLog "[錯誤] 在 Release ($remoteTag) 中找不到 Wx3000_Server*.zip 安裝包！" "Red"
        return $false
    }
    if ($updateAgent -and -not $agentAsset) {
        Write-UpdateLog "[提示] Release ($remoteTag) 未包含 Wx3000_LocalAgent*.zip，本次略過 LocalAgent。" "Yellow"
        $updateAgent = $false
    }

    if (-not $updateBackend -and -not $updateAgent) {
        Write-UpdateLog "[完成] 本機已是最新版本 ($remoteTag)，無須更新。" "Green"
        return $true
    }

    $tempDir = Join-Path $env:TEMP "Wx3000_Update_$remoteTag"
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    $destServerApi = Join-Path $InstallRoot "Server\api"
    $backupRoot = Join-Path $InstallRoot "Backup"
    $backupStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupDir = $null
    $agentBackupDir = $null
    $agentDeployed = $false
    $previousAgentExe = $null

    try {
        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
        $newApiSourceDir = $null
        $newAgentSourceDir = $null

        if ($updateBackend) {
            $zipFile = Join-Path $tempDir $serverAsset.name
            $extractDir = Join-Path $tempDir "server"
            Write-UpdateLog "正在下載伺服器更新包: $($serverAsset.name) ($([math]::Round($serverAsset.size / 1MB, 2)) MB) ..." "Yellow"
            Save-ReleaseAsset $serverAsset $zipFile $cfg
            Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

            # 定位解壓縮後的 Wx3000.Backend.exe 所在目錄
            $newExe = Get-ChildItem -Path $extractDir -Filter "Wx3000.Backend.exe" -Recurse -File | Select-Object -First 1
            if (-not $newExe) {
                Write-UpdateLog "[錯誤] 更新壓縮包內找不到 Wx3000.Backend.exe，取消更新！" "Red"
                return $false
            }
            $newApiSourceDir = $newExe.DirectoryName
        }

        if ($updateAgent) {
            $zipFile = Join-Path $tempDir $agentAsset.name
            $extractDir = Join-Path $tempDir "agent"
            Write-UpdateLog "正在下載 LocalAgent 更新包: $($agentAsset.name) ($([math]::Round($agentAsset.size / 1MB, 2)) MB) ..." "Yellow"
            Save-ReleaseAsset $agentAsset $zipFile $cfg
            Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

            $newAgentExe = Get-ChildItem -Path $extractDir -Filter "Wx3000Agent.exe" -Recurse -File | Select-Object -First 1
            if (-not $newAgentExe) {
                Write-UpdateLog "[錯誤] 更新壓縮包內找不到 Wx3000Agent.exe，取消更新！" "Red"
                return $false
            }
            $newAgentSourceDir = $newAgentExe.DirectoryName
        }

        # 備份現有版本 (各僅保留最近 3 份備份以免佔用硬碟空間)
        if ($updateBackend -and (Test-Path (Join-Path $destServerApi "Wx3000.Backend.exe"))) {
            $backupDir = Join-Path $backupRoot "api_backup_$backupStamp"
            Write-UpdateLog "正在備份現有後端至 $backupDir ..." "Gray"
            Copy-Item -Path $destServerApi -Destination $backupDir -Recurse -Force -ErrorAction Stop
            Get-ChildItem -Path $backupRoot -Directory -Filter "api_backup_*" | Sort-Object CreationTime -Descending | Select-Object -Skip 3 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($updateAgent) {
            # 更新包只含主程式與設定，橋接程式與報表 DLL 維持本機現有檔案，因此只備份會被覆蓋的檔案
            $agentBackupDir = Join-Path $backupRoot "agent_backup_$backupStamp"
            Write-UpdateLog "正在備份現有 LocalAgent 至 $agentBackupDir ..." "Gray"
            foreach ($file in (Get-ChildItem -Path $newAgentSourceDir -Recurse -File)) {
                $relativePath = $file.FullName.Substring($newAgentSourceDir.Length + 1)
                $existing = Join-Path $AgentDir $relativePath
                if (Test-Path $existing) {
                    $backupFile = Join-Path $agentBackupDir $relativePath
                    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupFile) | Out-Null
                    Copy-Item -Path $existing -Destination $backupFile -Force -ErrorAction Stop
                }
            }
            Get-ChildItem -Path $backupRoot -Directory -Filter "agent_backup_*" | Sort-Object CreationTime -Descending | Select-Object -Skip 3 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }

        # 先停後端再停 LocalAgent，避免後端正透過 DBFBridge 寫入 DBF 時被中斷
        if ($hasBackend) {
            Write-UpdateLog "正在停止 $ApiServiceName 服務以進行熱更新..." "Yellow"
            Stop-Service -Name $ApiServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }

        if ($updateAgent) {
            $previousAgentExe = Get-AgentExeName
            Write-UpdateLog "正在部署 LocalAgent ($remoteTag) 至 $AgentDir ..." "Cyan"
            Stop-LocalAgent
            $agentDeployed = $true
            Copy-Item -Path "$newAgentSourceDir\*" -Destination $AgentDir -Recurse -Force -ErrorAction Stop

            if (Start-LocalAgent "Wx3000Agent.exe") {
                if (-not (Wait-AgentListening)) { throw "LocalAgent 啟動後未監聽 Port $AgentPort" }
            } else {
                Write-UpdateLog "[提示] 目前無人登入，LocalAgent 將於下次登入時自動啟動。" "Yellow"
            }
        }

        if ($updateBackend) {
            # 保留本機自訂的 appsettings.Production.json (若有)
            $prodConfigPath = Join-Path $destServerApi "appsettings.Production.json"
            $prodConfigBackup = $null
            if (Test-Path $prodConfigPath) {
                $prodConfigBackup = Get-Content -Path $prodConfigPath -Raw -Encoding UTF8
            }

            # 覆蓋新檔案
            Write-UpdateLog "正在部署後端 ($remoteTag) 至 $destServerApi ..." "Cyan"
            New-Item -ItemType Directory -Force -Path $destServerApi | Out-Null
            Copy-Item -Path "$newApiSourceDir\*" -Destination $destServerApi -Recurse -Force -ErrorAction Stop

            if ($prodConfigBackup) {
                Set-Content -Path $prodConfigPath -Value $prodConfigBackup -Encoding UTF8
            }
        }

        # 啟動服務並驗證健康狀態
        if ($hasBackend) {
            Write-UpdateLog "正在啟動 $ApiServiceName 服務並進行健康檢查..." "Yellow"
            Start-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3

            $afterSvc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
            if (-not ($afterSvc -and $afterSvc.Status -eq "Running")) {
                throw "服務啟動後未處於 Running 狀態"
            }
        }

        if ($updateBackend) { Set-Content -Path $VersionFile -Value $remoteTag -Encoding UTF8 }
        if ($updateAgent) { Set-Content -Path $AgentVersionFile -Value $remoteTag -Encoding UTF8 }
        Write-UpdateLog "[成功] Wx3000 已成功升級至 $remoteTag 並正常運行中！" "Green"
        return $true
    } catch {
        Write-UpdateLog "[嚴重錯誤] 更新過程發生異常: $($_.Exception.Message)" "Red"
        # 後端與 LocalAgent 一起還原，避免兩邊版本 (與連線 Port) 不一致
        if ($backupDir -and (Test-Path $backupDir)) {
            Write-UpdateLog "[自動回滾] 正在從備份 ($backupDir) 還原後端..." "Yellow"
            Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
            Copy-Item -Path "$backupDir\*" -Destination $destServerApi -Recurse -Force
        }
        if ($agentDeployed) {
            Write-UpdateLog "[自動回滾] 正在從備份 ($agentBackupDir) 還原 LocalAgent..." "Yellow"
            Stop-LocalAgent
            if (Test-Path $agentBackupDir) {
                Copy-Item -Path "$agentBackupDir\*" -Destination $AgentDir -Recurse -Force
            }
            try { Start-LocalAgent $previousAgentExe | Out-Null } catch { Write-UpdateLog "[自動回滾] LocalAgent 重新啟動失敗: $($_.Exception.Message)" "Red" }
        }
        if ($hasBackend) {
            Start-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
        }
        Write-UpdateLog "[自動回滾] 已還原舊版並重新啟動服務。" "Green"
        return $false
    } finally {
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Register-DailyAutoUpdateTask {
    $cfg = Get-UpdaterConfig
    $defaultTime = if ($cfg.DailyTime) { $cfg.DailyTime } else { "03:00" }
    Write-Host ""
    $inputTime = Read-Host "請輸入每日自動檢查更新時間 (24小時制 HH:mm，直接按 Enter 預設為 $defaultTime)"
    $runTime = if ($inputTime.Trim() -match "^\d{1,2}:\d{2}$") { $inputTime.Trim() } else { $defaultTime }

    $cfg.DailyTime = $runTime
    Save-UpdaterConfig $cfg

    $actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$localScriptPath`" -Silent -InstallRoot `"$InstallRoot`""
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs -WorkingDirectory $InstallRoot
    $trigger = New-ScheduledTaskTrigger -Daily -At $runTime
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

    Register-ScheduledTask -TaskName $ScheduledTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Wx3000 ERP 每日自動從 GitHub Releases 檢查並更新本機已安裝的後端與 LocalAgent" -Force | Out-Null

    Write-UpdateLog "已成功註冊 Windows 每日自動更新排程 ($ScheduledTaskName)，將於每天 $runTime 自動背景檢查更新！" "Green"
}

function Unregister-DailyAutoUpdateTask {
    Unregister-ScheduledTask -TaskName $ScheduledTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-UpdateLog "已移除 Windows 每日自動更新排程 ($ScheduledTaskName)。" "Yellow"
}

function Show-UpdateLog {
    Write-Host ""
    if (Test-Path $LogFile) {
        Write-Host "=== 最近 30 筆更新紀錄 ($LogFile) ===" -ForegroundColor Cyan
        Get-Content -Path $LogFile -Tail 30 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host "尚無更新紀錄。" -ForegroundColor Gray
    }
}

function Edit-UpdaterConfig {
    $cfg = Get-UpdaterConfig
    Write-Host ""
    $newRepo = Read-Host "請輸入 GitHub 倉庫 (格式 帳號/倉庫，直接按 Enter 維持 $($cfg.GitHubRepo))"
    if ($newRepo.Trim() -ne "") { $cfg.GitHubRepo = $newRepo.Trim() }
    $newToken = Read-Host "若為 Private 私有倉庫請輸入 GitHub Token (公開倉庫直接按 Enter 略過)"
    if ($newToken.Trim() -ne "") { $cfg.GitHubToken = $newToken.Trim() }
    Save-UpdaterConfig $cfg
    Write-Host "[完成] 設定已儲存至 $ConfigFile" -ForegroundColor Green
}

# ==============================================================================
# 若為 Windows 排程器背景呼叫 (-Silent)，直接執行更新並結束
# ==============================================================================
if ($Silent) {
    Invoke-GitHubReleaseUpdate -ForceUpdate:$Force | Out-Null
    exit 0
}

# ==============================================================================
# 由 Install-Wx3000.ps1 維護選單呼叫 (-Action)，執行單一功能後返回呼叫端
# ==============================================================================
switch ($Action) {
    "Check"           { Invoke-GitHubReleaseUpdate -ForceUpdate:$Force | Out-Null; exit 0 }
    "ForceUpdate"     { Invoke-GitHubReleaseUpdate -ForceUpdate | Out-Null; exit 0 }
    "EnableSchedule"  { Register-DailyAutoUpdateTask; exit 0 }
    "DisableSchedule" { Unregister-DailyAutoUpdateTask; exit 0 }
    "ShowLog"         { Show-UpdateLog; exit 0 }
    "Configure"       { Edit-UpdaterConfig; exit 0 }
}

# ==============================================================================
# 互動式管理選單
# ==============================================================================
function Pause-UpdaterMenu {
    Write-Host ""
    Read-Host "請按 Enter 鍵返回自動更新選單"
}

:UpdaterLoop while ($true) {
    Clear-Host
    $cfg = Get-UpdaterConfig
    $localVer = Get-LocalVersion
    $agentVer = Get-LocalAgentVersion
    $taskStatus = Get-ScheduledTaskStatus
    $svc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    $svcStatus = if ($svc) { "$($svc.Status) (Port $ApiPort)" } else { "未安裝" }

    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "              Wx3000 ERP GitHub Releases 自動熱更新與排程管理工具             " -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " 目標 GitHub 倉庫      : $($cfg.GitHubRepo)" -ForegroundColor White
    Write-Host " 本機安裝根目錄        : $InstallRoot" -ForegroundColor Gray
    Write-Host " 本機目前紀錄版本      : 後端 $localVer / LocalAgent $agentVer" -ForegroundColor Yellow
    Write-Host " 後端服務 (Wx3000Api)  : $svcStatus" -ForegroundColor Green
    Write-Host " Windows 每日自動排程  : $taskStatus" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "   [1] ★ 立即連線 GitHub 檢查並更新本機已安裝的後端與 LocalAgent" -ForegroundColor Yellow
    Write-Host "   [2]   強制重新下載並覆蓋安裝最新 Release 版本 (忽略版號比對)"
    Write-Host "   [3] ★ 啟用/設定【Windows 每日凌晨自動更新排程】 (免人工零接觸更新)" -ForegroundColor Green
    Write-Host "   [4]   停用/移除【Windows 每日自動更新排程】"
    Write-Host "   [5]   檢視本機更新歷史紀錄 ($LogFile)"
    Write-Host "   [6]   設定 GitHub 倉庫名稱或私有倉庫 Token (選填)"
    Write-Host "   [Q]   離開"
    Write-Host "==============================================================================" -ForegroundColor Cyan

    $choice = (Read-Host "請輸入選項 [1-6 或 Q]").Trim().ToUpper()
    switch ($choice) {
        "1" {
            Write-Host ""
            Invoke-GitHubReleaseUpdate | Out-Null
            Pause-UpdaterMenu
        }
        "2" {
            Write-Host ""
            Invoke-GitHubReleaseUpdate -ForceUpdate | Out-Null
            Pause-UpdaterMenu
        }
        "3" {
            Register-DailyAutoUpdateTask
            Pause-UpdaterMenu
        }
        "4" {
            Unregister-DailyAutoUpdateTask
            Pause-UpdaterMenu
        }
        "5" {
            Show-UpdateLog
            Pause-UpdaterMenu
        }
        "6" {
            Edit-UpdaterConfig
            Pause-UpdaterMenu
        }
        { $_ -in "Q", "QUIT", "EXIT" } {
            break UpdaterLoop
        }
        default {
            Write-Host "無效的選項，請重新輸入。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
