# 規格書：wbase1050 稅務人員資料維護作業

> **模組代號**：`wbase1050`  
> **功能名稱**：稅務人員資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 台灣地址開窗選取 + 熱鍵快查 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1050/` & `backend/Controllers/Wbase1050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1050` (對應地端 `<Drive>:\w3000\comm\taxno.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"taxno"`)

---

## 1. 模組定位與職責

本模組用於維護各區國稅局、稽徵所之稅務員、審查人員與助理人員聯絡資料，並嚴格對齊 `taxno.dbf` 原生 7 欄位順序與標題。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase1050Form.tsx`)**：
   - 依實際資料筆數顯示（`minRows` 預設 `0`），支援行內直接打字覆蓋、`Enter`/`Tab` 跳欄、每個儲存格確認時即存檔該列 (`onSaveRow` → `handleSaveRow`：新代號走 `POST`、既有代號走 `PUT`，成功後重新載入) 與欄寬拖曳記憶 (`gridId="wbase1050_grid"`)。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：於住址 (`addr`) 欄位設定 `hasEllipsis: true`，按 `F2` / `F4` 或點擊儲存格右側 `F2` 按鈕開啟台灣縣市/鄉鎮區/路名選取器，選定後直接存檔該列。
   - **頁首關鍵字搜尋**：`<WbasePageHeader />` 右側搜尋框送出時以 `GET /api/wbase1050?keyword=` 重新查詢（後端比對代號、姓名、助理人員、單位、電話、住址、備註）。
2. **F3 開窗快速搜尋 (`SearchModal`)**：依代號、姓名、單位、助理人員與電話模糊比對（於目前已載入的清單中篩選）。
3. **列印預覽、純元素列印與 LocalAgent DLL 報表 (`wbase1050Print.tsx` + `<FoxProPrintModal />`)**：支援起訖代號區間查詢 (`POST /api/wbase1050/print`)、瀏覽器預覽列印、Excel 匯出（未指定 `xlsxFields`，依列印欄位產生），以及 `DLL 報表預覽列印` 按鈕：透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `wbase1050_taxno_list`（基本稅務人員清冊）。
4. **混合雲地 DBF 雙向同步 (`Wbase1050Controller.cs`)**：讀取前 `EnsureTableSyncedAsync(..., "taxno", ..., "taxno", "no")`；新增/修改/刪除以 `WriteRecordAsync(..., KeyField = "no", ...)` 先寫地端 `taxno.dbf`，成功後才更新 PostgreSQL 與 checksum。DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `taxno`)

前端欄位定義目前未設定 `maxBytes`、未做 Big5 檢查，後端也不截斷長度；欄位長度以實際 DBF 結構為準。

| 順序 | DBF / PG 欄位 | EF Core 屬性 (`TaxOfficerMaster`) | 前端屬性 (`TaxOfficerItem`) | 表格標題 | 說明 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `no` | `TaxCode` (PK，別名 `No`) | `no` (別名 `taxCode`) | 代號 | 稅務人員代號 (存檔時轉大寫) |
| 2 | `name` | `TaxName` (別名 `Name`) | `name` (別名 `taxName`) | 姓名 | 稅務人員姓名 |
| 3 | `department` | `Unit` (別名 `Department`) | `department` (別名 `unit`) | 單位 | 稽徵所/單位股別名稱 |
| 4 | `tel` | `Tel` | `tel` | 電話 | 聯絡電話 |
| 5 | `helpman` | `TaxBureau` (別名 `Helpman`) | `helpman` (別名 `taxBureau`) | 助理人員 | 助理人員姓名 |
| 6 | `addr` | `Address` (別名 `Addr`) | `addr` (別名 `address`) | 住址 | 機關或聯絡住址 (支援 `F2`/`F4` `<AddressSelectModal />`) |
| 7 | `memo` | `Memo` | `memo` | 備註 | 備註事項 |
| - | `_record_number` | `RecordNumber` | `_record_number` | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵對照表

- `Enter` / `Tab`：向右跳欄，列末換至下一列首欄，最後一列最後一欄自動新增列（每個儲存格確認時即存檔）
- `↑` / `↓` / `←` / `→` / `PageUp` / `PageDown` / `Home` / `End`：儲存格導覽（底端按 `↓` 不新增列）
- `F2` / `F4`：於住址 (`addr`) 欄位開啟 `<AddressSelectModal />` 台灣地址選取器；其他欄位按 `F2` 切換編輯狀態
- `Ins`：新增空白列
- `F3`：開啟稅務人員開窗搜尋 (`SearchModal`)
- `Del`：彈出刪除確認對話框，確認後先刪 `taxno.dbf` 再刪 PostgreSQL
- `F7`：開啟列印設定視窗 (`<FoxProPrintModal />`)
- `Esc`：編輯中取消該儲存格編輯；否則關閉列印視窗 / 刪除確認窗，或退回主選單

---

## 4. 後端 API 規格 (`Wbase1050Controller.cs`)

- `GET /api/wbase1050?keyword={q}`：同步檢核 `taxno.dbf` 後查詢稅務人員列表（依代號排序）
- `GET /api/wbase1050/{code}`：查詢單筆稅務人員資料
- `POST /api/wbase1050`：雙寫新增（代號已存在時改為更新；先寫入 `taxno.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1050/{code}`：雙寫更新（代號不存在時改為新增）
- `DELETE /api/wbase1050/{code}`：雙寫刪除
- `POST /api/wbase1050/print`：依起訖代號 (`codeStart` / `codeEnd`) 查詢列印資料
