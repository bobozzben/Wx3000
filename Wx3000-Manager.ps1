#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = $PSScriptRoot
if (-not $RootDir) {
    $RootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location $RootDir

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ServiceStatusText([string]$svcName) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if (-not $svc) { return "未安裝 (Not Installed)" }
    if ($svc.Status -eq "Running") { return "運行中 (Running)" }
    return "$($svc.Status)"
}

function Open-InEditor([string]$targetPath) {
    $fullPath = Join-Path $RootDir $targetPath
    if (Get-Command "code" -ErrorAction SilentlyContinue) {
        Write-Host "正在使用 VS Code 開啟: $fullPath" -ForegroundColor Cyan
        Start-Process "code" -ArgumentList "`"$fullPath`""
    } else {
        Write-Host "正在開啟檔案總管: $fullPath" -ForegroundColor Cyan
        Invoke-Item $fullPath
    }
}

function Pause-Return {
    Write-Host ""
    Read-Host "執行完畢，請按 Enter 鍵返回主選單"
}

function Stop-Wx3000ApiSafely {
    $svc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        if (-not (Test-IsAdmin)) {
            Write-Host "[提示] 偵測到 Wx3000Api 服務正在運行，需要系統管理員權限停止服務以解除檔案鎖定..." -ForegroundColor Yellow
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"Stop-Service -Name 'Wx3000Api' -Force`"" -Verb RunAs -Wait
        } else {
            Write-Host "正在停止 Wx3000Api 服務..." -ForegroundColor Yellow
            Stop-Service -Name "Wx3000Api" -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
    # 確保沒有殘留的 Wx3000.Backend 處理程序鎖住檔案
    $proc = Get-Process -Name "Wx3000.Backend" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "正在結束殘留的 Wx3000.Backend 處理程序..." -ForegroundColor Yellow
        Stop-Process -Name "Wx3000.Backend" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

function Start-Wx3000ApiSafely {
    $svc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
    if ($svc) {
        if (-not (Test-IsAdmin)) {
            Write-Host "[提示] 正在請求系統管理員權限啟動 Wx3000Api 服務..." -ForegroundColor Yellow
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"Start-Service -Name 'Wx3000Api'`"" -Verb RunAs -Wait
        } else {
            Write-Host "正在啟動 Wx3000Api 服務..." -ForegroundColor Green
            Start-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
        $svcAfter = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
        Write-Host "Wx3000Api 服務目前狀態: $($svcAfter.Status)" -ForegroundColor Green
    } else {
        Write-Host "[提醒] Wx3000Api 尚未安裝為 Windows 服務，檔案已更新至 publish\Wx3000_Server\api。" -ForegroundColor Yellow
    }
}

function Find-LazBuild {
    if ($env:LAZBUILD -and (Test-Path $env:LAZBUILD)) { return $env:LAZBUILD }
    $cmd = Get-Command "lazbuild" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @("C:\fpcupdeluxe\lazarus\lazbuild.exe", "C:\lazarus\lazbuild.exe", "C:\Program Files\Lazarus\lazbuild.exe")) {
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

# 讀取 PE 檔匯出表的函數名稱 (支援 32/64-bit)
function Get-DllExportNames([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
    $sectionCount = [BitConverter]::ToUInt16($bytes, $peOffset + 6)
    $optionalSize = [BitConverter]::ToUInt16($bytes, $peOffset + 20)
    $optional = $peOffset + 24
    $isPe32Plus = [BitConverter]::ToUInt16($bytes, $optional) -eq 0x20B
    $exportRva = [BitConverter]::ToUInt32($bytes, $(if ($isPe32Plus) { $optional + 112 } else { $optional + 96 }))
    if ($exportRva -eq 0) { return @() }
    $sectionTable = $optional + $optionalSize
    $toOffset = {
        param([long]$Rva)
        for ($i = 0; $i -lt $sectionCount; $i++) {
            $section = $sectionTable + $i * 40
            $virtualAddress = [long][BitConverter]::ToUInt32($bytes, $section + 12)
            $size = [Math]::Max([long][BitConverter]::ToUInt32($bytes, $section + 8), [long][BitConverter]::ToUInt32($bytes, $section + 16))
            if ($Rva -ge $virtualAddress -and $Rva -lt $virtualAddress + $size) {
                return [int]($Rva - $virtualAddress + [BitConverter]::ToUInt32($bytes, $section + 20))
            }
        }
        return -1
    }
    $exportDir = & $toOffset $exportRva
    $nameCount = [BitConverter]::ToUInt32($bytes, $exportDir + 24)
    $nameTable = & $toOffset ([BitConverter]::ToUInt32($bytes, $exportDir + 32))
    for ($i = 0; $i -lt $nameCount; $i++) {
        $nameOffset = & $toOffset ([BitConverter]::ToUInt32($bytes, $nameTable + $i * 4))
        $end = [Array]::IndexOf($bytes, [byte]0, $nameOffset)
        [Text.Encoding]::ASCII.GetString($bytes, $nameOffset, $end - $nameOffset)
    }
}

# 以 Lazarus 編譯 64-bit 報表 DLL，確認 dlls.json 登記的函數都有匯出後，才覆蓋 localagent\wbase\wbaseRP.dll
function Build-WbaseReportDll {
    $lazbuild = Find-LazBuild
    if (-not $lazbuild) {
        Write-Host "[錯誤] 找不到 lazbuild.exe，請安裝 Lazarus，或設定環境變數 LAZBUILD 指向 lazbuild.exe。" -ForegroundColor Red
        return $false
    }
    $projectFile = Join-Path $RootDir "report\wbase\wbaseRP.lpi"
    $builtDll = Join-Path $RootDir "report\wbase\wbaseRP.dll"
    $targetDll = Join-Path $RootDir "localagent\wbase\wbaseRP.dll"
    $startTime = Get-Date

    # 沿用專案現行的 Debug 建置模式，與目前發佈的 DLL 相同
    Write-Host "[步驟 1/3] 使用 $lazbuild 編譯 64-bit wbaseRP.dll ..." -ForegroundColor Cyan
    & $lazbuild --bm=Debug --cpu=x86_64 --os=win64 --no-write-project $projectFile | Out-Host
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $builtDll) -or (Get-Item $builtDll).LastWriteTime -lt $startTime) {
        Write-Host "[錯誤] wbaseRP.dll 編譯失敗，請檢查上方 Lazarus 編譯訊息！" -ForegroundColor Red
        return $false
    }

    Write-Host "[步驟 2/3] 檢查 dlls.json 登記的報表函數是否都已匯出..." -ForegroundColor Cyan
    $dllConfig = Get-Content -Path (Join-Path $RootDir "localagent\dlls.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $required = @($dllConfig.dlls.wbaseRP.functions.PSObject.Properties.Name)
    $exported = @(Get-DllExportNames $builtDll)
    $missing = @($required | Where-Object { $exported -notcontains $_ })
    if ($missing.Count -gt 0) {
        Write-Host "[錯誤] 新的 wbaseRP.dll 缺少函數: $($missing -join ', ')，未覆蓋 localagent\wbase。" -ForegroundColor Red
        return $false
    }
    Write-Host "      已匯出 $($exported.Count) 個函數: $($exported -join ', ')" -ForegroundColor Gray

    Write-Host "[步驟 3/3] 複製至 $targetDll ..." -ForegroundColor Cyan
    try {
        Copy-Item -Path $builtDll -Destination $targetDll -Force -ErrorAction Stop
    } catch {
        Write-Host "[錯誤] 無法覆蓋 $targetDll，請關閉報表預覽視窗與 LocalAgent 後重試: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    Write-Host "[完成] wbaseRP.dll 已更新至 $targetDll" -ForegroundColor Green
    return $true
}

# 以 Release 模式編譯 64-bit WbaseBridge (Debug 模式的 heaptrc 會把記憶體傾印混進輸出)，
# 試跑確認能載入 wbaseRP.dll 後，覆蓋 build.ps1 優先打包的 bridge\lazarus\WbaseBridge.exe
function Build-WbaseBridge {
    $lazbuild = Find-LazBuild
    if (-not $lazbuild) {
        Write-Host "[錯誤] 找不到 lazbuild.exe，請安裝 Lazarus，或設定環境變數 LAZBUILD 指向 lazbuild.exe。" -ForegroundColor Red
        return $false
    }
    $bridgeDir = Join-Path $RootDir "localagent\bridge\lazarus"
    $projectFile = Join-Path $bridgeDir "WbaseBridge_Generic.lpi"
    $builtExe = Join-Path $bridgeDir "WbaseBridge_Generic.exe"
    $reportDll = Join-Path $RootDir "localagent\wbase\wbaseRP.dll"
    $startTime = Get-Date

    Write-Host "[步驟 1/3] 使用 $lazbuild 編譯 64-bit WbaseBridge (Release) ..." -ForegroundColor Cyan
    & $lazbuild --bm=Release --cpu=x86_64 --os=win64 --no-write-project $projectFile | Out-Host
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $builtExe) -or (Get-Item $builtExe).LastWriteTime -lt $startTime) {
        Write-Host "[錯誤] WbaseBridge 編譯失敗，請檢查上方 Lazarus 編譯訊息！" -ForegroundColor Red
        return $false
    }

    # 以不存在的函數名稱試跑：能載入報表 DLL 並回報找不到函數，代表位元數與相依元件正確，且不會開啟預覽視窗
    Write-Host "[步驟 2/3] 試跑新 WbaseBridge 載入 wbaseRP.dll ..." -ForegroundColor Cyan
    $probe = New-Object System.Diagnostics.Process
    $probe.StartInfo.FileName = $builtExe
    $probe.StartInfo.Arguments = "--dll `"$reportDll`" --func __wx3000_probe__ --args [1,0,0,0,1,0]"
    $probe.StartInfo.UseShellExecute = $false
    $probe.StartInfo.RedirectStandardOutput = $true
    $probe.StartInfo.CreateNoWindow = $true
    [void]$probe.Start()
    $probeOutput = $probe.StandardOutput.ReadToEndAsync()
    if (-not $probe.WaitForExit(30000)) {
        $probe.Kill()
        Write-Host "[錯誤] WbaseBridge 試跑逾時，未覆蓋現有版本。" -ForegroundColor Red
        return $false
    }
    $output = $probeOutput.Result.Trim()
    if ($probe.ExitCode -ne 4 -or $output -notmatch 'GetProcAddress __wx3000_probe__') {
        Write-Host "[錯誤] WbaseBridge 試跑結果異常 (Exit=$($probe.ExitCode)): $output，未覆蓋現有版本。" -ForegroundColor Red
        return $false
    }
    Write-Host "      試跑正常: $output" -ForegroundColor Gray

    Write-Host "[步驟 3/3] 覆蓋 bridge\lazarus\WbaseBridge.exe 與 localagent\WbaseBridge.exe ..." -ForegroundColor Cyan
    try {
        foreach ($target in @((Join-Path $bridgeDir "WbaseBridge.exe"), (Join-Path $RootDir "localagent\WbaseBridge.exe"))) {
            Copy-Item -Path $builtExe -Destination $target -Force -ErrorAction Stop
        }
    } catch {
        Write-Host "[錯誤] 無法覆蓋 WbaseBridge.exe，請關閉報表預覽視窗與 LocalAgent 後重試: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    Write-Host "[完成] WbaseBridge.exe 已更新" -ForegroundColor Green
    return $true
}

# 發佈新版本：本機編譯報表元件 ➔ 推送 tag 由 CI 建立草稿 Release ➔ 補傳報表元件 ➔ 正式發佈
# 報表 DLL 與橋接程式無法在 CI 編譯，草稿階段各機器的自動更新抓不到，補檔後才正式發佈
function Publish-Wx3000Release {
    foreach ($tool in @("git", "gh")) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            Write-Host "[錯誤] 找不到 $tool 指令，請先安裝。" -ForegroundColor Red
            return $false
        }
    }
    gh auth status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[錯誤] GitHub CLI 尚未登入，請先執行 gh auth login。" -ForegroundColor Red
        return $false
    }
    $repo = gh repo view --json nameWithOwner --jq .nameWithOwner
    if ($LASTEXITCODE -ne 0 -or -not $repo) {
        Write-Host "[錯誤] 無法取得 GitHub 倉庫名稱，請確認專案的 origin 指向 GitHub。" -ForegroundColor Red
        return $false
    }

    # 報表元件要從與發佈版本相同的原始碼編譯，因此本機必須就是 GitHub main 的最新提交
    Write-Host "[步驟 1/7] 檢查本機與 GitHub main 是否一致..." -ForegroundColor Cyan
    git -C $RootDir fetch origin main --tags 2>&1 | Out-Host
    $head = git -C $RootDir rev-parse HEAD
    $remoteMain = git -C $RootDir rev-parse origin/main
    if ($head -ne $remoteMain) {
        Write-Host "[錯誤] 本機目前的提交 ($($head.Substring(0, 7))) 不是 GitHub main 的最新提交 ($($remoteMain.Substring(0, 7)))。" -ForegroundColor Red
        Write-Host "        請先切換到 main 並執行 git pull，再重新發佈。" -ForegroundColor Yellow
        return $false
    }
    $dirty = @(git -C $RootDir status --porcelain -- report localagent/bridge localagent/dlls.json ':(exclude)report/wbase/lib' ':(exclude)localagent/bridge/lazarus/lib')
    if ($dirty.Count -gt 0) {
        Write-Host "[錯誤] 報表或橋接程式原始碼有未提交的修改，編譯結果會與發佈版本不一致：" -ForegroundColor Red
        $dirty | ForEach-Object { Write-Host "        $_" -ForegroundColor Yellow }
        return $false
    }

    $tags = @(git -C $RootDir tag -l "v*" | Where-Object { $_ -match '^v\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Substring(1) })
    $suggested = "v0.0.1"
    if ($tags.Count -gt 0) {
        $last = [version]$tags[-1].Substring(1)
        $suggested = "v{0}.{1}.{2}" -f $last.Major, $last.Minor, ($last.Build + 1)
    }
    $answer = Read-Host "請輸入要發佈的版本號 (格式 vX.Y.Z，直接按 Enter 使用 $suggested)"
    $tag = if ($answer.Trim()) { $answer.Trim() } else { $suggested }
    if ($tag -notmatch '^v\d+\.\d+\.\d+$') {
        Write-Host "[錯誤] 版本號格式不正確：$tag (需為 vX.Y.Z)" -ForegroundColor Red
        return $false
    }

    # 已存在的版本：草稿可接續完成 (例如上次 CI 失敗或中斷)，已正式發佈則停止
    $tagCommit = git -C $RootDir rev-parse -q --verify "refs/tags/$tag^{commit}" 2>$null
    if ($tagCommit -and $tagCommit -ne $head) {
        Write-Host "[錯誤] $tag 已存在且指向其他提交 ($($tagCommit.Substring(0, 7)))，請改用新的版本號。" -ForegroundColor Red
        return $false
    }
    $remoteTag = git -C $RootDir ls-remote --tags origin "refs/tags/$tag"
    $releaseJson = gh release view $tag --repo $repo --json isDraft 2>$null
    $existingRelease = if ($LASTEXITCODE -eq 0 -and $releaseJson) { $releaseJson | ConvertFrom-Json } else { $null }
    if ($existingRelease -and -not $existingRelease.isDraft) {
        Write-Host "[錯誤] $tag 已經正式發佈，請改用新的版本號。" -ForegroundColor Red
        return $false
    }

    Write-Host ""
    Write-Host "即將發佈 $tag (提交 $($head.Substring(0, 7)) 至 $repo)：" -ForegroundColor Yellow
    Write-Host "  1. 本機編譯 wbaseRP.dll 與 WbaseBridge.exe" -ForegroundColor White
    Write-Host "  2. 推送 tag，由 GitHub Actions 打包並建立草稿 Release (約需 5~10 分鐘)" -ForegroundColor White
    Write-Host "  3. 上傳報表元件後正式發佈，各機器將在下次排程自動更新" -ForegroundColor White
    if ($remoteTag) { Write-Host "  ($tag 已推送過，將接續未完成的步驟)" -ForegroundColor Gray }
    $confirm = Read-Host "確定要發佈嗎？[Y/N]"
    if ($confirm -notmatch "^[Yy]") {
        Write-Host "已取消發佈。" -ForegroundColor Gray
        return $false
    }

    # 先編譯再推送 tag，編譯失敗就不會留下沒有報表元件的草稿
    Write-Host ""
    Write-Host "[步驟 2/7] 編譯報表 DLL 與橋接程式..." -ForegroundColor Cyan
    if (-not ((Build-WbaseReportDll) -and (Build-WbaseBridge))) {
        Write-Host "[錯誤] 報表元件編譯失敗，未推送 tag。" -ForegroundColor Red
        return $false
    }

    Write-Host "[步驟 3/7] 打包報表元件 Wx3000_ReportBin_$tag.zip ..." -ForegroundColor Cyan
    $stageDir = Join-Path $env:TEMP "Wx3000_ReportBin_$tag"
    $reportZip = Join-Path $env:TEMP "Wx3000_ReportBin_$tag.zip"
    if (Test-Path $stageDir) { Remove-Item -Path $stageDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Join-Path $stageDir "wbase") | Out-Null
    Copy-Item -Path (Join-Path $RootDir "localagent\wbase\wbaseRP.dll") -Destination (Join-Path $stageDir "wbase") -Force
    Copy-Item -Path (Join-Path $RootDir "localagent\bridge\lazarus\WbaseBridge.exe") -Destination $stageDir -Force
    Compress-Archive -Path "$stageDir\*" -DestinationPath $reportZip -Force
    Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue

    if (-not $remoteTag) {
        Write-Host "[步驟 4/7] 建立並推送 tag $tag ..." -ForegroundColor Cyan
        if (-not $tagCommit) { git -C $RootDir tag $tag $head 2>&1 | Out-Host }
        git -C $RootDir push origin "refs/tags/$tag" 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[錯誤] 推送 tag 失敗，請檢查上方訊息。" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "[步驟 4/7] $tag 已在 GitHub 上，略過推送。" -ForegroundColor Gray
    }

    if (-not $existingRelease) {
        Write-Host "[步驟 5/7] 等待 GitHub Actions 打包並建立草稿 Release (約需 5~10 分鐘)..." -ForegroundColor Cyan
        $runId = $null
        for ($i = 0; $i -lt 36 -and -not $runId; $i++) {
            $runId = gh run list --repo $repo --workflow release.yml --branch $tag --limit 1 --json databaseId --jq '.[0].databaseId'
            if (-not $runId) { Start-Sleep -Seconds 5 }
        }
        if (-not $runId) {
            Write-Host "[錯誤] 3 分鐘內沒有看到 $tag 的 Release 打包工作，請到 https://github.com/$repo/actions 確認。" -ForegroundColor Red
            Write-Host "        確認後重新執行此選項並輸入 $tag 即可接續。" -ForegroundColor Yellow
            return $false
        }
        gh run watch $runId --repo $repo --exit-status --interval 15 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[錯誤] GitHub Actions 打包失敗：https://github.com/$repo/actions/runs/$runId" -ForegroundColor Red
            Write-Host "        修正後執行 gh run rerun $runId --repo $repo，完成後重新執行此選項並輸入 $tag 即可接續。" -ForegroundColor Yellow
            return $false
        }
        $releaseJson = gh release view $tag --repo $repo --json isDraft 2>$null
        $existingRelease = if ($LASTEXITCODE -eq 0 -and $releaseJson) { $releaseJson | ConvertFrom-Json } else { $null }
        if (-not ($existingRelease -and $existingRelease.isDraft)) {
            Write-Host "[錯誤] 打包完成但找不到 $tag 的草稿 Release，請到 https://github.com/$repo/releases 確認。" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "[步驟 5/7] $tag 的草稿 Release 已存在，略過等待。" -ForegroundColor Gray
    }

    Write-Host "[步驟 6/7] 上傳報表元件至草稿 Release ..." -ForegroundColor Cyan
    gh release upload $tag $reportZip --repo $repo --clobber 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[錯誤] 上傳報表元件失敗，草稿尚未發佈。重新執行此選項並輸入 $tag 即可接續。" -ForegroundColor Red
        return $false
    }

    Write-Host "[步驟 7/7] 正式發佈 $tag ..." -ForegroundColor Cyan
    gh release edit $tag --repo $repo --draft=false --latest 2>&1 | Out-Host
    $latest = gh api "repos/$repo/releases/latest" --jq .tag_name 2>$null
    if ($LASTEXITCODE -ne 0 -or $latest -ne $tag) {
        Write-Host "[錯誤] 發佈後的最新版本是 $latest 而不是 $tag，請到 https://github.com/$repo/releases 確認。" -ForegroundColor Red
        return $false
    }
    $assets = gh release view $tag --repo $repo --json assets --jq '.assets[].name'
    Write-Host "[完成] $tag 已正式發佈：https://github.com/$repo/releases/tag/$tag" -ForegroundColor Green
    $assets | ForEach-Object { Write-Host "        - $_" -ForegroundColor Gray }
    return $true
}

:MenuLoop while ($true) {
    Clear-Host
    $apiStatus = Get-ServiceStatusText "Wx3000Api"
    $agentStatus = Get-ServiceStatusText "Wx3000Agent"
    $adminTag = if (Test-IsAdmin) { "[系統管理員]" } else { "[一般權限]" }

    Write-Host "==================================================================================" -ForegroundColor Cyan
    Write-Host "            Wx3000 全端開發編輯與打包部署工具 (Build & Deploy CLI)                " -ForegroundColor Cyan
    Write-Host "==================================================================================" -ForegroundColor Cyan
    Write-Host " 專案路徑 : $RootDir $adminTag" -ForegroundColor Gray
    Write-Host " 後端服務 (Wx3000Api)   : $apiStatus" -ForegroundColor Yellow
    Write-Host " 代理服務 (Wx3000Agent) : $agentStatus" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 【一、編輯與開發預覽 (Edit & Dev)】" -ForegroundColor Green
    Write-Host "   [1] 前端 (Frontend)   - 開啟源碼編輯 / 啟動 Vite 開發伺服器 (5173)"
    Write-Host "   [2] 後端 (Backend)    - 開啟源碼編輯 / 啟動 .NET API 開發模式 (5000)"
    Write-Host "   [3] 本機代理 (Agent)  - 開啟 dlls.json & agent.js / 啟動測試 (5009)"
    Write-Host "   [4] 桌面端 (Electron) - 開啟主程序源碼 / 啟動 Electron 熱重載開發模式"
    Write-Host ""
    Write-Host " 【二、編譯與打包部署 (Build & Package -> 統一輸出至 Wx3000\publish\...)】" -ForegroundColor Magenta
    Write-Host "   [A] ★ 全部一鍵打包 (5~10、13)   ➔ 依序重編 5~10 與 13 所有模組至 Wx3000\publish\" -ForegroundColor Green
    Write-Host "   [5] ★ 全端伺服器一鍵發佈        ➔ Wx3000\publish\Wx3000_Server\" -ForegroundColor Yellow
    Write-Host "   [6] 僅打包【前端靜態網頁】      ➔ Wx3000\publish\frontend\dist\"
    Write-Host "   [7] 僅打包【後端單一執行檔】    ➔ Wx3000\publish\backend\Release\Wx3000.Backend.exe"
    Write-Host "   [8] 打包【LocalAgent 執行檔】   ➔ Wx3000\publish\localagent\dist\"
    Write-Host "   [9] 打包【Electron 快速免安裝】 ➔ Wx3000\publish\frontend\Electron\release\win-unpacked\"
    Write-Host "  [10] 打包【Electron 正式安裝包】 ➔ Wx3000\publish\frontend\Electron\release\"
    Write-Host "  [13] 編譯【報表 DLL 與橋接程式】 ➔ wbaseRP.dll + WbaseBridge.exe (Lazarus，完成後請執行 [8])"
    Write-Host "  [14] ★ 發佈新版本到 GitHub      ➔ 編譯報表元件 ➔ CI 草稿 ➔ 補傳報表元件 ➔ 正式發佈" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " 【三、服務管理與產出目錄 (Services & Folders)】" -ForegroundColor Cyan
    Write-Host "  [11] 管理 Wx3000Api Windows 服務 (安裝 / 啟動 / 停止 / 檢查區網 IP)"
    Write-Host "  [12] 開啟 publish 各項打包產出資料夾"
    Write-Host "   [Q] 離開程式 (Quit)"
    Write-Host "==================================================================================" -ForegroundColor Cyan

    $rawChoice = Read-Host "請輸入選項代號 [1-14, A 或 Q]"
    $choice = if ($rawChoice) { $rawChoice.Trim().ToUpper() } else { "" }

    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Host "--- [1] 前端 (Frontend) ---" -ForegroundColor Green
            Write-Host "  1. 用 VS Code 開啟前端源碼 (frontend/src)"
            Write-Host "  2. 啟動前端 Vite 開發伺服器 (pnpm dev:web)"
            Write-Host "  3. 同時開啟 VS Code 並啟動開發伺服器"
            $sub = Read-Host "請選擇 [1-3，預設 2]"
            if ($sub -eq "1") {
                Open-InEditor "frontend\src"
            } elseif ($sub -eq "3") {
                Open-InEditor "frontend\src"
                pnpm dev:web
            } else {
                pnpm dev:web
            }
            Pause-Return
        }
        "2" {
            Write-Host ""
            Write-Host "--- [2] 後端 (Backend API) ---" -ForegroundColor Green
            Write-Host "  1. 用 VS Code 開啟後端源碼 (backend)"
            Write-Host "  2. 啟動後端 .NET 開發模式 (pnpm dev:api)"
            Write-Host "  3. 同時開啟 VS Code 並啟動開發模式"
            $sub = Read-Host "請選擇 [1-3，預設 2]"
            if ($sub -eq "1") {
                Open-InEditor "backend"
            } elseif ($sub -eq "3") {
                Open-InEditor "backend"
                pnpm dev:api
            } else {
                pnpm dev:api
            }
            Pause-Return
        }
        "3" {
            Write-Host ""
            Write-Host "--- [3] LocalAgent 本機代理 ---" -ForegroundColor Green
            Write-Host "  1. 用 VS Code 開啟 localagent (編輯 dlls.json / agent.js)"
            Write-Host "  2. 直接啟動 LocalAgent 測試模式 (node localagent/agent.js)"
            Write-Host "  3. 同時開啟編輯器並啟動測試模式"
            $sub = Read-Host "請選擇 [1-3，預設 1]"
            if ($sub -eq "2") {
                node localagent/agent.js
            } elseif ($sub -eq "3") {
                Open-InEditor "localagent"
                node localagent/agent.js
            } else {
                Open-InEditor "localagent"
            }
            Pause-Return
        }
        "4" {
            Write-Host ""
            Write-Host "--- [4] Electron 桌面端開發 ---" -ForegroundColor Green
            Write-Host "  1. 用 VS Code 開啟 Electron 設定與主程序 (frontend/electron)"
            Write-Host "  2. 啟動 Electron 開發熱重載模式 (pnpm dev:electron)"
            $sub = Read-Host "請選擇 [1-2，預設 2]"
            if ($sub -eq "1") {
                Open-InEditor "frontend\electron"
            } else {
                pnpm dev:electron
            }
            Pause-Return
        }
        "A" {
            Write-Host ""
            $publishRoot = Join-Path $RootDir "publish"
            Write-Host "==================================================================================" -ForegroundColor Green
            Write-Host "  === [A] 開始執行【全部打包 (5~10 與 13 全套重編)】 ➔ $publishRoot\ ===" -ForegroundColor Green
            Write-Host "==================================================================================" -ForegroundColor Green

            # --- [5] 全端伺服器一鍵發佈 ---
            Write-Host ""
            $serverTargetDir = Join-Path $publishRoot "Wx3000_Server"
            Write-Host ">>> [進度 1/7 - 項目 5] 全端伺服器一鍵發佈 ➔ $serverTargetDir\api" -ForegroundColor Yellow
            Stop-Wx3000ApiSafely
            pnpm publish:server
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[錯誤] 項目 [5] 全端伺服器發佈失敗，中止全部打包流程！" -ForegroundColor Red
                Pause-Return
                continue
            }
            Start-Wx3000ApiSafely

            # --- [6] 僅打包前端靜態網頁 ---
            Write-Host ""
            $feTargetDir = Join-Path $publishRoot "frontend\dist"
            Write-Host ">>> [進度 2/7 - 項目 6] 同步前端靜態網頁 ➔ $feTargetDir\" -ForegroundColor Magenta
            if (Test-Path $feTargetDir) {
                Remove-Item -Path "$feTargetDir\*" -Recurse -Force -ErrorAction SilentlyContinue
            } else {
                New-Item -ItemType Directory -Force -Path $feTargetDir | Out-Null
            }
            Copy-Item -Path (Join-Path $RootDir "frontend\dist\*") -Destination $feTargetDir -Recurse -Force

            # --- [7] 僅打包後端單一執行檔 ---
            Write-Host ""
            $beTargetDir = Join-Path $publishRoot "backend\Release"
            Write-Host ">>> [進度 3/7 - 項目 7] 打包後端單一執行檔 ➔ $beTargetDir\Wx3000.Backend.exe" -ForegroundColor Magenta
            New-Item -ItemType Directory -Force -Path $beTargetDir | Out-Null
            dotnet publish backend/Wx3000.Backend.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o "$beTargetDir"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[錯誤] 項目 [7] 後端單一執行檔打包失敗，中止全部打包流程！" -ForegroundColor Red
                Pause-Return
                continue
            }

            # --- [13] 編譯報表 DLL 與橋接程式 (須在 [8] 之前，打包時才會帶入新版) ---
            Write-Host ""
            Write-Host ">>> [進度 4/7 - 項目 13] 編譯報表 wbaseRP.dll 與 WbaseBridge.exe" -ForegroundColor Magenta
            if (-not (Find-LazBuild)) {
                Write-Host "[略過] 本機沒有 lazbuild.exe，沿用現有的 wbaseRP.dll 與 WbaseBridge.exe。" -ForegroundColor Yellow
            } elseif (-not ((Build-WbaseReportDll) -and (Build-WbaseBridge))) {
                Write-Host "[錯誤] 項目 [13] 報表 DLL 或橋接程式編譯失敗，中止全部打包流程！" -ForegroundColor Red
                Pause-Return
                continue
            }

            # --- [8] 打包 LocalAgent 執行檔 ---
            Write-Host ""
            $agentTargetDir = Join-Path $publishRoot "localagent\dist"
            Write-Host ">>> [進度 5/7 - 項目 8] 打包 LocalAgent 執行檔 (Level 1) ➔ $agentTargetDir\" -ForegroundColor Magenta
            $localAgentDir = Join-Path $RootDir "localagent"
            & "$localAgentDir\build.ps1" -Level 1 -TargetDir $agentTargetDir -NoPause
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[錯誤] 項目 [8] LocalAgent 打包失敗，中止全部打包流程！" -ForegroundColor Red
                Pause-Return
                continue
            }

            # --- [9] & [10] 打包 Electron 快速免安裝版與正式安裝包 ---
            Write-Host ""
            $outReleaseDir = Join-Path $publishRoot "frontend\Electron\release"
            $outUnpackedDir = Join-Path $outReleaseDir "win-unpacked"
            Write-Host ">>> [進度 6/7 - 項目 9] 打包 Electron 快速免安裝版 ➔ $outUnpackedDir\" -ForegroundColor Magenta
            Push-Location (Join-Path $RootDir "frontend")
            try {
                $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
                $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
                npx electron-builder --dir --config.directories.output="$outReleaseDir"
                if ($LASTEXITCODE -ne 0) {
                    throw "Electron 免安裝版打包失敗"
                }

                Write-Host ""
                Write-Host ">>> [進度 7/7 - 項目 10] 打包 Electron 正式安裝包 ➔ $outReleaseDir\" -ForegroundColor Magenta
                npx electron-builder --win --x64 --config.directories.output="$outReleaseDir"
                if ($LASTEXITCODE -ne 0) {
                    throw "Electron 正式安裝包打包失敗"
                }
            } catch {
                Write-Host "[錯誤] $_" -ForegroundColor Red
                Pause-Return
                continue
            } finally {
                Pop-Location
            }

            Write-Host ""
            Write-Host "==================================================================================" -ForegroundColor Green
            Write-Host "  🎉 [完成] 項目 5 ~ 10 與 13 已全部重新編譯並打包完畢！" -ForegroundColor Green
            Write-Host "  - [5] 伺服器發佈包   : $serverTargetDir\api" -ForegroundColor White
            Write-Host "  - [6] 前端靜態網頁   : $feTargetDir" -ForegroundColor White
            Write-Host "  - [7] 後端單一執行檔 : $beTargetDir\Wx3000.Backend.exe" -ForegroundColor White
            Write-Host "  - [13] 報表 DLL      : $(Join-Path $RootDir 'localagent\wbase\wbaseRP.dll')" -ForegroundColor White
            Write-Host "  - [13] 橋接程式      : $(Join-Path $RootDir 'localagent\bridge\lazarus\WbaseBridge.exe')" -ForegroundColor White
            Write-Host "  - [8] LocalAgent     : $agentTargetDir" -ForegroundColor White
            Write-Host "  - [9] Electron 免安裝: $outUnpackedDir" -ForegroundColor White
            Write-Host "  - [10] Electron 安裝包: $outReleaseDir" -ForegroundColor White
            Write-Host "==================================================================================" -ForegroundColor Green

            $openNow = Read-Host "是否立即開啟 Wx3000\publish 目錄？[Y/N，預設 Y]"
            if ($openNow -eq "" -or $openNow -match "^[Yy]") {
                Invoke-Item $publishRoot
            }
            Pause-Return
        }
        "5" {
            Write-Host ""
            $targetDir = Join-Path $RootDir "publish\Wx3000_Server"
            Write-Host "=== [5] 全端伺服器一鍵發佈 ➔ $targetDir ===" -ForegroundColor Yellow
            Stop-Wx3000ApiSafely

            Write-Host "[步驟 1/2] 開始編譯前端並發佈後端至 $targetDir\api..." -ForegroundColor Cyan
            pnpm publish:server
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[錯誤] 打包過程中發生錯誤，請檢查上方編譯訊息！" -ForegroundColor Red
                Pause-Return
                continue
            }

            Write-Host "[步驟 2/2] 打包成功！準備啟動 Wx3000Api 服務..." -ForegroundColor Green
            Start-Wx3000ApiSafely
            Write-Host "[完成] 目的存放目錄: $targetDir\" -ForegroundColor Green
            Pause-Return
        }
        "6" {
            Write-Host ""
            $targetDir = Join-Path $RootDir "publish\frontend\dist"
            Write-Host "=== [6] 僅打包【前端靜態網頁】 ➔ $targetDir\ ===" -ForegroundColor Magenta
            pnpm --filter frontend build
            if ($LASTEXITCODE -eq 0) {
                if (Test-Path $targetDir) {
                    Remove-Item -Path "$targetDir\*" -Recurse -Force -ErrorAction SilentlyContinue
                } else {
                    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
                }
                Copy-Item -Path (Join-Path $RootDir "frontend\dist\*") -Destination $targetDir -Recurse -Force
                Write-Host "[完成] 前端靜態檔已存放至: $targetDir\" -ForegroundColor Green
                $openNow = Read-Host "是否立即開啟產出資料夾？[Y/N，預設 N]"
                if ($openNow -match "^[Yy]") {
                    Invoke-Item $targetDir
                }
            }
            Pause-Return
        }
        "7" {
            Write-Host ""
            $targetDir = Join-Path $RootDir "publish\backend\Release"
            $targetExe = Join-Path $targetDir "Wx3000.Backend.exe"
            Write-Host "=== [7] 僅打包【後端單一執行檔】 ➔ $targetExe ===" -ForegroundColor Magenta
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            dotnet publish backend/Wx3000.Backend.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o "$targetDir"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[完成] 後端單一執行檔已存放至: $targetExe" -ForegroundColor Green
                $openNow = Read-Host "是否立即開啟產出資料夾？[Y/N，預設 N]"
                if ($openNow -match "^[Yy]") {
                    Invoke-Item $targetDir
                }
            }
            Pause-Return
        }
        "8" {
            Write-Host ""
            $targetDir = Join-Path $RootDir "publish\localagent\dist"
            Write-Host "=== [8] 打包【LocalAgent 執行檔】 ➔ $targetDir\ ===" -ForegroundColor Magenta
            Write-Host "  1. 一般打包 Level 1 (Koffi + Bridge 雙模式 -> Wx3000Agent.exe) [推薦]"
            Write-Host "  2. 混淆打包 Level 2 (程式碼混淆保護 -> Wx3000Agent_L2.exe)"
            $sub = Read-Host "請選擇 [1-2，預設 1]"
            $level = if ($sub -eq "2") { 2 } else { 1 }
            $localAgentDir = Join-Path $RootDir "localagent"
            & "$localAgentDir\build.ps1" -Level $level -TargetDir $targetDir -NoPause
            $openNow = Read-Host "是否立即開啟產出資料夾？[Y/N，預設 N]"
            if ($openNow -match "^[Yy]") {
                Invoke-Item $targetDir
            }
            Pause-Return
        }
        "9" {
            Write-Host ""
            $outReleaseDir = Join-Path $RootDir "publish\frontend\Electron\release"
            $outUnpackedDir = Join-Path $outReleaseDir "win-unpacked"
            Write-Host "=== [9] 打包【Electron 桌面端 - 快速免安裝版】 ➔ $outUnpackedDir\ ===" -ForegroundColor Magenta
            pnpm --filter frontend run build
            if ($LASTEXITCODE -eq 0) {
                Push-Location (Join-Path $RootDir "frontend")
                try {
                    $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
                    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
                    npx electron-builder --dir --config.directories.output="$outReleaseDir"
                } finally {
                    Pop-Location
                }
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[完成] 免安裝版已存放至: $outUnpackedDir\" -ForegroundColor Green
                    $openNow = Read-Host "是否立即開啟產出資料夾？[Y/N，預設 Y]"
                    if ($openNow -eq "" -or $openNow -match "^[Yy]") {
                        Invoke-Item $outUnpackedDir
                    }
                }
            }
            Pause-Return
        }
        "10" {
            Write-Host ""
            $outReleaseDir = Join-Path $RootDir "publish\frontend\Electron\release"
            Write-Host "=== [10] 打包【Electron 桌面端 - 正式安裝包】 ➔ $outReleaseDir\ ===" -ForegroundColor Magenta
            pnpm --filter frontend run build
            if ($LASTEXITCODE -eq 0) {
                Push-Location (Join-Path $RootDir "frontend")
                try {
                    $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
                    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
                    npx electron-builder --win --x64 --config.directories.output="$outReleaseDir"
                } finally {
                    Pop-Location
                }
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[完成] 正式安裝包已存放至: $outReleaseDir\" -ForegroundColor Green
                    $openNow = Read-Host "是否立即開啟產出資料夾？[Y/N，預設 Y]"
                    if ($openNow -eq "" -or $openNow -match "^[Yy]") {
                        Invoke-Item $outReleaseDir
                    }
                }
            }
            Pause-Return
        }
        "11" {
            Write-Host ""
            Write-Host "--- [11] 管理 Wx3000Api Windows 服務 ---" -ForegroundColor Cyan
            Write-Host "  1. 檢查服務狀態與連線 (Check-Status)"
            Write-Host "  2. 啟動服務 (Start-Service)"
            Write-Host "  3. 停止服務 (Stop-Service)"
            Write-Host "  4. 重新註冊服務 (Install-Service 透過 Install-Wx3000.ps1)"
            Write-Host "  5. 解除安裝服務 (sc.exe delete)"
            $sub = Read-Host "請選擇 [1-5，預設 1]"
            switch ($sub) {
                "2" {
                    Start-Wx3000ApiSafely
                }
                "3" {
                    Stop-Wx3000ApiSafely
                }
                "4" {
                    $installScript = Join-Path $RootDir "publish\Install-Wx3000.ps1"
                    if (Test-Path $installScript) {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$installScript"
                    } else {
                        Write-Host "[錯誤] 找不到 $installScript" -ForegroundColor Red
                    }
                }
                "5" {
                    if (-not (Test-IsAdmin)) {
                        Write-Host "[提示] 需要系統管理員權限解除安裝服務..." -ForegroundColor Yellow
                        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"sc.exe delete Wx3000Api`"" -Verb RunAs -Wait
                    } else {
                        sc.exe delete Wx3000Api
                    }
                }
                default {
                    $svc = Get-Service -Name "Wx3000Api" -ErrorAction SilentlyContinue
                    Write-Host "Wx3000Api 服務狀態: $(if ($svc) { $svc.Status } else { '未安裝 (Not Installed)' })" -ForegroundColor Yellow
                }
            }
            Pause-Return
        }
        "12" {
            Write-Host ""
            Write-Host "--- [12] 快速開啟 publish 打包產出資料夾 ---" -ForegroundColor Cyan
            Write-Host "  1. [5] 全端伺服器發佈目錄   (Wx3000\publish\Wx3000_Server\)"
            Write-Host "  2. [6] 前端靜態網頁目錄     (Wx3000\publish\frontend\dist\)"
            Write-Host "  3. [7] 後端單一執行檔目錄   (Wx3000\publish\backend\Release\)"
            Write-Host "  4. [8] LocalAgent 執行檔目錄(Wx3000\publish\localagent\dist\)"
            Write-Host "  5. [9] Electron 免安裝目錄  (Wx3000\publish\frontend\Electron\release\win-unpacked\)"
            Write-Host "  6. [10] Electron 正式安裝包 (Wx3000\publish\frontend\Electron\release\)"
            $sub = Read-Host "請選擇 [1-6]"
            $folderMap = @{
                "1" = "publish\Wx3000_Server"
                "2" = "publish\frontend\dist"
                "3" = "publish\backend\Release"
                "4" = "publish\localagent\dist"
                "5" = "publish\frontend\Electron\release\win-unpacked"
                "6" = "publish\frontend\Electron\release"
            }
            if ($folderMap.ContainsKey($sub)) {
                $target = Join-Path $RootDir $folderMap[$sub]
                if (-not (Test-Path $target)) {
                    New-Item -ItemType Directory -Force -Path $target | Out-Null
                }
                Invoke-Item $target
            }
        }
        "13" {
            Write-Host ""
            Write-Host "=== [13] 編譯【報表 wbaseRP.dll 與 WbaseBridge.exe】 ===" -ForegroundColor Magenta
            if ((Build-WbaseReportDll) -and (Build-WbaseBridge)) {
                Write-Host "請接著執行 [8] 打包 LocalAgent，隨身碟安裝檔才會帶入新版報表 DLL 與橋接程式。" -ForegroundColor Yellow
            }
            Pause-Return
        }
        "14" {
            Write-Host ""
            Write-Host "=== [14] 發佈新版本到 GitHub Release ===" -ForegroundColor Magenta
            [void](Publish-Wx3000Release)
            Pause-Return
        }
        { $_ -in "Q", "QUIT", "EXIT" } {
            Write-Host "感謝使用，再見！" -ForegroundColor Cyan
            break MenuLoop
        }
        default {
            Write-Host "無效的選項，請重新輸入。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
