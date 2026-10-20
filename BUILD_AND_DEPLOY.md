# Wx3000 開發編輯與打包部署速查指南 (Build & Deploy Guide)

> 本文件彙整 `Wx3000` 專案四大核心模組（**前端 Frontend**、**後端 Backend Service**、**本機代理 LocalAgent**、**桌面端 Electron**）的源碼位置、開發調試指令與正式打包流程。
> 所有指令預設在專案根目錄 `f:\ADSProject\Wx3000` 下執行（除非特別註明）。

---

## 🚀 0️⃣ 互動式一鍵管理工具 (推薦使用！)

不想背指令時，可直接執行根目錄的 **PowerShell 互動式選單工具**：

- **方式 A（滑鼠雙擊）**：直接點擊根目錄的 `Wx3000-Manager.bat`
- **方式 B（終端機執行）**：
  ```powershell
  .\Wx3000-Manager.ps1
  ```
- **內建功能**：
  - 自動顯示 `Wx3000Api` 與 `Wx3000Agent` 服務運行狀態。
  - **選單 `[1] ~ [4]`**：一鍵用 VS Code 開啟對應模組源碼或啟動開發伺服器。
  - **選單 `[5]`（最常用）**：自動停止 `Wx3000Api` 服務解除檔案鎖定 ➔ 編譯前端並打包後端至 `publish/Wx3000_Server` ➔ 自動重新啟動 `Wx3000Api` 服務。
  - **選單 `[6] ~ [10]`**：單獨打包前端、後端單檔 EXE、LocalAgent EXE 或 Electron 桌面端安裝檔。
  - **選單 `[11] ~ [12]`**：管理 Windows 服務、查看區網連線 IP、一鍵打開打包產出資料夾。

---

## 1️⃣ 前端 (Frontend - React + Vite)

### 📁 源碼位置
- **前端主目錄**：`frontend/src/`
- **基本資料維護模組**：`frontend/src/wbase/`（公司、記帳士、稅務人員、會計師等）
- **單據作業模組**：`frontend/src/wtaxop/`（進銷貨單、申報作業等）
- **FoxPro 鍵盤盲打核心組件**：
  - 單檔維護表格：`frontend/src/components/FoxProGrid/`
  - 單據 (Header+Detail) 表格：`frontend/src/components/FoxProGridBill/`
- **API 服務與狀態管理**：`frontend/src/services/`、`frontend/src/store/`

### 💻 開發即時預覽 (Dev)
```powershell
pnpm dev:web
```
- 啟動後預設網址：`http://localhost:5173`

### 📦 單獨編譯打包 (Build)
```powershell
pnpm --filter frontend build
```
- **產出位置**：`frontend/dist/`（純靜態網頁檔 HTML / JS / CSS）

---

## 2️⃣ 後端 API 與 Windows Service (Backend - C# .NET)

### 📁 源碼位置
- **後端主目錄**：`backend/`
- **API 控制器**：`backend/Controllers/`
- **EF Core 資料模型與 Context**：`backend/Models/`、`backend/Data/`
- **業務邏輯與服務**：`backend/Services/`
- **資料庫與連線設定**：`backend/appsettings.json`

### 💻 開發啟動 (Dev)
```powershell
pnpm dev:api
```
- 啟動後預設網址：`http://localhost:5000`

### 📦 打包方式 A：與前端一起打包成完整伺服器發佈包（推薦部署用）
> ⚠️ **重要提醒**：如果 `Wx3000` Windows 服務正在執行中，打包覆蓋前**請務必先停止服務**，否則 `Wx3000.Backend.exe` 會因檔案鎖定而無法覆蓋！

```powershell
# 1. 若服務執行中，先停止服務 (需系統管理員權限)
publish\Wx3000_Server\Stop-Services.bat

# 2. 自動編譯前端 + 打包後端 + 將前端 dist 複製到後端 wwwroot
pnpm publish:server

# 3. 重新啟動服務
publish\Wx3000_Server\Start-Services.bat
```
- **產出位置**：`publish/Wx3000_Server/api/`
- **Windows 服務管理腳本**（位於 `publish/Wx3000_Server/`，請右鍵「**以系統管理員身分執行**」）：
  - 安裝服務：`Install-Service.bat`（或 `1-安裝後端服務.bat`）
  - 啟動服務：`Start-Services.bat`（或 `2-啟動後端服務.bat`）
  - 停止服務：`Stop-Services.bat`（或 `3-停止後端服務.bat`）
  - 移除服務：`Uninstall-Service.bat`（或 `4-解除安裝服務.bat`）
  - 檢查狀態：`Check-Status.bat`（或 `5-檢查服務狀態與網域IP.bat`）

