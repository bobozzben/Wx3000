# Project Specification: Wx3000 (FoxPro to Modern Hybrid Cloud/Local ERP Migration)

> **專案目標**：建立全端專案 `Wx3000` 用以無縫接軌並取代傳統 Visual FoxPro / Delphi / Lazarus Win32 會計師與記帳士事務所管理、營業稅申報與進銷存系統。核心關鍵在於**前端輸入手感 100% 模擬傳統 FoxPro 鍵盤盲打模式**（無須滑鼠），並透過 **PostgreSQL 16 與地端 VFP `.dbf` 動態磁碟機雙向即時同步引擎 (`SystemConfigService` + `DbfSyncService` + `DBFBridge`)** 以及 **Lazarus 64-bit 原生報表引擎 (`wbaseRP.dll`)**，讓新舊系統在轉型期間可於同一區域網路內安全並行運作。

---

## 1. 技術棧與環境規格 (Tech Stack)

| 項目 | 選用技術 / 規格說明 |
| :--- | :--- |
| **專案名稱** | `Wx3000` |
| **包管理工具** | `pnpm` (Monorepo / Workspace 管理架構) |
| **前端 (Frontend)** | React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid Community + Zustand + Axios + SheetJS (`xlsx`) |
| **桌面端 (Desktop)** | **Electron** (`frontend/electron/main.cjs`) — 支援獨立桌面視窗、動態切換後端伺服器 IP 與資料磁碟機 (`Ctrl+Shift+S`)，功能鍵保留給盲打（DevTools 改用 `Ctrl+Shift+I`、單按 `F5` 不重新整理、`F11` 切換全螢幕）；桌面端沒有內建自動更新，由安裝精靈維護選單 `[4]` 重新安裝 |
| **後端 (Backend)** | **C# .NET 8 (ASP.NET Core Web API)**<br>- 預設監聽埠號：`http://0.0.0.0:5007`<br>- 可發佈為獨立單一執行檔 (`publish/backend/Release/Wx3000.Backend.exe`) 或完整伺服器包 (`publish/Wx3000_Server/api`，內含 `wwwroot` 靜態前端)<br>- 支援註冊為 Windows 服務 (`Wx3000Api`) |
| **資料庫與雙向同步** | 1. **PostgreSQL 16**：`Host=localhost;Port=54320;Database=w3000;Username=postgres;Password=Pg_W3000`<br>2. **Visual FoxPro DBF**：`<Drive>:\w3000\comm\*.dbf`（透過 `ISystemConfigService` 動態映射至 PostgreSQL Schema `"<drive>:/w3000/comm"`，以 `dictionary.w3000_dbf` 記錄 SHA256 Checksum 進行即時雙向同步） |
| **本機代理 (LocalAgent)** | **Node.js (`localagent/agent.js`, Port `5009`, 只監聽 `127.0.0.1` 與 `::1`)**，打包為 `Wx3000Agent.exe`，安裝後於使用者登入時在背景自動啟動（報表預覽視窗才會出現在使用者桌面）<br>- **DBF 橋接**：透過 **32-bit `DBFBridge.exe`** 呼叫 32-bit `w3000_dbf.dll` (VFP COM) 執行 Checksum 計算、快照腳本產生與寫入（記錄被鎖定時回 `LOCK_TIMEOUT`）；`/api/dbf/*` 只供後端呼叫，帶 `Origin` / `Sec-Fetch-Site` 的瀏覽器請求會被拒絕（唯讀的 `/api/dbf/check_drive` 除外）<br>- **報表橋接**：透過 **64-bit `WbaseBridge.exe`** 或 `Koffi` 呼叫 64-bit Lazarus 編譯之 `wbaseRP.dll` 執行 FastReport 預覽與列印；只能呼叫 `localagent/dlls.json` 登記的函數，未登記回 `FORBIDDEN` |
| **建置、發版與更新** | GitHub Actions `ci.yml`（前端建置、Electron 免安裝打包、後端建置）與 `release.yml`（推送 `v*.*.*` tag 建立**草稿** Release）；正式發版一律用 `Wx3000-Manager.ps1` `[14]`（本機編譯報表元件 ➔ 推送 tag ➔ 補傳 `Wx3000_ReportBin_<版本>.zip` ➔ 正式發佈）。客戶端以 `publish/Install-Wx3000.ps1` 安裝、`publish/Update-Wx3000.ps1` 每日線上更新 |

