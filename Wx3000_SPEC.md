# Project Specification: Wx3000 (FoxPro to Modern Hybrid Cloud/Local ERP Migration)

> **專案目標**：建立全端專案 `Wx3000` 用以無縫接軌並取代傳統 Visual FoxPro / Delphi Win32 會計師與記帳士事務所管理、營業稅申報與進銷存系統。核心關鍵在於**前端輸入手感 100% 模擬傳統 FoxPro 鍵盤盲打模式**（無須滑鼠），並透過 **PostgreSQL 16 與地端 VFP `.dbf` 雙向即時同步引擎 (`DbfSyncService` + `DBFBridge`)** 以及 **Lazarus 原生報表引擎 (`wbaseRP.dll`)**，讓新舊系統在轉型期間可於同一區域網路內安全並行運作。

---

## 1. 技術棧與環境規格 (Tech Stack)

| 項目 | 選用技術 / 規格說明 |
| :--- | :--- |
| **專案名稱** | `Wx3000` |
| **包管理工具** | `pnpm` (Monorepo / Workspace 管理架構) |
| **前端 (Frontend)** | React 19 + TypeScript + Vite + Tailwind CSS + AG Grid Community + Zustand + Axios + SheetJS (`xlsx`) |
| **桌面端 (Desktop)** | **Electron** (`frontend/electron/main.cjs`) — 支援獨立桌面視窗、動態切換後端伺服器 IP，並完整保留 `F1`~`F12` 功能鍵 |
| **後端 (Backend)** | **C# .NET 8 (ASP.NET Core Web API)**<br>- 預設監聽埠號：`http://0.0.0.0:5007`<br>- 可發佈為獨立單一執行檔 (Single File EXE) 或完整伺服器包 (`publish/Wx3000_Server/api`，內含 `wwwroot` 靜態前端)<br>- 支援註冊為 Windows 服務 (`Wx3000Api`) |
| **資料庫與雙向同步** | 1. **PostgreSQL 16**：`Host=localhost;Port=54320;Database=w3000;Username=postgres;Password=Pg_W3000`<br>2. **Visual FoxPro DBF**：`C:\w3000\comm\*.dbf`（映射至 PostgreSQL Schema `"c:/w3000/comm"`，以 `dictionary.w3000_dbf` 記錄 SHA256 Checksum 進行即時雙向同步） |
| **本機代理 (LocalAgent)** | **Node.js (`localagent/agent.js`, Port `18889`, Windows Service `Wx3000Agent`)**<br>- **DBF 橋接**：透過 `DBFBridge.exe` 呼叫 `w3000_dbf.dll` (VFP COM) 執行 Checksum 計算、RLOCK 鎖定檢測與寫入<br>- **報表橋接**：透過 `WbaseBridge.exe` 或 `Koffi` 呼叫 Lazarus 編譯之 `wbaseRP.dll` 執行 FastReport 預覽與列印 |

---

## 2. 專案目錄結構 (Project Structure)

