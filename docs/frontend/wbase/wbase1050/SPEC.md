# 規格書：wbase1050 稅務人員資料維護作業

> **模組代號**：`wbase1050`  
> **功能名稱**：稅務人員資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 台灣地址開窗選取 + 熱鍵快查 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1050/` & `backend/Controllers/Wbase1050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1050` (對應地端 `<Drive>:\w3000\comm\taxno.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"taxno"`)

---

## 1. 模組定位與職責

本模組用於維護各區國稅局、稽徵所之稅務員、審查人員與助理人員聯絡資料，並嚴格對齊 `taxno.dbf` 原生 7 欄位順序與標題。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase1050Form.tsx`)**：
   - 依實際資料筆數顯示（`minRows = 0`），支援行內直接打字覆蓋、`Enter`/`Tab` 跳欄、離開列時自動儲存 (`onSaveRow`) 與欄寬拖曳記憶 (`gridId="wbase1050"`)。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：於住址 (`addr`) 欄位設定 `hasEllipsis: true`，按 `F2` 或點擊 `...` 按鈕開啟台灣縣市/鄉鎮區/路名選取器。
2. **F3 開窗快速搜尋 (`SearchModal`)**：依代號、姓名、單位、電話、助理人員與住址模糊比對。
3. **列印預覽、純元素列印與 LocalAgent DLL 報表 (`wbase1050Print.tsx` + `<FoxProPrintModal />`)**：支援瀏覽器預覽 (`printElementById`)、動態欄位 Excel 匯出 (`<FormUtilSelectXlsxFieldsList />`) 與 `wbaseRP.dll` 原生報表列印。
4. **混合雲地 DBF 雙向同步 (`Wbase1050Controller.cs`)**：與地端 `<Drive>:\w3000\comm\taxno.dbf` 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `taxno`)

| 順序 | DBF / PG 欄位 | EF Core 屬性 (`TaxOfficerMaster`) | 前端屬性 (`TaxOfficerItem`) | 表格標題 | 長度 (Bytes) | 說明 |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | `no` | `TaxCode` (PK) | `taxCode` | 代號 | `4` | 稅務人員代號 |
| 2 | `name` | `TaxName` | `taxName` | 姓名 | `12` | 稅務人員姓名 |
| 3 | `department` | `Unit` | `unit` | 單位 | `14` | 稽徵所/單位股別名稱 |
| 4 | `tel` | `Tel` | `tel` | 電話 | `15` | 聯絡電話 (`checkPhoneDigits`) |
| 5 | `helpman` | `TaxBureau` | `taxBureau` | 助理人員 | `12` | 助理人員姓名 |
| 6 | `addr` | `Address` | `address` | 住址 | `50` | 機關或聯絡住址 (支援 `F2` `<AddressSelectModal />`) |
| 7 | `memo` | `Memo` | `memo` | 備註 | `30` | 備註事項 |
| - | `_record_number` | `RecordNumber` | - | - | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵對照表

- `Enter` / `Tab`：向右跳欄，列末換行並自動存檔，底端自動新增列
- `F2`：於住址 (`addr`) 欄位開啟 `<AddressSelectModal />` 台灣地址選取器
- `Ins`：新增空白列
- `F3`：開啟稅務人員開窗搜尋 (`SearchModal`)
- `Del` / `F8`：刪除選取列
- `F7`：開啟列印設定視窗 (`<FoxProPrintModal />`)
- `Esc`：儲存結算並退回主選單
