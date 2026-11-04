# 規格書：wbase3010 購票地點資料維護作業

> **模組代號**：`wbase3010`  
> **功能名稱**：購票地點資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 台灣地址開窗選取 + 熱鍵快查 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase3010/` & `backend/Controllers/Wbase3010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3010` (對應地端 `<Drive>:\w3000\comm\place.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"place"`)

---

## 1. 模組定位與職責

本模組用於維護事務所為客戶申購統一發票時前往之各區代售點、農會、銀行或合作社購票地點與聯絡資訊。
1. **頂部統一標題列 (`<WbasePageHeader />`) 與 `<FoxProGridV2 />` 盲打體驗 (`Wbase3010Form.tsx`)**：
   - 依實際資料筆數渲染（`minRows = 0`），支援行內直接打字覆蓋、代號存檔時自動大寫修整（前端 `sanitizeTicketPlace` 與後端皆轉大寫）、欄寬拖曳記憶與離列自動存檔 (`onSaveRow`)。
   - 標題列右側提供關鍵字搜尋框（代號 / 地點 / 連絡人），送出後以 `keyword` 重新查詢。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：於購買地址 (`placeAddress`) 欄位設定 `hasEllipsis: true`（按鈕標籤 `F2`），按 `F2` / `F4` 或點擊儲存格內按鈕開啟台灣縣市/鄉鎮區/路名選取器，確認後立即存檔該列。
2. **F3 開窗快速搜尋 (`SearchModal`)**：提供編號、購買地點、連絡人、連絡電話與購買地址模糊比對（於前端已載入的清單中比對）。
3. **列印預覽與報表輸出 (`wbase3010Print.tsx` + `<FoxProPrintModal />`)**：支援起訖地點代號區間過濾、純元素預覽列印 (`printElement`)、動態欄位 Excel 匯出 (`<FormUtilSelectXlsxFieldsList />`)，以及透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `wbase3010_ticketplace_list` 開啟原生報表預覽。
4. **混合雲地 DBF 雙向同步 (`Wbase3010Controller.cs`)**：讀取前以 `EnsureTableSyncedAsync(..., "place", ..., "place", keyFields: "no")` 比對 `<Drive>:\w3000\comm\place.dbf` Checksum；新增/修改/刪除時先以 `WriteRecordAsync(keyField: "no")` 寫入地端 `place.dbf`，成功後才寫入 PostgreSQL（DBF 鎖定時回 `409`）。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `place`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`TicketPlaceMaster`) | 前端屬性 (`TicketPlaceItem`) | 長度 (Bytes) | 說明 |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `no` | `VARCHAR(255)` | `PlaceCode` (PK) | `placeCode` | `2` | 購票地點編號 |
| `place` | `VARCHAR(255)` | `PlaceName` | `placeName` | `30` | 購買地點名稱 |
| `linkman` | `VARCHAR(255)` | `ContactPerson` | `contactPerson` | `12` | 連絡人姓名 |
| `linktel` | `VARCHAR(255)` | `ContactTel` | `contactTel` | `15` | 連絡電話 |
| `addr` | `VARCHAR(255)` | `PlaceAddress` | `placeAddress` | `50` | 購買地點詳細地址 (支援 `F2`/`F4` `<AddressSelectModal />`) |
| `_record_number` | `INTEGER` | `RecordNumber` | - | - | DBF 實體記錄號 |

> 長度依 `place.dbf` 欄位結構 (`NO C(2)`、`PLACE C(30)`、`LINKMAN C(12)`、`LINKTEL C(15)`、`ADDR C(50)`)；DBF 另有 `serial` (N 4) 欄位，本模組未對應。

---

## 3. 後端 API 規格 (`Wbase3010Controller.cs`)

- `GET /api/wbase3010?keyword={q}`：同步檢核 `place.dbf` 後查詢購票地點列表（比對編號、地點、連絡人、電話、地址）
- `GET /api/wbase3010/{placeCode}`：查詢單筆購票地點
- `POST /api/wbase3010`：雙寫新增購票地點（代號已存在時改為更新）
- `PUT /api/wbase3010/{placeCode}`：雙寫更新購票地點（代號不存在時改為新增）
- `DELETE /api/wbase3010/{placeCode}`：雙寫刪除購票地點
- `POST /api/wbase3010/batch-save`：批量儲存購票地點列表
- `POST /api/wbase3010/print`：依起訖編號 (`codeStart` / `codeEnd`) 查詢報表資料
- `GET /api/wbase3010/print-preview?codeStart=&codeEnd=`：依起訖編號查詢預覽資料

### LocalAgent 報表
- `POST http://localhost:5009/report`，`func: "wbase3010_ticketplace_list"`（已登記於 `localagent/dlls.json`），`jsonData` 為 `{ placeCode, placeName, contactPerson, contactTel, placeAddress }` 陣列，由 LocalAgent 寫成暫存 JSON 後交給 `wbaseRP.dll`。

---

## 4. 鍵盤熱鍵對照表

- `↑` / `↓` / `←` / `→` / `PageUp` / `PageDown` / `Home` / `End`：儲存格導覽
- 直接輸入字元：進入編輯並覆蓋原值；`Enter` / `Tab` 跳下一欄，列末自動存檔
- `Ins`：新增空白列（主鍵未填時先要求輸入編號）
- `Del`：開啟刪除確認對話框
- `F2` / `F4`：於購買地址欄開啟 `<AddressSelectModal />`；其他欄位 `F2` 進入/結束編輯
- `F3`：開啟購買地點開窗搜尋
- `F7`：開啟列印視窗
- `Esc`：編輯中取消編輯；否則關閉列印/刪除對話框或退回 wbase 主選單