```text
Wx3000/
├── Wx3000-Manager.bat / .ps1      # 互動式一鍵開發、編譯、部署與服務管理選單
├── BUILD_AND_DEPLOY.md            # 四大模組開發與打包部署速查指南
├── WORKSPACE.md                   # 工作區開發規範與熱鍵標準
├── Wx3000_SPEC.md                 # 本系統完整規格書
├── GEMINI.md                      # AI Agent 自動載入之核心行為準則
├── package.json                   # Root package.json (dev, publish:server, electron scripts)
├── docs/                          # 詳細模組規格書目錄
│   ├── SPEC.md                    # 規格書總索引
│   ├── backend/backend_SPEC.md    # 後端 API、DBF 雙向同步與 PostgreSQL 規格
│   └── frontend/                  # 前端組件、wbase (1020~3060) 與 wtaxop 規格書
├── backend/                       # C# 後端 API 與 Windows 服務專案 (Port: 5007)
│   ├── Wx3000.Backend.csproj
│   ├── Program.cs                 # Web API / Windows Service 啟動入口 & wwwroot 託管
│   ├── appsettings.json           # 連線字串 (Port 54320, DB w3000) 與 LocalAgent URL
│   ├── Data/
│   │   ├── AppDbContext.cs        # EF Core PostgreSQL DbContext
│   │   └── DbInitializer.cs       # 冪等性原生 SQL DDL 建表與初始資料
│   ├── Services/
│   │   ├── IDbfSyncService.cs     # VFP DBF 雙向同步服務介面
│   │   ├── DbfSyncService.cs      # DBF Checksum 比對、重灌與權威寫入實作
│   │   ├── ISystemParamService.cs # 系統參數存取介面
│   │   └── SystemParamService.cs  # 動態 Schema/Table 系統參數讀寫實作
│   ├── Models/                    # CpaMaster, EmpMaster, TaxOfficerMaster, FeeItemMaster,
│   │                              # NoteMaster, FeeSummaryMaster, CompanyMaster,
│   │                              # TicketPlaceMaster, InvoicePurchaseMaster,
│   │                              # Product, Vendor, PurchaseHeader, PurchaseLine
│   └── Controllers/               # Wbase1020~1080, Wbase2010, Wbase3010~3060,
│                                  # SystemParam, Products, Vendors, Purchase
├── frontend/                      # React 19 + Vite + Electron 前端專案
│   ├── electron/                  # Electron 主程序 (main.cjs, preload.cjs)
│   └── src/
│       ├── components/
│       │   ├── FoxProGrid/        # [核心元件 A] FoxProGridV2 整頁多列行內盲打表格 + SearchModal
│       │   ├── FoxProGridCard/    # [核心元件 B] FoxProGridCard 主檔清單瀏覽卡片 (支援滾動同步游標)
│       │   ├── FoxProGridBill/    # [核心元件 C] FoxProGridBill 單據 Header+Detail 盲打表格
│       │   ├── SelectXlsxField/   # [核心元件 D] FormUtilSelectXlsxFieldsList Excel 動態欄位匯出器
│       │   └── ServerConfigModal.tsx # 伺服器連線位址動態配置彈窗
│       ├── wbase/                 # 事務所基本資料與營業稅發票統購模組
│       │   ├── menu/              # 三階動態手風琴選單 + 雙色主題 (ThemeContext)
│       │   ├── wbase1020/         # 會計師/記帳士資料維護 (FoxProGridCard + 下方聯動表單)
│       │   ├── wbase1030/         # 建檔人員(員工)資料維護 (FoxProGridV2)
│       │   ├── wbase1050/         # 稅務人員資料維護 (FoxProGridV2)
│       │   ├── wbase1060/         # 收費項目資料維護 (FoxProGridV2)
│       │   ├── wbase1070/         # 備註資料維護 (FoxProGridV2)
│       │   ├── wbase1080/         # 收費摘要資料維護 (FoxProGridV2)
│       │   ├── wbase2010/         # 公司基本資料維護 (上下/左右分割 + 6 大 Tab 跨頁盲打)
│       │   ├── wbase3010/         # 發票購買地點資料維護 (FoxProGridV2)
│       │   ├── wbase3020/         # 發票預購輸入 (01/02) 與預購表列印 (wbase3020_buyinv_print)
│       │   ├── wbase3050/         # 統購發票清單列印 (A4/中一刀簽收單) 與單價設定
│       │   └── wbase3060/         # 統購發票字軌輸入 (01/02) 與國稅局/代售點 Excel 匯入
│       ├── wtaxop/                # 進銷存單據作業模組
│       │   └── PurchaseOrder/     # 進貨單盲打登錄作業
│       ├── services/              # Axios API 封裝、LocalAgent 呼叫與非阻斷欄位驗證 (validation.ts)
│       └── store/                 # Zustand 狀態管理
├── localagent/                    # 本機代理服務 (Port: 18889)
│   ├── agent.js                   # 整合 DBFBridge 隊列與報表 DLL 呼叫之 HTTP/WS Server
│   ├── dlls.json                  # 報表 DLL 函數簽名設定檔
│   └── bridge/lazarus/            # DBFBridge.lpr / .exe & WbaseBridge_Generic.lpr / .exe
├── report/                        # Lazarus FastReport 報表 DLL 源碼 (wbaseRP.lpr / wbaseRP.dll)
└── publish/Wx3000_Server/         # 生產環境伺服器部署包與 Windows 服務管理腳本
```

---

## 3. 核心架構設計規範

### 3.1 混合雲地雙向資料同步架構 (`DbfSyncService` + `DBFBridge`)
為確保現代化 Web/Electron 介面與傳統 FoxPro 桌面系統在過渡期能同時讀寫同一份資料且零衝突，系統實作了 **「地端 DBF 絕對權威」雙向同步機制**：
1. **讀取快取與變更偵測 (`EnsureTableSyncedAsync`)**：
   - 每次 API 讀取前，後端向 `LocalAgent` (`POST /api/dbf/checksum`) 取得地端 `C:\w3000\comm\<table_name>.dbf` 的即時 `SHA256:FileSize` 校驗碼。
   - 與 PostgreSQL `dictionary.w3000_dbf` 中記錄的 `file_checksum` 比對：
     - **相符 (Fast-path ~2ms)**：代表外部 VFP 未異動該表，直接由 EF Core 從 PostgreSQL Schema `"c:/w3000/comm"` 高速查詢。
     - **不符**：自動觸發 `DBFBridge.exe` (`SYNC_TABLE`) 呼叫 `w3000_dbf.dll` 將最新 DBF 結構與內容重灌至 PostgreSQL。
