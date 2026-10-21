#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 1. 自動檢查並提升為「系統管理員」權限 (安裝 Windows Service 與設定防火牆必備)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[提示] 正在請求以「系統管理員」身分啟動安裝程式..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# 隨身碟 / 安裝來源根目錄 (即 publish 目錄)
$SourceRoot = $PSScriptRoot
if (-not $SourceRoot) {
    $SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location $SourceRoot

# 本機預設安裝目標根目錄
$InstallRoot = "C:\Wx3000"
$ApiServiceName = "Wx3000Api"
$ApiPort = 5007
$AgentPort = 18889

function Pause-Menu {
    Write-Host ""
    Read-Host "請按 Enter 鍵返回安裝主選單"
}

function Get-LanIpAddresses {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.InterfaceAlias -notlike "*vEthernet*" -and
        $_.InterfaceAlias -notlike "*WSL*" -and
        $_.InterfaceAlias -notlike "*Loopback*"
    }
    return $ips
}

function Get-PrimaryLanIp {
    $ips = Get-LanIpAddresses
    $physical = $ips | Where-Object { $_.InterfaceAlias -notlike "*VMware*" -and $_.InterfaceAlias -notlike "*Virtual*" } | Select-Object -First 1
    if ($physical) { return $physical.IPAddress }
    if ($ips) { return ($ips | Select-Object -First 1).IPAddress }
    return "127.0.0.1"
}

function Get-ApiServiceStatus {
    $svc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    if (-not $svc) { return "未安裝" }
    if ($svc.Status -eq "Running") { return "運行中 (Port $ApiPort)" }
    return "$($svc.Status)"
}

function Get-LocalAgentStatus {
    $proc = Get-Process -Name "Wx3000Agent", "Wx3000Agent_L2" -ErrorAction SilentlyContinue
    if ($proc) { return "運行中 (PID: $($proc[0].Id), Port $AgentPort)" }
    $svc = Get-Service -Name "Wx3000Agent" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") { return "服務運行中 (Port $AgentPort)" }
    return "未啟動"
}

function Create-Shortcut([string]$ShortcutPath, [string]$TargetPath, [string]$WorkingDir, [string]$Description) {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = $WorkingDir
    $shortcut.Description = $Description
    $shortcut.Save()
}

