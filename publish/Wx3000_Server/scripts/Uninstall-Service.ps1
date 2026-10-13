# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$serviceName = "Wx3000Api"
$port = 5007

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 解除安裝 Windows Service 服務          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 停止 $serviceName 服務..." -ForegroundColor Gray
Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[2/3] 刪除 $serviceName 服務註冊..." -ForegroundColor Gray
sc.exe delete $serviceName | Out-Null

Write-Host "[3/3] 移除 Windows 防火牆規則..." -ForegroundColor Gray
Remove-NetFirewallRule -DisplayName "Wx3000 ERP Web API (Port $port)" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  $serviceName 服務已成功解除安裝！                      " -ForegroundColor Green
Write-Host "  (應用程式檔案與 PostgreSQL 資料皆完整保留)             " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Read-Host "請按 Enter 鍵結束"
