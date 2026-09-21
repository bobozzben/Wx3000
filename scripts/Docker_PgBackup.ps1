# 編碼設為 UTF8 
$env:PGCLIENTENCODING = "UTF8"
# 強制設定輸出編碼為 UTF-8 
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8 
# --- 設定區 --- 
$PG_BIN = "C:\A3000PG\PostgreSQL\16\bin" # 安裝路徑 
$DB_HOST = "127.0.0.1" 
$DB_PORT = "5432" 
$DB_USER = "postgres" 
$DB_NAME = "a3000" 
$BACKUP_DIR = "C:\A3000\wBackup"  # 回置或備份存放路徑 
#$SCHEMAS = @("e3000__comm") # 要備份的 Schema 
$DATE = Get-Date -Format "yyyyMMdd_HHmm" 
$FILENAME = "C:\wBackup\a3000_"+$DATE+".backup" 
# 設定密碼
$env:PGPASSWORD = "0000" 
# 建立備份目錄 
if (!(Test-Path $BACKUP_DIR)) { New-Item -ItemType Directory -Path $BACKUP_DIR } 
#開始備份作業 ... 
$errorOutput = & "$PG_BIN\pg_dump.exe" -h $DB_HOST -p $DB_PORT -U $DB_USER            -Ft -d $DB_NAME -f $FILENAME --clean --if-exists 2>&1 
if ($LASTEXITCODE -ne 0) { 
    Write-Host "error,$schema,$errorOutput,$LASTEXITCODE "
} else {
    Write-Host "A3000 備份完成!" -ForegroundColor Yellow
} 
# 清除密碼變數 
$env:PGPASSWORD = $null 
 
