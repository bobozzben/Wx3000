# Wx3000 - 奇勝資訊現代化會計事務所與進銷存系統 (FoxPro Keyboard Replica)

`Wx3000` 是一個旨在無縫接軌並逐步取代傳統 Visual FoxPro / Delphi / Lazarus Win32 會計師與記帳士事務所管理、營業稅申報及進銷存系統的全端現代化專案。
核心優勢在於**前端輸入手感 100% 模擬 FoxPro 全鍵盤盲打**（支援 `Enter` 連續跳欄、聚焦全選直接打字覆蓋、底端自動增列、`F2`/`F3` 開窗搜尋與台灣地址智慧快選、`F7`/`F9` 報表列印與批次存檔），並具備 **PostgreSQL 與地端 VFP `.dbf` 動態磁碟機即時雙向同步橋接引擎** 及 **Lazarus 64-bit 原生報表 DLL 引擎**。

---

## 🛠️ 技術架構 (Tech Stack)

| 層級 | 選用技術與規格說明 |
| :--- | :--- |
| **Frontend (Web & Desktop)** | React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid Community + Zustand + Axios + SheetJS (`xlsx`)<br>- 支援瀏覽器區網連線與 **Electron 桌面端封裝**（含 `electron-updater` 自動更新、完整保留 `F1`~`F12` 功能鍵） |
| **Backend (API & Service)** | **C# .NET 8 (ASP.NET Core Web API / Windows Service `Wx3000Api`)**<br>- 預設監聽：`http://0.0.0.0:5007`（內建 Swagger UI 與 `wwwroot` 靜態 SPA 託管）<br>- 內建 `DbfSyncService`（VFP DBF 雙向同步）、`SystemConfigService`（動態磁碟機 `C:`/`F:` 與 Schema 切換）與 `SystemParamService` |
| **Database (Hybrid Sync)** | 1. **PostgreSQL 16** (`localhost:54320`, DB: `w3000`, 動態 Schema: `c:/w3000/comm` 或 `f:/w3000/comm` & `public`)<br>2. **Visual FoxPro DBF** (`<Drive>:\w3000\comm\*.dbf`) — 採用 **DBF 絕對權威雙向同步機制** |
| **LocalAgent (地端橋接服務)** | **Node.js (`localagent/agent.js`, Port `18889`, Windows Service `Wx3000Agent`)**<br>- **DBF 橋接**：透過 **32-bit `DBFBridge.exe`** 呼叫 32-bit `w3000_dbf.dll` (VFP COM) 執行 SHA256 Checksum、RLOCK 鎖定檢測與雙向同步<br>- **報表橋接**：透過 **64-bit `WbaseBridge.exe`** / `Koffi` 呼叫 64-bit Lazarus `wbaseRP.dll` 產生傳統 FastReport 預覽與中一刀列印 |
| **DevOps & Deployment** | `pnpm` Workspace + `Wx3000-Manager.bat` 互動式管理選單 + `publish/` 客戶端一鍵安裝/更新/DBF 同步診斷腳本 + GitHub Actions CI/Release |

---

## 📁 核心目錄與模組結構

