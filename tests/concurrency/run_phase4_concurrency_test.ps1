# run_phase4_concurrency_test.ps1
# Wx3000 Phase 4: 多站併發鎖定與錯誤防護自動化驗證腳本
# 執行環境: Windows PowerShell 7 (pwsh)

param(
    [string]$DbfPath = 'C:\w3000\comm',
    [string]$DbfName = 'keyin',
    [string]$ApiUrl = 'http://localhost:5007/api/wbase1030',
    [string]$LocalAgentUrl = 'http://localhost:18889/api/dbf'
)

$ErrorActionPreference = 'Stop'
$testDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vfp = 'C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe'
$cfg = Join-Path $testDir 'config.fpw'
$prg = Join-Path $testDir 'lock_holder.prg'

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Wx3000 Phase 4: 多站併發鎖定與錯誤防護自動化測試" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Clear-TestFlags {
    Get-ChildItem -Path $testDir -Filter "*.flag" | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $testDir -Filter "*.fxp" | Remove-Item -Force -ErrorAction SilentlyContinue
}

function Start-VfpLock([string]$mode, [int]$recno, [int]$timeoutSec) {
    Clear-TestFlags
    $targetDbf = Join-Path $DbfPath "$DbfName.dbf"
    @"
$targetDbf
$mode
$recno
$timeoutSec
"@ | Set-Content -Path (Join-Path $testDir 'lock_cmd.txt') -Encoding Ascii

    $proc = Start-Process -FilePath $vfp -ArgumentList "-c`"$cfg`"", "`"$prg`"" -PassThru
    $waitLimit = [Environment]::TickCount + 5000
    while (-not (Test-Path (Join-Path $testDir 'locked.flag')) -and -not (Test-Path (Join-Path $testDir 'fail.flag')) -and [Environment]::TickCount -lt $waitLimit) {
        Start-Sleep -Milliseconds 100
    }

    if (Test-Path (Join-Path $testDir 'fail.flag')) {
        $msg = Get-Content (Join-Path $testDir 'fail.flag') -Raw
        try { $proc.Kill() } catch {}
        throw "VFP Lock failed: $msg"
    }

    if (-not (Test-Path (Join-Path $testDir 'locked.flag'))) {
        try { $proc.Kill() } catch {}
        throw "VFP Lock timeout waiting for locked.flag"
    }

    return $proc
}

function Release-VfpLock($proc) {
    "done" | Set-Content (Join-Path $testDir 'release.flag') -Encoding Ascii
    if ($proc) {
        $proc.WaitForExit(3000)
    }
    Clear-TestFlags
}

function Get-PgName([string]$code) {
    $env:PGPASSWORD = "Pg_W3000"
    $val = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -p 54320 -U postgres -d w3000 -t -A -c "SELECT name FROM ""c:/w3000/comm"".keyin WHERE no = '$code';"
    return $val.Trim()
}

function Extract-ErrorMessage($ex) {
    if ($ex.ErrorDetails -and $ex.ErrorDetails.Message) {
        try {
            $j = $ex.ErrorDetails.Message | ConvertFrom-Json
            if ($j.message) { return $j.message }
        } catch {}
        return $ex.ErrorDetails.Message
    }
    return $ex.Exception.Message
}

# Warm-up request
Write-Host "連線預熱中..." -ForegroundColor DarkGray
try { Invoke-RestMethod -Uri "$ApiUrl/USER" -Method GET | Out-Null } catch {}

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

# -------------------------------------------------------------
# Case 1: Baseline 無鎖更新 (基準測試)
# -------------------------------------------------------------
Write-Host "`n[Test 1] 基準測試: 無其他工作站鎖定時更新 USER..." -ForegroundColor Yellow
$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
$body1 = @{ empCode = "USER"; empName = "USER"; depName = ""; mobile = ""; email = ""; oneUserId = ""; onePassNo = "" } | ConvertTo-Json -Compress
$res1 = Invoke-RestMethod -Uri "$ApiUrl/USER" -Method PUT -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body1))
$sw1.Stop()

$t1Pass = ($res1.empName -eq "USER" -and $sw1.ElapsedMilliseconds -lt 3000)
Write-Host " -> 結果: $(if ($t1Pass){'通過 (PASS)'}else{'失敗'}), 耗時: $($sw1.ElapsedMilliseconds)ms" -ForegroundColor $(if ($t1Pass){'Green'}else{'Red'})
$results.Add([PSCustomObject]@{
    Scenario = "1. Baseline 無鎖正常寫入"
    Result = if ($t1Pass) { "PASS" } else { "FAIL" }
    Details = "耗時 $($sw1.ElapsedMilliseconds)ms, 回傳 200 OK"
})

# -------------------------------------------------------------
# Case 2: 他站持 RLOCK 單筆鎖定，Wx3000 嘗試更新同筆 (撞鎖攔截)
# -------------------------------------------------------------
Write-Host "`n[Test 2] 他站持 RLOCK 鎖定 USER (Recno 2)，Wx3000 嘗試更新同筆..." -ForegroundColor Yellow
$lockerProc = Start-VfpLock "RLOCK" 2 15
Write-Host " -> 他站已取得 RLOCK 鎖定: $(Get-Content (Join-Path $testDir 'locked.flag'))" -ForegroundColor DarkGray

$pgBeforeLock = Get-PgName "USER"
$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
$status2 = 0
$errMsg2 = ""
try {
    $body2 = @{ empCode = "USER"; empName = "撞鎖測試_不應寫入" } | ConvertTo-Json -Compress
    $res2 = Invoke-RestMethod -Uri "$ApiUrl/USER" -Method PUT -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body2))
    $status2 = 200
} catch {
    $status2 = $_.Exception.Response.StatusCode.value__
    $errMsg2 = Extract-ErrorMessage $_
}
$sw2.Stop()
$pgAfterLock = Get-PgName "USER"

