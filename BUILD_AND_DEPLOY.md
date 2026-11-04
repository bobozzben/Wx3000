# Wx3000 開發編輯與打包部署速查指南 (Build & Deploy Guide)

> 本文件彙整 `Wx3000` 專案四大核心模組（**前端 Frontend**、**後端 Backend Service**、**本機代理 LocalAgent**、**桌面端 Electron**）與報表 DLL 的源碼位置、開發調試指令與正式打包流程。
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
| **`[A]`** | ★ **全部一鍵打包 (5~10 與 13 全套重編)** (依序 5 ➔ 6 ➔ 7 ➔ 13 ➔ 8 ➔ 9 ➔ 10；本機找不到 `lazbuild` 時略過 13，沿用現有報表元件；完成後統一詢問是否開啟 `publish\`) | `Wx3000\publish\` (涵蓋下方 5~10 所有目錄) |
| **`[5]`** | ★ **全端伺服器一鍵發佈** (自動停服務 ➔ 打包前後端 ➔ 重啟服務) | `Wx3000\publish\Wx3000_Server\` (`api\`) |
| **`[6]`** | 僅打包 **【前端靜態網頁】** | `Wx3000\publish\frontend\dist\` |
| **`[7]`** | 僅打包 **【後端單一執行檔】** | `Wx3000\publish\backend\Release\Wx3000.Backend.exe` |
| **`[8]`** | 打包 **【LocalAgent 執行檔】** (`localagent\build.ps1`，可選 Level 1 / Level 2) | `Wx3000\publish\localagent\dist\` |
| **`[9]`** | 打包 **【Electron 桌面端 - 快速免安裝版】** | `Wx3000\publish\frontend\Electron\release\win-unpacked\` |
| **`[10]`** | 打包 **【Electron 桌面端 - 正式安裝包】** | `Wx3000\publish\frontend\Electron\release\` |
| **`[13]`** | 編譯 **【報表 DLL 與橋接程式】** (Lazarus `lazbuild`，檢查匯出函數並試跑橋接程式後才覆蓋；完成後請執行 `[8]`) | `Wx3000\localagent\wbase\wbaseRP.dll`、`Wx3000\localagent\bridge\lazarus\WbaseBridge.exe`、`Wx3000\localagent\WbaseBridge.exe` |
| **`[14]`** | ★ **發佈新版本到 GitHub** (本機編譯報表元件 ➔ 推送 tag 由 CI 建立草稿 Release ➔ 補傳 `Wx3000_ReportBin_<版本>.zip` ➔ 正式發佈) | GitHub Releases |

> 💡 **發佈新版本請一律使用 `[14]`**：報表 DLL 與橋接程式需要 Lazarus 與 FastReport，無法在 GitHub Actions 編譯。直接推送 tag 只會建立草稿 Release，各機器的自動更新看不到草稿；`[14]` 會在補傳報表元件後才正式發佈。中途失敗時，重新執行 `[14]` 並輸入同一版本號即可接續。需要先安裝並登入 GitHub CLI (`gh auth login`)，本機必須位於 GitHub `main` 的最新提交，且 `report\`、`localagent\bridge\`、`localagent\dlls.json` 沒有未提交的修改。詳見下方「7️⃣ 報表元件編譯與 GitHub 發佈」。

> 其他選單：`[1]`~`[4]` 開啟源碼或啟動各模組開發模式，`[11]` 管理 `Wx3000Api` Windows 服務 (檢查 / 啟動 / 停止 / 透過 `Install-Wx3000.ps1` 重新註冊 / 刪除)，`[12]` 開啟 `publish` 各產出資料夾。

---

## 1️⃣ 前端 (Frontend - React + Vite)

### 📁 源碼位置
- **前端主目錄**：`frontend/src/`
- **基本資料維護模組**：`frontend/src/wbase/`（公司、記帳士、稅務人員、會計師等）
- **單據作業模組**：`frontend/src/wtaxop/`（進銷貨單、申報作業等）
- **FoxPro 鍵盤盲打核心組件**：
  - 單檔維護表格：`frontend/src/components/FoxProGrid/`
  - 清單 + 表單：`frontend/src/components/FoxProGridCard/`
  - 單據 (Header+Detail) 表格：`frontend/src/components/FoxProGridBill/`
- **API 服務與狀態管理**：`frontend/src/services/`、`frontend/src/store/`

### 💻 開發即時預覽 (Dev)
```powershell
pnpm dev:web
```
- 啟動後預設網址：`http://localhost:5173`（`/api`、`/health`、`/swagger` 代理到 `http://127.0.0.1:5007`）

### 📦 單獨編譯打包 (選單 `[6]`)
```powershell
pnpm build:web
```
- **產出位置**：`Wx3000\publish\frontend\dist\`（純靜態網頁檔 HTML / JS / CSS）。`pnpm build:web` 另會同步複製到 `publish\Wx3000_Server\api\wwwroot\` 與 `backend\wwwroot\`；選單 `[6]` 則執行 `pnpm --filter frontend build` 後只複製到 `publish\frontend\dist\`。

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
- 啟動後預設網址：`http://localhost:5007`（依 `appsettings.json` 的 `Urls` = `http://0.0.0.0:5007`；Swagger：`/swagger`，健康檢查：`/health`）

### 📦 打包方式 A：與前端一起打包成完整伺服器發佈包 (選單 `[5]`，推薦部署用)
> ⚠️ **重要提醒**：如果 `Wx3000Api` Windows 服務正在執行中，手動執行指令前請先停止服務（使用 `Wx3000-Manager.ps1` 的選項 `[5]` 則會自動幫您停服務並重啟）。

```powershell
# 1. 若服務執行中，先停止服務 (需系統管理員權限)
Stop-Service -Name Wx3000Api -Force

# 2. 自動編譯前端 + 打包後端 + 將前端 dist 複製到 api\wwwroot
pnpm publish:server

# 3. 重新啟動服務
Start-Service -Name Wx3000Api
```
- **產出位置**：`Wx3000\publish\Wx3000_Server\`（執行檔與 `wwwroot` 位於 `Wx3000\publish\Wx3000_Server\api\`）
- **Windows 服務管理**：`publish\Wx3000_Server\` 下已不再提供服務管理批次檔。
  - 安裝 / 重新註冊服務：執行 `publish\Install-Wx3000.bat`，主選單 `[1]` 或維護選單 `[1]`（複製到 `C:\Wx3000\Server\api\`，以 `sc.exe` 註冊開機自動啟動的 `Wx3000Api`，失敗自動重啟，並開放防火牆 TCP `5007`）。
  - 檢查 / 啟動 / 停止 / 刪除服務：`Wx3000-Manager.ps1` 選單 `[11]`。

### 📦 打包方式 B：僅打包後端單一執行檔 (選單 `[7]`)
```powershell
pnpm build:api
```
- **產出位置**：`Wx3000\publish\backend\Release\Wx3000.Backend.exe`

---

## 3️⃣ LocalAgent (本機 DLL / DBF 橋接代理服務)

### 📁 源碼位置
- **主目錄**：`localagent/`
- **主程式**：`localagent/agent.js`（單元測試：`localagent/agent.test.js`，`cd localagent; npm test`）
- **DLL 函數映射設定檔**：`localagent/dlls.json`
  - 💡 *新增報表函數時，只要 DLL 已匯出並在 `dlls.json` 登記即可呼叫，無須修改 `agent.js`；預設 `bridge` 模式下 `WbaseBridge.exe` 依參數個數分派 (6 參數、7 參數 `wbase350_buyinv_list`、2 參數 `int, str`)，其他參數型態才需修改 `WbaseBridge_Generic.lpr`。*
- **Lazarus Bridge 源碼**：`localagent/bridge/lazarus/`
  - `DBFBridge.lpr`：地端 VFP DBF COM 橋接程式（**必須編譯為 32-bit x86**）
  - `WbaseBridge_Generic.lpr`：FastReport 報表 DLL 橋接程式（**必須編譯為 64-bit x64**，標準作法為選單 `[13]`）
- **報表 DLL 源碼**：`report/wbase/`（`wbaseRP.lpi`，Lazarus + FastReport）

### 🏛️ Bridge 執行檔架構規格與編譯
| 橋接程式 | 目標架構 | 呼叫對象 | 編譯方式 |
| :--- | :---: | :--- | :--- |
| **`DBFBridge.exe`** | **32-bit (x86)** | `w3000_dbf.dll` (VFP COM) | `fpc -Pi386 -Twin32 -O3 -FE"bridge\lazarus" -o"DBFBridge.exe" "bridge\lazarus\DBFBridge.lpr"` |
| **`WbaseBridge.exe`** | **64-bit (x64)** | `wbaseRP.dll` (FastReport) | 選單 `[13]` (`lazbuild --bm=Release --cpu=x86_64 --os=win64 WbaseBridge_Generic.lpi`)；手動可用 `fpc -Px86_64 -Twin64 -O3 -FE"bridge\lazarus" -o"WbaseBridge.exe" "bridge\lazarus\WbaseBridge_Generic.lpr"` |

> ⚠️ **排錯提醒 (ERROR: LoadLibrary ... Code=193)**：
> 若前端按下 `F7.列印` 出現 `Code=193`（`ERROR_BAD_EXE_FORMAT`），代表 `WbaseBridge.exe` 誤用 32 位元版本載入 64 位元的 `wbaseRP.dll`。請用選單 `[13]` (或上方 FPC 64-bit 指令) 重新編譯即可。

### 💻 開發啟動 (Dev)
```powershell
pnpm dev:agent
```
- 監聽埠號：`http://localhost:5009`（只綁定 `127.0.0.1` 與 `::1`，同時支援 HTTP 與 WebSocket）

### 📦 重新打包成 EXE (選單 `[8]`)
透過 `Wx3000-Manager.ps1` 選單 `[8]` 或切換至 `localagent` 目錄下執行打包腳本：

```powershell
cd localagent

# 一般打包 Level 1 (Wx3000Agent.exe，自動備齊 64-bit WbaseBridge 與 32-bit DBFBridge，並同步至 Wx3000\publish\localagent\dist\)
.\build.ps1 -Level 1

# 進階混淆打包 Level 2 (先經過 javascript-obfuscator 混淆後再打包成 Wx3000Agent_L2.exe)
.\build.ps1 -Level 2      # 或 .\build_level2.bat
```
- **產出位置**：`Wx3000\publish\localagent\dist\`（內含 `Wx3000Agent.exe`、`wbase\wbaseRP.dll`、`WbaseBridge.exe` (x64)、`DBFBridge.exe` (x86)、`w3000_dbf.dll` / `w3000_dbf.VBR` / `vfpencryption.fll`、VFP9 執行元件、`dlls.json`、`test.html` 與 `install_service.bat`）
- `WbaseBridge.exe` 優先取 `localagent\bridge\lazarus\WbaseBridge.exe`，因此 `[13]` 編譯後要再跑 `[8]`，隨身碟安裝檔才會帶入新版報表 DLL 與橋接程式。
- 舊的 `build_level1.bat` 不會複製 VFP9 執行元件，請改用 `build.ps1`。

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
- **`[1]` 安裝【主機端 Server 全套】**：自動複製檔案至 `C:\Wx3000\`、註冊並啟動 `Wx3000Api` Windows 服務 (Port `5007`)、開放區網防火牆、設定 `LocalAgent` (Port `5009`) 於使用者登入時背景自動啟動、建立桌面捷徑【Wx3000 雲端會計進銷存】，並啟用每日自動更新排程。
- **`[2]` 安裝【區網員工工作站】**：僅安裝本機 `LocalAgent`（供本機呼叫 FastReport 報表預覽直印）與 `Electron 桌面端`，並啟用每日自動更新排程，啟動後按 `Ctrl + Shift + S` 指向主機區網 IP (`http://主機IP:5007`) 即可連線。
- **`[3]` 系統檢測與維護工具**：進入第二層維護選單（共 13 項），可單獨更新後端 API、`wwwroot` 靜態網頁、`LocalAgent` 或 `Electron`，並整合 GitHub 線上更新與每日排程 (`Update-Wx3000.ps1`)、區網連線資訊、更改安裝路徑與解除安裝。

> 💡 GitHub 線上更新、版本紀錄 (`version.txt` / `agent_version.txt`) 與回滾規則，請見 `publish\README_客戶端安裝指南.md`。

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
| **`[3]` Step 3** | **`LocalAgent` HTTP 服務測試** | 檢查 Port `5009` 監聽狀態（未啟動可一鍵啟動），並呼叫 `GET /api/dbf/ping` 與 `POST /api/dbf/checksum` 驗證代理服務通訊。 |
| **`[4]` Step 4** | **生成 PostgreSQL 腳本測試** | 呼叫 `POST /api/dbf/get_pg_script` 測試產出建表 (`STRUCT`) 與資料 (`DATA`) SQL 腳本，並預覽前 6 行 SQL 輸出。 |
| **`[5]` Step 5** | **PostgreSQL 服務與字典表檢查** | 檢查 Port `54320`、`w3000` 資料庫是否存在（若無可一鍵建立）、查詢 `dictionary.w3000_dbf` 校驗碼紀錄與 `"c:/w3000/comm"` Schema 下的資料表清單。 |
| **`[6]` Step 6** | **後端 API 端到端觸發同步** | 實際呼叫後端 `GET /api/wbase1050` (`taxno.dbf`) 與 `GET /api/wbase1020` (`cpa.dbf`)，驗證 `DbfSyncService.EnsureTableSyncedAsync` 完整同步鏈路並檢視回傳筆數。 |

### 🛠️ 進階除錯與強制修復功能 (`[D1]` ~ `[D3]`)
- **`[D1]` 清除 `dictionary.w3000_dbf` 校驗碼快取**：若 PostgreSQL 曾還原過舊備份或手動清空資料表，導致 Checksum 相符而略過同步，可一鍵執行 `DELETE FROM dictionary.w3000_dbf;` 並立即觸發強制全量重灌。
- **`[D2]` 手動抽取 SQL 腳本並直接匯入 PostgreSQL**：將 `LocalAgent` 產出的 `STRUCT` 與 `DATA` SQL 腳本存至 `%TEMP%\Wx3000_DbfDebug\`，並以 `psql.exe -v ON_ERROR_STOP=1` 單步執行，精準定位 SQL 語法或欄位數值溢位問題。
- **`[D3]` 開啟前景 Console 即時除錯視窗**：暫停背景服務，改在獨立 CMD 視窗以前景模式執行 `Wx3000Agent.exe` 或 `Wx3000.Backend.exe`，即時查看 `[DbfSync]` 同步 Log 與 Exception StackTrace。
- **`[S]` 變更測試 DBF 檔名或路徑**：可隨時切換要單步驗證的目標 DBF 檔案（如 `comp`、`keyin`、`taxno` 等）。

---

## 7️⃣ 報表元件編譯與 GitHub 發佈 (`[13]` / `[14]`)

### 🔧 `[13]` 編譯報表 DLL 與橋接程式
1. **尋找 `lazbuild`**：依序為環境變數 `LAZBUILD` ➔ `PATH` ➔ `C:\fpcupdeluxe\lazarus` ➔ `C:\lazarus` ➔ `C:\Program Files\Lazarus`。其他位置 (例如 `C:\fpcupdeluxe4\lazarus`) 請設定 `LAZBUILD` 指向 `lazbuild.exe`。
2. **報表 DLL**：以 **Debug** 建置模式編譯 64-bit `report\wbase\wbaseRP.lpi`，確認 `dlls.json` 中 `wbaseRP` 登記的函數都已匯出後，才覆蓋 `localagent\wbase\wbaseRP.dll`。
3. **橋接程式**：以 **Release** 建置模式編譯 64-bit `localagent\bridge\lazarus\WbaseBridge_Generic.lpi`（Debug 模式的 heaptrc 會把記憶體傾印混進輸出），以不存在的函數名稱試跑，確認能載入 `wbaseRP.dll` 後，才覆蓋 `localagent\bridge\lazarus\WbaseBridge.exe` 與 `localagent\WbaseBridge.exe`。
4. 任一步失敗都不覆蓋現有檔案；覆蓋失敗多半是報表預覽視窗或 LocalAgent 仍在使用檔案。

### 🚀 `[14]` 發佈新版本 (`Publish-Wx3000Release`)
| 步驟 | 動作 |
| :---: | :--- |
| 前置 | 確認已安裝 `git`、`gh` 且 `gh auth status` 已登入，並取得 GitHub 倉庫名稱 |
| **1/7** | `git fetch origin main --tags`，本機 `HEAD` 必須等於 `origin/main`；`report\`、`localagent\bridge\`、`localagent\dlls.json` 不可有未提交的修改 |
| 版本號 | 預設為最新 `vX.Y.Z` tag 的下一個修訂號；已存在的 tag 必須指向目前提交，已正式發佈的版本不可重用 (草稿可接續) |
| **2/7** | 編譯報表 DLL 與橋接程式 (同 `[13]`)；失敗就不推送 tag |
| **3/7** | 打包 `Wx3000_ReportBin_<版本>.zip`（`wbase\wbaseRP.dll` + `WbaseBridge.exe`） |
| **4/7** | 建立並推送 tag（已在 GitHub 上則略過） |
| **5/7** | 等待 `release.yml` 打包並建立草稿 Release（3 分鐘內找不到工作或打包失敗即停止，修正後輸入同一版本號接續） |
| **6/7** | 上傳報表元件 zip 至草稿 Release (`--clobber`) |
| **7/7** | 正式發佈並設為 Latest，確認 GitHub 最新版本就是本次版本 |

### ☁️ GitHub Actions
- **`ci.yml`**（推送或 PR 至 `main` / `master` / `develop`）：前端建置 (`pnpm --filter frontend build`)、Electron 免安裝目錄打包驗證、後端 `dotnet build`；不執行測試。
- **`release.yml`**（推送 `v*.*.*` tag；在分支上手動觸發時只產生 Artifacts）：執行 `pnpm publish:server`、Electron 安裝包 (NSIS + Portable) 與 `localagent\build.ps1 -Level 1`，上傳 Artifacts；推送 tag 時建立**草稿** Release，附件為 `Wx3000_Server_<版本>.zip`（`Wx3000_Server\` 與 `publish` 根目錄的 `.bat` / `.ps1` / `.md`）、`Wx3000_LocalAgent_<版本>.zip` 與 Electron 安裝檔。
- 報表 DLL、橋接程式、`DBFBridge.exe`、`w3000_dbf.dll` 與 VFP9 執行元件都不在版控內，CI 打包的 LocalAgent 只含主程式與設定；報表元件 zip 由 `[14]` 補傳後才正式發佈。
