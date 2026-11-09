# 規格書：C# ASP.NET Core 後端 API、動態磁碟機與 VFP DBF 雙向同步規格

> **專案代號**：`Wx3000.Backend`  
> **技術架構**：C# .NET 8 ASP.NET Core Web API + EF Core (`DynamicModelCacheKeyFactory`) + Npgsql + `SystemConfigService` + `DbfSyncService`  
> **檔案目錄**：`backend/`  
> **預設監聽**：`http://0.0.0.0:5007` (`appsettings.json` 的 `Urls`；Windows 服務名稱：`Wx3000Api`)  
> **目標資料庫**：PostgreSQL 16 (`localhost:54320` / Database: `w3000` / 動態 Schema: `<drive>:/w3000/comm` & `public`) + 地端 VFP DBF (`<Drive>:\w3000\comm\*.dbf`)

---

## 1. 系統定位與部署規格

1. **多合一伺服器包裝**：
   - 支援 `dotnet run` / `pnpm dev:api` 本地開發偵錯 (同樣監聽 `5007`)。
   - 支援發佈為獨立單一執行檔 (`pnpm build:api` ➔ `publish/backend/Release/Wx3000.Backend.exe`) 或含 `wwwroot` 靜態前端之完整伺服器包 (`pnpm publish:server` ➔ `publish/Wx3000_Server/api`，前端 `dist` 複製到 `api/wwwroot`)。
   - 支援安裝為 Windows Service (服務名稱 `Wx3000Api`)，透過 `builder.Host.UseWindowsService()` 實現開機背景自啟；以服務執行時 Content Root 為執行檔目錄。
   - 靜態網頁依序尋找 `../../../frontend/dist`、`../../../backend/wwwroot`、`<執行檔目錄>/wwwroot`，找到第一個存在的目錄後提供靜態檔，非 API 路徑一律回 `index.html` (SPA Fallback)。不存在的 `/api/*` 路徑回 404 JSON `{ message }`，不會落到 SPA Fallback (否則舊版後端缺新模組的控制器時，前端會把 `index.html` 當成 API 回應)。
   - 一律開啟 Swagger (`/swagger`)，並提供 `GET /health` 健康檢查；CORS 採 `AllowAll`。
2. **動態資料磁碟機與 Schema 切換 (`SystemConfigService` + `DynamicModelCacheKeyFactory`)**：
   - 磁碟機代號以請求標頭 `X-Data-Drive` (前端 Axios 攔截器帶入，如 `C` 或 `F`) 為準；沒有標頭時使用 `system_config.json` (位於執行檔目錄) 的設定，兩者皆無時為 `C`。代號一律正規化為單一英文字母。
   - 自動對應地端 DBF 路徑（如 `C:\w3000\comm` 或 `F:\w3000\comm`）與 PostgreSQL Schema（如 `"c:/w3000/comm"` 或 `"f:/w3000/comm"`），並透過 `DynamicModelCacheKeyFactory` 依 Schema 快取 EF Core Model。
   - `POST /api/systemconfig` 會先確認 `<Drive>:\w3000` 目錄存在，才寫入 `system_config.json`，並以 `DbInitializer.EnsureSchemaInitialized` 建立該 Schema 與 9 張主檔表。
   - 啟動時執行 `DbInitializer.Initialize`：資料庫不存在就建立，再對目前 Schema 建立 `cpa`、`keyin`、`taxno`、`recitem`、`recmemo`、`recnote`、`customer`、`place`、`buyinv`。其他快照表 (如 `recmom`、`xmaster`、`accpara`、`bsdesc`) 由第一次同步的結構腳本建立。
3. **LocalAgent 連線**：`DbfSyncService` 透過具名 `HttpClient` (逾時 60 秒) 呼叫 `LocalAgent:Url` (預設 `http://localhost:5009`)。LocalAgent 只接受 `localhost` / `127.0.0.1` / `[::1]` 的 Host，因此後端與 LocalAgent 必須在同一台機器。

---

## 2. 檔案目錄結構

