# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 正在停止後端服務...                   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$apiSvc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
if ($apiSvc -and $apiSvc.Status -eq "Running") {
    Write-Host "正在停止 Wx3000Api 服務..." -ForegroundColor Yellow
    Stop-Service -Name "Wx3000Api" -Force
    Write-Host "Wx3000Api 服務已停止。" -ForegroundColor Green
} else {
    Write-Host "Wx3000Api 服務目前未運行。" -ForegroundColor Gray
}

Write-Host ""
Write-Host "(註：PostgreSQL 資料庫服務維持運行，如需停止請由 Windows 服務員管理員操作)" -ForegroundColor Gray
Write-Host ""
Start-Sleep -Seconds 2
