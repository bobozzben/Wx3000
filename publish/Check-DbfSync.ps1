#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 自動檢查並提升為「系統管理員」權限 (停止/啟動 Wx3000Api Windows 服務與釋放 Port 5007 必備)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[提示] 正在請求以「系統管理員」身分啟動診斷工具 (管理 Windows 服務必備)..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# ==============================================================================
# Wx3000 DBF -> PostgreSQL 雙向同步單步驗證與除錯工具 (Check-DbfSync.ps1)
# 放置位置: Wx3000\publish\Check-DbfSync.ps1
# ==============================================================================

$ScriptRoot = $PSScriptRoot
if (-not $ScriptRoot) {
    $ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location $ScriptRoot

# 預設檢測參數 (可於選單中動態調整)
$script:DbfDir       = "C:\W3000\COMM"
$script:TestDbfName  = "taxno"          # 預設測試用的小檔案 (taxno.dbf 稅務人員, 或 comp.dbf 公司檔)
$script:PgHost       = "localhost"
$script:PgPort       = 54320
$script:PgDb         = "w3000"
$script:PgUser       = "postgres"
$script:PgPass       = "Pg_W3000"
$script:PgSchema     = "c:/w3000/comm"
$script:AgentUrl     = "http://localhost:18889"
$script:ApiPort      = 5007             # 正式安裝版預設 5007 (開發版為 5000)
$script:InstallRoot  = "C:\Wx3000"

# 自動偵測可用的測試 DBF 檔案
if (Test-Path $script:DbfDir) {
    if (-not (Test-Path (Join-Path $script:DbfDir "$($script:TestDbfName).dbf"))) {
        $firstDbf = Get-ChildItem -Path $script:DbfDir -Filter "*.dbf" -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($firstDbf) {
            $script:TestDbfName = [System.IO.Path]::GetFileNameWithoutExtension($firstDbf.Name).ToLower()
        }
    }
}

# 自動偵測後端 API 實際監聽 Port (5007 或 5000)
function Resolve-ActiveApiPort {
    foreach ($p in @(5007, 5000)) {
        $tcp = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($tcp) {
            $script:ApiPort = $p
            return $p
        }
    }
    return $script:ApiPort
}
Resolve-ActiveApiPort | Out-Null

# 自動尋找 LocalAgent 安裝目錄
function Find-LocalAgentDir {
    $candidates = @(
        (Join-Path $script:InstallRoot "LocalAgent"),
        (Join-Path $ScriptRoot "localagent\dist"),
        (Join-Path (Split-Path -Parent $ScriptRoot) "localagent\dist"),
        (Join-Path (Split-Path -Parent $ScriptRoot) "localagent")
    )
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path (Join-Path $dir "DBFBridge.exe"))) {
            return $dir
        }
    }
    return (Join-Path $script:InstallRoot "LocalAgent")
}

# 自動尋找本機 psql.exe
function Find-PsqlExe {
    $cmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\w3000\pgsql\bin\psql.exe",
        "C:\Wx3000\pgsql\bin\psql.exe",
        "D:\Program Files\PostgreSQL\16\bin\psql.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Write-StepHeader([string]$stepNum, [string]$title) {
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " [$stepNum] $title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
}