```text
backend/
├── Wx3000.Backend.csproj
├── Program.cs                           # API 入口點、Windows Service 註冊、DI 注入、Swagger、/health 與 wwwroot 託管
├── appsettings.json                     # Urls (5007)、PostgreSQL (54320/w3000) 與 LocalAgent (5009) 配置
├── Data/
│   ├── AppDbContext.cs                  # EF Core DbContext (依 CurrentPgSchema 動態映射資料表)
│   ├── DynamicModelCacheKeyFactory.cs   # EF Core 動態 Schema Model Cache Key 工廠
│   └── DbInitializer.cs                 # 建立資料庫，並以冪等原生 SQL DDL 建立 Schema 與 9 張主檔表
├── Services/
│   ├── IDbfSyncService.cs               # 地端 VFP DBF 雙向同步服務介面
│   ├── DbfSyncService.cs                # Checksum 比對、交易內快照重灌 (含重複主鍵處理)、DBF 權威寫入與 custbak 匯出入
│   ├── ISystemConfigService.cs          # 系統磁碟機與路徑配置介面
│   ├── SystemConfigService.cs           # 動態磁碟機 (X-Data-Drive / system_config.json) 與目錄檢測服務
│   ├── ISystemParamService.cs           # 系統參數讀寫介面
│   ├── SystemParamService.cs            # 動態 Schema/Table 參數存取服務 (「名稱」/「數值」兩欄的 PostgreSQL 參數表)
│   └── TransferPasswordService.cs       # 轉檔列印密碼 (motherp.txt 第 101–110 bytes) 比對，只在後端
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
│   ├── AccountMaster.cs                 # 會計科目 (table: xmaster ~ xmaster6，4010 以 ADO 依 mode 切換表名)
│   ├── Wbase1010Models.cs / Wbase2030Models.cs / Wbase2040Models.cs / Wbase2050Models.cs / Wbase4020Models.cs / Wbase5010Models.cs / Wbase5070Models.cs  # ADO 模組的 DTO
│   ├── Product.cs / Vendor.cs           # 產品 / 廠商主檔 (table: products / vendors)
│   └── PurchaseHeader.cs / PurchaseLine.cs # 進貨單頭與明細 (table: purchase_headers / purchase_lines)
├── DTOs/
│   └── CreatePurchaseOrderDto.cs        # 進貨單建立 DTO
└── Controllers/
    ├── SystemConfigController.cs        # 資料磁碟機設定與檢測 API (/api/systemconfig)
    ├── SystemParamController.cs         # 系統參數讀寫 API (/api/systemparam)
    ├── Wbase1010Controller.cs           # 事務所資料維護 API (/api/wbase1010)
    ├── Wbase1020Controller.cs           # 會計師維護 API (/api/wbase1020)
    ├── Wbase1030Controller.cs           # 建檔人員維護 API (/api/wbase1030)
    ├── Wbase1050Controller.cs           # 稅務人員維護 API (/api/wbase1050)
    ├── Wbase1060Controller.cs           # 收費項目維護 API (/api/wbase1060)
    ├── Wbase1070Controller.cs           # 備註維護 API (/api/wbase1070)
    ├── Wbase1080Controller.cs           # 收費摘要維護 API (/api/wbase1080)
    ├── Wbase2010Controller.cs           # 公司基本資料維護 API (/api/wbase2010)
    ├── Wbase2030Controller.cs           # 客戶資料匯出 (2020) / 匯入 (2030) API (/api/wbase2030)
    ├── Wbase2040Controller.cs           # 客戶收費資料輸入 API (/api/wbase2040)
    ├── Wbase2050Controller.cs           # 總分支機構設定 API (/api/wbase2050)
    ├── Wbase3010Controller.cs           # 購票地點維護 API (/api/wbase3010)
    ├── Wbase3020Controller.cs           # 預購統一發票輸入、公司資料轉入與預購表列印查詢 API (/api/wbase3020)
    ├── Wbase3050Controller.cs           # 統購發票清單列印與單價設定 API (/api/wbase3050)
    ├── Wbase3060Controller.cs           # 統購發票字軌維護與 Excel 匯入 API (/api/wbase3060)
    ├── Wbase4010Controller.cs           # 標準 / 營造 / 建設 / 文教 / 社會 / 衛福會計科目維護 API (/api/wbase4010)
    ├── Wbase4020Controller.cs           # 4-2 ~ 4-6 營業稅、傳票轉檔、期末存貨、共用摘要與共用參數設定 API (/api/wbase4020)
    ├── Wbase5010Controller.cs           # 5-1 ~ 5-6 管理報表查詢與委任書條文維護 API (/api/wbase5010)
    ├── Wbase5070Controller.cs           # 5-7 碳健檢企業名單匯出：客戶清單、轉檔列印密碼、各客戶 t403 銷售額加總 (/api/wbase5070)
    └── Products / Vendors / PurchaseController.cs
```