```text
Wx3000/
├── Wx3000-Manager.bat / .ps1       # [推薦] 互動式一鍵開發、全套打包 (選項 [A]/[5]~[10]) 與服務管理選單
├── BUILD_AND_DEPLOY.md             # 四大模組 (Frontend/Backend/LocalAgent/Electron) 編譯部署速查指南
├── WORKSPACE.md                    # 工作區開發規範與熱鍵標準
├── Wx3000_SPEC.md                  # 系統整體架構與規格書
├── GEMINI.md / SKILL.md            # AI Agent 核心開發準則與舊系統翻新協議
├── docs/                           # 模組詳細規格文件庫 (SPEC.md 總目錄)
│   ├── backend/backend_SPEC.md     # 後端 API、動態磁碟機、DBF 同步與資料庫規格
│   └── frontend/                   # 前端共用組件、wbase 主檔/發票統購、wtaxop 單據規格書
├── backend/                        # C# .NET 8 Web API & Windows Service (Port: 5007)
│   ├── Controllers/                # SystemConfig, SystemParam, Wbase1020~3060, Products, Vendors, Purchase
│   ├── Services/                   # DbfSyncService, SystemConfigService (動態磁碟機), SystemParamService
│   ├── Data/                       # AppDbContext, DynamicModelCacheKeyFactory, DbInitializer
│   └── Models/                     # 映射 <drive>:/w3000/comm (cpa, keyin, taxno, customer, buyinv...)
├── frontend/                       # React 19 + Vite + Electron 前端專案
│   ├── electron/                   # Electron 主程序 (main.cjs, preload.cjs)
│   └── src/
│       ├── mainmenu/               # 奇勝資訊 Wx3000 系統總入口 (四大系統分區、快捷鍵啟動、線上客服)
│       ├── components/
│       │   ├── FoxProGrid/         # FoxProGridV2 (多列盲打表格) + SearchModal + FoxProPrintModal + AddressSelectModal
│       │   ├── FoxProGridCard/     # FoxProGridCard (主檔瀏覽卡片) + useFoxProCardNavigation (母版表單導覽 Hook)
│       │   ├── FoxProGridBill/     # FoxProGridBill (單據 Header+Detail 盲打表格)
│       │   ├── SelectXlsxField/    # FormUtilSelectXlsxFieldsList (Excel 動態欄位匯出設定器)
│       │   ├── WbasePageHeader.tsx # 統一模組頂部標題列與模式徽章
│       │   └── ServerConfigModal.tsx # 伺服器連線與資料來源磁碟機 (C:/F:) 設定視窗 (Ctrl+Shift+S)
│       ├── wbase/                  # 事務所與發票統購系統 (Z. 基本資料管理)
│       │   ├── menu/               # 三階手風琴鍵盤盲打主選單 + 深淺雙色主題 (ThemeContext)
│       │   ├── wbase1020/          # 會計師/記帳士資料維護 (FoxProGridCard + Wbase1020Form)
│       │   ├── wbase1030/          # 員工/建檔人員資料維護 (12 欄 FoxProGridV2 + w3000 密碼加解密)
│       │   ├── wbase1050/          # 稅務人員資料維護 (7 欄 FoxProGridV2 + F2 地址快選)
│       │   ├── wbase1060/          # 收費項目資料維護 (FoxProGridV2)
│       │   ├── wbase1070/          # 備註資料維護 (recnote.dbf ⇄ FoxProGridV2)
│       │   ├── wbase1080/          # 收費摘要資料維護 (recmemo.dbf ⇄ FoxProGridV2)
│       │   ├── wbase2010/          # 公司基本資料維護 (上下/左右分割 + 6 大 Tab 跨頁盲打 + 統編/稅籍/地址檢核)
│       │   ├── wbase3010/          # 發票購買地點維護 (FoxProGridV2 + F2 地址快選)
│       │   ├── wbase3020/          # 發票預購輸入 (wbase3020_01/02) & 預購列印 (wbase3020_buyinv_print)
│       │   ├── wbase3050/          # 統購發票清單列印 (A4/中一刀簽收單) & 單價設定
│       │   └── wbase3060/          # 統購發票字軌輸入與國稅局/代售點 Excel 匯入
│       ├── wtaxop/PurchaseOrder/   # 進貨單盲打作業 (Header + Detail)
│       └── services/               # Axios API、apiConfig (X-Data-Drive)、addressService、validation.ts
├── localagent/                     # 本機代理服務 (Port: 18889)
│   ├── agent.js                    # HTTP/WS 伺服器 (處理 /api/dbf/* 與 /report, /api/call)
│   ├── dlls.json                   # 動態 DLL 函數簽名配置檔
│   └── bridge/lazarus/             # DBFBridge.exe (32-bit) & WbaseBridge.exe (64-bit)
└── publish/                        # 集中打包產出目錄與客戶端自動化部署/診斷腳本
    ├── Install-Wx3000.bat / .ps1   # 客戶端一鍵安裝精靈
    ├── Update-Wx3000.bat / .ps1    # 客戶端一鍵更新腳本
    └── Check-DbfSync.bat / .ps1    # DBF ⇄ PostgreSQL 雙向同步單步驗證與除錯工具
```

---

## 🚀 快速啟動與打包指引 (Quick Start)