---

## 2. 專案目錄結構 (Project Structure)

```text
Wx3000/
├── Wx3000-Manager.bat / .ps1      # 互動式一鍵開發、全套編譯打包 ([A]/[5]~[10]/[13])、GitHub 發版 [14] 與服務管理選單
├── BUILD_AND_DEPLOY.md            # 四大模組開發與打包部署速查指南
├── WORKSPACE.md                   # 工作區開發規範與熱鍵標準
├── Wx3000_SPEC.md                 # 本系統完整規格書
├── CLAUDE.md / GEMINI.md / SKILL.md # AI Agent 自動載入之核心行為準則與舊系統翻新協議
├── package.json                   # Root package.json (dev, publish:server, build:web, build:api, electron scripts)
├── .github/workflows/             # ci.yml (建置驗證) 與 release.yml (推送 tag 建立草稿 Release)
├── docs/                          # 詳細模組規格書目錄
│   ├── SPEC.md                    # 規格書總索引
│   ├── backend/backend_SPEC.md    # 後端 API、動態磁碟機、DBF 雙向同步與 PostgreSQL 規格
│   └── frontend/                  # 前端組件、wbase (1020~5070) 與 wtaxop 規格書
├── backend/                       # C# 後端 API 與 Windows 服務專案 (Port: 5007)
│   ├── Wx3000.Backend.csproj
│   ├── Program.cs                 # Web API / Windows Service 啟動入口 & wwwroot 託管
│   ├── appsettings.json           # 連線字串 (Port 54320, DB w3000) 與 LocalAgent URL
│   ├── Data/
│   │   ├── AppDbContext.cs        # EF Core PostgreSQL DbContext (支援動態 Schema)
│   │   ├── DynamicModelCacheKeyFactory.cs # 依 CurrentPgSchema 動態快取 EF Model
│   │   └── DbInitializer.cs       # 冪等性原生 SQL DDL 建表與初始資料
│   ├── Services/
│   │   ├── IDbfSyncService.cs / DbfSyncService.cs           # VFP DBF 雙向同步服務
│   │   ├── ISystemConfigService.cs / SystemConfigService.cs # 動態資料磁碟機 (C:/F:) 與 Schema 管理
│   │   ├── ISystemParamService.cs / SystemParamService.cs   # 動態 Schema/Table 系統參數讀寫
│   │   └── TransferPasswordService.cs                       # 轉檔列印密碼 (motherp.txt) 後端比對 (2-2 / 2-3 進入前、5-7 F8 轉出前)
│   ├── Models/                    # CpaMaster, EmpMaster, TaxOfficerMaster, FeeItemMaster,
│   │                              # NoteMaster, FeeSummaryMaster, CompanyMaster,
│   │                              # TicketPlaceMaster, InvoicePurchaseMaster, AccountMaster,
│   │                              # Wbase2030/2040/2050/4020/5010/5070Models (各模組 DTO),
│   │                              # Product, Vendor, PurchaseHeader, PurchaseLine
│   ├── DTOs/                      # CreatePurchaseOrderDto
│   └── Controllers/               # SystemConfig, SystemParam, Wbase1020~1080, Wbase2010~2050,
│                                  # Wbase3010~3060, Wbase4010, Wbase4020, Wbase5010, Wbase5070,
│                                  # Products, Vendors, Purchase
├── frontend/                      # React 19 + Vite + Electron 前端專案
│   ├── electron/                  # Electron 主程序 (main.cjs, preload.cjs)
│   └── src/
│       ├── mainmenu/              # 奇勝資訊 Wx3000 系統總入口 (四大系統分區、快捷鍵導覽)
│       ├── components/
│       │   ├── FoxProGrid/        # FoxProGridV2 + SearchModal + FoxProPrintModal + AddressSelectModal
│       │   ├── FoxProGridCard/    # FoxProGridCard + useFoxProCardNavigation (表單盲打導覽 Hook)
│       │   ├── FoxProGridBill/    # FoxProGridBill (單據 Header+Detail 盲打表格)
│       │   ├── SelectXlsxField/   # FormUtilSelectXlsxFieldsList (Excel 動態欄位匯出器)
│       │   ├── WbasePageHeader.tsx# 統一模組頂部標題列與模式徽章
│       │   └── ServerConfigModal.tsx # 伺服器連線位址與資料磁碟機動態配置彈窗 (Ctrl+Shift+S)
│       ├── wbase/                 # 事務所基本資料、客戶、營業稅發票統購、操作設定與管理報表模組 (Z-基本資料系統)
│       │   ├── menu/              # 三階動態手風琴選單 + 雙色主題 (ThemeContext)
│       │   ├── wbase1020/         # 會計師/記帳士資料維護 (FoxProGridCard + Wbase1020Form)
│       │   ├── wbase1030/         # 建檔人員(員工)資料維護 (12 欄 FoxProGridV2 + w3000 密碼加解密)
│       │   ├── wbase1050/         # 稅務人員資料維護 (7 欄 FoxProGridV2 + F2 地址快選)
│       │   ├── wbase1060/         # 收費項目資料維護 (FoxProGridV2)
│       │   ├── wbase1070/         # 備註資料維護 (recnote.dbf ⇄ FoxProGridV2)
│       │   ├── wbase1080/         # 收費摘要資料維護 (recmemo.dbf ⇄ FoxProGridV2)
│       │   ├── wbase2010/         # 客戶資料建檔 (上下/左右分割 + 6 大 Tab 跨頁盲打)
│       │   ├── wbase2030/         # 2-2 客戶資料匯出 / 2-3 客戶資料匯入 (轉檔列印密碼 + custbak.dbf)
│       │   ├── wbase2040/         # 客戶收費資料輸入 (F4 收據、F6 請款單 DLL 報表、F9 收費統計表 Excel)
│       │   ├── wbase2050/         # 總分支機構設定 (總機構清單 + F8 分公司資料維護)
│       │   ├── wbase3010/         # 發票購買地點資料維護 (FoxProGridV2 + F2 地址快選)
│       │   ├── wbase3020/         # 發票預購輸入 (01/02) 與預購表列印 (wbase3020_buyinv_print，選單 3-3)
│       │   ├── wbase3050/         # 統購發票清單列印 (A4/中一刀簽收單) 與單價設定
│       │   ├── wbase3060/         # 統購發票字軌輸入 (01/02) 與國稅局/代售點 Excel 匯入
│       │   ├── wbase4010/         # 4-1 標準會計科目維護 (6 種科目表 xmaster~xmaster6)
│       │   ├── wbase4020/         # 4-2~4-6 營業稅設定、傳票轉檔、進銷存方式、共用科目摘要、共用參數
│       │   ├── wbase5010/         # 5-1~5-6 客戶資料列印、郵寄標籤、登打統計、營業/財務狀況表、委任書
│       │   └── wbase5070/         # 5-7 碳健檢企業名單匯出 (勾選客戶、t403 銷售額加總、匯出 Excel)
│       ├── wtaxop/                # 進銷存單據作業模組 (PurchaseOrder)
│       ├── services/              # Axios API、apiConfig、addressService、localagent、validation.ts
│       └── data/                  # 台灣縣市鄉鎮郵遞區號 (taiwanDistricts.ts) 與路名庫 (taiwan_roads.json)
├── localagent/                    # 本機代理服務 (Port: 5009，只監聽 127.0.0.1 / ::1)
│   ├── agent.js                   # 整合 DBFBridge 隊列與報表 DLL 呼叫之 HTTP/WS Server
│   ├── agent.test.js              # node --test 單元測試 (npm test)
│   ├── dlls.json                  # 可呼叫的報表 DLL 函數白名單與簽名
│   ├── wbase/wbaseRP.dll          # 64-bit 報表 DLL
│   └── bridge/lazarus/            # DBFBridge.lpr/.exe (32-bit) & WbaseBridge_Generic.lpr/.exe (64-bit)
├── report/wbase/                  # 報表 DLL 原始碼 (Lazarus + FastReport，wbaseRP.lpi / wbase_unit1 / wbase_repunit1)
└── publish/                       # 統一打包輸出目錄與客戶端安裝/更新/DBF 同步診斷腳本
```