function Write-Pass([string]$msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

function Write-Hint([string]$msg) {
    Write-Host "         💡 除錯建議: $msg" -ForegroundColor Magenta
}

function Pause-Step([bool]$isBatchMode = $false) {
    if (-not $isBatchMode) {
        Write-Host ""
        Read-Host "請按 Enter 鍵返回診斷主選單"
    } else {
        Write-Host ""
        $ans = Read-Host "按 Enter 繼續下一步驗證，或輸入 [Q] 中斷返回主選單"
        if ($ans -match "^[Qq]") { return $false }
    }
    return $true
}

# ==============================================================================
# Step 1: 檢查地端 DBF 目錄、LocalAgent 檔案與 VFP9 Runtime 執行環境
# ==============================================================================
function Invoke-Step1-FileAndRuntimeCheck {
    Write-StepHeader "Step 1" "檢查地端 C:\W3000\COMM\、LocalAgent 核心元件與 VFP9 執行期 DLL"
    $allOk = $true

    # 1. 檢查 C:\W3000\COMM
    Write-Host "`n  >>> 1.1 檢查地端 DBF 資料目錄 ($script:DbfDir)" -ForegroundColor White
    if (Test-Path $script:DbfDir) {
        $dbfFiles = Get-ChildItem -Path $script:DbfDir -Filter "*.dbf" -File -ErrorAction SilentlyContinue
        if ($dbfFiles.Count -gt 0) {
            Write-Pass "找到 DBF 目錄: $script:DbfDir (共 $($dbfFiles.Count) 個 .dbf 檔案)"
        } else {
            Write-Fail "目錄 $script:DbfDir 存在，但裡面沒有任何 .dbf 檔案！"
            $allOk = $false
        }

        $testDbfPath = Join-Path $script:DbfDir "$($script:TestDbfName).dbf"
        if (Test-Path $testDbfPath) {
            $fi = Get-Item $testDbfPath
            Write-Pass "測試目標檔案存在: $testDbfPath ($($fi.Length) bytes, 最後修改: $($fi.LastWriteTime))"
        } else {
            Write-Warn "找不到預設測試檔 $testDbfPath，請於選單 [S] 更換測試 DBF 檔名。"
        }
    } else {
        Write-Fail "找不到地端 DBF 目錄: $script:DbfDir"
        Write-Hint "請確認此電腦是否已放置 C:\W3000\COMM\ 資料夾，或於選單 [S] 修改 DBF 路徑。"
        $allOk = $false
    }

    # 2. 檢查 LocalAgent 檔案完整性
    $agentDir = Find-LocalAgentDir
    Write-Host "`n  >>> 1.2 檢查 LocalAgent 與 DBF 橋接元件 ($agentDir)" -ForegroundColor White
    $requiredAgentFiles = @(
        @{ Name = "DBFBridge.exe";     Desc = "Lazarus 32-bit DBF 橋接執行檔" },
        @{ Name = "w3000_dbf.dll";     Desc = "VFP COM 核心元件 (負責讀取 DBF 與產生 PG 腳本)" },
        @{ Name = "w3000_dbf.VBR";     Desc = "VFP COM 免註冊 CLSID 定義檔" },
        @{ Name = "vfpencryption.fll"; Desc = "VFP SHA256 Checksum 加密擴充庫" }
    )

    foreach ($item in $requiredAgentFiles) {
        $fPath = Join-Path $agentDir $item.Name
        if (Test-Path $fPath) {
            Write-Pass "$($item.Name) 存在 ($($item.Desc))"
        } else {
            Write-Fail "缺少 $($item.Name) ($fPath) - $($item.Desc)"
            $allOk = $false
        }
    }

    # 3. 檢查乾淨電腦最容易缺少的 32-bit VFP9 Runtime 與 VC++ 7.1 執行期 DLL
    Write-Host "`n  >>> 1.3 檢查 32-bit Visual FoxPro 9 Runtime 與 VC71 相依 DLL (乾淨電腦必檢！)" -ForegroundColor White
    $searchPaths = @(
        $agentDir,
        "C:\Windows\SysWOW64",
        "C:\Program Files (x86)\Common Files\Microsoft Shared\VFP",
        "C:\Windows\System32",
        "C:\W3000",
        "C:\W3000\COMM"
    )

    $runtimeDlls = @(
        @{ Name = "vfp9r.dll";   Desc = "Visual FoxPro 9.0 COM Runtime 核心庫 (必備)"; Critical = $true },
        @{ Name = "vfp9t.dll";   Desc = "Visual FoxPro 9.0 Multi-threaded Runtime (DLL COM 必備)"; Critical = $true },
        @{ Name = "msvcr71.dll"; Desc = "Microsoft C Runtime 7.1 (VFP9 與 vfpencryption.fll 必備)"; Critical = $true },
        @{ Name = "msvcp71.dll"; Desc = "Microsoft C++ Runtime 7.1 (vfpencryption.fll 必備)"; Critical = $false },
        @{ Name = "gdiplus.dll"; Desc = "GDI+ 圖形庫 (VFP9 執行期相依)"; Critical = $false }
    )

    foreach ($dll in $runtimeDlls) {
        $foundAt = $null
        foreach ($sp in $searchPaths) {
            if ($sp -and (Test-Path (Join-Path $sp $dll.Name))) {
                $foundAt = Join-Path $sp $dll.Name
                break
            }
        }
        if ($foundAt) {
            Write-Pass "找到 $($dll.Name) -> $foundAt"
        } else {
            if ($dll.Critical) {
                Write-Fail "找不到 $($dll.Name)！($($dll.Desc))"
                Write-Hint "乾淨電腦若沒裝過 VFP9，w3000_dbf.dll 會無法載入！請將 vfp9r.dll、vfp9t.dll、vfp9cht.dll、msvcr71.dll 複製到 $agentDir 或 C:\Windows\SysWOW64\。"
                $allOk = $false
            } else {
                Write-Warn "未在常見路徑找到 $($dll.Name) ($($dll.Desc))，若後續 Checksum 失敗請補齊此檔。"
            }
        }
    }

    return $allOk
}

# ==============================================================================
# Step 2: 單步直接呼叫 DBFBridge.exe (略過 HTTP 網路層，直接驗證 COM 載入與 Checksum)
# ==============================================================================
function Invoke-Step2-DirectDbfBridgeTest {
    Write-StepHeader "Step 2" "直接執行 DBFBridge.exe 測試底層 VFP COM 載入 (略過網路層)"
    $agentDir = Find-LocalAgentDir
    $bridgeExe = Join-Path $agentDir "DBFBridge.exe"

    if (-not (Test-Path $bridgeExe)) {
        Write-Fail "找不到 $bridgeExe，無法執行直接測試！"
        Write-Hint "請先執行 Install-Wx3000.bat 安裝 LocalAgent，或確認隨身碟 localagent\dist 目錄完整。"
        return $false
    }

    # 2.1 測試 PING 指令 (驗證 InitVfpCom 免註冊載入 w3000_dbf.dll)
    Write-Host "`n  >>> 2.1 測試 DBFBridge.exe -> InitVfpCom (載入 w3000_dbf.dll)" -ForegroundColor White
    $pingJson = '{"action":"PING"}'
    $pingB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($pingJson))

    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $bridgeExe
        $psi.Arguments = $pingB64
        $psi.WorkingDirectory = $agentDir
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8

        $proc = [System.Diagnostics.Process]::Start($psi)
        $stdout = $proc.StandardOutput.ReadToEnd()
        $stderr = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit(10000) | Out-Null

        Write-Host "      原始回傳 (stdout): $($stdout.Trim())" -ForegroundColor Gray
        if ($stderr.Trim()) {
            Write-Host "      錯誤輸出 (stderr): $($stderr.Trim())" -ForegroundColor Yellow
        }

        $parsed = $stdout.Trim() | ConvertFrom-Json -ErrorAction Stop
        if ($parsed.success -eq $true) {
            Write-Pass "DBFBridge.exe 成功載入 w3000_dbf.dll！(dllPath: $($parsed.dllPath))"
        } else {
            Write-Fail "DBFBridge.exe 載入 w3000_dbf.dll 失敗！錯誤訊息: $($parsed.error)"
            if ($parsed.error -match "126") {
                Write-Hint "Win32 Error 126 代表找不到相依模組！這台乾淨電腦缺少 VFP9 Runtime (vfp9r.dll / vfp9t.dll / msvcr71.dll)，請將它們放到 $agentDir 下。"
            } elseif ($parsed.error -match "CreateInstance|DllGetClassObject") {
                Write-Hint "COM 建立實例失敗！請以系統管理員執行: regsvr32 `"$agentDir\w3000_dbf.dll`" 測試註冊，或確認 VFP9 Runtime 已安裝。"
            }
            return $false
        }
    } catch {
        Write-Fail "執行 DBFBridge.exe 發生例外: $($_.Exception.Message)"
        return $false
    }

    # 2.2 測試 CHECKSUM 指令 (驗證讀取 C:\W3000\COMM\*.dbf 與 vfpencryption.fll)
    $testFile = Join-Path $script:DbfDir "$($script:TestDbfName).dbf"
    Write-Host "`n  >>> 2.2 測試 DBFBridge.exe -> CheckSum_SHA256 ($testFile)" -ForegroundColor White
    $csObj = @{
        action   = "CHECKSUM"
        filePath = $testFile
        dbfPath  = $script:DbfDir
        dbfName  = $script:TestDbfName
    } | ConvertTo-Json -Compress
    $csB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($csObj))

    try {
        $psi.Arguments = $csB64
        $proc = [System.Diagnostics.Process]::Start($psi)
        $stdout = $proc.StandardOutput.ReadToEnd()
        $proc.WaitForExit(10000) | Out-Null

        Write-Host "      原始回傳 (stdout): $($stdout.Trim())" -ForegroundColor Gray
        $parsedCs = $stdout.Trim() | ConvertFrom-Json -ErrorAction Stop
        if ($parsedCs.success -eq $true -and $parsedCs.checksum) {
            Write-Pass "成功計算 DBF SHA256 Checksum: $($parsedCs.checksum)"
            return $true
        } else {
            Write-Fail "計算 DBF Checksum 失敗！錯誤訊息: $($parsedCs.error)"
            Write-Hint "w3000_dbf.dll 內部呼叫 CheckSum_SHA256 時需要載入 vfpencryption.fll (相依 msvcr71.dll 與 msvcp71.dll)。請確認這三個檔案都在 $agentDir 或 C:\Windows\SysWOW64\ 中！"
            return $false
        }
    } catch {
        Write-Fail "解析 Checksum 回應失敗: $($_.Exception.Message)"
        return $false
    }
}

# ==============================================================================
# Step 3: 驗證 LocalAgent HTTP 服務 (Port 18889) /api/dbf/ping 與 /api/dbf/checksum
# ==============================================================================
function Invoke-Step3-LocalAgentHttpTest {
    Write-StepHeader "Step 3" "驗證 LocalAgent HTTP 服務 ($script:AgentUrl)"

    # 3.1 檢查行程與 Port 18889
    $agentProc = Get-Process -Name "Wx3000Agent", "Wx3000Agent_L2", "node" -ErrorAction SilentlyContinue
    $portListen = Get-NetTCPConnection -LocalPort 18889 -State Listen -ErrorAction SilentlyContinue

    if ($portListen) {
        Write-Pass "LocalAgent 正在監聽 TCP Port 18889 (PID: $($portListen[0].OwningProcess))"
    } else {
        Write-Fail "目前沒有任何程式監聽 TCP Port 18889 (LocalAgent 未啟動)！"
        $agentDir = Find-LocalAgentDir
        $exePath = Join-Path $agentDir "Wx3000Agent.exe"
        if (Test-Path $exePath) {
            $startAns = Read-Host "  是否要立即為您啟動 $exePath ？[Y/N]"
            if ($startAns -match "^[Yy]") {
                Start-Process -FilePath $exePath -WorkingDirectory $agentDir
                Start-Sleep -Seconds 2
            } else {
                return $false
            }
        } else {
            Write-Hint "找不到 $exePath，請先執行 Install-Wx3000.bat 安裝 LocalAgent。"
            return $false
        }
    }

    # 3.2 測試 GET /api/dbf/ping
    Write-Host "`n  >>> 3.1 呼叫 GET $script:AgentUrl/api/dbf/ping" -ForegroundColor White
    try {
        $pingResp = Invoke-RestMethod -Uri "$script:AgentUrl/api/dbf/ping" -Method Get -TimeoutSec 10
        Write-Host "      回傳 JSON: $($pingResp | ConvertTo-Json -Compress)" -ForegroundColor Gray
        if ($pingResp.success -eq $true) {
            Write-Pass "LocalAgent /api/dbf/ping 回應成功！"
        } else {
            Write-Fail "LocalAgent /api/dbf/ping 回傳失敗: $($pingResp.error)"
            if ($pingResp.error -match "snapshot") {
                Write-Hint "偵測到舊版 Wx3000Agent.exe 誤讀 pkg 虛擬路徑 (C:\snapshot\...)！"
                $newAgentSrc = Join-Path $ScriptRoot "localagent\dist"
                $destAgentDir = Join-Path $script:InstallRoot "LocalAgent"
                if (Test-Path (Join-Path $newAgentSrc "Wx3000Agent.exe")) {
                    $fixAns = Read-Host "  是否要立即用隨身碟內的新版 LocalAgent 更新 $destAgentDir 並重啟？[Y/N]"
                    if ($fixAns -match "^[Yy]") {
                        Stop-Process -Name "Wx3000Agent", "Wx3000Agent_L2", "DBFBridge", "WbaseBridge" -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 1
                        New-Item -ItemType Directory -Force -Path $destAgentDir | Out-Null
                        Copy-Item -Path "$newAgentSrc\*" -Destination $destAgentDir -Recurse -Force
                        Start-Process -FilePath (Join-Path $destAgentDir "Wx3000Agent.exe") -WorkingDirectory $destAgentDir -WindowStyle Hidden
                        Start-Sleep -Seconds 2
                        Write-Pass "已更新並重啟新版 LocalAgent，正在重新測試 /api/dbf/ping..."
                        $pingResp = Invoke-RestMethod -Uri "$script:AgentUrl/api/dbf/ping" -Method Get -TimeoutSec 10
                        Write-Host "      重試回傳 JSON: $($pingResp | ConvertTo-Json -Compress)" -ForegroundColor Gray
                        if ($pingResp.success -ne $true) { return $false }
                    } else {
                        return $false
                    }
                } else {
                    return $false
                }
            } else {
                return $false
            }
        }
    } catch {
        Write-Fail "無法連線至 $script:AgentUrl/api/dbf/ping : $($_.Exception.Message)"
        return $false
    }

    # 3.3 測試 POST /api/dbf/checksum (模擬後端 DbfSyncService.GetChecksumAsync)
    Write-Host "`n  >>> 3.2 呼叫 POST $script:AgentUrl/api/dbf/checksum (模擬後端 DbfSyncService)" -ForegroundColor White
    $fullPath = Join-Path $script:DbfDir "$($script:TestDbfName).dbf"
    $payload = @{
        filePath = $fullPath
        dbfPath  = $script:DbfDir
        dbfName  = $script:TestDbfName
    } | ConvertTo-Json -Compress

    try {
        $csResp = Invoke-RestMethod -Uri "$script:AgentUrl/api/dbf/checksum" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType "application/json; charset=utf-8" -TimeoutSec 15
        Write-Host "      回傳 JSON: $($csResp | ConvertTo-Json -Compress)" -ForegroundColor Gray
        if ($csResp.success -eq $true -and $csResp.checksum) {
            Write-Pass "LocalAgent 成功回傳 [$($script:TestDbfName).dbf] Checksum: $($csResp.checksum)"
            return $true
        } else {
            Write-Fail "LocalAgent 計算 Checksum 失敗: $($csResp.error)"
            Write-Hint "後端 DbfSyncService 若拿不到 Checksum，會記錄 Warning 並直接放棄同步！"
            return $false
        }
    } catch {
        Write-Fail "呼叫 /api/dbf/checksum 發生例外: $($_.Exception.Message)"
        return $false
    }
}

# ==============================================================================
# Step 4: 驗證 DBF 轉 PostgreSQL 腳本生成 (/api/dbf/get_pg_script STRUCT & DATA)
# ==============================================================================
function Invoke-Step4-GetPgScriptTest {
    Write-StepHeader "Step 4" "驗證 DBF 轉 PostgreSQL 腳本生成 (/api/dbf/get_pg_script)"

    foreach ($mode in @("STRUCT", "DATA")) {
        Write-Host "`n  >>> 測試生成 [$mode] 腳本 (目標: $script:DbfDir\$($script:TestDbfName).dbf -> Schema: $script:PgSchema)" -ForegroundColor White
        $payload = @{
            dbfPath   = $script:DbfDir
            dbfName   = $script:TestDbfName
            mode      = $mode
            schema    = $script:PgSchema
            table     = $script:TestDbfName
            keyFields = "no"
            hexFields = ""
        } | ConvertTo-Json -Compress

        try {
            $resp = Invoke-RestMethod -Uri "$script:AgentUrl/api/dbf/get_pg_script" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType "application/json; charset=utf-8" -TimeoutSec 30
            if ($resp.success -eq $true -and -not [string]::IsNullOrWhiteSpace($resp.script)) {
                $lines = $resp.script -split "`r?`n"
                Write-Pass "[$mode] SQL 腳本生成成功！(共 $($resp.script.Length) 字元, $($lines.Count) 行)"
                $previewCount = [Math]::Min(6, $lines.Count)
                Write-Host "      --- SQL 腳本前 $previewCount 行預覽 ---" -ForegroundColor DarkCyan
                for ($i = 0; $i -lt $previewCount; $i++) {
                    $lineText = $lines[$i]
                    if ($lineText.Length -gt 110) { $lineText = $lineText.Substring(0, 110) + "..." }
                    Write-Host "      $lineText" -ForegroundColor Gray
                }
            } else {
                Write-Fail "[$mode] 腳本生成失敗或為空！錯誤訊息: $($resp.error)"
                return $false
            }
        } catch {
            Write-Fail "呼叫 /api/dbf/get_pg_script ($mode) 失敗: $($_.Exception.Message)"
            return $false
        }
    }
    return $true
}

# ==============================================================================
# Step 5: 驗證 PostgreSQL 服務 (Port 54320)、資料庫連線與 dictionary.w3000_dbf 狀態
# ==============================================================================
function Invoke-Step5-PostgresCheck {
    Write-StepHeader "Step 5" "驗證 PostgreSQL ($($script:PgHost):$($script:PgPort), DB: $script:PgDb) 與字典表狀態"

    # 5.1 檢查 Port 54320
    $pgListen = Get-NetTCPConnection -LocalPort $script:PgPort -State Listen -ErrorAction SilentlyContinue
    if ($pgListen) {
        Write-Pass "PostgreSQL 正在監聽 TCP Port $script:PgPort (PID: $($pgListen[0].OwningProcess))"
    } else {
        Write-Fail "TCP Port $script:PgPort 沒有任何程式監聽！PostgreSQL 未啟動或 Port 設定非 $script:PgPort。"
        $pgSvcs = Get-Service | Where-Object { $_.Name -match "postgres|A3000PG" -or $_.DisplayName -match "PostgreSQL" }
        if ($pgSvcs) {
            foreach ($s in $pgSvcs) {
                Write-Host "      偵測到服務: $($s.Name) ($($s.DisplayName)) - 狀態: $($s.Status)" -ForegroundColor Yellow
            }
        } else {
            Write-Hint "這台新電腦尚未安裝 PostgreSQL，或尚未啟動服務！"
        }
        return $false
    }

    # 5.2 使用 psql.exe 檢查 w3000 資料庫、dictionary.w3000_dbf 與 c:/w3000/comm Schema
    $psqlExe = Find-PsqlExe
    if (-not $psqlExe) {
        Write-Warn "未在本機預設路徑找到 psql.exe，略過直接 SQL 查詢 (將在 Step 6 透過後端 API 驗證)。"
        return $true
    }

    Write-Host "`n  >>> 使用 $psqlExe 檢查資料庫 [$script:PgDb] 與同步字典表..." -ForegroundColor White
    $env:PGPASSWORD = $script:PgPass
    try {
        # 檢查資料庫是否存在
        $dbCheck = & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d "postgres" -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$script:PgDb';" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "連線 PostgreSQL 失敗: $dbCheck"
            Write-Hint "請檢查帳號 ($script:PgUser) 與密碼是否與 backend\appsettings.json 一致！"
            return $false
        }
        if ($dbCheck -notmatch "1") {
            Write-Fail "PostgreSQL 內尚未建立資料庫 [$script:PgDb]！"
            $createAns = Read-Host "  是否要立即為您建立空的 [$script:PgDb] 資料庫？[Y/N]"
            if ($createAns -match "^[Yy]") {
                & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d "postgres" -c "CREATE DATABASE `"$script:PgDb`" WITH ENCODING 'UTF8';"
                Write-Pass "已建立資料庫 [$script:PgDb]！"
            } else {
                return $false
            }
        } else {
            Write-Pass "成功連線至 PostgreSQL 且資料庫 [$script:PgDb] 存在。"
        }

        # 查詢 dictionary.w3000_dbf 內容
        Write-Host "`n  >>> 查詢 dictionary.w3000_dbf 已記錄的同步校驗碼:" -ForegroundColor White
        $dictSql = "SELECT path, dbf, left(checksum, 16) || '...' AS checksum_prefix FROM dictionary.w3000_dbf ORDER BY dbf;"
        $dictOut = & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d $script:PgDb -c $dictSql 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dictOut | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        } else {
            Write-Warn "dictionary.w3000_dbf 尚未建立 (代表後端尚未執行過任何一次 EnsureTableSyncedAsync)。"
        }

        # 查詢 c:/w3000/comm Schema 下的資料表
        Write-Host "`n  >>> 查詢 Schema [`"$script:PgSchema`"] 下的已同步資料表:" -ForegroundColor White
        $tblSql = "SELECT table_name FROM information_schema.tables WHERE table_schema = '$script:PgSchema' ORDER BY table_name;"
        $tblOut = & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d $script:PgDb -t -A -c $tblSql 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($tblOut)) {
            $tables = $tblOut -split "`r?`n" | Where-Object { $_ -ne "" }
            Write-Pass "Schema [`"$script:PgSchema`"] 目前共有 $($tables.Count) 張資料表: $($tables -join ', ')"
        } else {
            Write-Warn "Schema [`"$script:PgSchema`"] 目前沒有任何資料表！"
            Write-Hint "如果上面 dictionary.w3000_dbf 卻有紀錄，代表資料庫曾被清空但校驗碼殘留，請使用主選單 [D1] 清除 dictionary.w3000_dbf 強制重灌！"
        }
        return $true
    } finally {
        $env:PGPASSWORD = $null
    }
}

# ==============================================================================
# Step 6: 驗證後端 API (Wx3000.Backend) 端到端觸發 DBF -> PostgreSQL 同步
# ==============================================================================
function Invoke-Step6-BackendEndToEndTest {
    Resolve-ActiveApiPort | Out-Null
    $apiUrl = "http://localhost:$($script:ApiPort)"
    Write-StepHeader "Step 6" "驗證後端服務 ($apiUrl) 端到端觸發 DBF 同步"

    $apiListen = Get-NetTCPConnection -LocalPort $script:ApiPort -State Listen -ErrorAction SilentlyContinue
    if ($apiListen) {
        Write-Pass "後端 API 正在監聽 TCP Port $($script:ApiPort) (PID: $($apiListen[0].OwningProcess))"
    } else {
        Write-Fail "後端 API 未在 Port 5007 或 5000 監聽！(Wx3000Api 服務未啟動)"
        Write-Hint "請使用選單 [D3] 在前景啟動後端觀察錯誤訊息，或啟動 Wx3000Api 服務。"
        return $false
    }

    # 呼叫 /api/wbase1050 (對應 C:\w3000\comm\taxno.dbf) 與 /api/wbase1020 (對應 comp.dbf)
    $endpoints = @(
        @{ Path = "/api/wbase1050"; Dbf = "taxno.dbf"; Desc = "稅務人員維護 (Wbase1050)" },
        @{ Path = "/api/wbase1020"; Dbf = "comp.dbf";  Desc = "公司基本資料 (Wbase1020)" }
    )

    foreach ($ep in $endpoints) {
        Write-Host "`n  >>> 呼叫 GET $apiUrl$($ep.Path) -> 觸發同步 $($ep.Dbf) ($($ep.Desc))" -ForegroundColor White
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $res = Invoke-RestMethod -Uri "$apiUrl$($ep.Path)" -Method Get -TimeoutSec 60
            $sw.Stop()
            $count = if ($res -is [Array]) { $res.Count } elseif ($res) { 1 } else { 0 }
            Write-Pass "API 回應成功 (耗時 $($sw.ElapsedMilliseconds) ms)，PostgreSQL 回傳 $count 筆資料！"
            if ($count -eq 0) {
                Write-Warn "API 回傳 0 筆資料！若地端 $($ep.Dbf) 明明有資料，表示後端 EnsureTableSyncedAsync 同步失敗（系統退回空表）或字典表 Checksum 殘留。"
                Write-Hint "請先執行選單 [D1] 清空 dictionary.w3000_dbf，或執行 [D2] 直接測試將 SQL 腳本灌入 PostgreSQL 查看具體 SQL 錯誤！"
            }
        } catch {
            Write-Fail "呼叫 $apiUrl$($ep.Path) 失敗: $($_.Exception.Message)"
            if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
                Write-Host "      後端詳細錯誤: $($_.ErrorDetails.Message)" -ForegroundColor Red
            }
            return $false
        }
    }
    return $true
}

