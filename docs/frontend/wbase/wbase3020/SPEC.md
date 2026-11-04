# 規格書：wbase3020 發票購買申購維護與預購表列印作業

> **模組代號**：`wbase3020` & `wbase3020_buyinv_print` (`wbase3030`)  
> **功能名稱**：營業稅發票預購輸入作業 + 發票預購表列印與 Excel 動態欄位匯出  
> **所屬模組**：`frontend/src/wbase/wbase3020/` & `backend/Controllers/Wbase3020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3020` / `wbase3030` (對應地端 `<Drive>:\w3000\comm\buyinv.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"buyinv"`)

---

## 1. 模組定位與職責

本模組涵蓋營業稅統一發票預購之兩大核心作業：
1. **`wbase3020` 發票預購本數輸入作業**（選單 `320`）：
   - **階段 1：期別與過濾條件設定 (`wbase3020_01.tsx`)**：設定申購期別（年、起月、迄月，組成如 `11505-06`，對應 DBF `yymm="150506"`）、次數 (`1` 首次購買 / `2` 追加購買) 與輸入方式：
     - `1` 稅籍編號、`2` 統一編號、`3` 客戶編號、`4` 上次次序（以上只決定排序）
     - `5` 依縣市別、`6` 購買地點、`7` 登入人員（需輸入條件；`6` / `7` 可按 `F2` 開窗，分別查詢 `/api/wbase3010` 與 `/api/wbase1030`）
     - 設定透過 `systemParamService` 存於目前資料磁碟 schema 的 `參數設定` 表（`營業稅發票購買期別`、`營業稅發票購買次數`、`營業稅發票購買輸入方式`、`營業稅發票購買輸入條件`），下次開啟自動帶入。
   - **階段 2：8 大發票本數整頁盲打 (`wbase3020_02.tsx`)**：使用 `<FoxProGridV2 />` 展示雙層表頭（`＜ 手開式統一發票 ＞` / `＜ 收銀機專用 ＞`）與 8 種發票本數（手開二聯、二聯副、三聯、三聯副、特種；收銀二聯、三聯、三聯副），支援直接打字覆蓋、`Enter` 橫向跳欄與離列即時雙寫存檔；公司統編欄以 `checkUnifiedNo` 做非阻斷式警告。
   - **F3 轉檔**：呼叫 `transfer-company-data`，將客戶主檔 (`customer`) 中本期尚無紀錄的公司新增為 `buyinv` 紀錄（本數為 0）。
   - 工具列另有 `清除` (重新載入)、`查詢`、`上期拷貝`、`方向` 按鈕（只能以滑鼠點選）；`上期拷貝` 目前只顯示提示訊息，尚未實作，`方向` 只切換按鈕上的方向圖示。
2. **`wbase3020_buyinv_print` 發票預購表列印與 Excel 匯出作業**（選單 `330` `wbase3030`，亦可於 `wbase3020_02` 按 `F7` 開啟）：
   - 期別（年、起月、迄月）預設自 `參數設定` 的 `營業稅發票購買期別` 載入；查詢時次數固定為 `1`，只列出 8 種本數任一大於 0 的公司。
   - 支援依「地址縣市」（`*` 代表全部）或「購買地點 (`F2` 開窗)」分區、依「統一編號」或「稅籍編號」排序。
   - 整合 `<FormUtilSelectXlsxFieldsList />` 雙欄式動態欄位選擇器，可自訂匯出 Excel 欄位、標題與順序（持久化於 `localStorage` 的 `wbase3020_xlsx_export_config`）。
   - 支援呼叫 `LocalAgent` (`POST http://localhost:5009/api/call`，`dll: "wbaseRP"`、`func: "wbase320_buyinv"`) 驅動 Lazarus `wbaseRP.dll` 開啟原生 FastReport 預購表預覽（`IsPrint = 0`）。
3. **混合雲地 DBF 雙向同步 (`Wbase3020Controller.cs`)**：
   - 讀取前以 `EnsureTableSyncedAsync(..., "buyinv", ..., "buyinv", keyFields: "_record_number")` 比對地端 `<Drive>:\w3000\comm\buyinv.dbf` Checksum。
   - 寫入時先以 `WriteRecordAsync(keyField: "yymm,times,no", keyValue: "<yymm>,<times>,<no>")` 寫 DBF，成功後才寫 PostgreSQL；DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3020/
├── index.tsx                    # 預購輸入主進入點 (切換 01 條件視窗與 02 明細表格)
├── wbase3020_01.tsx             # 階段 1：期別/次數/輸入方式設定對話框
├── wbase3020_02.tsx             # 階段 2：8 種發票本數 FoxProGridV2 盲打明細表格
├── wbase3020_buyinv_print.tsx   # 發票預購表列印、原生報表預覽與 Excel 動態欄位匯出視窗
├── wbase3020Print.tsx           # FoxProPrintModal 起訖公司編號區間清冊 (呼叫 /print；目前沒有畫面引用)
└── useWbase3020.ts              # 狀態管理 Hook (Zustand)

frontend/src/services/
└── wbase3020.ts                 # API 呼叫、LocalAgent wbase320_buyinv 報表呼叫與 XLSX 匯出

backend/
├── Controllers/
│   └── Wbase3020Controller.cs   # CRUD、Batch Save、F3 轉檔與預購列印查詢 API
└── Models/
    └── InvoicePurchaseMaster.cs # EF Core Entity (Table: "buyinv"，schema 依目前資料磁碟動態決定；複合主鍵於 AppDbContext 設定)
