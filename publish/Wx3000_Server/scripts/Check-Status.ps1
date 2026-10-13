# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$serviceName = "Wx3000Api"
$port = 5007

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 伺服器狀態與連線診斷                  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1] 檢查 Windows 服務狀態:" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
$apiSvc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($apiSvc) {
    $color = if ($apiSvc.Status -eq "Running") { "Green" } else { "Yellow" }
    Write-Host "  $serviceName 服務: " -NoNewline
    Write-Host "$($apiSvc.Status)" -ForegroundColor $color
} else {
    Write-Host "  $serviceName 服務: 尚未安裝" -ForegroundColor Red
}

$pgServices = @("postgresql-x64-16", "A3000PG", "postgresql")
$pgFound = $false
foreach ($pg in $pgServices) {
    $svc = Get-Service -Name $pg -ErrorAction SilentlyContinue
    if ($svc) {
        $pgFound = $true
        $color = if ($svc.Status -eq "Running") { "Green" } else { "Yellow" }
        Write-Host "  PostgreSQL ($pg): " -NoNewline
        Write-Host "$($svc.Status)" -ForegroundColor $color
        break
    }
}
if (-not $pgFound) {
    Write-Host "  PostgreSQL: 未偵測到預設服務" -ForegroundColor Yellow
}
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "[2] 檢查 API 監聽狀態 (Health Check):" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
try {
    $res = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  API 健康檢查: 正常回應 ($res)" -ForegroundColor Green
} catch {
    Write-Host "  API 健康檢查失敗: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "[3] 伺服器區域網路 IP (供各工作站電腦連線使用):" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
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
    Write-Host "  區網連線網址:  $url  $tag ($($item.InterfaceAlias))" -ForegroundColor $color
}
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "【區網工作站使用指引】:" -ForegroundColor Cyan
$physicalAdapter = $allIps | Where-Object { $_.InterfaceAlias -notlike "*VMware*" -and $_.InterfaceAlias -notlike "*Virtual*" } | Select-Object -First 1
$mainUrl = if ($physicalAdapter) { "http://" + $physicalAdapter.IPAddress + ":" + $port } else { "http://localhost:" + $port }

Write-Host "  🌐 [網頁瀏覽器 (Chrome / Edge)]:" -ForegroundColor Yellow
Write-Host "     直接在任何電腦/平板瀏覽器打開網址: $mainUrl" -ForegroundColor Green
Write-Host "     (免安裝軟體，自動連線後端與 PostgreSQL)" -ForegroundColor Gray
Write-Host ""
Write-Host "  🖥️ [桌面客戶端 (Electron)]:" -ForegroundColor Yellow
Write-Host "     1. 開啟 Wx3000 桌面應用程式"
Write-Host "     2. 按下熱鍵 [Ctrl + Shift + S] 開啟伺服器連線設定"
Write-Host "     3. 輸入伺服器網址: $mainUrl 並點擊儲存" -ForegroundColor Green
Write-Host ""
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Read-Host "請按 Enter 鍵結束"
}
