# Wx3000 開發編輯與打包部署速查指南 (Build & Deploy Guide)

> 本文件彙整 `Wx3000` 專案四大核心模組（**前端 Frontend**、**後端 Backend Service**、**本機代理 LocalAgent**、**桌面端 Electron**）的源碼位置、開發調試指令與正式打包流程。
> 所有打包產出統一集中存放於 `Wx3000\publish\` 目錄下。

---

## 🚀 0️⃣ 互動式一鍵管理工具 (推薦使用！)

不想背指令時，可直接執行根目錄的 **PowerShell 互動式選單工具**：

- **方式 A（滑鼠雙擊）**：直接點擊根目錄的 `Wx3000-Manager.bat`
- **方式 B（終端機執行）**：
  ```powershell
  .\Wx3000-Manager.ps1
  ```

### 📦 【二、編譯與打包部署】對應產出目錄一覽表

| 選單代號 | 打包項目 | 打包後存放目的目錄 |
| :---: | :--- | :--- |
| **`[A]`** | ★ **全部一鍵打包 (5~10 全套重編)** (完成後統一詢問是否開啟 `publish\`) | `Wx3000\publish\` (涵蓋下方 5~10 所有目錄) |
| **`[5]`** | ★ **全端伺服器一鍵發佈** (自動停服務 ➔ 打包前後端 ➔ 重啟服務) | `Wx3000\publish\Wx3000_Server\` (`api\`) |
| **`[6]`** | 僅打包 **【前端靜態網頁】** | `Wx3000\publish\frontend\dist\` |
| **`[7]`** | 僅打包 **【後端單一執行檔】** | `Wx3000\publish\backend\Release\Wx3000.Backend.exe` |
| **`[8]`** | 打包 **【LocalAgent 執行檔】** | `Wx3000\publish\localagent\dist\` |
| **`[9]`** | 打包 **【Electron 桌面端 - 快速免安裝版】** | `Wx3000\publish\frontend\Electron\release\win-unpacked\` |
| **`[10]`** | 打包 **【Electron 桌面端 - 正式安裝包】** | `Wx3000\publish\frontend\Electron\release\` |

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

### 📦 單獨編譯打包 (選單 `[6]`)
```powershell
pnpm build:web
```
- **產出位置**：`Wx3000\publish\frontend\dist\`（純靜態網頁檔 HTML / JS / CSS）

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

### 📦 打包方式 A：與前端一起打包成完整伺服器發佈包 (選單 `[5]`，推薦部署用)
> ⚠️ **重要提醒**：如果 `Wx3000Api` Windows 服務正在執行中，手動執行指令前請先停止服務（使用 `Wx3000-Manager.ps1` 的選項 `[5]` 則會自動幫您停服務並重啟）。

```powershell
# 1. 若服務執行中，先停止服務 (需系統管理員權限)
publish\Wx3000_Server\Stop-Services.bat

# 2. 自動編譯前端 + 打包後端 + 將前端 dist 複製到後端 wwwroot
pnpm publish:server