```

---

## 3. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `buyinv`)

> ⚠️ **複合主鍵 (Composite PK)**：(`Period` [`yymm`], `Times` [`times`], `CompanyCode` [`no`])

| DBF / PG 欄位 | DBF 型別 | EF Core 屬性 (`InvoicePurchaseMaster`) | 說明 |
| :--- | :--- | :--- | :--- |
| `yymm` | `C(6)` | `Period` (PK) | 申購期別 (DBF 6 碼如 `150506`，前端顯示 `11505-06`) |
| `times` | `C(1)` | `Times` (PK) | 申購次數 (`1`: 首次, `2`: 追加) |
| `no` | `C(10)` | `CompanyCode` (PK) | 公司編號 |
| `name` | `C(10)` | `CompanyShortName` | 公司簡稱 |
| `unino` | `C(10)` | `UnifiedNo` | 統一編號 |
| `taxno` | `C(9)` | `TaxNo` | 稅籍編號 |
| `a02` / `a02b` | `N(6)` | `ManualTwoDup` / `ManualTwoDupSub` | 手開二聯 / 手開二聯副 本數 |
| `a03` / `a03b` | `N(6)` | `ManualThreeDup` / `ManualThreeDupSub` | 手開三聯 / 手開三聯副 本數 |
| `spec` | `N(6)` | `ManualSpecial` | 手開特種 本數 |
| `c02` / `c03` / `c03b` | `N(6)` | `CashTwoDup` / `CashThreeDup` / `CashThreeDupSub` | 收銀二聯 / 收銀三聯 / 收銀三聯副 本數 |
| `_record_number` | - | `RecordNumber` | DBF 實體記錄號 |

> 各發票種類的字軌與起迄號欄位 (`a02beg`、`a02begno`、`a02endno` …) 見 `wbase3060` SPEC；本模組存檔時會連同這些欄位一併回寫 DBF。
> `City`、`PlaceCode`、`EmpCode`、`CompanyName`、`CompanyAddr` 等為 `[NotMapped]` 屬性，由後端查詢時自客戶主檔 (`customer`) 帶入。

---

## 4. 後端 API 規格 (`Wbase3020Controller.cs`)

- `GET /api/wbase3020?period={p}&times={t}&keyword={q}&inputMode={m}&inputCondition={c}`：同步 `buyinv.dbf` 並依期別、次數、輸入方式 (`1`~`7`) 排序/過濾發票預購明細
- `GET /api/wbase3020/{period}/{times}/{companyCode}`：查詢單筆發票預購紀錄
- `POST /api/wbase3020`：單筆新增（已存在時改為更新）
- `PUT /api/wbase3020`：以 Body 帶入期別/次數/公司編號的單筆更新（前端使用此路由，避免公司編號含 `#` 等特殊字元）
- `PUT /api/wbase3020/{period}/{times}/{companyCode}`：以路由參數指定的單筆更新
- `DELETE /api/wbase3020/{period}/{times}/{companyCode}`：單筆刪除
- `POST /api/wbase3020/batch-save`：批次儲存發票申購本數變更
- `POST /api/wbase3020/transfer-company-data`：F3 轉檔，將客戶主檔中本期尚無紀錄的公司新增至 `buyinv`
- `POST /api/wbase3020/buyinv-print-query`：查詢發票預購表列印與 Excel 匯出資料（自動關聯 `customer` 公司主檔地址與電話）
- `POST /api/wbase3020/print`：依期別、次數與起訖公司編號查詢清冊資料

### LocalAgent 報表
- `POST http://localhost:5009/api/call`，`{ dll: "wbaseRP", func: "wbase320_buyinv", args: [1, 10, 10, 0, 0, <path>], jsonData }`；LocalAgent 將 `jsonData` 寫成 `%TEMP%\Wx3000\` 暫存 JSON 並以其路徑取代 `args` 最後一個參數。`wbase320_buyinv` 已登記於 `localagent/dlls.json`。

---

## 5. 鍵盤熱鍵對照表

### 階段 1 (`wbase3020_01.tsx`)
- `Enter` / `↓` / `↑`：依序於年、起月、迄月、次數、輸入方式、條件之間移動；最後一欄按 `Enter` 送出
- `F2`：輸入方式為 `6` / `7` 時開窗選擇購買地點 / 登入人員
- `F8`：確定並進入階段 2
- `Esc`：退回 wbase 主選單

### 階段 2 (`wbase3020_02.tsx`)
- `Enter` / `Tab` / 方向鍵：`<FoxProGridV2 />` 儲存格導覽與跳欄，離列自動存檔
- `Ins`：新增空白列
- `Del`：刪除確認對話框
- `F3`：轉檔（自客戶資料轉入基本發票購買）
- `F7`：開啟 `wbase3020_buyinv_print` 列印視窗
- `Esc`：關閉列印/刪除對話框，或回到階段 1 重新選擇期別

### 預購表列印 (`wbase3020_buyinv_print.tsx`)
- `F2`：分區為購買地點時開窗選擇
- `F4`：預覽查詢資料
- `F7`：呼叫 LocalAgent `wbase320_buyinv` 報表預覽
- `F8`：匯出 Excel（勾選「匯出 xlsx 設定」時先開欄位選擇器）
- `Esc`：離開