---

## 3. 核心架構設計規範

### 3.1 混合雲地雙向資料同步與動態磁碟機架構 (`SystemConfigService` + `DbfSyncService`)
為確保現代化 Web/Electron 介面與傳統 FoxPro 桌面系統在過渡期能同時讀寫同一份資料且支援多磁碟機環境（如 `C:\w3000` 或網路磁碟機 `F:\w3000`），系統實作了 **「地端 DBF 絕對權威」雙向同步機制**：
1. **動態資料磁碟機切換 (`ISystemConfigService` + `X-Data-Drive`)**：
   - 前端於啟動時透過 `ServerConfigModal`（或快捷鍵 `Ctrl+Shift+S`）設定資料來源磁碟機代號（如 `C` 或 `F`），並於每次 Axios 請求自動附帶 `X-Data-Drive` Header。
   - 後端 `AppDbContext` 搭配 `DynamicModelCacheKeyFactory` 自動將實體映射至對應之 PostgreSQL Schema（如 `"c:/w3000/comm"` 或 `"f:/w3000/comm"`）與地端 DBF 目錄（`C:\w3000\comm` 或 `F:\w3000\comm`）。
2. **讀取快取與變更偵測 (`EnsureTableSyncedAsync(dbfPath, dbfName, schema, table, keyFields)`)**：
   - 每次 API 讀取前，後端向 `LocalAgent` (`POST /api/dbf/checksum`) 取得地端 `.dbf` 的即時 `SHA256:FileSize` 校驗碼。
   - 與 PostgreSQL `dictionary.w3000_dbf` 中記錄的 `checksum` 比對：相符則直接由 PostgreSQL 高速查詢（Fast-path ~2ms）；不符則透過 `LocalAgent` (`POST /api/dbf/get_pg_script`，由 32-bit `DBFBridge.exe` 產生) 取得結構與資料腳本，將最新 DBF 結構與內容整表重灌至 PostgreSQL。
   - **重灌在單一交易內完成**：先清空舊快照 (`TRUNCATE`) 並移除舊的唯一索引 (`ux_` 開頭)，再依本次 `keyFields` 重建結構與資料；任何一步失敗都整個回復，保留原本的快照。
   - `keyFields` 會成為 PostgreSQL 的唯一鍵；沒有唯一鍵的表傳 `""`。DBF 主鍵重複時，快照每個主鍵只保留 RECNO 最小的一筆（與 VFP `LOCATE` / `SEEK` 一致），重複清單記在 `dictionary.w3000_dbf_dupkey`。快照的 `_record_number` 等於實體 RECNO，已刪除列不在快照中。
