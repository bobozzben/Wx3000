# Wx3000 - Modern Accounting & Tax Firm ERP System (FoxPro Keyboard Replica)

`Wx3000` 是一個旨在無縫接軌並逐步取代傳統 Visual FoxPro / Delphi Win32 會計師與記帳士事務所管理、營業稅申報及進銷存系統的全端現代化專案。
核心優勢在於**前端輸入手感 100% 模擬 FoxPro 全鍵盤盲打**（支援 `Enter` 連續跳欄、底端自動增列、直接打字覆蓋、`F2`/`F3` 開窗搜尋、`F7`/`F9` 報表列印與批次存檔），並具備 **PostgreSQL 與地端 VFP `.dbf` 即時雙向同步橋接引擎** 及 **Lazarus 原生報表 DLL 引擎**。

---

## 🛠️ 技術架構 (Tech Stack)

| 層級 | 選用技術與規格說明 |
| :--- | :--- |
| **Frontend (Web & Desktop)** | React 19 + TypeScript + Vite + Tailwind CSS + AG Grid Community + Zustand + Axios + SheetJS (`xlsx`)<br>- 支援瀏覽器區網連線與 **Electron 桌面端封裝**（完整保留 `F1`~`F12` 功能鍵） |
| **Backend (API & Service)** | **C# .NET 8 (ASP.NET Core Web API / Windows Service `Wx3000Api`)**<br>- 預設監聽：`http://0.0.0.0:5007`（內建 Swagger UI 與 `wwwroot` 靜態 SPA 託管）<br>- 內建 `DbfSyncService`（VFP DBF 雙向同步）與 `SystemParamService`（系統參數管理） |
| **Database (Hybrid Sync)** | 1. **PostgreSQL 16** (`localhost:54320`, DB: `w3000`, Schema: `c:/w3000/comm` & `public`)<br>2. **Visual FoxPro DBF** (`C:\w3000\comm\*.dbf`) — 採用 **DBF 絕對權威雙向同步機制** |
| **LocalAgent (地端橋接服務)** | **Node.js (`localagent/agent.js`, Port `18889`, Windows Service `Wx3000Agent`)**<br>- **DBF 橋接**：透過 `DBFBridge.exe` 呼叫 `w3000_dbf.dll` (VFP COM) 執行 SHA256 Checksum、鎖定檢測與寫入<br>- **報表橋接**：透過 `WbaseBridge.exe` / `Koffi` 呼叫 Lazarus `wbaseRP.dll` 產生傳統 FastReport 預覽與中一刀列印 |
| **Package & Build Tools** | `pnpm` Workspace + `concurrently` + PowerShell 互動式管理選單 (`Wx3000-Manager.bat`) |

---

## 📁 核心目錄與模組結構

```text
Wx3000/
├── Wx3000-Manager.bat / .ps1       # [推薦] 互動式一鍵開發、編譯、部署與服務管理選單
├── BUILD_AND_DEPLOY.md             # 四大模組 (Frontend/Backend/LocalAgent/Electron) 編譯部署速查指南
├── WORKSPACE.md                    # 工作區開發規範與熱鍵標準
├── Wx3000_SPEC.md                  # 系統整體架構與規格書
├── GEMINI.md                       # AI Agent 核心開發準則
├── docs/                           # 模組詳細規格文件庫 (SPEC.md 總目錄)
│   ├── backend/backend_SPEC.md     # 後端 API、DBF 同步與資料庫規格
│   └── frontend/                   # 前端共用組件、wbase 主檔/發票統購、wtaxop 單據規格書
├── backend/                        # C# .NET 8 Web API & Windows Service (Port: 5007)
│   ├── Controllers/                # Wbase1020~3060, SystemParam, Products, Vendors, Purchase API
│   ├── Services/                   # DbfSyncService (DBF 雙向同步), SystemParamService
│   ├── Data/                       # AppDbContext & DbInitializer
│   └── Models/                     # 映射 c:/w3000/comm (cpa, keyin, taxno, customer, buyinv...)
├── frontend/                       # React 19 + Vite + Electron 前端專案
│   ├── electron/                   # Electron 主程序 (main.cjs, preload.cjs)
│   └── src/
│       ├── components/
│       │   ├── FoxProGrid/         # FoxProGridV2 (整頁多列盲打表格) + SearchModal
│       │   ├── FoxProGridCard/     # FoxProGridCard (主檔瀏覽卡片 + 滾動同步游標)
│       │   ├── FoxProGridBill/     # FoxProGridBill (單據 Header+Detail 盲打表格)
│       │   └── SelectXlsxField/    # FormUtilSelectXlsxFieldsList (Excel 動態欄位匯出設定器)
│       ├── wbase/                  # 事務所與發票統購系統
│       │   ├── menu/               # 三階手風琴鍵盤盲打主選單 + 深淺雙色主題
│       │   ├── wbase1020/          # 會計師/記帳士資料維護 (上方卡片 + 下方聯動表單)
│       │   ├── wbase1030/          # 員工/建檔人員資料維護 (FoxProGridV2)
│       │   ├── wbase1050/          # 稅務人員資料維護 (FoxProGridV2)
│       │   ├── wbase1060/          # 收費項目資料維護 (FoxProGridV2)
│       │   ├── wbase1070/          # 備註資料維護 (FoxProGridV2)
│       │   ├── wbase1080/          # 收費摘要資料維護 (FoxProGridV2)
│       │   ├── wbase2010/          # 公司基本資料維護 (上下/左右分割 + 6 大 Tab 跨頁跳欄)
│       │   ├── wbase3010/          # 發票購買地點維護 (FoxProGridV2)
│       │   ├── wbase3020/          # 發票預購輸入 (wbase3020_01/02) & 預購列印 (wbase3020_buyinv_print)
│       │   ├── wbase3050/          # 統購發票清單列印 (A4/中一刀簽收單) & 單價設定
│       │   └── wbase3060/          # 統購發票字軌輸入與國稅局/代售點 Excel 匯入
│       ├── wtaxop/PurchaseOrder/   # 進貨單盲打作業 (Header + Detail)
│       └── services/               # Axios API 客戶端、動態連線設定與欄位驗證 (validation.ts)
├── localagent/                     # 本機代理服務 (Port: 18889)
│   ├── agent.js                    # HTTP/WS 伺服器 (處理 /api/dbf/* 與 /report, /api/call)
│   ├── dlls.json                   # 動態 DLL 函數簽名配置檔
│   └── bridge/lazarus/             # DBFBridge.exe & WbaseBridge.exe (Lazarus FreePascal 橋接器)
├── report/                         # Lazarus FastReport 報表 DLL 源碼 (wbaseRP.lpr, wbaseRP.dll)
└── publish/Wx3000_Server/          # 伺服器一鍵安裝/啟停 Windows 服務批次檔與發佈目錄
```

