# UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dbName = "a3000"
$dbUser = "postgres"
$dbPort = 5432
$env:PGPASSWORD = "0000"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 ERP 資料庫還原精靈 (PostgreSQL)           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 尋找 psql.exe
$psqlPath = $null
$possiblePaths = @(
    "C:\A3000PG\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
)
foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        $psqlPath = $p
        break
    }
}
if (-not $psqlPath) {
    $cmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($cmd) {
        $psqlPath = $cmd.Source
    }
}

if (-not $psqlPath) {
    Write-Host "[錯誤] 找不到 psql.exe，請確認 PostgreSQL 是否已安裝。" -ForegroundColor Red
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Read-Host "請按 Enter 鍵結束"
    }
    exit 1
}

# 尋找還原檔案
$restoreFile = $null
$latest = Join-Path $PSScriptRoot "a3000_latest_backup.sql"
$current = Join-Path $PSScriptRoot "a3000_current_backup.sql"

if (Test-Path $latest) {
    $restoreFile = $latest
} elseif (Test-Path $current) {
    $restoreFile = $current
} else {
    $backups = Get-ChildItem (Join-Path $PSScriptRoot "backups\*.sql") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($backups -and $backups.Count -gt 0) {
        $restoreFile = $backups[0].FullName
    }
}

if (-not $restoreFile -or -not (Test-Path $restoreFile)) {
    Write-Host "請輸入或拖曳欲還原的 .sql 備份檔案路徑:" -ForegroundColor Yellow
    $restoreFile = Read-Host
    $restoreFile = $restoreFile.Trim('"').Trim("'")
}

if (-not (Test-Path $restoreFile)) {
    Write-Host "[錯誤] 找不到指定的備份檔案: $restoreFile" -ForegroundColor Red
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Read-Host "請按 Enter 鍵結束"
    }
    exit 1
}

Write-Host "即將把以下備份檔案還原至資料庫 [$dbName]:" -ForegroundColor White
Write-Host "檔案: $restoreFile" -ForegroundColor Green
Write-Host ""

if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    $confirm = Read-Host "確定要繼續執行資料庫還原嗎？此操作將覆蓋或更新資料 (Y/N)"
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "已取消操作。" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "[1/2] 檢查資料庫 [$dbName] 是否存在..." -ForegroundColor Gray
$checkDb = & "$psqlPath" -h localhost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
if ($checkDb -notmatch "1") {
    Write-Host "資料庫 [$dbName] 不存在，正在自動建立..." -ForegroundColor Yellow
    & "$psqlPath" -h localhost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName ENCODING 'UTF8';" | Out-Null
}

Write-Host "[2/2] 正在還原資料庫資料結構與內容..." -ForegroundColor Yellow
& "$psqlPath" -h localhost -p $dbPort -U $dbUser -d $dbName -f "$restoreFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[成功] 資料庫已成功還原！" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[提醒] 還原已完成，請確認是否有相容性警訊。" -ForegroundColor Yellow
}

Write-Host ""
if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Read-Host "請按 Enter 鍵結束"
}
