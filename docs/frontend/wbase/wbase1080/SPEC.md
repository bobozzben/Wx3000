# 規格書：wbase1080 收費摘要資料維護作業

> **模組代號**：`wbase1080`  
> **功能名稱**：收費摘要資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1080/` & `backend/Controllers/Wbase1080Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1080` (對應地端 `<Drive>:\w3000\comm\recmemo.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"recmemo"`)

---

## 1. 模組定位與職責

本模組用於維護事務所各項收費單據、代收代付費用明細之標準收費摘要代號、說明與詳細內容（對應地端 **`recmemo.dbf`**，主鍵 `mno`）。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase1080Form.tsx`)**：
   - 依實際資料筆數渲染（`minRows = 0`），支援摘要代號自動轉大寫、Big5 位元組長度限制、欄寬拖曳記憶 (`gridId="wbase1080"`)、行內直接打字覆蓋與自動存檔 (`onSaveRow`)。
2. **F3 開窗快查與報表輸出 (`wbase1080Print.tsx` + `<FoxProPrintModal />`)**：支援區間過濾、純元素預覽列印 (`printElementById`)、動態欄位 Excel 匯出 (`<FormUtilSelectXlsxFieldsList />`) 與 LocalAgent DLL 報表列印。
3. **混合雲地 DBF 雙向同步 (`Wbase1080Controller.cs`)**：與地端 `<Drive>:\w3000\comm\recmemo.dbf` (`KeyField = "mno"`) 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `recmemo`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`FeeSummaryMaster`) | 前端屬性 (`FeeSummaryItem`) | 長度 (Bytes) | 說明 |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `mno` | `VARCHAR(255)` | `SummaryCode` (PK) | `summaryCode` | `4` | 收費摘要代號 |
| `tx` | `VARCHAR(255)` | `SummaryName` | `summaryName` | `50` | 收費摘要說明 |
| `memo` | `TEXT` | `SummaryMemo` | `summaryMemo` | Memo | 詳細摘要備註 |
| `_record_number` | `INTEGER` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1080Controller.cs`)

- `GET /api/wbase1080?keyword={q}`：同步檢核 `recmemo.dbf` 後查詢收費摘要列表
- `POST /api/wbase1080`：雙寫新增收費摘要（先寫入 `recmemo.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1080/{code}`：雙寫更新收費摘要
- `DELETE /api/wbase1080/{code}`：雙寫刪除收費摘要
- `POST /api/wbase1080/batch-save`：批量儲存收費摘要列表
- `POST /api/wbase1080/print`：依起訖代號查詢列印資料
