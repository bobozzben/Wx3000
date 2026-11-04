# 規格書：wbase1080 收費摘要資料維護作業

> **模組代號**：`wbase1080`  
> **功能名稱**：收費摘要資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1080/` & `backend/Controllers/Wbase1080Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1080` (對應地端 `<Drive>:\w3000\comm\recmemo.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"recmemo"`)

---

## 1. 模組定位與職責

本模組用於維護事務所各項收費單據、代收代付費用明細之標準收費摘要代號、說明與詳細內容（對應地端 **`recmemo.dbf`**，主鍵 `mno`）。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase1080Form.tsx`)**：
   - 依實際資料筆數渲染（`minRows` 預設 `0`），支援行內直接打字覆蓋，每個儲存格確認時即存檔該列 (`onSaveRow` → `handleSaveRow`：新代號走 `POST`、既有代號走 `PUT`，成功後重新載入)。
   - 未傳 `gridId`，欄寬記憶以欄位組合產生 `localStorage` 鍵值。
   - 摘要代號於存檔時轉大寫 (`sanitizeFeeSummary` 與後端 `ToUpper`)；Grid 欄位未設 `uppercase` / `maxBytes`，也未做 Big5 檢查。
   - 標題列右側搜尋框以 `GET /api/wbase1080?keyword=` 重新查詢（比對代號、說明、內容）。
2. **F3 開窗快查與報表輸出 (`wbase1080Print.tsx`)**：列印視窗為模組自建彈窗（未使用 `<FoxProPrintModal />`，無 Excel 匯出），提供起訖代號區間查詢 (`POST /api/wbase1080/print`)、瀏覽器列印 (`window.print()`) 與 `DLL 報表預覽列印` 按鈕：透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `wbase1080_feesummary_list`（基本收費摘要清冊）。
3. **混合雲地 DBF 雙向同步 (`Wbase1080Controller.cs`)**：讀取前 `EnsureTableSyncedAsync(..., "recmemo", ..., "recmemo", "mno")`；寫入以 `WriteRecordAsync(..., KeyField = "mno", ...)` 先寫地端 `recmemo.dbf`，成功後才更新 PostgreSQL 與 checksum。DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `recmemo`)

前端與後端皆未限制欄位長度；長度以實際 DBF 結構為準。

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`FeeSummaryMaster`) | 前端屬性 (`FeeSummary`) | 表格標題 | 說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mno` | `VARCHAR(255)` | `Mno` (PK，別名 `SummaryCode`) | `summaryCode` | 摘要代號 | 收費摘要代號 (存檔時轉大寫) |
| `tx` | `VARCHAR(255)` | `Tx` (別名 `SummaryName`) | `summaryName` | 摘要說明 | 收費摘要說明 |
| `memo` | `TEXT` | `Memo` (別名 `Content`) | `content` | 摘要內容 | 詳細摘要內容 (DBF Memo 欄位) |
| `_record_number` | `INTEGER` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1080Controller.cs`)

- `GET /api/wbase1080?keyword={q}`：同步檢核 `recmemo.dbf` 後查詢收費摘要列表
- `GET /api/wbase1080/{code}`：查詢單筆收費摘要
- `POST /api/wbase1080`：雙寫新增收費摘要（代號已存在時改為更新；先寫入 `recmemo.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1080/{code}`：雙寫更新收費摘要（代號不存在時改為新增）
- `DELETE /api/wbase1080/{code}`：雙寫刪除收費摘要
- `POST /api/wbase1080/batch-save`：批量儲存收費摘要列表（目前畫面未使用）
- `POST /api/wbase1080/print`：依起訖代號 (`codeStart` / `codeEnd`) 查詢列印資料

---

## 4. 鍵盤熱鍵對照表 (`FoxProGridV2`)

- `Enter` / `Tab`：向右跳欄，列末換至下一列首欄，最後一列最後一欄自動新增列（每個儲存格確認時即存檔）
- `↑` / `↓` / `←` / `→` / `PageUp` / `PageDown` / `Home` / `End`：儲存格導覽（底端按 `↓` 不新增列）
- `F2`：切換儲存格編輯狀態
- `Ins`：新增空白列
- `F3`：開啟收費摘要開窗搜尋 (`SearchModal`，比對代號、說明、內容)
- `Del`：彈出刪除確認對話框
- `F7`：開啟列印設定視窗
- `Esc`：編輯中取消該儲存格編輯；否則關閉列印視窗 / 刪除確認窗，或退回主選單
