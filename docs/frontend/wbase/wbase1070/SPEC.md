# 規格書：wbase1070 備註資料維護作業

> **模組代號**：`wbase1070`  
> **功能名稱**：備註資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1070/` & `backend/Controllers/Wbase1070Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1070` (對應地端 `<Drive>:\w3000\comm\recnote.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"recnote"`)

---

## 1. 模組定位與職責

本模組用於維護事務所常用之標準備註代號與備註說明（對應地端 **`recnote.dbf`**，主鍵 `noteno`）。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase1070Form.tsx`)**：
   - 依實際資料筆數渲染（`minRows = 0`），支援備註代號自動大寫、Big5 長度截斷保護、欄寬拖曳記憶 (`gridId="wbase1070"`)、行內編輯與離列自動儲存 (`onSaveRow`)。
2. **F3 開窗快查與報表輸出 (`wbase1070Print.tsx` + `<FoxProPrintModal />`)**：支援區間篩選、純元素預覽列印 (`printElementById`)、動態欄位 Excel 匯出 (`<FormUtilSelectXlsxFieldsList />`) 與 LocalAgent DLL 報表列印。
3. **混合雲地 DBF 雙向同步 (`Wbase1070Controller.cs`)**：與地端 `<Drive>:\w3000\comm\recnote.dbf` (`KeyField = "noteno"`) 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `recnote`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`NoteMaster`) | 前端屬性 (`NoteItem`) | 長度 (Bytes) | 說明 |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `noteno` | `VARCHAR(255)` | `NoteCode` (PK) | `noteCode` | `2` | 備註代號 |
| `note` | `VARCHAR(255)` | `NoteName` | `noteName` | `50` | 備註說明內容 |
| `_record_number` | `INTEGER` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1070Controller.cs`)

- `GET /api/wbase1070?keyword={q}`：同步檢核 `recnote.dbf` 後查詢備註列表
- `POST /api/wbase1070`：雙寫新增備註資料（先寫入 `recnote.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1070/{code}`：雙寫更新備註資料
- `DELETE /api/wbase1070/{code}`：雙寫刪除備註資料
- `POST /api/wbase1070/batch-save`：批量儲存備註列表
- `POST /api/wbase1070/print`：依起訖代號查詢列印資料