# ==============================================================================
# 模組安裝函式 1：安裝後端伺服器 (Wx3000Api Windows Service)
# ==============================================================================
function Install-ServerComponent {
    Write-Host ""
    Write-Host ">>> 開始安裝/更新【Wx3000 後端伺服器服務 ($ApiServiceName)】..." -ForegroundColor Cyan

    $srcServerApi = Join-Path $SourceRoot "Wx3000_Server\api"
    $srcSingleExe = Join-Path $SourceRoot "backend\Release\Wx3000.Backend.exe"
    $srcFrontDist = Join-Path $SourceRoot "frontend\dist"
    $destServerApi = Join-Path $InstallRoot "Server\api"

    # 檢查來源檔案是否存在
    $hasServerApi = Test-Path (Join-Path $srcServerApi "Wx3000.Backend.exe")
    $hasSingleExe = Test-Path $srcSingleExe

    if (-not $hasServerApi -and -not $hasSingleExe) {
        Write-Host "[錯誤] 找不到後端安裝來源檔案！" -ForegroundColor Red
        Write-Host "請確認隨身碟內包含 Wx3000_Server\api\Wx3000.Backend.exe 或 backend\Release\Wx3000.Backend.exe" -ForegroundColor Yellow
        return $false
    }

    # 1. 若舊服務正在運行，先停止服務與處理程序
    Write-Host "[1/5] 檢查並停止既有 $ApiServiceName 服務..." -ForegroundColor Gray
    $existingSvc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    if ($existingSvc) {
        Stop-Service -Name $ApiServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    # 2. 複製檔案到本機硬碟 C:\Wx3000\Server\api (避免隨身碟拔除後無法執行)
    Write-Host "[2/5] 正在複製伺服器程式至本機: $destServerApi ..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $destServerApi | Out-Null

    if ($hasServerApi) {
        Copy-Item -Path "$srcServerApi\*" -Destination $destServerApi -Recurse -Force
    } else {
        Copy-Item -Path "$SourceRoot\backend\Release\*" -Destination $destServerApi -Recurse -Force
    }

    # 若隨身碟有最新 frontend\dist，同步更新至 wwwroot
    if (Test-Path (Join-Path $srcFrontDist "index.html")) {
        $destWwwroot = Join-Path $destServerApi "wwwroot"
        New-Item -ItemType Directory -Force -Path $destWwwroot | Out-Null
        Copy-Item -Path "$srcFrontDist\*" -Destination $destWwwroot -Recurse -Force
        Write-Host "      已同步最新前端靜態網頁至 $destWwwroot" -ForegroundColor Green
    }

    # 3. 註冊 Windows Service
    $exePath = Join-Path $destServerApi "Wx3000.Backend.exe"
    Write-Host "[3/5] 正在註冊 Windows 服務 ($ApiServiceName)..." -ForegroundColor Gray
    if ($existingSvc) {
        sc.exe delete $ApiServiceName | Out-Null
        Start-Sleep -Seconds 2
    }
    $binPathArg = "`"$exePath`""
    sc.exe create $ApiServiceName binPath= "$binPathArg" DisplayName= "Wx3000 ERP Web API Service" start= auto depend= Tcpip | Out-Null
    sc.exe description $ApiServiceName "Wx3000 ERP C# ASP.NET Core 後端常駐服務 (Port $ApiPort)" | Out-Null
    sc.exe failure $ApiServiceName reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null

    # 4. 設定 Windows 防火牆規則
    Write-Host "[4/5] 正在設定 Windows 防火牆 (開放區網 TCP Port $ApiPort)..." -ForegroundColor Gray
    Remove-NetFirewallRule -DisplayName "Wx3000 ERP Web API (Port $ApiPort)" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Wx3000 ERP Web API (Port $ApiPort)" -Direction Inbound -LocalPort $ApiPort -Protocol TCP -Action Allow -Profile Any | Out-Null

    # 5. 檢查 PostgreSQL 並啟動 Wx3000Api 服務
    Write-Host "[5/5] 正在啟動 $ApiServiceName 服務..." -ForegroundColor Gray
    $pgServices = @("postgresql-x64-16", "A3000PG", "postgresql")
    foreach ($pg in $pgServices) {
        $pgSvc = Get-Service -Name $pg -ErrorAction SilentlyContinue
        if ($pgSvc -and $pgSvc.Status -ne "Running") {
            Write-Host "      正在啟動 PostgreSQL 資料庫服務 ($pg)..." -ForegroundColor Yellow
            Start-Service -Name $pg -ErrorAction SilentlyContinue
        }
    }

    Start-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $afterSvc = Get-Service -Name $ApiServiceName -ErrorAction SilentlyContinue
    if ($afterSvc -and $afterSvc.Status -eq "Running") {
        Write-Host "[成功] 後端伺服器已安裝於 $destServerApi 並成功啟動！" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[警告] $ApiServiceName 服務未處於 Running 狀態，請檢查 PostgreSQL 是否已啟動或檢視系統事件檢視器。" -ForegroundColor Yellow
        return $false
    }
}

# ==============================================================================
# 模組安裝函式 2：安裝本機代理 (LocalAgent - 報表 wbaseRP.dll & DBF 免註冊元件)
# ==============================================================================
function Install-LocalAgentComponent {
    Write-Host ""
    Write-Host ">>> 開始安裝/更新【Wx3000 LocalAgent 本機印表與 DBF 代理】..." -ForegroundColor Cyan

    $srcAgentDir = Join-Path $SourceRoot "localagent\dist"
    $destAgentDir = Join-Path $InstallRoot "LocalAgent"

    $agentExeName = "Wx3000Agent.exe"
    if (-not (Test-Path (Join-Path $srcAgentDir "Wx3000Agent.exe"))) {
        if (Test-Path (Join-Path $srcAgentDir "Wx3000Agent_L2.exe")) {
            $agentExeName = "Wx3000Agent_L2.exe"
        } else {
            Write-Host "[錯誤] 找不到 LocalAgent 安裝來源: $srcAgentDir\Wx3000Agent.exe" -ForegroundColor Red
            return $false
        }
    }

    # 1. 停止既有處理程序
    Write-Host "[1/3] 停止既有 LocalAgent 處理程序..." -ForegroundColor Gray
    Stop-Process -Name "Wx3000Agent", "Wx3000Agent_L2", "WbaseBridge", "DBFBridge" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    # 2. 複製檔案到本機 C:\Wx3000\LocalAgent (包含免註冊元件 w3000_dbf.dll 與 w3000_dbf.VBR)
    Write-Host "[2/3] 正在複製 LocalAgent 檔案至本機: $destAgentDir ..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $destAgentDir | Out-Null
    Copy-Item -Path "$srcAgentDir\*" -Destination $destAgentDir -Recurse -Force

    # 3. 建立背景無視窗啟動器並加入 Windows 登入自動啟動 (確保 FastReport 報表預覽視窗可正常彈出於使用者桌面)
    Write-Host "[3/3] 設定開機自動背景啟動並立即啟動 LocalAgent (Port $AgentPort)..." -ForegroundColor Gray
    $targetExe = Join-Path $destAgentDir $agentExeName
    $vbsLauncher = Join-Path $destAgentDir "Start-LocalAgent-Hidden.vbs"
    $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$destAgentDir"
WshShell.Run Chr(34) & "$targetExe" & Chr(34), 0, False
"@
    [System.IO.File]::WriteAllText($vbsLauncher, $vbsContent, [System.Text.Encoding]::Default)

    # 寫入 HKLM Run 讓所有使用者登入時自動在背景啟動 LocalAgent
    $runKeyPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $runKeyPath -Name "Wx3000LocalAgent" -Value "wscript.exe `"$vbsLauncher`"" -ErrorAction SilentlyContinue

    # 開放防火牆 LocalAgent Port 18889 (供本機與區網診斷)
    Remove-NetFirewallRule -DisplayName "Wx3000 LocalAgent (Port $AgentPort)" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Wx3000 LocalAgent (Port $AgentPort)" -Direction Inbound -LocalPort $AgentPort -Protocol TCP -Action Allow -Profile Any | Out-Null

    # 立即啟動
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsLauncher`"" -WorkingDirectory $destAgentDir
    Start-Sleep -Seconds 2

    $agentProc = Get-Process -Name "Wx3000Agent", "Wx3000Agent_L2" -ErrorAction SilentlyContinue
    if ($agentProc) {
        Write-Host "[成功] LocalAgent 已安裝於 $destAgentDir 並在背景運行中 (Port $AgentPort)！" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[提醒] LocalAgent 已複製完成，若未自動啟動請手動執行 $targetExe 檢查。" -ForegroundColor Yellow
        return $false
    }
}

# ==============================================================================
# 模組安裝函式 3：安裝 Electron 桌面端 (Wx3000 ERP Client)
# ==============================================================================
function Install-ElectronClientComponent {
    Write-Host ""
    Write-Host ">>> 開始安裝/更新【Wx3000 Electron 桌面端程式】..." -ForegroundColor Cyan

    $srcUnpacked = Join-Path $SourceRoot "frontend\Electron\release\win-unpacked"
    $srcRelease = Join-Path $SourceRoot "frontend\Electron\release"
    $destClientDir = Join-Path $InstallRoot "Client"

    $unpackedExe = Join-Path $srcUnpacked "Wx3000 ERP Client.exe"
    $setupExe = Get-ChildItem -Path $srcRelease -Filter "*Setup*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $portableExe = Get-ChildItem -Path $srcRelease -Filter "*.exe" -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike "*Setup*" } | Select-Object -First 1

    # 優先使用 win-unpacked 快速部署至 C:\Wx3000\Client 並建立桌面捷徑
    if (Test-Path $unpackedExe) {
        Write-Host "[1/2] 停止運行中的 Wx3000 ERP Client..." -ForegroundColor Gray
        Stop-Process -Name "Wx3000 ERP Client" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        Write-Host "[2/2] 正在複製桌面端程式至本機: $destClientDir ..." -ForegroundColor Gray
        New-Item -ItemType Directory -Force -Path $destClientDir | Out-Null
        Copy-Item -Path "$srcUnpacked\*" -Destination $destClientDir -Recurse -Force

        $installedExe = Join-Path $destClientDir "Wx3000 ERP Client.exe"
        # 建立目前使用者桌面捷徑
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutFile = Join-Path $desktopPath "Wx3000 雲端會計進銷存.lnk"
        Create-Shortcut -ShortcutPath $shortcutFile -TargetPath $installedExe -WorkingDir $destClientDir -Description "Wx3000 雲端會計進銷存系統 (FoxPro 桌面端)"

        Write-Host "[成功] 桌面端已安裝至 $destClientDir，並已在桌面建立【Wx3000 雲端會計進銷存】捷徑！" -ForegroundColor Green
        return $true
    }
    elseif ($setupExe) {
        Write-Host "找到正式安裝精靈: $($setupExe.FullName)" -ForegroundColor Cyan
        Write-Host "正在啟動安裝精靈，請依畫面指示完成安裝..." -ForegroundColor Yellow
        Start-Process -FilePath $setupExe.FullName -Wait
        Write-Host "[成功] 安裝精靈執行完畢！" -ForegroundColor Green
        return $true
    }
    elseif ($portableExe) {
        Write-Host "找到單檔綠色版執行檔: $($portableExe.FullName)" -ForegroundColor Cyan
        New-Item -ItemType Directory -Force -Path $destClientDir | Out-Null
        $installedExe = Join-Path $destClientDir "Wx3000 ERP Client.exe"
        Copy-Item -Path $portableExe.FullName -Destination $installedExe -Force

        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutFile = Join-Path $desktopPath "Wx3000 雲端會計進銷存.lnk"
        Create-Shortcut -ShortcutPath $shortcutFile -TargetPath $installedExe -WorkingDir $destClientDir -Description "Wx3000 雲端會計進銷存系統 (FoxPro 桌面端)"

        Write-Host "[成功] 桌面端已複製至 $installedExe 並建立桌面捷徑！" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "[錯誤] 隨身碟內找不到 Electron 桌面端檔案！" -ForegroundColor Red
        Write-Host "請確認 frontend\Electron\release\ 目錄下是否已打包桌面端程式。" -ForegroundColor Yellow
        return $false
    }
}

# ==============================================================================
# 顯示區網連線指引
# ==============================================================================
function Show-LanConnectionGuide {
    $primaryIp = Get-PrimaryLanIp
    $serverUrl = "http://${primaryIp}:${ApiPort}"

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "                    區網連線資訊與操作指引                            " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  本機伺服器區網網址 : $serverUrl" -ForegroundColor Yellow
    Write-Host "  本機後端健康檢查   : $serverUrl/health" -ForegroundColor Gray
    Write-Host "  本機印表代理網址   : http://localhost:$AgentPort" -ForegroundColor Gray
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  【使用瀏覽器開啟】 : 直接在 Chrome / Edge 輸入 $serverUrl" -ForegroundColor White
    Write-Host "  【使用桌面端開啟】 : 開啟桌面【Wx3000 雲端會計進銷存】捷徑，" -ForegroundColor White
    Write-Host "                       按 [Ctrl + Shift + S] 設定伺服器網址為：" -ForegroundColor White
    Write-Host "                       $serverUrl" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Green
}

# ==============================================================================
# 主選單迴圈
# ==============================================================================
:MenuLoop while ($true) {
    Clear-Host
    $lanIp = Get-PrimaryLanIp
    $apiStatus = Get-ApiServiceStatus
    $agentStatus = Get-LocalAgentStatus

    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "              Wx3000 ERP 客戶端隨身碟一鍵安裝與部署精靈                       " -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " 安裝來源路徑 (隨身碟) : $SourceRoot" -ForegroundColor Gray
    Write-Host " 本機安裝目標路徑      : $InstallRoot" -ForegroundColor Gray
    Write-Host " 本機區網 IP 位址      : $lanIp" -ForegroundColor Yellow
    Write-Host " 後端服務 (Wx3000Api)  : $apiStatus" -ForegroundColor Green
    Write-Host " 本機代理 (LocalAgent) : $agentStatus" -ForegroundColor Green
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 【一、角色快速安裝 (推薦依電腦角色選擇)】" -ForegroundColor Yellow
    Write-Host "   [1] ★ 安裝【主機端 Server 全套】 (後端服務 + LocalAgent + Electron 桌面端)"
    Write-Host "         ➔ 適用於：區網內的主機電腦，或單機版電腦" -ForegroundColor DarkGray
    Write-Host "   [2] ★ 安裝【區網員工工作站】     (LocalAgent 本機印表代理 + Electron 桌面端)"
    Write-Host "         ➔ 適用於：區網內連線至主機的其他員工電腦" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host " 【二、單獨元件安裝與更新 (模組化維護)】" -ForegroundColor Magenta
    Write-Host "   [3] 僅安裝/更新【後端伺服器服務 Wx3000Api】 (複製至 $InstallRoot\Server)"
    Write-Host "   [4] 僅更新【前端網頁檔 wwwroot】           (從 frontend\dist 更新至 Server)"
    Write-Host "   [5] 僅安裝/更新【LocalAgent 本機代理】     (複製至 $InstallRoot\LocalAgent)"
    Write-Host "   [6] 僅安裝/更新【Electron 桌面端程式】     (複製至 $InstallRoot\Client + 桌面捷徑)"
    Write-Host ""
    Write-Host " 【三、系統檢測與維護工具】" -ForegroundColor Cyan
    Write-Host "   [7] 更改本機安裝目標路徑 (目前為: $InstallRoot)"
    Write-Host "   [8] 檢查服務狀態、防火牆與顯示區網連線 IP"
    Write-Host "   [9] 解除安裝本機 Wx3000 服務與開機自啟動項目"
    Write-Host "   [Q] 離開安裝程式"
    Write-Host "==============================================================================" -ForegroundColor Cyan

    $rawChoice = Read-Host "請輸入選項代號 [1-9 或 Q]"
    $choice = if ($rawChoice) { $rawChoice.Trim().ToUpper() } else { "" }

    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Host "=== 執行 [1] 主機端 Server 全套安裝 ===" -ForegroundColor Yellow
            Install-ServerComponent | Out-Null
            Install-LocalAgentComponent | Out-Null
            Install-ElectronClientComponent | Out-Null
            Show-LanConnectionGuide
            Pause-Menu
        }
        "2" {
            Write-Host ""
            Write-Host "=== 執行 [2] 區網員工工作站安裝 (LocalAgent + Electron 桌面端) ===" -ForegroundColor Yellow
            Install-LocalAgentComponent | Out-Null
            Install-ElectronClientComponent | Out-Null
            Write-Host ""
            Write-Host "======================================================================" -ForegroundColor Green
            Write-Host "  員工工作站安裝完成！" -ForegroundColor Green
            Write-Host "  請開啟桌面上的【Wx3000 雲端會計進銷存】捷徑，" -ForegroundColor White
            Write-Host "  按下 [Ctrl + Shift + S] 輸入主機的連線網址 (例如 http://主機IP:5007)" -ForegroundColor Yellow
            Write-Host "======================================================================" -ForegroundColor Green
            Pause-Menu
        }
        "3" {
            Install-ServerComponent | Out-Null
            Show-LanConnectionGuide
            Pause-Menu
        }
        "4" {
            Write-Host ""
            Write-Host ">>> 開始更新【前端靜態網頁 wwwroot】..." -ForegroundColor Cyan
            $srcFrontDist = Join-Path $SourceRoot "frontend\dist"
            if (-not (Test-Path (Join-Path $srcFrontDist "index.html"))) {
                $srcFrontDist = Join-Path $SourceRoot "Wx3000_Server\api\wwwroot"
            }
            $destWwwroot = Join-Path $InstallRoot "Server\api\wwwroot"
            if (-not (Test-Path (Join-Path $srcFrontDist "index.html"))) {
                Write-Host "[錯誤] 隨身碟中找不到前端網頁檔 (frontend\dist\index.html)！" -ForegroundColor Red
            } else {
                New-Item -ItemType Directory -Force -Path $destWwwroot | Out-Null
                Copy-Item -Path "$srcFrontDist\*" -Destination $destWwwroot -Recurse -Force
                Write-Host "[成功] 前端網頁已更新至 $destWwwroot (使用者按 Ctrl+R 即可載入新畫面)！" -ForegroundColor Green
            }
            Pause-Menu
        }
        "5" {
            Install-LocalAgentComponent | Out-Null
            Pause-Menu
        }
        "6" {
            Install-ElectronClientComponent | Out-Null
            Pause-Menu
        }
        "7" {
            Write-Host ""
            $newPath = Read-Host "請輸入新的本機安裝根目錄 (例如 D:\Wx3000，直接按 Enter 維持 $InstallRoot)"
            if ($newPath.Trim() -ne "") {
                $InstallRoot = $newPath.Trim()
                Write-Host "已將安裝目標路徑更改為: $InstallRoot" -ForegroundColor Green
            }
            Pause-Menu
        }
        "8" {
            Show-LanConnectionGuide
            Write-Host ""
            Write-Host "【本機所有網路介面卡 IP 列表】:" -ForegroundColor Cyan
            foreach ($ip in (Get-LanIpAddresses)) {
                Write-Host "  - $($ip.InterfaceAlias) : http://$($ip.IPAddress):$ApiPort" -ForegroundColor White
            }
            Pause-Menu
        }
        "9" {
            Write-Host ""
            $confirm = Read-Host "確定要停止並移除本機的 Wx3000Api 服務與 LocalAgent 自啟動嗎？[Y/N]"
            if ($confirm -match "^[Yy]") {
                Stop-Service -Name $ApiServiceName -Force -ErrorAction SilentlyContinue
                sc.exe delete $ApiServiceName | Out-Null
                Stop-Process -Name "Wx3000.Backend", "Wx3000Agent", "Wx3000Agent_L2", "Wx3000 ERP Client" -Force -ErrorAction SilentlyContinue
                Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "Wx3000LocalAgent" -ErrorAction SilentlyContinue
                Write-Host "[完成] 已移除 Wx3000Api 服務與 LocalAgent 開機自啟動設定。" -ForegroundColor Green
                Write-Host "(程式檔案仍保留於 $InstallRoot，如需徹底刪除可手動刪除該資料夾)" -ForegroundColor Gray
            }
            Pause-Menu
        }
        { $_ -in "Q", "QUIT", "EXIT" } {
            Write-Host "安裝程式已結束。" -ForegroundColor Cyan
            break MenuLoop
        }
        default {
            Write-Host "無效的選項，請重新輸入。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
