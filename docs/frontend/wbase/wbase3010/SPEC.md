# 規格書：wbase3010 購票地點資料維護作業

> **模組代號**：`wbase3010`  
> **功能名稱**：購票地點資料維護作業 (單檔主檔維護 CRUD + 熱鍵盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase3010/` & `backend/Controllers/Wbase3010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3010` (對應資料表 `e3000__comm.基本購票地點`)

---

## 1. 模組定位與職責

本模組用於維護事務所為客戶申購統一發票時前往之各區稽徵所、農會、銀行或指定購票地點與聯絡資訊。
具備以下功能特性：
1. **單檔 AG Grid / FoxProGridV2 盲打體驗 (`<Wbase3010Form />`)**：
   - 支援 `↑` `↓` 上下瀏覽資料列、`F2` 新增空白列、`F3` 關鍵字搜尋彈窗、`F8` 刪除選取列、`F9` 列印。
   - 自動清空代號與字串首尾空格，並自動英文字母大寫化 (`sanitizeTicketPlace`)。
2. **F3 開窗快速搜尋 (`SearchModal`)**：
   - 開啟 `購買地點開窗搜尋 [F3]` 視窗，提供編號、購買地點、連絡人、連絡電話與購買地址對應模糊比對。
3. **列印預覽與報表輸出 Modal (`wbase3010Print.tsx`)**：
   - 支援起訖代號區間過濾。
   - 提供網頁直印 (Browser Print/PDF) 與 CSV 檔案輸出功能。
   - 支援本地端 LocalAgent DLL 報表服務 (`wbaseRP.dll`) 呼叫能力 (`callWaccrep3106b`)。
4. **RESTful API 後端整合**：
   - 連結 C# ASP.NET Core API (`Wbase3010Controller.cs`) 與 PostgreSQL `基本購票地點` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3010/
├── index.tsx              # 模組進入點 (整合 FoxProGridV2 與頂部/底部 Status Bar)
├── Wbase3010Form.tsx      # FoxProGridV2 欄位配置與 inline editing/search 邏輯
├── wbase3010Print.tsx     # 列印預覽與報表設定/CSV 輸出 Modal
└── useWbase3010.ts        # Zustand 狀態管理 Store (CRUD + 搜尋 + 刪除確認 + 列印)

frontend/src/services/
└── wbase3010.ts           # Axios API 通訊與 LocalAgent DLL 報表服務介面

backend/
├── Controllers/
│   └── Wbase3010Controller.cs  # RESTful CRUD & Print Query Endpoints
├── Models/
│   └── TicketPlaceMaster.cs    # EF Core Entity Model (基本購票地點)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本購票地點`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `編號` | `VARCHAR(50)` | `PlaceCode` (PK) | 購票地點編號 |
| `購買地點` | `VARCHAR(255)`| `PlaceName` | 購票地點名稱 (如: 台北市農會) |
| `連絡人` | `VARCHAR(255)`| `ContactPerson` | 櫃檯/聯絡人員姓名 |
| `連絡電話` | `VARCHAR(255)`| `ContactTel` | 聯絡電話 |
| `購買地址` | `VARCHAR(255)`| `PlaceAddress` | 購票地點詳細地址 |

---

## 4. 後端 API 規格 (`Wbase3010Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase3010?keyword={q}` | 查詢購票地點列表 (依編號、購買地點、連絡人、電話與地址模糊比對) |
| `GET` | `/api/wbase3010/{code}` | 取得指定購票地點詳細資料 |
| `POST` | `/api/wbase3010` | 新增購票地點資料 (重複編號傳回 400 Bad Request) |
| `PUT` | `/api/wbase3010/{code}` | 更新指定購票地點資料 |
| `DELETE` | `/api/wbase3010/{code}` | 刪除指定購票地點資料 |
| `POST` | `/api/wbase3010/print` | 依 `codeStart` 與 `codeEnd` 區間查詢報表資料 |
| `POST` | `/api/wbase3010/batch-save` | 批量儲存購票地點列表 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 主表格視窗 (`index.tsx` & `FoxProGridV2`)
- `F2`：在表格末端自動新增一行空白列
- `F3`：開啟購買地點開窗關鍵字搜尋彈窗
- `F8` 或 `Delete`：彈出刪除確認對話框
- `F9`：開啟列印/報表設定對話框 (Print Modal)
- `Enter` / `Tab`：於表格儲存格內向右切換編輯欄位
- `↑` / `↓`：於表格列間上下滑動游標
- `Esc`：退回 wbase 系統主選單

### 列印彈窗 (`wbase3010Print.tsx`)
- `Enter`：欄位間順序切換 (起始編號 ➔ 結束編號 ➔ 確定列印)
- `Esc`：關閉列印彈窗

---

## 6. 建置與測試說明

```bash
# 1. 後端編譯與執行
cd backend
dotnet run

# 2. 前端專案編譯驗證
cd frontend
pnpm run build
```