3. **權威雙寫與鎖定保護 (`WriteRecordAsync(..., operation, keyField, keyValue, fields)`)**：
   - 當前端執行新增 (`INSERT`)、修改 (`UPDATE`)、刪除 (`DELETE`) 時，後端**優先呼叫 `LocalAgent` (`/api/dbf/write`) 寫入地端 DBF**（LocalAgent 組成 VFP `REPLACE` 腳本交給 `DBFBridge.exe` 執行），成功後才寫入 PostgreSQL 並更新 Checksum。`keyField` 可以是 VFP 運算式（例如 `"RECNO(),rno"`），日期欄傳 `{"$date":"yyyy-MM-dd"}`。
   - 若另一台傳統 FoxPro 工作站正鎖定該筆紀錄 (`RLOCK`) 或獨佔開啟該表，回傳 `LOCK_TIMEOUT` (HTTP `409 Conflict`)，後端立即中止操作並向前端顯示明確提示，**絕不單邊寫入 PostgreSQL**。
4. **LocalAgent 存取限制**：
   - LocalAgent 只監聽 `127.0.0.1` 與 `::1`，並檢查 `Host` 標頭防 DNS rebinding。
   - `/api/dbf/*` 不接受瀏覽器呼叫（帶 `Origin` 或 `Sec-Fetch-Site` 即拒絕，唯讀的 `check_drive` 除外）；可直接轉送給 `DBFBridge.exe` 的動作只有 `PING`、`CHECKSUM`、`READ`、`GET_PG_SCRIPT`，`EXEC_VFP` 只能由寫入流程內部使用。

