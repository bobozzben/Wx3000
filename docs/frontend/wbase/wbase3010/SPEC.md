# 規格書：wbase3010 購票地點資料維護作業

> **模組代號**：`wbase3010`  
> **功能名稱**：購票地點資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 熱鍵快查 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase3010/` & `backend/Controllers/Wbase3010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3010` (對應地端 `C:\w3000\comm\place.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."place"`)

---

## 1. 模組定位與職責

本模組用於維護事務所為客戶申購統一發票時前往之各區代售點、農會、銀行或合作社購票地點與聯絡資訊。
1. **`<FoxProGridV2 />` 盲打體驗 (`Wbase3010Form.tsx`)**：支援行內直接打字覆蓋、代號自動大寫修整與離列自動存檔 (`onSaveRow`)。
2. **F3 開窗快速搜尋 (`SearchModal`)**：提供編號、購買地點、連絡人、連絡電話與購買地址模糊比對。
3. **列印預覽與報表輸出 (`wbase3010Print.tsx`)**：支援區間過濾、CSV 匯出與 LocalAgent DLL (`wbaseRP.dll`) 報表列印。
4. **混合雲地 DBF 雙向同步 (`Wbase3010Controller.cs`)**：與地端 `C:\w3000\comm\place.dbf` 即時雙向同步。

---

## 2. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `place`)

| DBF / PG 欄位 | 資料型別 | EF Core 屬性 (`TicketPlaceMaster`) | 前端屬性 (`TicketPlaceItem`) | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| `no` | `VARCHAR(255)` | `PlaceCode` (PK) | `placeCode` | 購票地點編號 |
| `place` | `VARCHAR(255)` | `PlaceName` | `placeName` | 購買地點名稱 |
| `linkman` | `VARCHAR(255)` | `ContactPerson` | `contactPerson` | 連絡人姓名 |
| `linktel` | `VARCHAR(255)` | `ContactTel` | `contactTel` | 連絡電話 |
| `addr` | `VARCHAR(255)` | `PlaceAddress` | `placeAddress` | 購買地點詳細地址 |
| `_record_number` | `INTEGER` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 3. 後端 API 規格 (`Wbase3010Controller.cs`)

- `GET /api/wbase3010?keyword={q}`：同步檢核 `place.dbf` 後查詢購票地點列表
- `POST /api/wbase3010`：雙寫新增購票地點
- `PUT /api/wbase3010/{code}`：雙寫更新購票地點
- `DELETE /api/wbase3010/{code}`：雙寫刪除購票地點
- `POST /api/wbase3010/batch-save`：批量儲存購票地點列表
- `POST /api/wbase3010/print`：依起訖編號查詢報表資料
