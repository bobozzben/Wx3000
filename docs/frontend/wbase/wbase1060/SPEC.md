# 規格書：wbase1060 收費項目資料維護作業

> **模組代號**：`wbase1060`  
> **功能名稱**：收費項目資料維護作業 (單檔主檔維護 CRUD + 熱鍵盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1060/` & `backend/Controllers/Wbase1060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1060` (對應資料表 `e3000__comm.基本收費項目`)

---

## 1. 模組定位與職責

本模組用於維護記帳士事務所設定之各類服務項目與標準收費金額 (例如：記帳服務費、營業稅申報費、營所稅結算申報費、簽證費等)。
具備以下功能特性：
1. **單檔 AG Grid / FoxProGridV2 盲打體驗 (`<Wbase1060Form />`)**：
   - 支援 `↑` `↓` 上下瀏覽資料列、`F2` 新增空白列、`F3` 關鍵字搜尋彈窗、`F8` 刪除選取列、`F9` 列印。
   - 內建行內金額格式化顯示 (`NT$ 3,500.00`) 與自動自動處理 (`sanitizeFeeItem`)。
2. **F3 開窗快速搜尋 (`SearchModal`)**：
   - 開啟 `收費項目開窗搜尋 [F3]` 視窗，提供代號與項目名稱模糊比對。
3. **列印預覽與報表輸出 Modal (`wbase1060Print.tsx`)**：
   - 支援起訖代號區間過濾。
   - 提供網頁直印 (Browser Print/PDF) 與 CSV 檔案輸出功能。
   - 支援本地端 LocalAgent DLL 報表服務 (`wbaseRP.dll`) 呼叫能力 (`callWaccrep3106b`)。
4. **RESTful API 後端整合**：
   - 連結 C# ASP.NET Core API (`Wbase1060Controller.cs`) 與 PostgreSQL `基本收費項目` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1060/
├── index.tsx              # 模組進入點 (整合 FoxProGridV2 與頂部/底部 Status Bar)
├── Wbase1060Form.tsx      # FoxProGridV2 欄位配置與 inline editing/search 邏輯
├── wbase1060Print.tsx     # 列印預覽與報表設定/CSV 輸出 Modal
└── useWbase1060.ts        # Zustand 狀態管理 Store (CRUD + 搜尋 + 刪除確認 + 列印)

frontend/src/services/
└── wbase1060.ts           # Axios API 通訊與 LocalAgent DLL 報表服務介面

backend/
├── Controllers/
│   └── Wbase1060Controller.cs  # RESTful CRUD & Print Query Endpoints
├── Models/
│   └── FeeItemMaster.cs        # EF Core Entity Model (基本收費項目)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本收費項目`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `項目` | `VARCHAR(50)` | `FeeCode` (PK) | 收費項目代號 (如: 01, 02) |
| `項目名稱` | `VARCHAR(100)`| `FeeName` | 收費項目名稱 (如: 記帳服務費) |
| `收費金額` | `NUMERIC(18,2)`| `Price` | 標準收費金額 (預設 0) |
| `guid` | `VARCHAR(50)` | `Guid` | 全球唯一識別碼 |

---

## 4. 後端 API 規格 (`Wbase1060Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase1060?keyword={q}` | 查詢收費項目列表 (依項目代號、項目名稱模糊比對) |
| `GET` | `/api/wbase1060/{code}` | 取得指定項目代號收費詳細資料 |
| `POST` | `/api/wbase1060` | 新增收費項目資料 (重複代號傳回 400 Bad Request) |
| `PUT` | `/api/wbase1060/{code}` | 更新指定項目代號收費資料 |
| `DELETE` | `/api/wbase1060/{code}` | 刪除指定項目代號收費資料 |
| `POST` | `/api/wbase1060/print` | 依 `codeStart` 與 `codeEnd` 區間查詢報表資料 |
| `POST` | `/api/wbase1060/batch-save` | 批量儲存收費項目列表 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 主表格視窗 (`index.tsx` & `FoxProGridV2`)
- `F2`：在表格末端自動新增一行空白列
- `F3`：開啟收費項目開窗關鍵字搜尋彈窗
- `F8` 或 `Delete`：彈出刪除確認對話框
- `F9`：開啟列印/報表設定對話框 (Print Modal)
- `Enter` / `Tab`：於表格儲存格內向右切換編輯欄位
- `↑` / `↓`：於表格列間上下滑動游標
- `Esc`：退回 wbase 系統主選單

### 列印彈窗 (`wbase1060Print.tsx`)
- `Enter`：欄位間順序切換 (起始代號 ➔ 結束代號 ➔ 確定列印)
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