# ==============================================================================
# 除錯工具 [D1]: 清除 PostgreSQL dictionary.w3000_dbf 快照校驗碼 (強制下次重新同步)
# ==============================================================================
function Invoke-Debug1-ClearChecksumDictionary {
    Write-StepHeader "除錯 D1" "清除 PostgreSQL [dictionary.w3000_dbf] 校驗碼快取 (強制重灌快照)"
    $psqlExe = Find-PsqlExe
    if (-not $psqlExe) {
        Write-Fail "找不到 psql.exe，無法直接執行 SQL 清除。"
        Write-Hint "請開啟 pgAdmin 連線至 localhost:54320 (資料庫 w3000)，執行: DELETE FROM dictionary.w3000_dbf;"
        return
    }

    $env:PGPASSWORD = $script:PgPass
    try {
        $out = & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d $script:PgDb -c "DELETE FROM dictionary.w3000_dbf;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "已清空 dictionary.w3000_dbf ($out)！"
            Write-Host "  現在正在重新呼叫後端 API 觸發強制全量同步..." -ForegroundColor Cyan
            Invoke-Step6-BackendEndToEndTest | Out-Null
        } else {
            Write-Fail "執行 DELETE 失敗: $out"
        }
    } finally {
        $env:PGPASSWORD = $null
    }
}

