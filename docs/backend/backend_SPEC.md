# 規格書：C# ASP.NET Core 後端 API、動態磁碟機與 VFP DBF 雙向同步規格

> **專案代號**：`Wx3000.Backend`  
> **技術架構**：C# .NET 8 ASP.NET Core Web API + EF Core (`DynamicModelCacheKeyFactory`) + Npgsql + `SystemConfigService` + `DbfSyncService`  
> **檔案目錄**：`backend/`  
> **預設監聽**：`http://0.0.0.0:5007` (Windows 服務名稱：`Wx3000Api`)  
> **目標資料庫**：PostgreSQL 16 (`localhost:54320` / Database: `w3000` / 動態 Schema: `<drive>:/w3000/comm` & `public`) + 地端 VFP DBF (`<Drive>:\w3000\comm\*.dbf`)

---

## 1. 系統定位與部署規格

1. **多合一伺服器包裝**：
   - 支援 `dotnet run` / `pnpm dev:api` 本地開發偵錯。
   - 支援發佈為獨立單一執行檔 (`pnpm build:api` ➔ `publish/backend/Release/Wx3000.Backend.exe`) 或含 `wwwroot` 靜態前端之完整伺服器包 (`pnpm publish:server` ➔ `publish/Wx3000_Server/api` 與 `backend/wwwroot`)。
   - 支援安裝為 Windows Service (服務名稱 `Wx3000Api`)，透過 `builder.Host.UseWindowsService()` 實現開機背景自啟。
2. **動態資料磁碟機與 Schema 切換 (`SystemConfigService` + `DynamicModelCacheKeyFactory`)**：
   - 支援透過 `/api/systemconfig`（持久化於 `system_config.json`）或前端請求 Header `X-Data-Drive`（如 `C` 或 `F`）動態切換資料來源磁碟機。
   - 自動對應地端 DBF 路徑（如 `C:\w3000\comm` 或 `F:\w3000\comm`）與 PostgreSQL Schema（如 `"c:/w3000/comm"` 或 `"f:/w3000/comm"`），並透過 `DynamicModelCacheKeyFactory` 動態快取 EF Core Model 與執行 `DbInitializer.Initialize` 自動建表。

---

## 2. 檔案目錄結構