### 3.2 前端核心盲打與輔助組件
1. **`<FoxProGridV2 />`（多列行內盲打組件）**：
   - 預設 `minRows = 0`（僅顯示實際資料筆數，對齊原生 FoxPro GRID），支援欄位寬度拖曳記憶 (`gridId`)、儲存格直接打字覆蓋、`uppercase`/`digitOnly`/`maxBytes` Big5 長度控制、`validate` 欄位檢核、`hasEllipsis` 儲存格內 `F2` 開窗按鈕、`Enter`/`Tab` 橫向跳欄與離列即時存檔。
2. **`<FoxProGridCard />` + `useFoxProCardNavigation`（主檔清單卡片與表單導覽母版）**：
   - 用於「上方/左側主檔瀏覽清單 + 下方/右側詳細編輯表單」之複合佈局（如 `wbase1020`、`wbase2010`）。
   - 提供 `foxProFocusAndSelect`（聚焦自動全選、打字直接覆蓋）、`Enter`/`↓` 下一欄、`↑` 上一欄、跨 Tab 自動切換、自動跳過 `disabled` 欄位與末欄 `Enter` 自動存檔。
3. **`<AddressSelectModal />`（台灣地址智慧快選視窗）**：
   - 對齊 Lazarus `util_hi_addr_form.pas`，內建全台縣市、鄉鎮市區郵遞區號與路名資料庫，支援智慧解析既有地址、門牌樓層速選按鈕與半形數字轉全形 (`digToBig`)。
4. **`<FoxProPrintModal />` & `<FormUtilSelectXlsxFieldsList />`（統一列印與 Excel 動態匯出母版）**：
   - 標準化 `F7` 區間列印預覽、純淨紙張列印與雙欄式 Excel 動態欄位自訂匯出。

### 3.3 本機報表 DLL (`LocalAgent` + `wbaseRP.dll`)
1. **呼叫流程**：前端 `POST http://localhost:5009/report`（或 `/api/call`），LocalAgent 把 `jsonData` 寫成 `%TEMP%\Wx3000\` 暫存 JSON，再交給 64-bit `WbaseBridge.exe`（預設 `bridge` 模式；環境變數 `WBASE_MODE=koffi` 時改由 Koffi 直接載入）呼叫 `wbaseRP.dll` 的 stdcall 函數。`IsPrint`：`0` 預覽、`1` 直接列印、`999` 只 PrepareReport 不開視窗。
2. **函數白名單**：只能呼叫 `localagent/dlls.json` 登記的函數，未登記回 `FORBIDDEN`。目前 `wbaseRP` 登記 10 個：

   | 函數 | 使用模組 |
   | :--- | :--- |
   | `waccrep3101_b` | wbase1030 建檔人員清冊 |
   | `wbase1050_taxno_list` / `wbase1060_recitem_list` / `wbase1070_recnote_list` / `wbase1080_feesummary_list` | wbase1050 / 1060 / 1070 / 1080 清冊 |
   | `wbase3010_ticketplace_list` | wbase3010 購買地點清冊 |
   | `wbase320_buyinv` | wbase3020 預購統一發票列印 |
   | `wbase350_buyinv_list` | wbase3050 統購發票清單 / 簽收單 |
   | `wbase2040_receipt` / `wbase2040_bill` | wbase2040 `F4` 收據、`F6` 請款單 |

3. **新增報表**：`report/wbase/wbase_unit1.lfm` / `.pas` 加 `TfrxReport` 範本（資料集名 `MTable`）、`wbase_repunit1.pas` 加 stdcall 函數、`wbaseRP.lpr` 匯出、`localagent/dlls.json` 登記；以 Manager `[13]` 編譯（確認 `dlls.json` 登記的函數都已匯出、新 `WbaseBridge.exe` 試跑能載入 DLL 後，才覆蓋 `localagent/wbase/wbaseRP.dll` 與 `WbaseBridge.exe`），再執行 `[8]` 重新打包並重啟 LocalAgent。`[13]` 會改到已追蹤的 `report/wbase/lib/x86_64-win64/wbase_unit1.lfm`，不打算提交時用 `git checkout --` 還原。
4. **位元架構**：`DBFBridge.exe` 必須 32-bit、`WbaseBridge.exe` 必須 64-bit，位元錯誤會出現 `LoadLibrary ... Code=193`。