> 控制器有兩種寫法：EF Core 實體 (`Models/*Master.cs` + `AppDbContext`，如 1020、1030、1050~1080、2010、3010、3020、3050、3060) 與 ADO + DTO (`GetDbConnection()`，如 1010、2030、2040、2050、4010、4020、5010、5070)。

---

## 3. 混合雲地 VFP DBF 雙向同步架構 (`DbfSyncService.cs`)

### 3.1 PostgreSQL 與地端 DBF 映射對照表

PostgreSQL Table 名稱與 DBF 檔名相同；`同步 keyFields` 是呼叫 `EnsureTableSyncedAsync` 時傳入、會成為快照唯一索引的欄位 (`""` 表示不設唯一鍵)，`寫入定位` 是呼叫 `WriteRecordAsync` 時的 `keyField`。

| 模組代號 | C# Entity Model | 地端 DBF 路徑 | PostgreSQL Schema | PostgreSQL Table | 同步 keyFields ／ 寫入定位 (keyField) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wbase1010` | ADO + DTO (`Wbase1010Models.cs`) | `<Drive>:\w3000\comm\base.dbf`、`pub_para.dbf`、`cstore.dbf` | `<drive>:/w3000/comm` | 同 DBF 名稱 | 三表同步不設唯一鍵；寫入 `base` / `cstore` 以 `RECNO(),no` 定位 (查無的 `base` 鍵值與新的 `cstore` 以 `no` 新增)，`pub_para` 以第一筆 `RECNO()` |
| `wbase1020` | `CpaMaster` | `<Drive>:\w3000\comm\cpa.dbf` | `<drive>:/w3000/comm` | `cpa` | `no` |
| `wbase1030` | `EmpMaster` | `<Drive>:\w3000\comm\keyin.dbf` | `<drive>:/w3000/comm` | `keyin` | `no` |
| `wbase1050` | `TaxOfficerMaster` | `<Drive>:\w3000\comm\taxno.dbf` | `<drive>:/w3000/comm` | `taxno` | `no` |
| `wbase1060` | `FeeItemMaster` | `<Drive>:\w3000\comm\recitem.dbf` (改代號時連動 `recmod.dbf`) | `<drive>:/w3000/comm` | `recitem` / `recmod` | `recitem` 以 `itemno`；`recmod` 同步不設唯一鍵，連動改代號以 `RECNO(),rno,itemno` 定位 |
| `wbase1070` | `NoteMaster` | `<Drive>:\w3000\comm\recnote.dbf` | `<drive>:/w3000/comm` | `recnote` | `noteno` |
| `wbase1080` | `FeeSummaryMaster` | `<Drive>:\w3000\comm\recmemo.dbf` | `<drive>:/w3000/comm` | `recmemo` | `mno` |
| `wbase2010` | `CompanyMaster` | `<Drive>:\w3000\comm\customer.dbf` | `<drive>:/w3000/comm` | `customer` | `no` |
| `wbase2020` / `2030` | ADO + DTO (`Wbase2030Models.cs`) | `<Drive>:\w3000\comm\customer.dbf` | `<drive>:/w3000/comm` | `customer` | `no`；匯入由 LocalAgent `import_custbak` 整批寫入，完成後整表重灌 |
| `wbase2040` | ADO + DTO (`Wbase2040Models.cs`) | `<Drive>:\w3000\comm\recmom.dbf` / `recmod.dbf` / `recsmemo.dbf` (另讀 `customer`、`recitem`、`recmemo`、`base`) | `<drive>:/w3000/comm` | `recmom` / `recmod` / `recsmemo` | 三表同步不設唯一鍵 (`customer` 以 `no`、`recitem` 以 `itemno`、`recmemo` 以 `mno`、`base` 不設)；寫入 `recmom` 以 `rno`、`recmod` 以 `RECNO(),rno`、`recsmemo` 以 `RECNO()` 定位 |
| `wbase2050` | ADO + DTO (`Wbase2050Models.cs`) | `<Drive>:\w3000\comm\customer.dbf` | `<drive>:/w3000/comm` | `customer` | 同步不設唯一鍵；寫入以 `RECNO(),no` 定位，找不到再用 `no` |
| `wbase3010` | `TicketPlaceMaster` | `<Drive>:\w3000\comm\place.dbf` | `<drive>:/w3000/comm` | `place` | `no` |
| `wbase3020` / `3060` | `InvoicePurchaseMaster` | `<Drive>:\w3000\comm\buyinv.dbf` | `<drive>:/w3000/comm` | `buyinv` | 同步以 `_record_number` (3020 的 `/print` 以 `yymm,times,no`)；寫入以 `RECNO(),yymm,times,no` 定位；3060 Excel 轉入另同步 `customer` (以 `no`) 查客戶代號，新列以 `yymm,times,no[,buydate]` 做 DBF 重複檢查後 `INSERT` |
| `wbase3050` | `InvoicePurchaseMaster` | `<Drive>:\w3000\comm\buyinv.dbf` | `<drive>:/w3000/comm` | `buyinv` | 同步以 `yymm,times,no`；單價設定存於 PostgreSQL `參數設定` 表 (`SystemParamService`)，不寫 DBF |
| `wbase4010` | ADO + `AccountMaster` | `<Drive>:\w3000\comm\xmaster.dbf` ~ `xmaster6.dbf` (依 `mode` 1~6) | `<drive>:/w3000/comm` | `xmaster` ~ `xmaster6` | `accno`；`/ref` 與 `/batch-copy` 直接讀 `<Drive>:\w3000\ref\80\xmaster*.dbf` 範本 |
| `wbase4020` | ADO + DTO (`Wbase4020Models.cs`) | `customer.dbf`、`accpara.dbf`、`acc_st.dbf`、`descrip.dbf`、`xmaster.dbf`、`pub_para.dbf` | `<drive>:/w3000/comm` | 同 DBF 名稱 | 同步：`customer`、`accpara`、`descrip`、`pub_para` 不設唯一鍵，`acc_st` 以 `no`，`xmaster` 以 `accno`；寫入：`customer` 先以 `RECNO()` 失敗再用 `no`，`accpara` / `pub_para` 以 `RECNO()` = 1，`acc_st` 以 `no` (查無才新增)，`descrip` 以 `RECNO()` |
| `wbase5010` | ADO + DTO (`Wbase5010Models.cs`) | `customer.dbf`、`keyin.dbf`、`bsdesc.dbf` | `<drive>:/w3000/comm` | 同 DBF 名稱 | `customer` / `keyin` 以 `no`，`bsdesc` 以 `seq` (寫入亦以 `seq`) |
| `wbase5070` | ADO + DTO (`Wbase5070Models.cs`) | `customer.dbf`；各客戶 `<Drive>:\w3000\data\<客戶代號>\<年末 2 碼>\t403.dbf` (401 資料檔，只讀) | `customer` 在 `<drive>:/w3000/comm`；`t403` 每家客戶每個年度一個 schema `<drive>:/w3000/data/<客戶代號小寫>/<年末 2 碼>` | `customer` / `t403` | `customer` 以 `no`；`t403` 不設唯一鍵 (保留全部列以加總 `t025`)；不寫入 |

