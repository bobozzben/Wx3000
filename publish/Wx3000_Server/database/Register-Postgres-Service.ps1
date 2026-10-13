# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       註冊 PostgreSQL 為 Windows 開機常駐服務          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$serviceName = "Wx3000PG"
$pgBin = "C:\A3000PG\PostgreSQL\16\bin"
$pgData = "C:\A3000PG\PostgreSQL\16\datas"

if (-not (Test-Path "$pgBin\pg_ctl.exe")) {
    Write-Host "[提示] 預設工具路徑 $pgBin\pg_ctl.exe 不存在。" -ForegroundColor Yellow
    Write-Host "請輸入 PostgreSQL bin 目錄路徑 (例如 D:\PostgreSQL\bin):"
    $pgBin = Read-Host
    $pgBin = $pgBin.Trim('"').Trim("'")
}

if (-not (Test-Path $pgData)) {
    Write-Host "[提示] 預設資料目錄 $pgData 不存在。" -ForegroundColor Yellow
    Write-Host "請輸入 PostgreSQL data 目錄路徑 (例如 D:\PostgreSQL\data):"
    $pgData = Read-Host
    $pgData = $pgData.Trim('"').Trim("'")
}

$pgCtl = Join-Path $pgBin "pg_ctl.exe"
if (-not (Test-Path $pgCtl) -or -not (Test-Path $pgData)) {
    Write-Host "[錯誤] 指定的路徑不存在，註冊終止。" -ForegroundColor Red
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Read-Host "請按 Enter 鍵結束"
    }
    exit 1
}

Write-Host "正在註冊服務名稱: $serviceName" -ForegroundColor Gray
Write-Host "執行程式路徑:   $pgCtl" -ForegroundColor Gray
Write-Host "資料存放目錄:   $pgData" -ForegroundColor Gray
Write-Host ""

& "$pgCtl" register -N "$serviceName" -D "$pgData" -S auto -w

if ($LASTEXITCODE -eq 0) {
    Write-Host "[成功] PostgreSQL 服務 ($serviceName) 註冊成功！" -ForegroundColor Green
    Start-Service -Name $serviceName -ErrorAction SilentlyContinue
} else {
    Write-Host "[失敗] 註冊服務失敗，可能服務已存在或權限不足。" -ForegroundColor Red
}

Write-Host ""
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Read-Host "請按 Enter 鍵結束"
}
