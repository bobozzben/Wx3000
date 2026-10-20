# 規格書：wbase1050 稅務人員資料維護作業

> **模組代號**：`wbase1050`  
> **功能名稱**：稅務人員資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 熱鍵快查 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1050/` & `backend/Controllers/Wbase1050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1050` (對應地端 `C:\w3000\comm\taxno.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."taxno"`)

---

## 1. 模組定位與職責

本模組用於維護各區國稅局、稽徵所之稅務員、審查人員聯絡資料。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase1050Form.tsx`)**：
   - 支援行內直接打字覆蓋、`Enter`/`Tab` 跳欄、離開列時自動儲存 (`onSaveRow`)。
   - 若包含 Email 欄位顯示，採用 `isValidEmail` 非阻斷式 `⚠️ 格式` 提示徽章。
2. **F3 開窗快速搜尋 (`SearchModal`)**：依編號、姓名、國稅局/稽徵所模糊比對。
3. **列印預覽與 LocalAgent DLL 報表 (`wbase1050Print.tsx`)**：支援瀏覽器預覽、CSV 匯出與 `wbaseRP.dll` 原生報表列印。
4. **混合雲地 DBF 雙向同步 (`Wbase1050Controller.cs`)**：與地端 `C:\w3000\comm\taxno.dbf` 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `taxno`)

| DBF / PG 欄位 | EF Core 屬性 (`TaxOfficerMaster`) | 前端屬性 (`TaxOfficerItem`) | 說明 |
| :--- | :--- | :--- | :--- |
| `no` | `TaxCode` (PK) | `taxCode` | 稅務人員編號 |
| `name` | `TaxName` | `taxName` | 稅務人員姓名/稽徵所 |
| `helpman` | `TaxBureau` | `taxBureau` | 承辦人/國稅局別 |
| `department` | `Unit` | `unit` | 股別/單位名稱 |
| `tel` | `Tel` | `tel` | 聯絡電話 |
| `addr` | `Address` | `address` | 地址 |
| `memo` | `Memo` | `memo` | 備註事項 |
| `_record_number` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵對照表

- `Enter` / `Tab`：向右跳欄，列末換行並自動存檔，底端自動新增列
- `Ins`：新增空白列
- `F3`：開啟稅務人員開窗搜尋
- `Del` / `F8`：刪除選取列
- `F7` / `F9`：開啟列印設定視窗
- `Esc`：儲存結算並退回主選單
