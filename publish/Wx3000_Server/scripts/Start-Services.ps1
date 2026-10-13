# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 正在啟動伺服器服務...                 " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 啟動資料庫
$pgServices = @("postgresql-x64-16", "A3000PG", "postgresql")
foreach ($pg in $pgServices) {
    $svc = Get-Service -Name $pg -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -ne "Running") {
            Write-Host "正在啟動資料庫服務: $pg..." -ForegroundColor Yellow
            Start-Service -Name $pg -ErrorAction SilentlyContinue
        } else {
            Write-Host "資料庫服務 $pg 正在運行中。" -ForegroundColor Green
        }
        break
    }
}

# 2. 啟動 API
$apiSvc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
if ($apiSvc) {
    if ($apiSvc.Status -ne "Running") {
        Write-Host "正在啟動後端服務: Wx3000Api..." -ForegroundColor Yellow
        Start-Service -Name "Wx3000Api"
    }
    Write-Host "Wx3000Api 服務狀態: " -NoNewline
    Write-Host "$((Get-Service -Name 'Wx3000Api').Status)" -ForegroundColor Green
} else {
    Write-Host "[提示] 尚未安裝 Wx3000Api 服務，請先執行 1-安裝後端服務。" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2
