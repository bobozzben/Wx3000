# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dbName = "a3000"
$dbUser = "postgres"
$dbPort = 5432
$env:PGPASSWORD = "0000"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 資料庫備份精靈 (PostgreSQL)           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 尋找 pg_dump.exe
$pgDumpPath = $null
$possiblePaths = @(
    "C:\A3000PG\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
)
foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        $pgDumpPath = $p
        break
    }
}
if (-not $pgDumpPath) {
    $cmd = Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue
    if ($cmd) {
        $pgDumpPath = $cmd.Source
    }
}

if (-not $pgDumpPath) {
    Write-Host "[錯誤] 找不到 pg_dump.exe，請確認 PostgreSQL 是否已安裝或設定環境變數。" -ForegroundColor Red
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Read-Host "請按 Enter 鍵結束"
    }
    exit 1
}

$backupsDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
}

$timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$targetFile = Join-Path $backupsDir "a3000_backup_$timestamp.sql"

Write-Host "正在備份資料庫 [$dbName]..." -ForegroundColor Yellow
Write-Host "工具路徑: $pgDumpPath" -ForegroundColor Gray
Write-Host "輸出檔案: $targetFile" -ForegroundColor Gray
Write-Host ""

& "$pgDumpPath" -h localhost -p $dbPort -U $dbUser -d $dbName -f "$targetFile"

if ($LASTEXITCODE -eq 0 -and (Test-Path $targetFile)) {
    $fileSizeMB = [math]::Round(((Get-Item $targetFile).Length / 1MB), 2)
    Write-Host "[成功] 資料庫備份完成！" -ForegroundColor Green
    Write-Host "檔案大小: $fileSizeMB MB" -ForegroundColor Green
    
    $latestFile = Join-Path $PSScriptRoot "a3000_latest_backup.sql"
    Copy-Item $targetFile $latestFile -Force
} else {
    Write-Host "[失敗] 備份過程發生錯誤，請確認 PostgreSQL 服務是否運行中且密碼正確。" -ForegroundColor Red
}

Write-Host ""
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Read-Host "請按 Enter 鍵結束"
}