---

## 🚀 快速啟動與打包指引 (Quick Start)

### 方式一：使用互動式管理工具（推薦）
直接雙擊根目錄的 **`Wx3000-Manager.bat`**（或於 PowerShell 執行 `.\Wx3000-Manager.ps1`），即可透過選單一鍵啟動開發伺服器、打包發佈並自動重啟 Windows 服務。

### 方式二：常用指令操作
```bash
# 1. 安裝依賴
pnpm install

# 2. 同時啟動全棧開發環境 (Backend + Frontend + LocalAgent)
pnpm dev

# 3. 單獨啟動各模組開發環境
pnpm dev:web        # 前端 Vite (http://localhost:5173)
pnpm dev:api        # 後端 C# API (http://localhost:5007)
node localagent/agent.js  # 地端代理服務 (http://localhost:18889)
pnpm dev:electron   # Electron 桌面端熱重載模式

# 4. 生產環境編譯與發佈
pnpm publish:server # 編譯前端並與後端一併發佈至 publish/Wx3000_Server/api
pnpm pack:electron  # 快速產出免安裝桌面端 (frontend/release/win-unpacked)
pnpm build:electron # 產出正式 Windows 安裝包與綠色版 EXE
```

> 📖 詳細的各模組編譯、Windows 服務註冊與故障排除，請參閱 [BUILD_AND_DEPLOY.md](file:///f:/ADSProject/Wx3000/BUILD_AND_DEPLOY.md)。

---

## 🔑 鍵盤盲打操作規範指南 (FoxPro Keyboard Shortcuts)

| 快捷鍵 | 主檔表格 (`FoxProGridV2`) | 卡片+表單 (`FoxProGridCard` / `1020` / `2010`) | 單據明細 (`FoxProGridBill`) |
| :--- | :--- | :--- | :--- |
| **Enter** | 向右移至下一格；列末跳至下一列首欄；底端自動增列並存檔 | 瀏覽時進入編修；表單內依序跳至下一欄位（支援跨 Tab 自動切換） | 向右跳欄；列末自動新增下一明細列 |
| **↑ / ↓** | 上下移動資料列；底端按 `↓` 自動新增空白列 | 上下切換選取資料列，下方/右側表單即時同步預覽 | 上下移動明細列 |
| **Ins / F2** | 插入/新增空白列或進入儲存格編輯 | `Ins` 新增資料、`F2` 開啟快速查詢彈窗 | 開立新單據 / 開窗快查 |
| **F3** | 開啟大型快查彈窗 (`SearchModal`) | 切換頁籤 (2010) 或查詢 | 開啟產品/廠商快查彈窗 |
| **F6** | 重新整理資料 (`onRefreshData`) | 進入編修模式 (`startEdit`) | - |
| **F7 / F9** | 開啟報表列印預覽 / 儲存變更 | `F7` 開啟報表列印視窗、`F9`/`Ctrl+S` 儲存表單 | 查詢單據 / 儲存 |
| **Del / F8** | 刪除目前選取列 | 彈出刪除確認對話框 | 刪除當前明細列 |
| **Esc** | 結束編輯、儲存結算並退回主選單 | 取消編修退回瀏覽模式，或退回系統主選單 | 退回上一層 |
| **直接打字** | 無須先按 F2，直接鍵入字元即時覆蓋儲存格內容 | 表單欄位聚焦時自動全選，打字直接覆蓋 | 直接鍵入字元即時覆蓋 |
