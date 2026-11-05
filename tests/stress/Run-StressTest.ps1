# Run-StressTest.ps1
# Wx3000 壓力測試：建立 DBF 測試複本 → subst 成一個空的磁碟機代號 → 執行測試 → 清除複本與 PostgreSQL 測試資料。
#   -Suite multiuser (預設)：stress.mjs，多人同時使用的競態與負載
#   -Suite large：large-data.mjs，把資料表灌到上萬筆後量測同步、讀取與寫入 (-Burst 未指定時用 5)
# 適用 Windows PowerShell 5.1 與 PowerShell 7。執行前請先啟動後端與 LocalAgent (例如 pnpm dev，或已安裝的服務)。
#
#   .\tests\stress\Run-StressTest.ps1
#   .\tests\stress\Run-StressTest.ps1 -Users '1,5,10,20,30' -Duration 30 -Burst 20
#   .\tests\stress\Run-StressTest.ps1 -Scenarios 'read-load,legacy-race'
#   .\tests\stress\Run-StressTest.ps1 -Suite large -Rows '10000,30000' -Tables 'buyinv,recmom,customer' -Users '1,5,10'

param(
    [ValidateSet('multiuser', 'large')]
    [string]$Suite = 'multiuser',
    [string]$SourceDir = 'C:\w3000\comm',
    [string]$Drive = '',
    [string]$ApiUrl = 'http://localhost:5007',
    [string]$AgentUrl = 'http://127.0.0.1:5009',
    [string]$Users = '1,5,10,20',
    [int]$Duration = 15,
    [int]$Burst = 10,
    [int]$Rounds = 20,
    [string]$Scenarios = 'all',
    [string]$Rows = '10000,30000',
    [string]$Tables = 'buyinv,recmom,customer',
    [string]$PsqlPath = 'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    [string]$PgHost = 'localhost',
    [int]$PgPort = 54320,
    [string]$PgUser = 'postgres',
    [string]$PgDatabase = 'w3000',
    [switch]$KeepCopy
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

function Get-SubstMap {
    $map = @{}
    foreach ($line in (& subst)) {
        if ($line -match '^([A-Z]):\\: => (.+)$') { $map[$Matches[1]] = $Matches[2] }
    }
    return $map
}

function Select-FreeDrive {
    $used = @{}
    foreach ($d in [IO.DriveInfo]::GetDrives()) { $used[$d.Name.Substring(0, 1).ToUpper()] = $true }
    foreach ($k in (Get-SubstMap).Keys) { $used[$k] = $true }
    foreach ($letter in 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N') {
        if (-not $used.ContainsKey($letter)) { return $letter }
    }
    throw '找不到可用的磁碟機代號，請用 -Drive 指定'
}

function Invoke-PgCleanup([string]$letter) {
    if (-not (Test-Path -LiteralPath $PsqlPath)) {
        Write-Warning "找不到 psql ($PsqlPath)，請手動刪除 schema `"$($letter.ToLower()):/w3000/comm`" 與 dictionary 中 $($letter.ToLower()): 開頭的列"
        return
    }
    $l = $letter.ToLower()
    # 用 SQL 檔傳給 psql：Windows PowerShell 5.1 會剝掉原生指令參數裡的雙引號
    $sql = @"
DROP SCHEMA IF EXISTS "${l}:/w3000/comm" CASCADE;
DELETE FROM dictionary.w3000_dbf WHERE left(path, 2) = '${l}:';
DELETE FROM dictionary.w3000_dbf_dupkey WHERE left(path, 2) = '${l}:';
"@
    $sqlFile = Join-Path $env:TEMP "wx3000-stress-cleanup-$l.sql"
    [IO.File]::WriteAllText($sqlFile, $sql, (New-Object System.Text.UTF8Encoding($false)))
    if (-not $env:PGPASSWORD) { $env:PGPASSWORD = 'Pg_W3000' }
    & $PsqlPath -h $PgHost -p $PgPort -U $PgUser -d $PgDatabase -q -f $sqlFile | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Warning "psql 清除失敗 (exit $LASTEXITCODE)" }
    [IO.File]::Delete($sqlFile)
}

# ---------------------------------------------------------------- 檢查
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '找不到 node，請先安裝 Node.js 18 以上' }
if (-not (Test-Path -LiteralPath (Join-Path $SourceDir 'cpa.dbf'))) { throw "找不到來源資料 $SourceDir\cpa.dbf" }

if ($Drive) {
    $Drive = $Drive.Trim().Substring(0, 1).ToUpper()
    if ($Drive -eq 'C') { throw '不可使用 C 碟' }
    if (Test-Path -LiteralPath "$($Drive):\") { throw "$($Drive): 已在使用中，請換一個代號" }
} else {
    $Drive = Select-FreeDrive
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path $env:TEMP "wx3000-stress-$stamp"
$dest = Join-Path $root 'w3000\comm'
$mounted = $false
$exitCode = 1

try {
    # ------------------------------------------------------------ 複本
    Write-Step "複製 $SourceDir 的 DBF / CDX / FPT 到 $dest"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $files = Get-ChildItem -LiteralPath $SourceDir -File | Where-Object { @('.dbf', '.cdx', '.fpt', '.idx') -contains $_.Extension.ToLower() }
    foreach ($f in $files) { Copy-Item -LiteralPath $f.FullName -Destination $dest }
    Write-Host "    已複製 $($files.Count) 個檔案"

    Write-Step "subst $($Drive): => $root"
    & subst "$($Drive):" $root
    if ($LASTEXITCODE -ne 0) { throw "subst $($Drive): 失敗" }
    $mounted = $true

    Write-Step "清除 $($Drive.ToLower()): 殘留的 PostgreSQL 測試資料"
    Invoke-PgCleanup $Drive

    # ------------------------------------------------------------ 執行
    Write-Step "執行壓力測試 ($Suite)"
    $common = @('--drive', $Drive, '--api', $ApiUrl, '--agent', $AgentUrl, '--users', $Users, '--duration', "$Duration")
    if ($Suite -eq 'large') {
        # 大表每次重灌要數十秒，同時開畫面的人數預設少一點
        if (-not $PSBoundParameters.ContainsKey('Burst')) { $Burst = 5 }
        $nodeArgs = @((Join-Path $scriptDir 'large-data.mjs')) + $common + @('--burst', "$Burst", '--rows', $Rows, '--tables', $Tables)
    } else {
        $nodeArgs = @((Join-Path $scriptDir 'stress.mjs')) + $common + @('--burst', "$Burst", '--rounds', "$Rounds", '--scenarios', $Scenarios)
    }
    & node @nodeArgs
    $exitCode = $LASTEXITCODE
}
finally {
    # ------------------------------------------------------------ 清除
    if ($mounted) {
        Write-Step "卸載 $($Drive):"
        & subst "$($Drive):" /D | Out-Null
    }
    Write-Step "刪除 PostgreSQL schema `"$($Drive.ToLower()):/w3000/comm`" 與 dictionary 測試列"
    Invoke-PgCleanup $Drive
    if (-not $KeepCopy -and (Test-Path -LiteralPath $root)) {
        Write-Step "刪除測試複本 $root"
        [IO.Directory]::Delete($root, $true)
    } elseif ($KeepCopy) {
        Write-Host "    保留測試複本：$root"
    }
}

exit $exitCode
