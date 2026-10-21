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
    Write-Host "   [3] 本機代理 (Agent)  - 開啟 dlls.json & agent.js / 啟動測試 (18889)"
    Write-Host "   [4] 桌面端 (Electron) - 開啟主程序源碼 / 啟動 Electron 熱重載開發模式"
    Write-Host ""
    Write-Host " 【二、編譯與打包部署 (Build & Package -> 統一輸出至 Wx3000\publish\...)】" -ForegroundColor Magenta
    Write-Host "   [5] ★ 全端伺服器一鍵發佈        ➔ Wx3000\publish\Wx3000_Server\" -ForegroundColor Yellow
    Write-Host "   [6] 僅打包【前端靜態網頁】      ➔ Wx3000\publish\frontend\dist\"
    Write-Host "   [7] 僅打包【後端單一執行檔】    ➔ Wx3000\publish\backend\Release\Wx3000.Backend.exe"
    Write-Host "   [8] 打包【LocalAgent 執行檔】   ➔ Wx3000\publish\localagent\dist\"
    Write-Host "   [9] 打包【Electron 快速免安裝】 ➔ Wx3000\publish\frontend\Electron\release\win-unpacked\"
    Write-Host "  [10] 打包【Electron 正式安裝包】 ➔ Wx3000\publish\frontend\Electron\release\"
    Write-Host ""
    Write-Host " 【三、服務管理與產出目錄 (Services & Folders)】" -ForegroundColor Cyan
    Write-Host "  [11] 管理 Wx3000Api Windows 服務 (安裝 / 啟動 / 停止 / 檢查區網 IP)"
    Write-Host "  [12] 開啟 publish 各項打包產出資料夾"
    Write-Host "   [Q] 離開程式 (Quit)"
    Write-Host "==================================================================================" -ForegroundColor Cyan

    $rawChoice = Read-Host "請輸入選項代號 [1-12 或 Q]"
    $choice = if ($rawChoice) { $rawChoice.Trim() } else { "" }

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
            Write-Host "  1. 檢查服務狀態與區網連線 IP (Check-Status)"
            Write-Host "  2. 啟動服務 (Start-Services)"
            Write-Host "  3. 停止服務 (Stop-Services)"
            Write-Host "  4. 安裝 / 重新註冊服務 (Install-Service)"
            Write-Host "  5. 解除安裝服務 (Uninstall-Service)"
            $sub = Read-Host "請選擇 [1-5，預設 1]"
            $scriptDir = Join-Path $RootDir "publish\Wx3000_Server\scripts"
            switch ($sub) {
                "2" { & "$scriptDir\Start-Services.ps1" }
                "3" { & "$scriptDir\Stop-Services.ps1" }
                "4" { & "$scriptDir\Install-Service.ps1" }
                "5" { & "$scriptDir\Uninstall-Service.ps1" }
                default { & "$scriptDir\Check-Status.ps1" }
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