```text
backend/
├── Wx3000.Backend.csproj
├── Program.cs                           # API 入口點、Windows Service 註冊、DI 注入、Swagger 與 wwwroot 託管
├── appsettings.json                     # Urls (5007)、PostgreSQL (54320/w3000) 與 LocalAgent (18889) 配置
├── Data/
│   ├── AppDbContext.cs                  # EF Core DbContext (依 CurrentPgSchema 動態映射資料表)
│   ├── DynamicModelCacheKeyFactory.cs   # EF Core 動態 Schema Model Cache Key 工廠
│   └── DbInitializer.cs                 # 冪等性原生 SQL DDL 建表與初始種子資料初始化
├── Services/
│   ├── IDbfSyncService.cs               # 地端 VFP DBF 雙向同步服務介面
│   ├── DbfSyncService.cs                # Checksum 比對、自動快照重灌、DBF 權威寫入與鎖定檢測
│   ├── ISystemConfigService.cs          # 系統磁碟機與路徑配置介面
│   ├── SystemConfigService.cs           # 動態磁碟機 (X-Data-Drive / system_config.json) 與目录檢測服務
│   ├── ISystemParamService.cs           # 系統參數讀寫介面
│   └── SystemParamService.cs            # 動態 Schema/Table 參數存取服務
├── Models/
│   ├── CpaMaster.cs                     # 會計師主檔 (table: cpa)
│   ├── EmpMaster.cs                     # 建檔人員主檔 (table: keyin, 12 欄位含 psw/onepassno)
│   ├── TaxOfficerMaster.cs              # 稅務人員主檔 (table: taxno, 7 欄位)
│   ├── FeeItemMaster.cs                 # 收費項目主檔 (table: recitem)
│   ├── NoteMaster.cs                    # 備註主檔 (table: recnote, key: noteno)
│   ├── FeeSummaryMaster.cs              # 收費摘要主檔 (table: recmemo, key: mno)
│   ├── CompanyMaster.cs                 # 公司基本資料主檔 (table: customer)
│   ├── TicketPlaceMaster.cs             # 購票地點主檔 (table: place)
│   ├── InvoicePurchaseMaster.cs         # 發票購買與字軌主檔 (table: buyinv)
│   ├── Product.cs / Vendor.cs           # 產品 / 廠商主檔
│   └── PurchaseHeader.cs / PurchaseLine.cs # 進貨單頭與明細
└── Controllers/
    ├── SystemConfigController.cs        # 資料磁碟機設定與檢測 API (/api/systemconfig)
    ├── SystemParamController.cs         # 系統參數讀寫 API (/api/systemparam)
    ├── Wbase1020Controller.cs           # 會計師維護 API (/api/wbase1020)
    ├── Wbase1030Controller.cs           # 建檔人員維護 API (/api/wbase1030)
    ├── Wbase1050Controller.cs           # 稅務人員維護 API (/api/wbase1050)
    ├── Wbase1060Controller.cs           # 收費項目維護 API (/api/wbase1060)
    ├── Wbase1070Controller.cs           # 備註維護 API (/api/wbase1070)
    ├── Wbase1080Controller.cs           # 收費摘要維護 API (/api/wbase1080)
    ├── Wbase2010Controller.cs           # 公司基本資料維護 API (/api/wbase2010)
    ├── Wbase3010Controller.cs           # 購票地點維護 API (/api/wbase3010)
    ├── Wbase3020Controller.cs           # 發票預購維護、媒體檔與預購表列印 API (/api/wbase3020)
    ├── Wbase3050Controller.cs           # 統購發票清單列印與單價設定 API (/api/wbase3050)
    ├── Wbase3060Controller.cs           # 統購發票字軌維護與 Excel 匯入 API (/api/wbase3060)
    └── Products / Vendors / PurchaseController.cs
```

---

## 3. 混合雲地 VFP DBF 雙向同步架構 (`DbfSyncService.cs`)

### 3.1 PostgreSQL 與地端 DBF 映射對照表

| 模組代號 | C# Entity Model | 地端 DBF 路徑 | PostgreSQL Schema | PostgreSQL Table | 主鍵欄位 (KeyField) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wbase1020` | `CpaMaster` | `<Drive>:\w3000\comm\cpa.dbf` | `<drive>:/w3000/comm` | `cpa` | `no` |
| `wbase1030` | `EmpMaster` | `<Drive>:\w3000\comm\keyin.dbf` | `<drive>:/w3000/comm` | `keyin` | `no` (`hexFields: psw,onepassno`) |
| `wbase1050` | `TaxOfficerMaster` | `<Drive>:\w3000\comm\taxno.dbf` | `<drive>:/w3000/comm` | `taxno` | `no` |
| `wbase1060` | `FeeItemMaster` | `<Drive>:\w3000\comm\recitem.dbf` | `<drive>:/w3000/comm` | `recitem` | `itemno` |
| `wbase1070` | `NoteMaster` | `<Drive>:\w3000\comm\recnote.dbf` | `<drive>:/w3000/comm` | `recnote` | `noteno` |
| `wbase1080` | `FeeSummaryMaster` | `<Drive>:\w3000\comm\recmemo.dbf` | `<drive>:/w3000/comm` | `recmemo` | `mno` |
| `wbase2010` | `CompanyMaster` | `<Drive>:\w3000\comm\customer.dbf` | `<drive>:/w3000/comm` | `customer` | `no` |
| `wbase3010` | `TicketPlaceMaster` | `<Drive>:\w3000\comm\place.dbf` | `<drive>:/w3000/comm` | `place` | `no` |
| `wbase3020` / `3050` / `3060` | `InvoicePurchaseMaster` | `<Drive>:\w3000\comm\buyinv.dbf` | `<drive>:/w3000/comm` | `buyinv` | `yymm,times,no` |