# 3. 重新啟動服務
publish\Wx3000_Server\Start-Services.bat
```
- **產出位置**：`Wx3000\publish\Wx3000_Server\`（執行檔與 `wwwroot` 位於 `Wx3000\publish\Wx3000_Server\api\`）
- **Windows 服務管理腳本**（位於 `publish/Wx3000_Server/`，請右鍵「**以系統管理員身分執行**」）：
  - 安裝服務：`Install-Service.bat`（或 `1-安裝後端服務.bat`）
  - 啟動服務：`Start-Services.bat`（或 `2-啟動後端服務.bat`）
  - 停止服務：`Stop-Services.bat`（或 `3-停止後端服務.bat`）
  - 移除服務：`Uninstall-Service.bat`（或 `4-解除安裝服務.bat`）
  - 檢查狀態：`Check-Status.bat`（或 `5-檢查服務狀態與網域IP.bat`）

### 📦 打包方式 B：僅打包後端單一執行檔 (選單 `[7]`)
```powershell
pnpm build:api
```
- **產出位置**：`Wx3000\publish\backend\Release\Wx3000.Backend.exe`

---

## 3️⃣ LocalAgent (本機 DLL / DBF 橋接代理服務)

### 📁 源碼位置
- **主目錄**：`localagent/`
- **主程式**：`localagent/agent.js`
- **DLL 函數映射設定檔**：`localagent/dlls.json`
  - 💡 *若只是擴充或調整 Delphi / VFP DLL 函數與參數，在 Koffi 模式下只需修改 `dlls.json`，無須重新編譯 `agent.js`。*
- **Lazarus Bridge 源碼**：`localagent/bridge/lazarus/`
  - `DBFBridge.lpr`：地端 VFP DBF COM 橋接程式（**必須編譯為 32-bit x86**）
  - `WbaseBridge_Generic.lpr`：FastReport 報表 DLL 橋接程式（**必須編譯為 64-bit x64**）

### 🏛️ Bridge 執行檔架構規格與編譯
| 橋接程式 | 目標架構 | 呼叫對象 | FPC 手動編譯指令 |
| :--- | :---: | :--- | :--- |
| **`DBFBridge.exe`** | **32-bit (x86)** | `w3000_dbf.dll` (VFP COM) | `fpc -Pi386 -Twin32 -O3 -FE"bridge\lazarus" -o"DBFBridge.exe" "bridge\lazarus\DBFBridge.lpr"` |
| **`WbaseBridge.exe`** | **64-bit (x64)** | `wbaseRP.dll` (FastReport) | `fpc -Px86_64 -Twin64 -O3 -FE"bridge\lazarus" -o"WbaseBridge.exe" "bridge\lazarus\WbaseBridge_Generic.lpr"` |

> ⚠️ **排錯提醒 (ERROR: LoadLibrary ... Code=193)**：
> 若前端按下 `F7.列印` 出現 `Code=193`（`ERROR_BAD_EXE_FORMAT`），代表 `WbaseBridge.exe` 誤用 32 位元版本載入 64 位元的 `wbaseRP.dll`。請執行上方 FPC 64-bit 指令重新編譯即可。

### 💻 開發啟動 (Dev)
```powershell
pnpm dev:agent
```
- 預設監聽埠號：`http://localhost:18889`（同時支援 HTTP 與 WebSocket）

### 📦 重新打包成 EXE (選單 `[8]`)
透過 `Wx3000-Manager.ps1` 選單 `[8]` 或切換至 `localagent` 目錄下執行批次檔：