2. **權威雙寫與鎖定保護 (`WriteRecordAsync`)**：
   - 當前端執行新增 (`INSERT`)、修改 (`UPDATE`)、刪除 (`DELETE`) 時，後端**優先呼叫 `LocalAgent` (`/api/dbf/call`) 寫入地端 DBF**。
   - `LocalAgent` 內建 Promise 串列隊列 (`dbfQueue`) 防止併發撞檔；若另一台傳統 FoxPro 工作站正鎖定該筆紀錄 (`RLOCK`)，將回傳 `LOCK_TIMEOUT` (HTTP `409 Conflict`)，後端立即中止操作並向前端顯示明確提示，**絕不單邊寫入 PostgreSQL**。
   - 地端 DBF 寫入成功後，後端同步更新 PostgreSQL 對應紀錄，並立即刷新 `dictionary.w3000_dbf` 的校驗碼，避免下次讀取時誤判重灌。

### 3.2 前端三大 FoxPro 盲打核心組件
1. **`<FoxProGridV2 />`（多列試算表行內盲打組件）**：
   - 預設顯示至少 15 列高對比表格，支援多層表頭 (`headerGroups`)、儲存格直接打字覆蓋、`Enter`/`Tab` 橫向跳欄、列末自動換行、底端自動新增空白列、離開該列或按 `Enter` 自動觸發 `onSaveRow`。
2. **`<FoxProGridCard />`（主檔清單卡片組件）**：
   - 用於「上方/左側主檔瀏覽清單 + 下方/右側詳細編輯表單」之複合佈局（如 `wbase1020` 會計師維護、`wbase2010` 公司維護）。
   - 支援鍵盤 `↑`/`↓`/`PageUp`/`PageDown` 快速換筆、滑鼠滾輪防抖自動同步選取列 (`enableScrollSync`)，下方表單即時同步預覽當前選取之完整資料。
3. **`<FoxProGridBill />`（單據 Header + Detail 連續登打組件）**：
   - 用於進銷存單據（如 `wtaxop/PurchaseOrder`），支援品號/廠商開窗快查、數量×單價即時試算、列末 `Enter` 自動新增明細列。

### 3.3 原生報表預覽與 Excel 動態欄位匯出
1. **Lazarus FastReport 報表 (`wbaseRP.dll`)**：
   - 前端將查詢結果 JSON 傳送至 `LocalAgent` (`http://localhost:18889/report` 或 `/wbase320_buyinv`、`/wbase350_buyinv_list`)。
   - `LocalAgent` 自動將 JSON 寫入本機暫存檔並啟動 `WbaseBridge.exe` 載入 `wbaseRP.dll`，開啟原生高解析度預覽視窗或直接驅動點陣/雷射印表機（支援 A4 清冊與中一刀簽收單）。
2. **Excel 動態欄位匯出器 (`<FormUtilSelectXlsxFieldsList />`)**：
   - 還原 FoxPro 經典「左欄待選欄位 ⇄ 右欄已選匯出欄位」雙列表設計，支援自訂欄位標題、順序調整、金額/家數合計列自動附加，並持久化設定至 `localStorage`。

---

## 4. 開發防呆與禁忌 (Strict Guidelines - DO NOT)

1. ❌ **禁止強迫使用滑鼠**：所有搜尋、換行、切換頁籤、增刪列與存檔必須能透過鍵盤熱鍵完成。
2. ❌ **禁止 Dropdown 下拉搜尋**：代號與條件搜尋必須使用 **`F2` / `F3` 觸發的大型開窗 `SearchModal`**。
3. ❌ **禁止預設需要先按 F2 才能打字**：儲存格必須支援 Direct Keypress Overwrite；表單欄位聚焦時自動全選。
4. ❌ **禁止繞過 DBF 同步單邊修改資料庫**：凡掛載 `IDbfSyncService` 之模組，寫入操作必須遵守 DBF 先行原則。
5. ❌ **禁止因非關鍵格式瑕疵強制阻斷舊資料存檔**：如歷史客戶/會計師之非標準 Email 格式，應使用 `isValidEmail` (`frontend/src/services/validation.ts`) 顯示友善 `⚠️ 格式` 提示徽章，仍允許正常儲存。
