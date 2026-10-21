param(
    [ValidateSet(1, 2)]
    [int]$Level = 1,

    [string]$TargetDir = "",

    [switch]$NoPause
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$LocalAgentRoot = $PSScriptRoot
if (-not $LocalAgentRoot) {
    $LocalAgentRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location $LocalAgentRoot

$levelTitle = if ($Level -eq 2) { "Level 2 (混淆保護版 -> Wx3000Agent_L2.exe)" } else { "Level 1 (雙模式推薦版 -> Wx3000Agent.exe)" }
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "       Wx3000 LocalAgent 打包建置程序 - $levelTitle" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 步驟 1: npm install
Write-Host ""
Write-Host "[步驟 1/4] 檢查並安裝 Node 相依套件 (npm install)..." -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[錯誤] npm install 失敗，請檢查網路連線或 package.json！" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "請按 Enter 鍵結束" }
    exit 1
}

# 步驟 2: 橋接器與混淆前置
Write-Host ""
Write-Host "[步驟 2/4] 準備橋接程式與混淆前置..." -ForegroundColor Green
if (-not (Test-Path "WbaseBridge.exe") -and (Test-Path "bridge\lazarus\WbaseBridge.exe")) {
    Copy-Item "bridge\lazarus\WbaseBridge.exe" "WbaseBridge.exe" -Force
    Write-Host "  -> 已從 bridge\lazarus\ 備妥 WbaseBridge.exe" -ForegroundColor Gray
}

if ($Level -eq 2) {
    Write-Host "  -> 正在執行程式碼混淆保護 (node build-obfuscate.js)..." -ForegroundColor Yellow
    node build-obfuscate.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[錯誤] 程式碼混淆失敗！" -ForegroundColor Red
        if (-not $NoPause) { Read-Host "請按 Enter 鍵結束" }
        exit 1
    }
}

# 步驟 3: pkg 封裝
Write-Host ""
Write-Host "[步驟 3/4] 封裝為 Windows 獨立執行檔 (npx pkg)..." -ForegroundColor Green
$distDir = Join-Path $LocalAgentRoot "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if ($Level -eq 2) {
    $outExe = Join-Path $distDir "Wx3000Agent_L2.exe"
    npx pkg agent.obf.js -t node18-win-x64 -o $outExe --compress GZip
} else {
    $outExe = Join-Path $distDir "Wx3000Agent.exe"
    npx pkg package.json -t node18-win-x64 -o $outExe --compress GZip
}

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outExe)) {
    Write-Host "[錯誤] pkg 打包失敗！" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "請按 Enter 鍵結束" }
    exit 1
}

# 步驟 4: 複製 DLL、橋接器與設定檔
Write-Host ""
Write-Host "[步驟 4/4] 備齊各系統別報表 DLL、橋接執行檔與周邊依賴..." -ForegroundColor Green

# 自動掃描並複製 localagent 下各系統別子資料夾 (如 wbase 及未來其他系統) 的報表 DLL
$excludeDirs = @("dist", "node_modules", "bridge")
$sysDirs = Get-ChildItem -Path $LocalAgentRoot -Directory | Where-Object { $_.Name -notin $excludeDirs }
foreach ($sysDir in $sysDirs) {
    $dllFiles = Get-ChildItem -Path $sysDir.FullName -Filter "*.dll" -File -ErrorAction SilentlyContinue
    if ($dllFiles) {
        $destSysDir = Join-Path $distDir $sysDir.Name
        New-Item -ItemType Directory -Force -Path $destSysDir | Out-Null
        Copy-Item -Path (Join-Path $sysDir.FullName "*") -Destination $destSysDir -Recurse -Force
        Write-Host "  -> 已複製系統別報表目錄: $($sysDir.Name)\ ($($dllFiles.Count) 個 DLL)" -ForegroundColor Gray
    }
}

# 報表與 DBF 橋接器
if (Test-Path "bridge\lazarus\WbaseBridge.exe") {
    Copy-Item "bridge\lazarus\WbaseBridge.exe" $distDir -Force
} elseif (Test-Path "WbaseBridge.exe") {
    Copy-Item "WbaseBridge.exe" $distDir -Force
}

if (Test-Path "DBFBridge.exe") {
    Copy-Item "DBFBridge.exe" $distDir -Force
} elseif (Test-Path "bridge\lazarus\DBFBridge.exe") {
    Copy-Item "bridge\lazarus\DBFBridge.exe" $distDir -Force
}

# 設定檔、FoxPro COM DLL 與服務註冊腳本
$assets = @("dlls.json", "test.html", "w3000_dbf.dll", "vfpencryption.fll", "w3000_dbf.VBR", "install_service.bat")
foreach ($asset in $assets) {
    if (Test-Path $asset) {
        Copy-Item $asset $distDir -Force
    }
}

# 同步至目標發佈目錄
if (-not $TargetDir) {
    $TargetDir = Join-Path $LocalAgentRoot "..\publish\localagent\dist"
}
$targetFullPath = [System.IO.Path]::GetFullPath($TargetDir)
New-Item -ItemType Directory -Force -Path $targetFullPath | Out-Null
Copy-Item -Path (Join-Path $distDir "*") -Destination $targetFullPath -Recurse -Force

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [完成] LocalAgent 打包成功！" -ForegroundColor Green
Write-Host " 本地目錄: $distDir" -ForegroundColor Gray
Write-Host " 發佈目錄: $targetFullPath" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Get-ChildItem -Path $targetFullPath | Format-Table Name, Length, LastWriteTime -AutoSize

if (-not $NoPause) {
    Write-Host ""
    Read-Host "打包完畢，請按 Enter 鍵結束"
}
