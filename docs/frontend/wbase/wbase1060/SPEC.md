# 規格書：wbase1060 收費項目資料維護作業

> **模組代號**：`wbase1060`  
> **功能名稱**：收費項目資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1060/` & `backend/Controllers/Wbase1060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1060` (對應地端 `<Drive>:\w3000\comm\recitem.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"recitem"`)

---

## 1. 模組定位與職責

本模組用於維護事務所設定之各類服務項目與標準收費金額（如：記帳服務費、營業稅申報費、營所稅結算申報費、工商登記代辦費等）。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase1060Form.tsx`)**：
   - 依實際資料筆數渲染列數（`minRows` 預設 `0`），支援行內直接打字覆蓋、金額千分位格式化顯示 (`toLocaleString('zh-TW')`，例如 `3,500`)、欄位寬度拖曳記憶 (`gridId="wbase1060_grid"`)；項目代號自動轉大寫並以 `maxBytes: 4` 截斷。
   - 標題列右側搜尋框以 `GET /api/wbase1060?keyword=` 重新查詢（比對代號、名稱）。
   - **逐筆依序存檔 (`useWbase1060.ts`)**：每個儲存格確認時呼叫 `handleSaveRow` → `saveFeeItem`，一律以 `PUT /api/wbase1060/{原代號}` 存檔（新增列以本身代號 PUT，不存在時新增）。存檔排入佇列 (`saveQueue`) 依序執行，並以載入時的 `_record_number` 記住原代號，因此可在 Grid 直接修改代號；成功或失敗後都重新載入清單。
   - **修改代號連動收費明細**：比照 VFP `recitem.scx`，代號變更時後端先把 `recmod.dbf` 中使用舊代號的明細改成新代號，再改 `recitem.dbf` 本身；新代號已存在時回「項目代號重複」。
   - **地端重複代號提示**：載入後呼叫 `GET /api/wbase1060/duplicates`，`recitem.dbf` 有重複代號時以錯誤提示列出（快照每個代號只保留 RECNO 最小的一筆）。
2. **F3 開窗快查與 F7 報表列印 (`wbase1060Print.tsx` + `<FoxProPrintModal />`)**：支援起訖代號區間過濾 (`POST /api/wbase1060/print`)、瀏覽器預覽列印、Excel 匯出（依列印欄位產生），以及 `DLL 報表預覽列印` 按鈕：透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `wbase1060_recitem_list`（基本收費項目清冊）。
3. **混合雲地 DBF 雙向同步 (`Wbase1060Controller.cs`)**：讀取與寫入前皆以 `EnsureTableSyncedAsync(..., "recitem", ..., "recitem", "itemno")` 重灌/檢核快照（寫入前無法確認 DBF 最新內容時回 `503` 並取消存檔）；寫入以 `WriteRecordAsync(..., KeyField = "itemno", ...)` 先寫 `recitem.dbf`，成功後才更新 PostgreSQL 與 checksum。DBF 鎖定 (`LOCK_TIMEOUT`) 或記錄已變動 (`RECORD_NOT_FOUND`) 時回 `409`。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `recitem`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`FeeItemMaster`) | 前端屬性 (`FeeItem`) | 長度限制 | 說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `itemno` | `VARCHAR(255)` | `FeeCode` (PK，別名 `ItemNo`) | `itemno` (別名 `feeCode`) | `4` Bytes | 收費項目代號 (自動轉大寫；前端 `maxBytes: 4`，後端以 Big5 位元組數檢查且不可含逗號) |
| `item` | `VARCHAR(255)` | `FeeName` (別名 `Item`) | `item` (別名 `feeName`) | 未限制 | 收費項目名稱 (前端未設 `maxBytes`、未做 Big5 檢查) |
| `amt` | `NUMERIC(20,4)` | `Price` (別名 `Amt`) | `amt` (別名 `price`) | 數值 | 標準收費金額 |
| `_record_number` | `INTEGER` | `RecordNumber` | `_record_number` | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1060Controller.cs`)

- `GET /api/wbase1060?keyword={q}`：先執行 DBF Checksum 同步檢核，再回傳收費項目列表
- `GET /api/wbase1060/duplicates`：列出地端 `recitem.dbf` 重複的代號與其記錄號
- `GET /api/wbase1060/{code}`：查詢單筆收費項目
- `POST /api/wbase1060`：雙寫新增收費項目（代號已存在時回 `409`；先寫入 `recitem.dbf`，再寫入 PostgreSQL）
- `PUT /api/wbase1060/{code}`：`{code}` 為修改前代號；body 代號相同時更新，不同時修改代號並連動 `recmod.dbf`（以 `RECNO(),rno,itemno` 定位明細）；`{code}` 不存在且代號未改時新增
- `DELETE /api/wbase1060/{code}`：雙寫刪除收費項目
- `POST /api/wbase1060/batch-save`：整頁批次儲存（寫完 DBF 後以 DBF 重灌快照；目前畫面未使用）
- `POST /api/wbase1060/print`：依代號區間 (`codeStart` / `codeEnd`) 查詢報表資料
- `GET /api/wbase1060/print-preview?codeStart=&codeEnd=`：同上，GET 版本

---

## 4. 鍵盤熱鍵對照表 (`FoxProGridV2`)

- `Enter` / `Tab`：向右跳欄，列末換至下一列首欄，最後一列最後一欄自動新增列（每個儲存格確認時即存檔）
- `↑` / `↓` / `←` / `→` / `PageUp` / `PageDown` / `Home` / `End`：儲存格導覽（底端按 `↓` 不新增列）
- `F2`：切換儲存格編輯狀態
- `Ins`：新增空白列
- `F3`：開啟收費項目開窗搜尋 (`SearchModal`，比對代號、名稱)
- `Del`：彈出刪除確認對話框
- `F7`：開啟列印設定視窗
- `Esc`：編輯中取消該儲存格編輯；否則關閉列印視窗 / 刪除確認窗，或退回主選單
