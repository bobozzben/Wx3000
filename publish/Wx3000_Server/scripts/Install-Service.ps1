# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 1. 檢查系統管理員權限
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[提示] 正在請求以「系統管理員」身分重新啟動安裝程式..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$serviceName = "Wx3000Api"
$displayName = "Wx3000 ERP Web API Service"
$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
$exePath = Join-Path $rootDir "api\Wx3000.Backend.exe"
$port = 5007

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 伺服器 Windows Service 安裝精靈        " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $exePath)) {
    Write-Host "[錯誤] 找不到後端執行檔: $exePath" -ForegroundColor Red
    Write-Host "請確認 api 目錄下是否存在 Wx3000.Backend.exe。"
    Read-Host "請按 Enter 鍵結束"
    exit 1
}

# 2. 移除舊服務 (若存在)
Write-Host "[1/5] 檢查舊有服務狀態..." -ForegroundColor Gray
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  發現已存在 $serviceName 服務，正在停止並重新註冊..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# 3. 註冊 Windows Service
Write-Host "[2/5] 註冊 Windows 服務 ($serviceName)..." -ForegroundColor Gray
$binPathArg = "`"$exePath`""
$createResult = sc.exe create $serviceName binPath= "$binPathArg" DisplayName= "$displayName" start= auto depend= Tcpip
if ($LASTEXITCODE -ne 0) {
    Write-Host "[失敗] 無法註冊服務: $createResult" -ForegroundColor Red
    Read-Host "請按 Enter 鍵結束"
    exit 1
}

sc.exe description $serviceName "Wx3000 ERP C# ASP.NET Core 後端常駐服務 (Port $port)" | Out-Null
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null

# 4. 設定防火牆規則
Write-Host "[3/5] 設定 Windows 防火牆規則 (開放 TCP $port 供區網連線)..." -ForegroundColor Gray
Remove-NetFirewallRule -DisplayName "Wx3000 ERP Web API (Port $port)" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Wx3000 ERP Web API (Port $port)" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -Profile Any | Out-Null

# 5. 檢查 PostgreSQL 服務
Write-Host "[4/5] 檢查 PostgreSQL 資料庫服務..." -ForegroundColor Gray
$pgServices = @("postgresql-x64-16", "A3000PG", "postgresql")
$pgFound = $false
foreach ($pg in $pgServices) {
    $svc = Get-Service -Name $pg -ErrorAction SilentlyContinue
    if ($svc) {
        $pgFound = $true
        if ($svc.Status -ne "Running") {
            Write-Host "  正在啟動資料庫服務: $pg..." -ForegroundColor Yellow
            Start-Service -Name $pg -ErrorAction SilentlyContinue
        } else {
            Write-Host "  資料庫服務 $pg 正在運行中。" -ForegroundColor Green
        }
        break
    }
}
if (-not $pgFound) {
    Write-Host "  [提醒] 未偵測到預設的 PostgreSQL 服務，請確認資料庫伺服器已正常啟動。" -ForegroundColor Yellow
}

# 6. 啟動 Wx3000Api 服務
Write-Host "[5/5] 啟動 $serviceName 服務..." -ForegroundColor Gray
Start-Service -Name $serviceName
Start-Sleep -Seconds 3

$svcStatus = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "               服務安裝與啟動成功！                     " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [服務名稱]: $serviceName"
Write-Host "  [運行狀態]: $($svcStatus.Status)" -ForegroundColor Green
Write-Host "  [監聽埠號]: $port"
Write-Host "  [啟動類型]: 自動 (Automatic，開機即常駐)"
Write-Host ""
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "【區網工作站使用位址】:" -ForegroundColor Cyan
$allIps = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and 
    $_.InterfaceAlias -notlike "*vEthernet*" -and 
    $_.InterfaceAlias -notlike "*WSL*" 
}
foreach ($item in $allIps) {
    $isVM = ($item.InterfaceAlias -like "*VMware*" -or $item.InterfaceAlias -like "*Virtual*")
    $tag = if ($isVM) { "[虛擬網卡]" } else { "[主要實體網路 (推薦)]" }
    $color = if ($isVM) { "DarkGray" } else { "Green" }
    $url = "http://" + $item.IPAddress + ":" + $port
    Write-Host "  伺服器連線網址:  $url  $tag" -ForegroundColor $color
}
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
$physicalAdapter = $allIps | Where-Object { $_.InterfaceAlias -notlike "*VMware*" -and $_.InterfaceAlias -notlike "*Virtual*" } | Select-Object -First 1
$mainUrl = if ($physicalAdapter) { "http://" + $physicalAdapter.IPAddress + ":" + $port } else { "http://localhost:" + $port }

Write-Host "【使用方式】:" -ForegroundColor White
Write-Host "  🌐 網頁版 (Web): 直接在任何瀏覽器開啟 $mainUrl" -ForegroundColor Yellow
Write-Host "  🖥️ 桌面版 (Electron): 在桌面端按 [Ctrl + Shift + S] 輸入 $mainUrl" -ForegroundColor Green
Write-Host ""
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Read-Host "請按 Enter 鍵結束"
}
