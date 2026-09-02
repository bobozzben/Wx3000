# 規格書：wbase1050 稅務人員資料維護作業

> **模組代號**：`wbase1050`  
> **功能名稱**：稅務人員資料維護作業 (單檔主檔維護 CRUD + 熱鍵盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1050/` & `backend/Controllers/Wbase1050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1050` (對應資料表 `e3000__comm.基本稅務人員`)

---

## 1. 模組定位與職責

本模組用於維護事務所合作及各區國稅局、稽徵所之稅務專員、審查人員與營業稅/營所稅承辦人員基本資料。
具備以下功能特性：
1. **單檔 AG Grid / FoxProGridV2 盲打體驗 (`<Wbase1050Form />`)**：
   - 支援 `↑` `↓` 上下瀏覽資料列、`F2` 新增空白列、`F3` 關鍵字搜尋彈窗、`F8` 刪除選取列、`F9` 列印。
   - 內建行內編輯 (Inline Cell Editing) 與全自動即時存檔處理 (`onSaveRow`)。
2. **F3 開窗快速搜尋 (`SearchModal`)**：
   - 開啟 `稅務人員開窗搜尋 [F3]` 視窗，提供代號、姓名、國稅局/稽徵所模糊比對。
3. **列印預覽與報表輸出 Modal (`wbase1050Print.tsx`)**：
   - 支援起訖代號區間過濾。
   - 提供網頁直印 (Browser Print/PDF) 與 CSV 檔案輸出功能。
   - 支援本地端 LocalAgent DLL 報表服務 (`wbaseRP.dll`) 呼叫能力 (`callWaccrep3105b`)。
4. **RESTful API 後端整合**：
   - 連結 C# ASP.NET Core API (`Wbase1050Controller.cs`) 與 PostgreSQL `基本稅務人員` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1050/
├── index.tsx              # 模組進入點 (整合 FoxProGridV2 與頂部/底部 Status Bar)
├── Wbase1050Form.tsx      # FoxProGridV2 欄位配置與 inline editing/search 邏輯
├── wbase1050Print.tsx     # 列印預覽與報表設定/CSV 輸出 Modal
└── useWbase1050.ts        # Zustand 狀態管理 Store (CRUD + 搜尋 + 刪除確認 + 列印)

frontend/src/services/
└── wbase1050.ts           # Axios API 通訊與 LocalAgent DLL 報表服務介面

backend/
├── Controllers/
│   └── Wbase1050Controller.cs  # RESTful CRUD & Print Query Endpoints
├── Models/
│   └── TaxOfficerMaster.cs     # EF Core Entity Model (基本稅務人員)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本稅務人員`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `編號` | `VARCHAR(20)` | `TaxCode` (PK) | 稅務人員編號 |
| `姓名` | `VARCHAR(50)` | `TaxName` | 稅務人員姓名 |
| `稅局` | `VARCHAR(50)` | `TaxBureau` | 國稅局/稽徵所名稱 |
| `單位` | `VARCHAR(50)` | `Unit` | 負責股別/單位名稱 |
| `電話` | `VARCHAR(30)` | `Tel` | 聯絡電話 |
| `分機` | `VARCHAR(20)` | `Ext` | 延伸分機 |
| `傳真` | `VARCHAR(30)` | `Fax` | 傳真號碼 |
| `手機` | `VARCHAR(30)` | `Mobile` | 行動電話 |
| `EMAIL` | `VARCHAR(100)`| `Email` | 電子信箱 |
| `備註` | `VARCHAR(200)`| `Memo` | 備註事項 |

---

## 4. 後端 API 規格 (`Wbase1050Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase1050?keyword={q}` | 查詢稅務人員列表 (依編號、姓名、國稅局模糊比對) |
| `GET` | `/api/wbase1050/{code}` | 取得指定編號稅務人員詳細資料 |
| `POST` | `/api/wbase1050` | 新增稅務人員資料 (重複編號傳回 400 Bad Request) |
| `PUT` | `/api/wbase1050/{code}` | 更新指定編號稅務人員資料 |
| `DELETE` | `/api/wbase1050/{code}` | 刪除指定編號稅務人員資料 |
| `POST` | `/api/wbase1050/print` | 依 `codeStart` 與 `codeEnd` 區間查詢報表資料 |
| `POST` | `http://localhost:18889/report` | 本地 LocalAgent 呼叫 DLL (`wbaseRP.dll`) 進行傳統列印 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 主表格視窗 (`index.tsx` & `FoxProGridV2`)
- `F2`：在表格末端自動新增一行空白列
- `F3`：開啟稅務人員開窗關鍵字搜尋彈窗
- `F8` 或 `Delete`：彈出刪除確認對話框
- `F9`：開啟列印/報表設定對話框 (Print Modal)
- `Enter` / `Tab`：於表格儲存格內向右切換編輯欄位
- `↑` / `↓`：於表格列間上下滑動游標
- `Esc`：退回 wbase 系統主選單

### 列印彈窗 (`wbase1050Print.tsx`)
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