### 📦 打包方式 B：僅打包後端單一執行檔 (Single-File EXE)
```powershell
pnpm build:api
```
- **產出位置**：`backend/bin/Release/net8.0/win-x64/publish/Wx3000.Backend.exe`

---

## 3️⃣ LocalAgent (本機 DLL / DBF 橋接代理服務)

### 📁 源碼位置
- **主目錄**：`localagent/`
- **主程式**：`localagent/agent.js`
- **DLL 函數映射設定檔**：`localagent/dlls.json`
  - 💡 *若只是擴充或調整 Delphi / VFP DLL 函數與參數，在 Koffi 模式下只需修改 `dlls.json`，無須重新編譯 `agent.js`。*
- **Lazarus Bridge 源碼**：`localagent/bridge/`

### 💻 開發啟動 (Dev)
```powershell
node localagent/agent.js
```
- 預設監聽埠號：`http://localhost:18889`（同時支援 HTTP 與 WebSocket）

### 📦 重新打包成 EXE
請切換至 `localagent` 目錄下執行對應批次檔：

```powershell
cd localagent

# 一般打包 (Koffi + Bridge 雙模式，並自動複製 wbaseRP.dll 等資源至 dist)
.\build_level1.bat

# 進階混淆打包 (先經過 javascript-obfuscator 混淆後再打包成 Wx3000Agent_L2.exe)
.\build_level2.bat
```
- **產出位置**：`localagent/dist/Wx3000Agent.exe`（部署至客戶端時，需連同 `dist/wbase/*.dll`、`WbaseBridge.exe` 與 `dlls.json` 一起放置）
- **註冊為 Windows 服務**：於目標目錄以系統管理員身分執行 `localagent/install_service.bat`

---

## 4️⃣ Electron (Windows 桌面端應用程式)

Electron 封裝於 `frontend` 專案內，負責將前端打包為獨立的 Windows 桌面視窗（已配置完整保留 `F2`、`F9`、`F12` 給 FoxPro 盲打，並攔截單按 `F5` 防止誤觸重整）。

### 📁 源碼位置
- **主程序與頂部選單設定**：`frontend/electron/main.cjs`
- **Preload 通訊橋接腳本**：`frontend/electron/preload.cjs`
- **Electron 打包組態**：`frontend/package.json` 內的 `"build"` 區塊

### 💻 開發熱重載模式 (Dev)
```powershell
pnpm dev:electron
```
- 會自動同時啟動 Vite 開發伺服器與 Electron 桌面視窗。

### 📦 打包方式 A：快速免安裝測試版（僅解壓目錄，速度最快）
```powershell
pnpm pack:electron
```
- **產出位置**：`frontend/release/win-unpacked/Wx3000 ERP Client.exe`

### 📦 打包方式 B：正式發行安裝包（NSIS 安裝精靈 + Portable 單檔綠色版）
```powershell
pnpm build:electron
```
- **產出位置**：`frontend/release/` 目錄下的 `.exe` 安裝檔與免安裝執行檔。

---

## 💡 常見情境快速決策表：我改了 XXX，該跑哪個指令？

| 修改內容 | 使用瀏覽器連線 Server 的環境 | 使用 Electron 桌面端的環境 |
| :--- | :--- | :--- |
| **只改了前端畫面 (`frontend/src/*`)** | 1. 停止後端服務<br>2. `pnpm publish:server`<br>3. 啟動後端服務 | 執行 `pnpm pack:electron` (快速測試)<br>或 `pnpm build:electron` (正式安裝包) |
| **改了後端 C# 程式碼 (`backend/*`)** | 1. 停止後端服務<br>2. `pnpm publish:server`<br>3. 啟動後端服務 | *(後端部署在 Server，同樣在 Server 更新 `publish:server` 即可)* |
| **只新增/修改了報表 DLL 設定 (`localagent/dlls.json`)** | 直接更新客戶端的 `dlls.json` 並重啟 `Wx3000Agent` 即可 | 同左 |
| **改了 LocalAgent 主程式 (`localagent/agent.js`)** | 進入 `localagent/` 執行 `.\build_level1.bat` | 同左 |
| **改了 Electron 視窗或熱鍵 (`frontend/electron/*`)** | *(無影響)* | 執行 `pnpm pack:electron` 或 `pnpm build:electron` |