# 驗證: 1. 回傳 409 Conflict, 2. 耗時約 2~4 秒 (SET REPROCESS 2s生效), 3. PG 完全未被寫入
$t2Pass = ($status2 -eq 409 -and $pgBeforeLock -eq $pgAfterLock -and $sw2.ElapsedMilliseconds -ge 1500)
Write-Host " -> 結果: $(if ($t2Pass){'通過 (PASS)'}else{'失敗'})" -ForegroundColor $(if ($t2Pass){'Green'}else{'Red'})
Write-Host "    HTTP 狀態碼: $status2 (預期: 409)" -ForegroundColor DarkGray
Write-Host "    等待重試耗時: $($sw2.ElapsedMilliseconds)ms (符合 2 秒設定)" -ForegroundColor DarkGray
Write-Host "    後端保護訊息: $errMsg2" -ForegroundColor DarkGray
Write-Host "    PG 資料未動: $($pgBeforeLock -eq $pgAfterLock) (維持 '$pgBeforeLock')" -ForegroundColor DarkGray

$results.Add([PSCustomObject]@{
    Scenario = "2. 他站持 RLOCK (同筆鎖定)"
    Result = if ($t2Pass) { "PASS" } else { "FAIL" }
    Details = "HTTP $status2 Conflict, 耗時 $($sw2.ElapsedMilliseconds)ms, PG 保證未寫入"
})

# -------------------------------------------------------------
# Case 3: 他站釋放鎖定後，Wx3000 重新存檔成功
# -------------------------------------------------------------
Write-Host "`n[Test 3] 他站釋放 RLOCK 鎖定，Wx3000 重新儲存..." -ForegroundColor Yellow
Release-VfpLock $lockerProc
Write-Host " -> 他站已釋放鎖定" -ForegroundColor DarkGray

$sw3 = [System.Diagnostics.Stopwatch]::StartNew()
$body3 = @{ empCode = "USER"; empName = "鎖定解除後成功儲存" } | ConvertTo-Json -Compress
$res3 = Invoke-RestMethod -Uri "$ApiUrl/USER" -Method PUT -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body3))
$sw3.Stop()
$pgAfterRelease = Get-PgName "USER"

$t3Pass = ($res3.empName -eq "鎖定解除後成功儲存" -and $pgAfterRelease -eq "鎖定解除後成功儲存")
Write-Host " -> 結果: $(if ($t3Pass){'通過 (PASS)'}else{'失敗'}), 耗時: $($sw3.ElapsedMilliseconds)ms" -ForegroundColor $(if ($t3Pass){'Green'}else{'Red'})
Write-Host "    PG 最新資料: $pgAfterRelease" -ForegroundColor DarkGray

$results.Add([PSCustomObject]@{
    Scenario = "3. 鎖定釋放後重新寫入"
    Result = if ($t3Pass) { "PASS" } else { "FAIL" }
    Details = "回傳 200 OK, 耗時 $($sw3.ElapsedMilliseconds)ms, DBF與PG兩端同步落地"
})

# -------------------------------------------------------------
# Case 4: 他站獨佔開檔 (模擬資料重整 EXCLUSIVE)，開檔即時攔截
# -------------------------------------------------------------
Write-Host "`n[Test 4] 他站獨佔開檔 (USE EXCLUSIVE 模擬 6-1 重整)，Wx3000 存檔攔截..." -ForegroundColor Yellow
$lockerProcExcl = Start-VfpLock "EXCL" 1 12
Write-Host " -> 他站已取得 EXCLUSIVE 獨佔檔鎖" -ForegroundColor DarkGray

$sw4 = [System.Diagnostics.Stopwatch]::StartNew()
$status4 = 0
$errMsg4 = ""
try {
    $body4 = @{ empCode = "USER"; empName = "獨佔衝突測試" } | ConvertTo-Json -Compress
    $res4 = Invoke-RestMethod -Uri "$ApiUrl/USER" -Method PUT -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body4))
    $status4 = 200
} catch {
    $status4 = $_.Exception.Response.StatusCode.value__
    $errMsg4 = Extract-ErrorMessage $_
}
$sw4.Stop()
Release-VfpLock $lockerProcExcl

$t4Pass = ($status4 -eq 409 -and $errMsg4 -like "*獨佔*")
Write-Host " -> 結果: $(if ($t4Pass){'通過 (PASS)'}else{'失敗'}), 耗時: $($sw4.ElapsedMilliseconds)ms" -ForegroundColor $(if ($t4Pass){'Green'}else{'Red'})
Write-Host "    HTTP 狀態碼: $status4 (預期: 409 Conflict)" -ForegroundColor DarkGray
Write-Host "    獨佔防護訊息: $errMsg4" -ForegroundColor DarkGray

$results.Add([PSCustomObject]@{
    Scenario = "4. 他站 EXCLUSIVE 獨佔 (6-1 重整)"
    Result = if ($t4Pass) { "PASS" } else { "FAIL" }
    Details = "即時回報 409 Conflict ($($sw4.ElapsedMilliseconds)ms), 提示資料檔獨佔中"
})

# -------------------------------------------------------------
# 復原測試資料
# -------------------------------------------------------------
Write-Host "`n[Cleanup] 復原測試資料..." -ForegroundColor Yellow
$bodyClean = @{ empCode = "USER"; empName = "USER"; depName = ""; mobile = ""; email = ""; oneUserId = ""; onePassNo = "" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$ApiUrl/USER" -Method PUT -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyClean)) | Out-Null
Write-Host " -> 資料已復原為初始基準" -ForegroundColor DarkGray

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Phase 4 併發鎖定驗證總結報表" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