# ==============================================================================
# 除錯工具 [D2]: 手動從 LocalAgent 取出 SQL 腳本並直接餵給 psql.exe (抓出 SQL 語法/型別錯誤)
# ==============================================================================
function Invoke-Debug2-ManualSqlImportDebug {
    Write-StepHeader "除錯 D2" "手動抽取出 [$($script:TestDbfName).dbf] 的 SQL 腳本並直接匯入 PostgreSQL 測試"
    $psqlExe = Find-PsqlExe
    if (-not $psqlExe) {
        Write-Fail "本機找不到 psql.exe，無法執行單步 SQL 匯入測試。"
        return
    }

    $tempDir = Join-Path $env:TEMP "Wx3000_DbfDebug"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    foreach ($mode in @("STRUCT", "DATA")) {
        $payload = @{
            dbfPath   = $script:DbfDir
            dbfName   = $script:TestDbfName
            mode      = $mode
            schema    = $script:PgSchema
            table     = $script:TestDbfName
            keyFields = "no"
            hexFields = ""
        } | ConvertTo-Json -Compress

        Write-Host "`n  >>> 1. 從 LocalAgent 取得 [$mode] 腳本..." -ForegroundColor White
        try {
            $resp = Invoke-RestMethod -Uri "$script:AgentUrl/api/dbf/get_pg_script" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType "application/json; charset=utf-8" -TimeoutSec 30
            if (-not $resp.script) {
                Write-Fail "LocalAgent 未回傳 script: $($resp.error)"
                return
            }

            $sqlText = $resp.script
            if ($mode -eq "DATA") {
                # 同步後端 DbfSyncService.cs 的數值溢位防呆處理 (將連續星號 **** 替換為 0)
                $sqlText = [System.Text.RegularExpressions.Regex]::Replace($sqlText, "(?<=[\(,])\s*\*+\s*(?=[,\)])", "0")
            }

            $sqlFile = Join-Path $tempDir "$($script:TestDbfName)_$($mode).sql"
            [System.IO.File]::WriteAllText($sqlFile, $sqlText, (New-Object System.Text.UTF8Encoding($false)))
            Write-Pass "已將 [$mode] 腳本儲存至: $sqlFile"

            Write-Host "  >>> 2. 使用 psql.exe 執行 $sqlFile ..." -ForegroundColor White
            $env:PGPASSWORD = $script:PgPass
            $psqlOut = & $psqlExe -h $script:PgHost -p $script:PgPort -U $script:PgUser -d $script:PgDb -v ON_ERROR_STOP=1 -f $sqlFile 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Pass "[$mode] 腳本於 PostgreSQL 執行成功！"
            } else {
                Write-Fail "[$mode] 腳本執行發生 SQL 錯誤 (這就是同步失敗的原因！):"
                $psqlOut | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
                Write-Hint "您可以打開 $sqlFile 檢視出錯行數的 SQL 內容。"
                return
            }
        } catch {
            Write-Fail "執行發生例外: $($_.Exception.Message)"
            return
        } finally {
            $env:PGPASSWORD = $null
        }
    }
}