### 方式一：使用互動式管理工具（推薦）
直接雙擊根目錄的 **`Wx3000-Manager.bat`**（或於 PowerShell 執行 `.\Wx3000-Manager.ps1`），即可透過選單一鍵啟動開發伺服器、執行 **`[A]` 全套一鍵打包**（產出統一集中於 `publish/` 目錄）並管理 Windows 服務。

### 方式二：常用指令操作
```powershell
# 1. 安裝依賴
pnpm install

# 2. 同時啟動全棧開發環境 (Backend + Frontend + LocalAgent)
pnpm dev

# 3. 單獨啟動各模組開發環境
pnpm dev:web              # 前端 Vite (http://localhost:5173)
pnpm dev:api              # 後端 C# API (http://localhost:5007)
pnpm dev:agent            # 地端代理服務 (http://localhost:18889)
pnpm dev:electron         # Electron 桌面端熱重載模式

# 4. 生產環境編譯與發佈 (統一輸出至 publish/ 目錄)
pnpm publish:server       # 編譯前端並與後端一併發佈至 publish/Wx3000_Server/api (同步更新 backend/wwwroot)
pnpm build:web            # 僅打包前端靜態檔至 publish/frontend/dist
pnpm build:api            # 僅打包後端單檔 EXE 至 publish/backend/Release
pnpm pack:electron        # 快速產出免安裝桌面端 (publish/frontend/Electron/release/win-unpacked)
pnpm build:electron       # 產出正式 Windows 安裝包與綠色版 EXE (publish/frontend/Electron/release)
```

> 📖 詳細的各模組編譯、32/64-bit Bridge 架構說明與故障排除，請參閱 [BUILD_AND_DEPLOY.md](file:///f:/ADSProject/Wx3000/BUILD_AND_DEPLOY.md)。

---

## 🔑 鍵盤盲打操作規範指南 (FoxPro Keyboard Shortcuts)

| 快捷鍵 | 主檔表格 (`FoxProGridV2`) | 卡片+表單 (`FoxProGridCard` / `1020` / `2010`) | 單據明細 (`FoxProGridBill`) |
| :--- | :--- | :--- | :--- |
| **Enter** | 向右移至下一格；列末跳至下一列首欄；底端自動增列並存檔 | 瀏覽時進入編修；表單內依序跳至下一欄位（支援跨 Tab 自動切換，末欄自動存檔） | 向右跳欄；列末自動新增下一明細列 |
| **↑ / ↓** | 上下移動資料列；底端按 `↓` 自動新增空白列 | 瀏覽時上下換筆並即時連動表單；編修時在欄位間上下移動 | 上下移動明細列 |
| **Ins** | 插入/新增空白列 (`onInsertRow`) | 進入新增模式 (`startAdd`)，自動計算下一個編號 | 新增明細列 |
| **F2 / F4** | 在具備輔助按鈕欄位開啟快選視窗（如台灣地址快選 `AddressSelectModal`） | 瀏覽時 `F2` 開啟搜尋彈窗；編修時於地址/字軌欄開啟輔助快選視窗 | 開立新單據 / 開窗快查 |
| **F3** | 開啟大型快查彈窗 (`SearchModal`) | 於 `wbase2010` 切換頁籤 (`F3`~`F8`) 或查詢 | 開啟產品/廠商快查彈窗 |
| **F6** | 重新整理資料 (`onRefreshData`) | 進入編修模式 (`startEdit`) | - |
| **F7 / F9** | `F7` 開啟區間列印與 Excel 匯出 (`FoxProPrintModal`) | `F7` 開啟報表列印視窗、`F9`/`Ctrl+S` 儲存表單 | 查詢單據 / 儲存 |
| **Del / F8** | 刪除目前選取列（`SUPERVISOR` 保留帳號自動防刪） | 彈出刪除確認對話框 | 刪除當前明細列 |
| **Esc** | 結束編輯、儲存結算並退回主選單 | 取消編修退回瀏覽模式，或退回系統主選單 | 退回上一層 |
| **直接打字** | 無須先按 F2，直接鍵入字元即時覆蓋儲存格內容 | 表單欄位聚焦時自動全選 (`foxProFocusAndSelect`)，打字直接覆蓋 | 直接鍵入字元即時覆蓋 |
