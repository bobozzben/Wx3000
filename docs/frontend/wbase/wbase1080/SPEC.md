# 規格書：wbase1080 收費摘要資料維護作業

> **模組代號**：`wbase1080`  
> **功能名稱**：收費摘要資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1080/` & `backend/Controllers/Wbase1080Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1080` (對應地端 `C:\w3000\comm\recnote.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."recnote"`)

---

## 1. 模組定位與職責

本模組用於維護事務所各項收費單據、代收代付費用明細之標準摘要簡稱與內容。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase1080Form.tsx`)**：支援摘要代號自動轉大寫、行內直接打字覆蓋與自動存檔。
2. **F3 開窗快查與報表輸出 (`wbase1080Print.tsx`)**：支援區間過濾、CSV 匯出與 LocalAgent DLL 報表列印。
3. **混合雲地 DBF 雙向同步 (`Wbase1080Controller.cs`)**：與地端 `C:\w3000\comm\recnote.dbf` 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `recnote`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`FeeSummaryMaster`) | 前端屬性 (`FeeSummaryItem`) | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| `noteno` | `VARCHAR(255)` | `SummaryCode` (PK) | `summaryCode` | 摘要代號 |
| `note` | `VARCHAR(255)` | `SummaryName` | `summaryName` | 摘要說明/內容 |
| `_record_number` | `INTEGER` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1080Controller.cs`)

- `GET /api/wbase1080?keyword={q}`：同步檢核 `recnote.dbf` 後查詢收費摘要列表
- `POST /api/wbase1080`：雙寫新增收費摘要
- `PUT /api/wbase1080/{code}`：雙寫更新收費摘要
- `DELETE /api/wbase1080/{code}`：雙寫刪除收費摘要
- `POST /api/wbase1080/batch-save`：批量儲存收費摘要列表
- `POST /api/wbase1080/print`：依起訖代號查詢列印資料
