# 規格書：wbase1080 收費摘要資料維護作業

> **模組代號**：`wbase1080`  
> **功能名稱**：收費摘要資料維護作業 (單檔主檔維護 CRUD + 熱鍵盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1080/` & `backend/Controllers/Wbase1080Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1080` (對應資料表 `e3000__comm.基本收費摘要`)

---

## 1. 模組定位與職責

本模組用於維護事務所各項收費單據、代收代付費用明細之標準摘要簡稱與詳細內容。
具備以下功能特性：
1. **單檔 AG Grid / FoxProGridV2 盲打體驗 (`<Wbase1080Form />`)**：
   - 支援 `↑` `↓` 上下瀏覽資料列、`F2` 新增空白列、`F3` 關鍵字搜尋彈窗、`F8` 刪除選取列、`F9` 列印。
   - 自動將摘要代號轉換為大寫並清理字串空格 (`sanitizeFeeSummary`)。
2. **F3 開窗快速搜尋 (`SearchModal`)**：
   - 開啟 `基本收費摘要開窗搜尋 [F3]` 視窗，提供摘要代號、說明與內文模糊比對。
3. **列印預覽與報表輸出 Modal (`wbase1080Print.tsx`)**：
   - 支援起訖代號區間過濾。
   - 提供網頁直印 (Browser Print/PDF) 與 CSV 檔案輸出功能。
   - 支援本地端 LocalAgent DLL 報表服務 (`wbaseRP.dll`) 呼叫能力 (`callWaccrep3106b`)。
4. **RESTful API 後端整合**：
   - 連結 C# ASP.NET Core API (`Wbase1080Controller.cs`) 與 PostgreSQL `基本收費摘要` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1080/
├── index.tsx              # 模組進入點 (整合 FoxProGridV2 與頂部/底部 Status Bar)
├── Wbase1080Form.tsx      # FoxProGridV2 欄位配置與 inline editing/search 邏輯
├── wbase1080Print.tsx     # 列印預覽與報表設定/CSV 輸出 Modal
└── useWbase1080.ts        # Zustand 狀態管理 Store (CRUD + 搜尋 + 刪除確認 + 列印)

frontend/src/services/
└── wbase1080.ts           # Axios API 通訊與 LocalAgent DLL 報表服務介面

backend/
├── Controllers/
│   └── Wbase1080Controller.cs  # RESTful CRUD & Print Query Endpoints
├── Models/
│   └── FeeSummaryMaster.cs     # EF Core Entity Model (基本收費摘要)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本收費摘要`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `序` | `INTEGER` | `Seq` | 排序序號 |
| `編號` | `VARCHAR(50)` | `SummaryCode` (PK) | 摘要代號 |
| `說明` | `VARCHAR(50)` | `SummaryName` | 摘要說明/名稱 |
| `摘要` | `VARCHAR(512)`| `Content` | 詳細摘要內容範本 |
| `guid` | `VARCHAR(50)` | `Guid` | 全球唯一識別碼 |

---

## 4. 後端 API 規格 (`Wbase1080Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase1080?keyword={q}` | 查詢收費摘要列表 (依編號、說明、摘要內容模糊比對) |
| `GET` | `/api/wbase1080/{code}` | 取得指定摘要代號詳細資料 |
| `POST` | `/api/wbase1080` | 新增收費摘要資料 (重複代號傳回 400 Bad Request) |
| `PUT` | `/api/wbase1080/{code}` | 更新指定摘要代號資料 |
| `DELETE` | `/api/wbase1080/{code}` | 刪除指定摘要代號資料 |
| `POST` | `/api/wbase1080/print` | 依 `codeStart` 與 `codeEnd` 區間查詢報表資料 |
| `POST` | `/api/wbase1080/batch-save` | 批量儲存收費摘要列表 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 主表格視窗 (`index.tsx` & `FoxProGridV2`)
- `F2`：在表格末端自動新增一行空白列
- `F3`：開啟基本收費摘要開窗關鍵字搜尋彈窗
- `F8` 或 `Delete`：彈出刪除確認對話框
- `F9`：開啟列印/報表設定對話框 (Print Modal)
- `Enter` / `Tab`：於表格儲存格內向右切換編輯欄位
- `↑` / `↓`：於表格列間上下滑動游標
- `Esc`：退回 wbase 系統主選單

### 列印彈窗 (`wbase1080Print.tsx`)
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
