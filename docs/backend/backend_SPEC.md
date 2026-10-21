# 規格書：C# ASP.NET Core 後端 API、PostgreSQL 與 VFP DBF 雙向同步規格

> **專案代號**：`Wx3000.Backend`  
> **技術架構**：C# .NET 8 ASP.NET Core Web API + EF Core + Npgsql + `DbfSyncService` (LocalAgent DBFBridge)  
> **檔案目錄**：`backend/`  
> **預設監聽**：`http://0.0.0.0:5007` (Windows 服務名稱：`Wx3000Api`)  
> **目標資料庫**：PostgreSQL 16 (`localhost:54320` / Database: `w3000` / Schema: `c:/w3000/comm` & `public`) + 地端 VFP DBF (`C:\w3000\comm\*.dbf`)

---

## 1. 系統定位與部署規格

1. **多合一伺服器包裝**：
   - 支援 `dotnet run` / `pnpm dev:api` 本地開發偵錯。
   - 支援發佈為獨立單一執行檔 (`pnpm build:api`) 或含 `wwwroot` 靜態前端之完整伺服器包 (`pnpm publish:server` ➔ `publish/Wx3000_Server/api`)。
   - 支援安裝為 Windows Service (服務名稱 `Wx3000Api`)，透過 `builder.Host.UseWindowsService()` 實現開機背景自啟。
2. **CORS 與靜態 SPA 託管**：
   - 註冊 `AllowAll` 策略，允許前端 Vite (`localhost:5173`)、Electron 桌面端及區網各工作站跨域存取。
   - 當執行目錄下存在 `wwwroot` 時，自動啟用靜態檔案服務與 SPA Fallback (`index.html`)。

---

## 2. 檔案目錄結構

```text
backend/
├── Wx3000.Backend.csproj
├── Program.cs                        # API 入口點、Windows Service 註冊、DI 注入、Swagger 與 wwwroot 託管
├── appsettings.json                  # Urls (5007)、PostgreSQL (54320/w3000) 與 LocalAgent (18889) 配置
├── Data/
│   ├── AppDbContext.cs               # EF Core DbContext、DbSet 註冊與複合主鍵映射
│   └── DbInitializer.cs              # 冪等性原生 SQL DDL 建表與初始種子資料初始化
├── Services/
│   ├── IDbfSyncService.cs            # 地端 VFP DBF 雙向同步服務介面
│   ├── DbfSyncService.cs             # Checksum 比對、自動快照重灌、DBF 權威寫入與鎖定檢測
│   ├── ISystemParamService.cs        # 系統參數讀寫介面
│   └── SystemParamService.cs         # 動態 Schema/Table 參數存取服務 (如 "c:/w3000/comm"."參數設定")
├── Models/
│   ├── CpaMaster.cs                  # 會計師主檔 (schema: c:/w3000/comm, table: cpa)
│   ├── EmpMaster.cs                  # 建檔人員主檔 (schema: c:/w3000/comm, table: keyin)
│   ├── TaxOfficerMaster.cs           # 稅務人員主檔 (schema: c:/w3000/comm, table: taxno)
│   ├── FeeItemMaster.cs              # 收費項目主檔 (schema: c:/w3000/comm, table: recitem)
│   ├── NoteMaster.cs                 # 備註主檔 (schema: c:/w3000/comm, table: recmemo)
│   ├── FeeSummaryMaster.cs           # 收費摘要主檔 (schema: c:/w3000/comm, table: recnote)
│   ├── CompanyMaster.cs              # 公司基本資料主檔 (schema: c:/w3000/comm, table: customer)
│   ├── TicketPlaceMaster.cs          # 購票地點主檔 (schema: c:/w3000/comm, table: place)
│   ├── InvoicePurchaseMaster.cs      # 發票購買與字軌主檔 (schema: c:/w3000/comm, table: buyinv)
│   ├── Product.cs                    # 產品主檔 (products)
│   ├── Vendor.cs                     # 廠商主檔 (vendors)
│   ├── PurchaseHeader.cs             # 進貨單頭 (purchase_headers)
│   └── PurchaseLine.cs               # 進貨單明細 (purchase_lines)
└── Controllers/
    ├── SystemParamController.cs      # 系統參數讀寫 API (/api/systemparam)
    ├── Wbase1020Controller.cs        # 會計師維護 API (/api/wbase1020)
    ├── Wbase1030Controller.cs        # 建檔人員維護 API (/api/wbase1030)
    ├── Wbase1050Controller.cs        # 稅務人員維護 API (/api/wbase1050)
    ├── Wbase1060Controller.cs        # 收費項目維護 API (/api/wbase1060)
    ├── Wbase1070Controller.cs        # 備註維護 API (/api/wbase1070)
    ├── Wbase1080Controller.cs        # 收費摘要維護 API (/api/wbase1080)
    ├── Wbase2010Controller.cs        # 公司基本資料維護 API (/api/wbase2010)
    ├── Wbase3010Controller.cs        # 購票地點維護 API (/api/wbase3010)
    ├── Wbase3020Controller.cs        # 發票預購維護、媒體檔與預購表列印 API (/api/wbase3020)
    ├── Wbase3050Controller.cs        # 統購發票清單列印與單價設定 API (/api/wbase3050)
    ├── Wbase3060Controller.cs        # 統購發票字軌維護與 Excel 匯入 API (/api/wbase3060)
    ├── ProductsController.cs         # 產品快查 API (/api/products)
    ├── VendorsController.cs          # 廠商快查 API (/api/vendors)
    └── PurchaseController.cs         # 進貨單作業 API (/api/purchase)
```