### 3.2 同步與鎖定處理流程
1. **讀取前檢核 (`EnsureTableSyncedAsync`)**：
   - 呼叫 `LocalAgent` (`POST /api/dbf/checksum`) 計算 `.dbf` 檔案的 `SHA256:FileSize`。
   - 比對 PostgreSQL `dictionary.w3000_dbf` 表中之 `file_checksum`。
   - 若一致則直接查詢 PostgreSQL（耗時約 2ms）；若不一致則呼叫 `LocalAgent` (`POST /api/dbf/call`, `action: "SYNC_TABLE"`) 透過 32-bit `DBFBridge.exe` 驅動 `w3000_dbf.dll` 將 DBF 全表同步至 PostgreSQL。
2. **DBF 絕對權威寫入 (`WriteRecordAsync`)**：
   - 執行 `INSERT` / `UPDATE` / `DELETE` 時，先透過 `LocalAgent` (`POST /api/dbf/call`, `action: "WRITE_RECORD"`) 寫入地端 `.dbf`。
   - 若地端 DBF 記錄正被其他 FoxPro 工作站以 `RLOCK()` 鎖定，`DBFBridge.exe` 會回傳 `errorType: "LOCK_TIMEOUT"`，C# Controller 立即回傳 HTTP `409 Conflict`，**絕不單邊修改 PostgreSQL**。
   - 寫入 DBF 成功後，才透過 EF Core 更新 PostgreSQL，並呼叫 `UpdateDictionaryChecksumAsync` 更新快照校驗碼。

---

## 4. API Endpoints 總覽

| 模組 | HTTP Method | Route | 說明 |
| :--- | :--- | :--- | :--- |
| **系統磁碟設定** | `GET` / `POST` | `/api/systemconfig` | 取得/設定資料來源磁碟機代號 (`C`~`Z`) 與 `/check-drive` 目錄檢查 |
| **系統參數** | `GET` / `POST` | `/api/systemparam` | 讀取或儲存動態 Schema/Table 系統參數 |
| **會計師主檔 (`1020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1020` | 會計師/記帳士 CRUD、`/print` 區間列印與 `cpa.dbf` 雙向同步 |
| **建檔人員 (`1030`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1030` | 員工資料 CRUD、`/batch-save`、`/print` 與 `keyin.dbf` 雙向同步 |
| **稅務人員 (`1050`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1050` | 稅務人員 CRUD、`/batch-save`、`/print` 與 `taxno.dbf` 雙向同步 |
| **收費項目 (`1060`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1060` | 收費項目 CRUD、`/batch-save`、`/print` 與 `recitem.dbf` 雙向同步 |
| **備註維護 (`1070`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1070` | 備註範本 CRUD、`/batch-save`、`/print` 與 `recnote.dbf` 雙向同步 |
| **收費摘要 (`1080`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1080` | 收費摘要 CRUD、`/batch-save`、`/print` 與 `recmemo.dbf` 雙向同步 |
| **公司主檔 (`2010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase2010` | 公司基本資料 CRUD、`/print` 與 `customer.dbf` 雙向同步 |
| **購票地點 (`3010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3010` | 購票地點 CRUD、`/batch-save`、`/print` 與 `place.dbf` 雙向同步 |
| **發票預購 (`3020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3020` | 發票申購本數維護、`/batch-save`、`/buyinv-print-query`、`/generate-purchase-file` |
| **發票清單 (`3050`)** | `POST` / `GET` | `/api/wbase3050` | `/query` 統購清單查詢、`/prices` 發票工本費單價讀寫 |
| **發票字軌 (`3060`)** | `GET` / `PUT` / `POST` | `/api/wbase3060` | 字軌與起迄號查詢、`/update-row`、`/batch-save`、`/import-excel` |
| **進銷存單據** | `GET` / `POST` | `/api/products`, `/api/vendors`, `/api/purchase` | 產品/廠商快查與進貨單交易寫入 |
