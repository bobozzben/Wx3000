#Requires -Version 5.1
param(
    [switch]$Silent,
    [switch]$Force,
    [string]$InstallRoot = "C:\Wx3000",
    [string]$GitHubRepo = "bobozzben/Wx3000"
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
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Force) { $argList += " -Force" }
    Start-Process powershell.exe -ArgumentList $argList -Verb RunAs
    exit
}

$ApiServiceName = "Wx3000Api"
$ApiPort = 5007
$ScheduledTaskName = "Wx3000_DailyAutoUpdate"
$VersionFile = Join-Path $InstallRoot "version.txt"
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

    Write-UpdateLog "=== 開始檢查 GitHub Release 更新 ($repo) ===" "Cyan"
    Write-UpdateLog "本機目前版本: $localVer" "Gray"

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

    if (-not $ForceUpdate -and ($localVer -eq $remoteTag)) {
        Write-UpdateLog "[完成] 本機已是最新版本 ($remoteTag)，無須更新。" "Green"
        return $true
    }

    # 尋找 Wx3000_Server_*.zip 資產
    $serverAsset = $release.assets | Where-Object { $_.name -like "Wx3000_Server*.zip" } | Select-Object -First 1
    if (-not $serverAsset) {
        Write-UpdateLog "[錯誤] 在 Release ($remoteTag) 中找不到 Wx3000_Server*.zip 安裝包！" "Red"
        return $false
    }

    $tempDir = Join-Path $env:TEMP "Wx3000_Update_$remoteTag"
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    $zipFile = Join-Path $tempDir $serverAsset.name
    $extractDir = Join-Path $tempDir "extracted"

    try {
        Write-UpdateLog "[1/6] 正在下載伺服器更新包: $($serverAsset.name) ($([math]::Round($serverAsset.size / 1MB, 2)) MB) ..." "Yellow"
        $dlHeaders = @{ "User-Agent" = "Wx3000-AutoUpdater" }
        if ($cfg.GitHubToken -and $cfg.GitHubToken.Trim() -ne "") {
            $dlHeaders["Authorization"] = "Bearer $($cfg.GitHubToken.Trim())"
            $dlHeaders["Accept"] = "application/octet-stream"
            Invoke-WebRequest -Uri $serverAsset.url -Headers $dlHeaders -OutFile $zipFile -UseBasicParsing
        } else {
            Invoke-WebRequest -Uri $serverAsset.browser_download_url -Headers $dlHeaders -OutFile $zipFile -UseBasicParsing
        }

        Write-UpdateLog "[2/6] 正在解壓縮更新包..." "Gray"
        Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

        # 定位解壓縮後的 Wx3000.Backend.exe 所在目錄
        $newExe = Get-ChildItem -Path $extractDir -Filter "Wx3000.Backend.exe" -Recurse -File | Select-Object -First 1
        if (-not $newExe) {
            Write-UpdateLog "[錯誤] 更新壓縮包內找不到 Wx3000.Backend.exe，取消更新！" "Red"
            return $false
        }
        $newApiSourceDir = $newExe.DirectoryName

        # 目標路徑與備份路徑
        $destServerApi = Join-Path $InstallRoot "Server\api"
        $backupRoot = Join-Path $InstallRoot "Backup"
        $backupDir = Join-Path $backupRoot "api_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        New-Item -ItemType Directory -Force -Path $destServerApi | Out-Null
        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

        # 備份現有版本 (僅保留最近 3 份備份以免佔用硬碟空間)
        if (Test-Path (Join-Path $destServerApi "Wx3000.Backend.exe")) {
            Write-UpdateLog "[3/6] 正在備份現有版本至 $backupDir ..." "Gray"
            Copy-Item -Path $destServerApi -Destination $backupDir -Recurse -Force
            Get-ChildItem -Path $backupRoot -Directory | Sort-Object CreationTime -Descending | Select-Object -Skip 3 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }

        # 停止服務
        Write-UpdateLog "[4/6] 正在停止 $ApiServiceName 服務以進行熱更新..." "Yellow"
        $svc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
        if ($svc) {
            Stop-Service -Name $ApiServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        # 保留本機自訂的 appsettings.Production.json (若有)
        $prodConfigPath = Join-Path $destServerApi "appsettings.Production.json"
        $prodConfigBackup = $null
        if (Test-Path $prodConfigPath) {
            $prodConfigBackup = Get-Content -Path $prodConfigPath -Raw -Encoding UTF8
        }

        # 覆蓋新檔案
        Write-UpdateLog "[5/6] 正在部署新版本 ($remoteTag) 至 $destServerApi ..." "Cyan"
        Copy-Item -Path "$newApiSourceDir\*" -Destination $destServerApi -Recurse -Force

        if ($prodConfigBackup) {
            Set-Content -Path $prodConfigPath -Value $prodConfigBackup -Encoding UTF8
        }

        # 若尚未註冊服務則自動建立服務
        $exePath = Join-Path $destServerApi "Wx3000.Backend.exe"
        if (-not $svc) {
            sc.exe create $ApiServiceName binPath= "`"$exePath`"" DisplayName= "Wx3000 ERP Web API Service" start= auto depend= Tcpip | Out-Null
            sc.exe description $ApiServiceName "Wx3000 ERP C# ASP.NET Core 後端常駐服務 (Port $ApiPort)" | Out-Null
        }

        # 啟動服務並驗證健康狀態
        Write-UpdateLog "[6/6] 正在啟動 $ApiServiceName 服務並進行健康檢查..." "Yellow"
        Start-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3

        $afterSvc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
        if ($afterSvc -and $afterSvc.Status -eq "Running") {
            Set-Content -Path $VersionFile -Value $remoteTag -Encoding UTF8
            Write-UpdateLog "[成功] Wx3000 主機已成功升級至 $remoteTag 並正常運行中！" "Green"
            return $true
        } else {
            throw "服務啟動後未處於 Running 狀態"
        }
    } catch {
        Write-UpdateLog "[嚴重錯誤] 更新過程發生異常: $($_.Exception.Message)" "Red"
        if ($backupDir -and (Test-Path $backupDir)) {
            Write-UpdateLog "[自動回滾] 正在從備份 ($backupDir) 還原上一版本..." "Yellow"
            Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
            Copy-Item -Path "$backupDir\*" -Destination $destServerApi -Recurse -Force
            Start-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
            Write-UpdateLog "[自動回滾] 已還原舊版並重新啟動服務。" "Green"
        }
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

    Register-ScheduledTask -TaskName $ScheduledTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Wx3000 ERP 主機每日自動從 GitHub Releases 檢查並熱更新" -Force | Out-Null

    Write-UpdateLog "已成功註冊 Windows 每日自動更新排程 ($ScheduledTaskName)，將於每天 $runTime 自動背景檢查更新！" "Green"
}

function Unregister-DailyAutoUpdateTask {
    Unregister-ScheduledTask -TaskName $ScheduledTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-UpdateLog "已移除 Windows 每日自動更新排程 ($ScheduledTaskName)。" "Yellow"
}

# ==============================================================================
# 若為 Windows 排程器背景呼叫 (-Silent)，直接執行更新並結束
# ==============================================================================
if ($Silent) {
    Invoke-GitHubReleaseUpdate -ForceUpdate:$Force | Out-Null
    exit 0
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
    $taskStatus = Get-ScheduledTaskStatus
    $svc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    $svcStatus = if ($svc) { "$($svc.Status) (Port $ApiPort)" } else { "未安裝" }

    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "          Wx3000 ERP 主機端 GitHub Releases 自動熱更新與排程管理工具          " -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " 目標 GitHub 倉庫      : $($cfg.GitHubRepo)" -ForegroundColor White
    Write-Host " 本機安裝根目錄        : $InstallRoot" -ForegroundColor Gray
    Write-Host " 本機目前紀錄版本      : $localVer" -ForegroundColor Yellow
    Write-Host " 後端服務 (Wx3000Api)  : $svcStatus" -ForegroundColor Green
    Write-Host " Windows 每日自動排程  : $taskStatus" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "   [1] ★ 立即連線 GitHub 檢查並自動熱更新 (若有新版本自動停服務 ➔ 覆蓋 ➔ 重啟)" -ForegroundColor Yellow
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
            Write-Host ""
            if (Test-Path $LogFile) {
                Write-Host "=== 最近 30 筆更新紀錄 ($LogFile) ===" -ForegroundColor Cyan
                Get-Content -Path $LogFile -Tail 30 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
            } else {
                Write-Host "尚無更新紀錄。" -ForegroundColor Gray
            }
            Pause-UpdaterMenu
        }
        "6" {
            Write-Host ""
            $newRepo = Read-Host "請輸入 GitHub 倉庫 (格式 帳號/倉庫，直接按 Enter 維持 $($cfg.GitHubRepo))"
            if ($newRepo.Trim() -ne "") { $cfg.GitHubRepo = $newRepo.Trim() }
            $newToken = Read-Host "若為 Private 私有倉庫請輸入 GitHub Token (公開倉庫直接按 Enter 略過)"
            if ($newToken.Trim() -ne "") { $cfg.GitHubToken = $newToken.Trim() }
            Save-UpdaterConfig $cfg
            Write-Host "[完成] 設定已儲存至 $ConfigFile" -ForegroundColor Green
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
