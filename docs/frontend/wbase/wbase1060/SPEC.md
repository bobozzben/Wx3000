# 規格書：wbase1060 收費項目資料維護作業

> **模組代號**：`wbase1060`  
> **功能名稱**：收費項目資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1060/` & `backend/Controllers/Wbase1060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1060` (對應地端 `C:\w3000\comm\recitem.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."recitem"`)

---

## 1. 模組定位與職責

本模組用於維護事務所設定之各類服務項目與標準收費金額（如：記帳服務費、營業稅申報費、營所稅結算申報費、工商登記代辦費等）。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase1060Form.tsx`)**：
   - 支援行內直接打字覆蓋、金額千分位格式化顯示 (`NT$ 3,500.00`) 與自動清理 (`sanitizeFeeItem`)。
2. **F3 開窗快查與 F7 報表列印 (`wbase1060Print.tsx`)**：支援區間過濾、CSV 匯出與 `LocalAgent` 原生 DLL 報表列印。
3. **混合雲地 DBF 雙向同步 (`Wbase1060Controller.cs`)**：與地端 `C:\w3000\comm\recitem.dbf` 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `recitem`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`FeeItemMaster`) | 前端屬性 (`FeeItem`) | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| `itemno` | `VARCHAR(255)` | `FeeCode` (PK) | `feeCode` | 收費項目代號 |
| `item` | `VARCHAR(255)` | `FeeName` | `feeName` | 收費項目名稱 |
| `amt` | `NUMERIC(20,4)` | `Price` | `price` | 標準收費金額 |
| `_record_number` | `INTEGER` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase1060Controller.cs`)

- `GET /api/wbase1060?keyword={q}`：先執行 DBF Checksum 同步檢核，再回傳收費項目列表
- `POST /api/wbase1060`：雙寫新增收費項目（先寫入 `recitem.dbf`，再寫入 PostgreSQL）
- `PUT /api/wbase1060/{code}`：雙寫更新收費項目
- `DELETE /api/wbase1060/{code}`：雙寫刪除收費項目
- `POST /api/wbase1060/batch-save`：整頁批次儲存
- `POST /api/wbase1060/print`：依代號區間查詢報表資料
