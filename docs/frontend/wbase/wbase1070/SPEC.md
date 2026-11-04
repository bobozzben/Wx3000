# 規格書：wbase1070 備註資料維護作業

> **模組代號**：`wbase1070`  
> **功能名稱**：備註資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1070/` & `backend/Controllers/Wbase1070Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1070` (對應地端 `<Drive>:\w3000\comm\recnote.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"recnote"`)

---

## 1. 模組定位與職責

本模組用於維護事務所常用之標準備註代號與備註說明（對應地端 **`recnote.dbf`**，主鍵 `noteno`）。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase1070Form.tsx`)**：
   - 依實際資料筆數渲染（`minRows` 預設 `0`），支援欄寬拖曳記憶 (`gridId="wbase1070_grid"`)、行內直接打字覆蓋，每個儲存格確認時即存檔該列 (`onSaveRow` → `handleSaveRow`：新編號走 `POST`、既有編號走 `PUT`，成功後重新載入)。
   - 備註編號於存檔時轉大寫 (`normalizeNoteItem` 與後端 `ToUpper`)；Grid 欄位未設 `uppercase` / `maxBytes`，也未做 Big5 檢查。
   - 標題列右側搜尋框以 `GET /api/wbase1070?keyword=` 重新查詢（比對編號、備註內容）。
2. **F3 開窗快查與報表輸出 (`wbase1070Print.tsx` + `<FoxProPrintModal />`)**：支援起訖編號區間篩選 (`POST /api/wbase1070/print`)、瀏覽器預覽列印、Excel 匯出（依列印欄位產生），以及 `DLL 報表預覽列印` 按鈕：透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `wbase1070_recnote_list`（收費備註名冊）。
3. **混合雲地 DBF 雙向同步 (`Wbase1070Controller.cs`)**：讀取前 `EnsureTableSyncedAsync(..., "recnote", ..., "recnote", "noteno")`；寫入以 `WriteRecordAsync(..., KeyField = "noteno", ...)` 先寫地端 `recnote.dbf`，成功後才更新 PostgreSQL 與 checksum。DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `recnote`)

前端與後端皆未限制欄位長度；長度以實際 DBF 結構為準。

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`NoteMaster`) | 前端屬性 (`NoteItem`) | 表格標題 | 說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `noteno` | `VARCHAR(255)` | `Noteno` (PK，別名 `NoteCode`) | `noteno` (別名 `noteCode`) | 編號 | 備註代號 (存檔時轉大寫) |
| `note` | `VARCHAR(255)` | `Note` (別名 `NoteName`、`Content`) | `note` (別名 `noteName`、`content`) | 備註內容 | 備註說明內容 |
| `_record_number` | `INTEGER` | `RecordNumber` | `_record_number` | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1070Controller.cs`)

- `GET /api/wbase1070?keyword={q}`：同步檢核 `recnote.dbf` 後查詢備註列表
- `GET /api/wbase1070/{code}`：查詢單筆備註資料
- `POST /api/wbase1070`：雙寫新增備註資料（編號已存在時改為更新；先寫入 `recnote.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1070/{code}`：雙寫更新備註資料（編號不存在時改為新增）
- `DELETE /api/wbase1070/{code}`：雙寫刪除備註資料
- `POST /api/wbase1070/batch-save`：批量儲存備註列表（目前畫面未使用）
- `POST /api/wbase1070/print`：依起訖代號 (`codeStart` / `codeEnd`) 查詢列印資料
- `GET /api/wbase1070/inspect`：回傳 PostgreSQL `recnote` 表欄位結構（除錯用）

---

## 4. 鍵盤熱鍵對照表 (`FoxProGridV2`)

- `Enter` / `Tab`：向右跳欄，列末換至下一列首欄，最後一列最後一欄自動新增列（每個儲存格確認時即存檔）
- `↑` / `↓` / `←` / `→` / `PageUp` / `PageDown` / `Home` / `End`：儲存格導覽（底端按 `↓` 不新增列）
- `F2`：切換儲存格編輯狀態
- `Ins`：新增空白列
- `F3`：開啟備註開窗搜尋 (`SearchModal`，比對編號、備註內容)
- `Del`：彈出刪除確認對話框
- `F7`：開啟列印設定視窗
- `Esc`：編輯中取消該儲存格編輯；否則關閉列印視窗 / 刪除確認窗，或退回主選單