---

## 3. 混合雲地 VFP DBF 雙向同步架構 (`DbfSyncService.cs`)

為使現代化 C# + PostgreSQL 系統與傳統 FoxPro 程式能無縫共用 `C:\w3000\comm\*.dbf`，後端實作了嚴謹的雙向同步機制：

### 3.1 PostgreSQL 與地端 DBF 映射對照表

| 模組代號 | C# Entity Model | 地端 DBF 路徑 | PostgreSQL Schema | PostgreSQL Table | 主鍵欄位 (KeyField) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wbase1020` | `CpaMaster` | `C:\w3000\comm\cpa.dbf` | `c:/w3000/comm` | `cpa` | `no` |
| `wbase1030` | `EmpMaster` | `C:\w3000\comm\keyin.dbf` | `c:/w3000/comm` | `keyin` | `no` |
| `wbase1050` | `TaxOfficerMaster` | `C:\w3000\comm\taxno.dbf` | `c:/w3000/comm` | `taxno` | `no` |
| `wbase1060` | `FeeItemMaster` | `C:\w3000\comm\recitem.dbf` | `c:/w3000/comm` | `recitem` | `itemno` |
| `wbase1070` | `NoteMaster` | `C:\w3000\comm\recmemo.dbf` | `c:/w3000/comm` | `recmemo` | `mno` |
| `wbase1080` | `FeeSummaryMaster` | `C:\w3000\comm\recnote.dbf` | `c:/w3000/comm` | `recnote` | `noteno` |
| `wbase2010` | `CompanyMaster` | `C:\w3000\comm\customer.dbf` | `c:/w3000/comm` | `customer` | `no` |
| `wbase3010` | `TicketPlaceMaster` | `C:\w3000\comm\place.dbf` | `c:/w3000/comm` | `place` | `no` |
| `wbase3020` / `3050` / `3060` | `InvoicePurchaseMaster` | `C:\w3000\comm\buyinv.dbf` | `c:/w3000/comm` | `buyinv` | `yymm,times,no` |

### 3.2 同步與鎖定處理流程
1. **讀取前檢核 (`EnsureTableSyncedAsync`)**：
   - 呼叫 `LocalAgent` (`POST /api/dbf/checksum`) 計算 `.dbf` 檔案的 `SHA256:FileSize`。
   - 比對 PostgreSQL `dictionary.w3000_dbf` 表中之 `file_checksum`。
   - 若一致則直接查詢 PostgreSQL（耗時約 2ms）；若不一致則呼叫 `LocalAgent` (`POST /api/dbf/call`, `action: "SYNC_TABLE"`) 透過 `DBFBridge.exe` 驅動 `w3000_dbf.dll` 將 DBF 全表同步至 PostgreSQL。
2. **DBF 絕對權威寫入 (`WriteRecordAsync`)**：
   - 執行 `INSERT` / `UPDATE` / `DELETE` 時，先透過 `LocalAgent` (`POST /api/dbf/call`, `action: "WRITE_RECORD"`) 寫入地端 `.dbf`。
   - 若地端 DBF 記錄正被其他 FoxPro 工作站以 `RLOCK()` 鎖定，`DBFBridge.exe` 會回傳 `errorType: "LOCK_TIMEOUT"`，C# Controller 立即回傳 HTTP `409 Conflict`，**絕不單邊修改 PostgreSQL**。
   - 寫入 DBF 成功後，才透過 EF Core 更新 PostgreSQL，並呼叫 `UpdateDictionaryChecksumAsync` 更新快照校驗碼。

---

## 4. API Endpoints 總覽

| 模組 | HTTP Method | Route | 說明 |
| :--- | :--- | :--- | :--- |
| **系統參數** | `GET` / `POST` | `/api/systemparam` | 讀取或儲存動態 Schema/Table 系統參數 |
| **會計師主檔 (`1020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1020` | 會計師/記帳士 CRUD、`/print` 區間列印與 DBF 同步 |
| **建檔人員 (`1030`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1030` | 員工資料 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **稅務人員 (`1050`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1050` | 稅務人員 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **收費項目 (`1060`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1060` | 收費項目 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **備註維護 (`1070`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1070` | 備註範本 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **收費摘要 (`1080`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1080` | 收費摘要 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **公司主檔 (`2010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase2010` | 公司基本資料 CRUD、`/print` 與 DBF 同步 |
| **購票地點 (`3010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3010` | 購票地點 CRUD、`/batch-save`、`/print` 與 DBF 同步 |
| **發票預購 (`3020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3020` | 發票申購本數維護、`/batch-save`、`/buyinv-print-query`、`/generate-purchase-file` |
| **發票清單 (`3050`)** | `POST` / `GET` | `/api/wbase3050` | `/query` 統購清單查詢、`/prices` 發票工本費單價讀寫 |
| **發票字軌 (`3060`)** | `GET` / `PUT` / `POST` | `/api/wbase3060` | 字軌與起迄號查詢、`/update-row`、`/batch-save`、`/import-excel` |
| **進銷存單據** | `GET` / `POST` | `/api/products`, `/api/vendors`, `/api/purchase` | 產品/廠商快查與進貨單交易寫入 |

---

## 5. 編譯與發佈指令

```powershell
# 本地開發啟動 (預設 http://0.0.0.0:5007)
pnpm dev:api

# 實機編譯驗證
dotnet build backend/Wx3000.Backend.csproj

# 打包完整伺服器發佈包 (含前端 wwwroot)
pnpm publish:server
```