> ⚠️ 同一張 DBF 可能被不同畫面以不同 keyFields 同步 (例如 `customer` 在 2010、2030、2040、5010 以 `no`，在 2050、4020 不設唯一鍵)。Checksum 相符時不會重灌，因此快照是否去除重複主鍵，取決於 DBF 變動後第一個觸發重灌的畫面。

### 3.2 同步與鎖定處理流程
1. **讀取前檢核 (`EnsureTableSyncedAsync(dbfPath, dbfName, schema, table, keyFields)`)**：
   - 呼叫 `LocalAgent` (`POST /api/dbf/checksum`) 取得 `.dbf` 檔案的 `SHA256:FileSize`；取不到時回傳 `false`，保留既有快照。
   - 與 PostgreSQL `dictionary.w3000_dbf` (欄位 `path`、`dbf`、`checksum`；`path` 為小寫且以 `\` 結尾的目錄，`dbf` 為小寫不含副檔名) 中記錄的 `checksum` 比對。
   - **一致時直接查詢 PostgreSQL**（耗時約 2ms）；**不一致時才重新載入**：呼叫 `LocalAgent` (`POST /api/dbf/get_pg_script`) 由 32-bit `DBFBridge.exe` 驅動 `w3000_dbf.dll` 產生結構腳本 (`STRUCT`，帶 keyFields) 與資料腳本 (`DATA`)。資料腳本中數值溢位的 `****` 會先換成 `0`。
   - **重新載入在單一交易內進行**：
     1. 先清空舊快照 (`TRUNCATE`)，並移除先前結構腳本建立的 `ux_` 開頭唯一索引 (資料表尚不存在時略過)。
     2. 執行結構腳本，在空表上依本次 keyFields 重建唯一索引。
     3. 建立 savepoint 後執行資料腳本。
     4. 若資料腳本因主鍵重複 (`unique_violation`) 失敗且 keyFields 不為空，回到 savepoint，把資料灌進暫存表，改為每個主鍵只保留 RECNO 最小的一筆 (即 VFP `LOCATE` / `SEEK` 會找到的那筆)，重複的主鍵與各筆 RECNO 記錄在 `dictionary.w3000_dbf_dupkey`。
     5. 任何一步失敗都會整個回復，保留舊快照並回傳 `false`；`checksum` 未更新，下次讀取會再重試。
   - 交易提交後才更新 `dictionary.w3000_dbf` 的 `checksum`，並更新或清除 `dictionary.w3000_dbf_dupkey` 的紀錄 (`GetDuplicateKeysAsync` 讀取，例如 `GET /api/wbase1060/duplicates`)。
   - 快照的 `_record_number` 等於 DBF 實體 RECNO，已刪除列不在快照中。
2. **DBF 絕對權威寫入 (`WriteRecordAsync`)**：
   - 執行 `INSERT` / `UPDATE` / `DELETE` 時，先透過 `LocalAgent` (`POST /api/dbf/write`) 寫入地端 `.dbf`。`keyField` 可為逗號分隔的多個欄位或 `RECNO()` (例如 `RECNO(),rno`)，`keyValue` 以同樣順序逗號分隔；日期欄位傳 `{"$date":"yyyy-MM-dd"}`。
   - 若地端 DBF 正被其他 FoxPro 工作站獨佔或鎖定，LocalAgent 會回傳 `errorType: "LOCK_TIMEOUT"`，C# Controller 回傳 HTTP `409 Conflict`，**絕不單邊修改 PostgreSQL**；找不到記錄時回 `errorType: "RECORD_NOT_FOUND"`。
   - **新增前在 DBF 檢查鍵值**：`INSERT` 的 VFP 腳本先以 `LOCATE FOR <鍵值條件> AND NOT DELETED()` 找相同鍵值的記錄，有就回 `errorType: "DUPLICATE_KEY"`，不新增。控制器判斷「新增或修改」只看 PostgreSQL 快照，快照過期或多人同時新增同一代號時，這是最後一道防線。鍵值本來就會重複的表傳 `allowDuplicateKey: true` (收費明細 `recmod` 以 `rno`、會計摘要 `descrip` 以 `accno` 新增)；`keyField` 含 `RECNO()` 時一律不檢查。和舊系統之間仍有幾毫秒的空窗，沒有用 `FLOCK()`，因為舊系統編輯時常持有記錄鎖。
   - **排隊逾時不寫入**：後端在請求帶 `queueTimeoutMs` (呼叫 LocalAgent 的逾時 60 秒減 15 秒，即 45 秒)。寫入在 LocalAgent 隊列裡等超過這個時間、或後端已斷線，LocalAgent 就不執行，回 `errorType: "AGENT_BUSY"`。大表重灌把隊列塞住時，使用者會收到「這次沒有寫入」的明確回覆，而不是後端放棄後由 LocalAgent 在背景寫入。
   - **結果未確認**：後端等 LocalAgent 超過 60 秒 (只有寫入本身做太久才會發生) 時，`WriteRecordAsync` 回 `errorType: "WRITE_UNCONFIRMED"`。這時寫入可能已經執行，控制器以 `DbfWriteResult.FailureText(...)` 或 `IsUnconfirmed` 回「無法確認是否已寫入，請重新整理確認」，不可說成寫入失敗，也不可自動重試。
   - 寫入 DBF 成功後，才更新 PostgreSQL，再呼叫 `CommitWriteChecksumAsync(dbfPath, dbfName)` 更新快照校驗碼；PostgreSQL 寫入失敗時不呼叫，下次讀取會自動重灌。
   - LocalAgent 在同一個隊列項目內讀取寫入前後的 `.dbf`，回傳 `checksumBefore`、`checksumAfter`；並比對寫入前後的位元組，以 `otherChanges` 標示是否有這次寫入以外的變動。只有檔頭前 32 個位元組，以及本次 INSERT 的整筆、UPDATE 寫入的欄位、DELETE 的刪除旗標可以改變。
   - `WriteRecordAsync` 會記下同一請求對每個 DBF 的連續寫入。`CommitWriteChecksumAsync` 只在三個條件都成立時，才執行 `UPDATE dictionary.w3000_dbf SET checksum = <最後一次寫入後> WHERE checksum = <第一次寫入前>`：每次寫入前的 checksum 都等於上一次寫入後的 checksum、沒有 `otherChanges`、字典仍是第一次寫入前的值。條件不成立時不動字典，下次讀取會重灌。
   - 這樣可以避免舊系統在網頁存檔的同時修改 DBF 時，字典記下包含舊系統修改的 checksum，而快照卻沒有那筆修改。控制器不要自行呼叫 `GetChecksumAsync` 加 `UpdateDictionaryChecksumAsync`。
3. **整批匯出 / 匯入 (`ExportCustbakAsync` / `ImportCustbakAsync`，2-2 / 2-3)**：
   - 透過 `LocalAgent` (`POST /api/dbf/export_custbak`、`/api/dbf/import_custbak`) 以固定 VFP 範本 `COPY TO` / `APPEND FROM` + `SEEK`/`GATHER` 處理 `custbak.dbf`。
   - 匯入逐筆回報鎖定失敗；完成後 (含部分失敗) 一律呼叫 `EnsureTableSyncedAsync` 整表重灌，不手動寫 PostgreSQL、不直接更新校驗碼。

---

## 4. API Endpoints 總覽

所有路由皆為 `[Route("api/[controller]")]`，下表「端點」欄位的路徑相對於 Route 前綴。另有 `GET /health` 與 Swagger `/swagger`。

| 模組 | HTTP Method | Route | 端點與說明 |
| :--- | :--- | :--- | :--- |
| **系統磁碟設定** | `GET` / `POST` | `/api/systemconfig` | `GET` 取得目前磁碟機、DBF 路徑與 Schema；`GET check-drive?drive=` 檢查 `<Drive>:\w3000` 是否存在；`POST` 設定資料來源磁碟機代號 (`{ dataDrive }`) |
| **系統參數** | `GET` / `POST` | `/api/systemparam` | `GET ?schema=&table=&name=&defaultValue=` 讀取 (找不到會以預設值新增)；`POST` 儲存 (`{ schema, table, name, value }`) |
| **事務所資料 (`1010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1010` | `GET`/`PUT office` 預設事務所資料 (`base.dbf` + `pub_para.pubimgpath`)；`GET cstore`、`POST cstore`、`PUT cstore` (body 帶 `origNo`、`recordNumber`，可改統號)、`DELETE cstore/{no}?recno=` (刪除後重編 `serial`)、`POST cstore/print` |
| **會計師主檔 (`1020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1020` | `GET` 清單 (`?keyword=`)、`GET {code}`、`POST`、`PUT {code}`、`DELETE {code}`、`POST print` 區間列印資料、`GET inspect` 檢視快照欄位；對應 `cpa.dbf` |
| **建檔人員 (`1030`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1030` | `GET` 清單 (`?keyword=`)、`GET {code}`、`POST`、`PUT {code}`、`DELETE {code}`、`POST print`、`GET inspect` 檢視快照欄位；對應 `keyin.dbf` |
| **稅務人員 (`1050`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1050` | `GET` 清單 (`?keyword=`)、`GET {code}`、`POST`、`PUT {code}`、`DELETE {code}`、`POST print`；對應 `taxno.dbf` |
| **收費項目 (`1060`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1060` | `GET` 清單 (`?keyword=`)、`GET duplicates` 地端重複代號、`GET {feeCode}`、`POST`、`PUT {feeCode}` (改代號連動 `recmod`)、`DELETE {feeCode}`、`POST batch-save`、`POST print`、`GET print-preview?codeStart=&codeEnd=`；對應 `recitem.dbf` |
| **備註維護 (`1070`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1070` | `GET` 清單 (`?keyword=`)、`GET {noteCode}`、`POST`、`PUT {noteCode}`、`DELETE {noteCode}`、`POST batch-save`、`POST print`、`GET inspect` (直接回傳快照全部資料，不先同步)；對應 `recnote.dbf` |
| **收費摘要 (`1080`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase1080` | `GET` 清單 (`?keyword=`)、`GET {summaryCode}`、`POST`、`PUT {summaryCode}`、`DELETE {summaryCode}`、`POST batch-save`、`POST print`；對應 `recmemo.dbf` |
| **公司主檔 (`2010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase2010` | `GET` 清單 (`?keyword=`)、`GET {code}`、`POST`、`PUT {code}`、`DELETE {code}`、`POST print`；對應 `customer.dbf` |
| **客戶匯出入 (`2020`/`2030`)** | `GET` / `POST` / `DELETE` | `/api/wbase2030` | `POST verify-password`、`GET customers`、`POST export` (回傳 Base64 `custbak.dbf`)、`POST import/preview` (multipart 上傳)、`POST import`、`DELETE import/{importId}` |
| **客戶收費 (`2040`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase2040` | 表頭：`GET` 清單 (`?sort=1..7`)、`GET {rno}`、`POST`、`PUT {rno}`、`PUT {rno}/rename`、`DELETE {rno}`、`POST {rno}/recalc`；明細：`POST {rno}/lines`、`PUT {rno}/lines/{recno}`、`POST {rno}/lines/{recno}/toggle-paid`、`DELETE {rno}/lines/{recno}`；其他：`GET`/`PUT shared-memo`、`POST batch`、`GET lookup/customers`、`GET office`、`GET print/receipts`、`GET print/bill`、`GET stats` |
| **總分支機構 (`2050`)** | `GET` / `PUT` / `DELETE` | `/api/wbase2050` | `GET headquarters`、`PUT headquarters/{no}`、`GET headquarters/{no}/branches`、`PUT headquarters/{no}/branches` (整批存檔、逐列回報)、`DELETE headquarters/{no}/branches/{branchNo}`、`GET customers` (`?keyword=`) |
| **購票地點 (`3010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3010` | `GET` 清單 (`?keyword=`)、`GET {placeCode}`、`POST`、`PUT {placeCode}`、`DELETE {placeCode}`、`POST batch-save`、`POST print`、`GET print-preview?codeStart=&codeEnd=`；對應 `place.dbf` |
| **發票預購 (`3020`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase3020` | `GET` 清單 (`?period=&times=&keyword=`)、`GET {period}/{times}/{companyCode}`、`POST`、`PUT` (以 body 定位)、`PUT {period}/{times}/{companyCode}`、`DELETE {period}/{times}/{companyCode}`、`POST batch-save`、`POST transfer-company-data` (把客戶資料轉入指定期別，只新增尚未存在者)、`POST buyinv-print-query`、`POST print` |
| **發票清單 (`3050`)** | `POST` / `GET` | `/api/wbase3050` | `POST query` 統購清單查詢、`GET`/`POST prices` 發票工本費單價讀寫 |
| **發票字軌 (`3060`)** | `GET` / `PUT` / `POST` | `/api/wbase3060` | `GET` 字軌與起迄號清單 (`?period=&times=&sortOrder=&keyword=`)、`PUT batch` 單筆或批次更新、`POST import-track` 轉入前端解析的網路購買 / 代售點購買 Excel (每筆為公司 × 發票種類：統編、稅籍、購買日期、`kind`、本數、字軌、起迄號；以統編 + 稅籍對應當期紀錄或客戶，每家每期只一列，Excel 空白不覆蓋，找不到客戶的列回報於 `unmatched`)、`GET doc-image/{tgo01|tgo02|tgo022}` 讀 `<Drive>:\W3000\doc\*.jpg` 格式預覽圖、`POST clear` 清除指定期別與次數的字軌 |
| **會計科目 (`4010`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase4010` | `GET` 清單 (`?mode=1..6&keyword=`)、`GET {accno}`、`GET ref` 範本總帳科目、`POST`、`PUT {accno}`、`DELETE {accno}`、`POST batch-copy` 從範本複製；`mode` 1~6 對應 `xmaster` ~ `xmaster6` |
| **操作設定 (`4020`~`4060`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase4020` | 4-2：`GET taxop`、`PUT taxop/{no}`、`POST taxop/apply-default/{no}`、`GET`/`PUT accpara/tax-accounts`；4-3：`GET voucher`、`PUT voucher/{no}`、`POST voucher/apply-default/{no}`、`GET`/`PUT accpara/voucher-params`；4-4：`GET stock-mode`、`PUT stock-mode/{no}` (連動 `customer`)；4-5：`GET descrip`、`GET descrip/accounts`、`POST descrip`、`PUT descrip/{recno}`、`DELETE descrip/{recno}`、`POST descrip/swap-order`；4-6：`GET`/`PUT pub-para` |
| **管理報表 (`5010`~`5060`)** | `GET` / `POST` / `PUT` / `DELETE` | `/api/wbase5010` | `GET customers`、`POST print/customer-data` (5-1)、`POST print/labels` (5-2)、`POST print/keyin-stats` (5-3)、`POST print/business-status` (5-4)、`POST print/finance-status` (5-5)；5-6 委任書條文：`GET bsdesc`、`POST bsdesc`、`PUT bsdesc/{seq}`、`DELETE bsdesc/{seq}`、`PUT bsdesc/batch` |
| **碳健檢企業名單 (`5070`)** | `GET` / `POST` | `/api/wbase5070` | `GET customers`、`POST verify-password` (轉檔列印密碼)、`POST sales` (`{ password, year, startMonth, endMonth, nos }`，每次最多 50 家，回傳匯出欄位與 `t025` 加總；密碼錯誤 403) |
| **進銷存單據** | `GET` / `POST` | `/api/products`, `/api/vendors`, `/api/purchase` | `GET /api/products/search?q=`、`GET /api/vendors/search?q=` 快查；`POST /api/purchase` 建立進貨單、`GET /api/purchase` 進貨單清單 |