```powershell
cd localagent

# 一般打包 (Koffi + Bridge 雙模式，自動備齊 64-bit WbaseBridge 與 32-bit DBFBridge，並同步至 Wx3000\publish\localagent\dist\)
.\build_level1.bat

# 進階混淆打包 (先經過 javascript-obfuscator 混淆後再打包成 Wx3000Agent_L2.exe)
.\build_level2.bat
```
- **產出位置**：`Wx3000\publish\localagent\dist\`（內含 `Wx3000Agent.exe`、`wbase/*.dll`、`WbaseBridge.exe` (x64)、`DBFBridge.exe` (x86)、`dlls.json` 與 `install_service.bat`）

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

### 📦 打包方式 A：快速免安裝測試版 (選單 `[9]`)
```powershell
pnpm pack:electron
```
- **產出位置**：`Wx3000\publish\frontend\Electron\release\win-unpacked\`

### 📦 打包方式 B：正式發行安裝包 (選單 `[10]`)
```powershell
pnpm build:electron
```
- **產出位置**：`Wx3000\publish\frontend\Electron\release\`（包含 NSIS 安裝精靈與 Portable 免安裝單檔）

---

## 5️⃣ 客戶端隨身碟一鍵安裝精靈 (`publish\Install-Wx3000`)

將整個 `Wx3000\publish\` 資料夾複製到隨身碟或目標電腦後，可直接使用內建的安裝精靈完成部署：

- **方式 A（滑鼠雙擊）**：直接執行 `Wx3000\publish\Install-Wx3000.bat`（自動提權為系統管理員）
- **方式 B（PowerShell）**：
  ```powershell
  .\publish\Install-Wx3000.ps1
  ```

### 🛠️ 支援安裝角色與項目
- **`[1]` 安裝【主機端 Server 全套】**：自動複製檔案至 `C:\Wx3000\`、註冊並啟動 `Wx3000Api` Windows 服務 (Port `5007`)、開放區網防火牆、設定 `LocalAgent` (Port `18889`) 開機背景自啟動，並建立桌面捷徑【Wx3000 雲端會計進銷存】。
- **`[2]` 安裝【區網員工工作站】**：僅安裝本機 `LocalAgent`（供本機呼叫 FastReport 報表預覽直印）與 `Electron 桌面端`，啟動後按 `Ctrl + Shift + S` 指向主機區網 IP (`http://主機IP:5007`) 即可連線。
- **`[3]` ~ `[6]` 單獨模組更新**：可針對後端 API、`wwwroot` 靜態網頁、`LocalAgent` 或 `Electron` 單獨熱更新。

---

## 6️⃣ 新電腦 DBF 同步單步驗證與除錯工具 (`publish\Check-DbfSync`)

當新安裝至一台乾淨電腦，發現 `C:\W3000\COMM\` 下的 `.dbf` 資料未同步至 PostgreSQL (`localhost:54320`, DB: `w3000`, Schema: `c:/w3000/comm`) 時，可執行單步驗證與除錯工具：

- **方式 A（滑鼠雙擊）**：直接執行 `Wx3000\publish\Check-DbfSync.bat`
- **方式 B（PowerShell）**：
  ```powershell
  .\publish\Check-DbfSync.ps1
  ```

### 🔍 單步驗證 6 大關卡 (`[A]` 一鍵全流程診斷 或 `[1]`~`[6]` 單步執行)

| 步驟代號 | 驗證關卡 | 檢查內容與常見失敗原因 |
| :---: | :--- | :--- |
| **`[1]` Step 1** | **地端檔案與 VFP9 Runtime 檢查** | 檢查 `C:\W3000\COMM\*.dbf`、`LocalAgent` 下的 `DBFBridge.exe` / `w3000_dbf.dll` / `w3000_dbf.VBR` / `vfpencryption.fll`，以及乾淨電腦最容易缺少的 **32-bit VFP9 執行期元件** (`vfp9r.dll`、`vfp9t.dll`、`msvcr71.dll`、`msvcp71.dll`、`gdiplus.dll`)。 |
| **`[2]` Step 2** | **`DBFBridge.exe` 底層直接測試** | 略過 HTTP 網路層，直接傳遞 Base64 指令給 `DBFBridge.exe` 測試免註冊載入 `w3000_dbf.dll` 與計算 SHA256 Checksum。若缺少相依 DLL 會直接印出 Win32 Error Code（如 `Error 126`）。 |
| **`[3]` Step 3** | **`LocalAgent` HTTP 服務測試** | 檢查 Port `18889` 監聽狀態（未啟動可一鍵啟動），並呼叫 `GET /api/dbf/ping` 與 `POST /api/dbf/checksum` 驗證代理服務通訊。 |
| **`[4]` Step 4** | **生成 PostgreSQL 腳本測試** | 呼叫 `POST /api/dbf/get_pg_script` 測試產出建表 (`STRUCT`) 與資料 (`DATA`) SQL 腳本，並預覽前 6 行 SQL 輸出。 |
| **`[5]` Step 5** | **PostgreSQL 服務與字典表檢查** | 檢查 Port `54320`、`w3000` 資料庫是否存在（若無可一鍵建立）、查詢 `dictionary.w3000_dbf` 校驗碼紀錄與 `"c:/w3000/comm"` Schema 下的資料表清單。 |
| **`[6]` Step 6** | **後端 API 端到端觸發同步** | 實際呼叫後端 `GET /api/wbase1050` (`taxno.dbf`) 與 `GET /api/wbase1020` (`comp.dbf`)，驗證 `DbfSyncService.EnsureTableSyncedAsync` 完整同步鏈路並檢視回傳筆數。 |

### 🛠️ 進階除錯與強制修復功能 (`[D1]` ~ `[D3]`)
- **`[D1]` 清除 `dictionary.w3000_dbf` 校驗碼快取**：若 PostgreSQL 曾還原過舊備份或手動清空資料表，導致 Checksum 相符而略過同步，可一鍵執行 `DELETE FROM dictionary.w3000_dbf;` 並立即觸發強制全量重灌。
- **`[D2]` 手動抽取 SQL 腳本並直接匯入 PostgreSQL**：將 `LocalAgent` 產出的 `STRUCT` 與 `DATA` SQL 腳本存至 `%TEMP%\Wx3000_DbfDebug\`，並以 `psql.exe -v ON_ERROR_STOP=1` 單步執行，精準定位 SQL 語法或欄位數值溢位問題。
- **`[D3]` 開啟前景 Console 即時除錯視窗**：暫停背景服務，改在獨立 CMD 視窗以前景模式執行 `Wx3000Agent.exe` 或 `Wx3000.Backend.exe`，即時查看 `[DbfSync]` 同步 Log 與 Exception StackTrace。
- **`[S]` 變更測試 DBF 檔名或路徑**：可隨時切換要單步驗證的目標 DBF 檔案（如 `comp`、`keyin`、`taxno` 等）。