# ==============================================================================
# 除錯工具 [D3]: 以 Console 前景除錯模式啟動後端或 LocalAgent (即時觀看 Log)
# ==============================================================================
function Stop-PortProcesses([int]$port) {
    for ($retry = 0; $retry -lt 5; $retry++) {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if (-not $conns) { return $true }
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 4) {
                $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
                Write-Host "      正在釋放 Port $port 佔用行程: PID $($c.OwningProcess) ($($p.ProcessName))..." -ForegroundColor Yellow
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
    }
    $stillListen = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return (-not $stillListen)
}

function Invoke-Debug3-ForegroundConsole {
    Write-StepHeader "除錯 D3" "啟動前景 Console 即時除錯視窗 (觀看即時 Log 與 Exception StackTrace)"
    Write-Host "  [1] 前景啟動 LocalAgent (Wx3000Agent.exe) - 觀察 Port 18889 與 DBFBridge 呼叫 Log"
    Write-Host "  [2] 前景啟動 後端伺服器 (Wx3000.Backend.exe) - 觀察 [DbfSync] 同步 Log 與資料庫錯誤"
    Write-Host "  [3] 結束前景除錯視窗，並恢復啟動背景 Wx3000Api 服務與 LocalAgent"
    Write-Host "  [Q] 取消返回"
    $sub = Read-Host "`n請選擇要執行的項目 [1/2/3/Q]"

    if ($sub -eq "1") {
        $agentDir = Find-LocalAgentDir
        $exe = Join-Path $agentDir "Wx3000Agent.exe"
        if (-not (Test-Path $exe)) {
            Write-Fail "找不到 $exe"
            return
        }
        Write-Host "正在停止背景 Wx3000Agent 行程並釋放 Port 18889..." -ForegroundColor Yellow
        Stop-Service -Name "Wx3000Agent" -Force -ErrorAction SilentlyContinue
        Stop-Process -Name "Wx3000Agent", "Wx3000Agent_L2" -Force -ErrorAction SilentlyContinue
        if (-not (Stop-PortProcesses 18889)) {
            Write-Fail "無法釋放 TCP Port 18889，請確認是否有其他程式佔用！"
            return
        }
        Write-Pass "TCP Port 18889 已完全釋放！"
        Write-Host "正在開啟新 Console 視窗執行 $exe ..." -ForegroundColor Green
        Start-Process cmd.exe -ArgumentList "/k `"cd /d `"$agentDir`" && title Wx3000 LocalAgent Debug Console && `"$exe`"`""
    }
    elseif ($sub -eq "2") {
        $apiCandidates = @(
            (Join-Path $script:InstallRoot "Server\api\Wx3000.Backend.exe"),
            (Join-Path $ScriptRoot "Wx3000_Server\api\Wx3000.Backend.exe"),
            (Join-Path $ScriptRoot "backend\Release\Wx3000.Backend.exe")
        )
        $apiExe = $null
        foreach ($c in $apiCandidates) {
            if (Test-Path $c) { $apiExe = $c; break }
        }
        if (-not $apiExe) {
            Write-Fail "找不到 Wx3000.Backend.exe！"
            return
        }
        $apiDir = Split-Path -Parent $apiExe
        Write-Host "正在停止背景 Wx3000Api Windows 服務 (需先停止服務避免自動重啟搶佔 Port 5007)..." -ForegroundColor Yellow
        $svc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne "Stopped") {
            Stop-Service -Name "Wx3000Api" -Force -ErrorAction SilentlyContinue
            for ($i = 0; $i -lt 10; $i++) {
                $svc.Refresh()
                if ($svc.Status -eq "Stopped") { break }
                Start-Sleep -Seconds 1
            }
        }
        Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
        if (-not (Stop-PortProcesses 5007)) {
            Write-Fail "TCP Port 5007 仍被佔用，無法啟動前景除錯視窗！"
            return
        }
        Write-Pass "Wx3000Api 背景服務已停止，TCP Port 5007 已完全釋放！"
        Write-Host "正在開啟新 Console 視窗執行 $apiExe (觀察 [DbfSync] 開頭的即時 Log)..." -ForegroundColor Green
        Write-Host "💡 提示: 啟動時印出 CREATE TABLE ... buyinv 為正常的資料庫結構初始化檢查，看到 Now listening on: http://0.0.0.0:5007 即代表啟動成功！" -ForegroundColor Cyan
        Start-Process cmd.exe -ArgumentList "/k `"cd /d `"$apiDir`" && title Wx3000 Backend Debug Console && `"$apiExe`"`""
    }
    elseif ($sub -eq "3") {
        Write-Host "正在關閉前景除錯行程並恢復背景服務..." -ForegroundColor Yellow
        Stop-Process -Name "Wx3000.Backend", "Wx3000Agent", "Wx3000Agent_L2" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        $svc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
        if ($svc) {
            Start-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
            Write-Pass "已重新啟動 Wx3000Api 背景服務！"
        }

        $agentDir = Find-LocalAgentDir
        $vbs = Join-Path $agentDir "Start-LocalAgent-Hidden.vbs"
        $agentExe = Join-Path $agentDir "Wx3000Agent.exe"
        if (Test-Path $vbs) {
            Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`"" -WorkingDirectory $agentDir
            Write-Pass "已重新在背景啟動 LocalAgent！"
        } elseif (Test-Path $agentExe) {
            Start-Process -FilePath $agentExe -WorkingDirectory $agentDir -WindowStyle Hidden
            Write-Pass "已重新在背景啟動 LocalAgent！"
        }
    }
}

# ==============================================================================
# 主選單迴圈
# ==============================================================================
:MenuLoop while ($true) {
    Clear-Host
    Resolve-ActiveApiPort | Out-Null
    $agentDir = Find-LocalAgentDir

    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host "       Wx3000 地端 DBF (C:\W3000\COMM) <-> PostgreSQL 同步單步驗證與除錯工具    " -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " 地端 DBF 路徑   : $script:DbfDir (測試檔: $($script:TestDbfName).dbf)" -ForegroundColor Yellow
    Write-Host " LocalAgent 目錄 : $agentDir ($script:AgentUrl)" -ForegroundColor Gray
    Write-Host " PostgreSQL 連線 : $($script:PgHost):$($script:PgPort) / DB: $script:PgDb / Schema: `"$script:PgSchema`"" -ForegroundColor Gray
    Write-Host " 後端 API 網址   : http://localhost:$($script:ApiPort)" -ForegroundColor Gray
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 【一、一鍵全流程與單步驗證 (Step-by-Step Verification)】" -ForegroundColor Green
    Write-Host "   [A] ★ 依序單步執行 [Step 1 ~ Step 6] 完整同步鏈路診斷 (推薦！)" -ForegroundColor Yellow
    Write-Host "   [1] Step 1 : 檢查 C:\W3000\COMM、LocalAgent 檔案與 VFP9 Runtime 相依 DLL"
    Write-Host "   [2] Step 2 : 單步直接執行 DBFBridge.exe (略過網路層，直接測 w3000_dbf.dll 載入)"
    Write-Host "   [3] Step 3 : 測試 LocalAgent (Port 18889) /api/dbf/ping 與 Checksum 計算"
    Write-Host "   [4] Step 4 : 測試 LocalAgent 產出 PostgreSQL 建表 (STRUCT) 與資料 (DATA) 腳本"
    Write-Host "   [5] Step 5 : 檢查 PostgreSQL (Port 54320) 連線、dictionary.w3000_dbf 與資料表"
    Write-Host "   [6] Step 6 : 測試後端 API (Port $($script:ApiPort)) 端到端觸發同步並檢視回傳筆數"
    Write-Host ""
    Write-Host " 【二、進階除錯與強制修復工具 (Debug & Fix Actions)】" -ForegroundColor Magenta
    Write-Host "   [D1] 清除 PostgreSQL [dictionary.w3000_dbf] 校驗碼快取 (強制重新全量同步)"
    Write-Host "   [D2] 手動抽取 [$($script:TestDbfName).dbf] SQL 腳本並直接匯入 PostgreSQL (抓取 SQL 錯誤)"
    Write-Host "   [D3] 開啟前景 Console 除錯視窗 (即時觀看 LocalAgent 或 Backend 錯誤 Log)"
    Write-Host "   [S]  變更測試 DBF 檔名或路徑設定 (目前: $script:DbfDir\$($script:TestDbfName).dbf)"
    Write-Host "   [Q]  離開診斷工具"
    Write-Host "==============================================================================" -ForegroundColor Cyan

    $rawChoice = Read-Host "請輸入選項代號 [A, 1-6, D1-D3, S, Q]"
    $choice = if ($rawChoice) { $rawChoice.Trim().ToUpper() } else { "" }

    switch ($choice) {
        "A" {
            $s1 = Invoke-Step1-FileAndRuntimeCheck
            if (-not (Pause-Step $true)) { continue }

            $s2 = Invoke-Step2-DirectDbfBridgeTest
            if (-not (Pause-Step $true)) { continue }

            $s3 = Invoke-Step3-LocalAgentHttpTest
            if (-not (Pause-Step $true)) { continue }

            $s4 = Invoke-Step4-GetPgScriptTest
            if (-not (Pause-Step $true)) { continue }

            $s5 = Invoke-Step5-PostgresCheck
            if (-not (Pause-Step $true)) { continue }

            $s6 = Invoke-Step6-BackendEndToEndTest

            Write-Host ""
            Write-Host "==============================================================================" -ForegroundColor Cyan
            Write-Host "                         【全流程診斷總結報告】                               " -ForegroundColor Cyan
            Write-Host "==============================================================================" -ForegroundColor Cyan
            Write-Host ("  Step 1 (檔案與 VFP9 Runtime) : " + $(if ($s1) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s1) { "Green" } else { "Red" })
            Write-Host ("  Step 2 (DBFBridge 直接載入)  : " + $(if ($s2) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s2) { "Green" } else { "Red" })
            Write-Host ("  Step 3 (LocalAgent Checksum) : " + $(if ($s3) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s3) { "Green" } else { "Red" })
            Write-Host ("  Step 4 (生成 PG SQL 腳本)    : " + $(if ($s4) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s4) { "Green" } else { "Red" })
            Write-Host ("  Step 5 (PostgreSQL 資料庫)   : " + $(if ($s5) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s5) { "Green" } else { "Red" })
            Write-Host ("  Step 6 (後端端到端 API 同步) : " + $(if ($s6) { "PASS" } else { "FAIL" })) -ForegroundColor $(if ($s6) { "Green" } else { "Red" })
            Pause-Step $false | Out-Null
        }
        "1" { Invoke-Step1-FileAndRuntimeCheck | Out-Null; Pause-Step $false | Out-Null }
        "2" { Invoke-Step2-DirectDbfBridgeTest  | Out-Null; Pause-Step $false | Out-Null }
        "3" { Invoke-Step3-LocalAgentHttpTest   | Out-Null; Pause-Step $false | Out-Null }
        "4" { Invoke-Step4-GetPgScriptTest      | Out-Null; Pause-Step $false | Out-Null }
        "5" { Invoke-Step5-PostgresCheck        | Out-Null; Pause-Step $false | Out-Null }
        "6" { Invoke-Step6-BackendEndToEndTest  | Out-Null; Pause-Step $false | Out-Null }
        "D1" { Invoke-Debug1-ClearChecksumDictionary; Pause-Step $false | Out-Null }
        "D2" { Invoke-Debug2-ManualSqlImportDebug;    Pause-Step $false | Out-Null }
        "D3" { Invoke-Debug3-ForegroundConsole;       Pause-Step $false | Out-Null }
        "S" {
            Write-Host ""
            $newDir = Read-Host "請輸入 DBF 目錄路徑 (直接按 Enter 維持 $script:DbfDir)"
            if ($newDir.Trim() -ne "") { $script:DbfDir = $newDir.Trim() }
            $newDbf = Read-Host "請輸入要測試的 DBF 檔名，不含副檔名 (例如 comp, keyin, taxno，按 Enter 維持 $script:TestDbfName)"
            if ($newDbf.Trim() -ne "") { $script:TestDbfName = [System.IO.Path]::GetFileNameWithoutExtension($newDbf.Trim()).ToLower() }
        }
        { $_ -in "Q", "QUIT", "EXIT" } {
            Write-Host "已離開診斷工具。" -ForegroundColor Cyan
            break MenuLoop
        }
        default {
            Write-Host "無效的選項，請重新輸入。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
