# 規格書：wbase1020 會計師/記帳士資料維護作業

> **模組代號**：`wbase1020`  
> **功能名稱**：會計師/記帳士資料維護作業 (單檔主檔維護 CRUD + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1020/` & `backend/Controllers/Wbase1020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1020` (對應資料表 `e3000__comm.基本會計師`)

---

## 1. 模組定位與職責

本模組為系統核心主檔維護作業之一，用於登錄、修改、刪除與列印事務所合作之會計師與記帳士基本資料。
具備以下功能特性：
1. **單檔 AG Grid 盲打體驗 (`<FoxProGrid />`)**：支援 `↑` `↓` 上下瀏覽資料列、`F2` 新增、`F3` 查詢、`F4` 編輯、`F8` 刪除、`F9` 列印。
2. **單筆編輯/新增 Modal (`wbase1020Form.tsx`)**：
   - 支援 **Enter 鍵順序下跳欄位**。
   - 會計師代號輸入自動英文字母轉大寫 (`toUpperCase()`)。
   - `F9` 或 `Ctrl+S` 儲存，`Esc` 取消關閉。
3. **列印預覽與報表輸出 Modal (`wbase1020Print.tsx`)**：
   - 起訖代號區間篩選。
   - 網頁報表格式預覽與瀏覽器直印 (Print / PDF)。
   - CSV 檔案下載輸出能力。
4. **RESTful API 後端整合**：連結 C# ASP.NET Core API 與 PostgreSQL `cpa_masters` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1020/
├── index.tsx              # 主頁面進入點 (包含 FoxProGrid 與工具列)
├── wbase1020Form.tsx      # 單筆編輯/新增 Modal (全鍵盤順序跳欄)
├── wbase1020Print.tsx      # 列印預覽與報表設定/CSV 輸出 Modal
└── useWbase1020.ts        # Zustand 狀態管理 Store (CRUD + 搜尋 + 視窗控制)

frontend/src/services/
└── wbase1020.ts           # Axios API Client 通訊模組

backend/
├── Controllers/
│   └── Wbase1020Controller.cs  # RESTful CRUD & Print Query Endpoints
├── Models/
│   └── CpaMaster.cs            # EF Core Entity Model (cpa_masters)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本會計師`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `編號` | `VARCHAR(10)` | `CpaCode` (PK) | 會計師/記帳士代號 |
| `姓名` | `VARCHAR(30)` | `CpaName` | 姓名/名稱 |
| `證書別` | `VARCHAR(20)` | `CertType` | 證書類別 |
| `申報ID` | `VARCHAR(20)` | `TaxId` | 申報識別碼 |
| `證書(登錄)字號` | `VARCHAR(50)` | `LicenseNo` | 證書/登錄字號 |
| `發文字軌` | `VARCHAR(20)` | `DocTrack` | 公文發文字軌 |
| `證書編號` | `VARCHAR(30)` | `CertNo` | 證書編號 |
| `公會名稱` | `VARCHAR(60)` | `OfficeName` | 公會/事務所名稱 |
| `會員證號` | `VARCHAR(30)` | `MemberNo` | 會員證號 |
| `電話` | `VARCHAR(20)` | `Tel` | 聯絡電話 |
| `手機` | `VARCHAR(20)` | `Mobile` | 行動電話 |
| `傳真` | `VARCHAR(20)` | `Fax` | 傳真號碼 |
| `統一編號` | `VARCHAR(20)` | `UnifiedNo` | 統一編號 |
| `地址` | `VARCHAR(100)`| `Address` | 通訊/事務所地址 |
| `會計師公會證號1` | `VARCHAR(50)`| `GuildNo1` | 公會證號一 |
| `會計師公會證號2` | `VARCHAR(50)`| `GuildNo2` | 公會證號二 |
| `EMAIL` | `VARCHAR(100)`| `Email` | 電子郵件地址 |
| `guid` | `VARCHAR(50)` | `Guid` | 全球唯一識別碼 |

---

## 4. 後端 API 規格 (`Wbase1020Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase1020?keyword={q}` | 查詢會計師列表 (可依代號、姓名、事務所模糊搜尋) |
| `GET` | `/api/wbase1020/{code}` | 取得指定代號會計師詳細資料 |
| `POST` | `/api/wbase1020` | 新增會計師資料 (重複代號傳回 400 Bad Request) |
| `PUT` | `/api/wbase1020/{code}` | 更新指定代號會計師資料 |
| `DELETE` | `/api/wbase1020/{code}` | 刪除指定代號會計師資料 |
| `POST` | `/api/wbase1020/print` | 依 `startCode` 與 `endCode` 區間查詢報表資料 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 主表格視窗 (`index.tsx`)
- `F2`：開啟新增視窗 (Add Modal)
- `F3`：焦點移至搜尋關鍵字輸入框 (Search Filter)
- `F4` 或 `Enter`：開啟選取列之編輯視窗 (Edit Modal)
- `F8` 或 `Delete`：彈出刪除確認對話框
- `F9`：開啟列印/報表對話框 (Print Modal)
- `Esc`：退回 wbase 系統主選單

### 編輯視窗 (`wbase1020Form.tsx`)
- `Enter`：欄位依序向下滑動焦點 (代號 ➔ 姓名 ➔ 證號 ➔ 事務所 ➔ 電話 ➔ 傳真 ➔ 地址 ➔ 備註)
- `F9` 或 `Ctrl+S`：儲存提交 (Save & Submit)
- `Esc`：取消並關閉編輯視窗

---

## 6. 建置與測試說明

```bash
# 後端編譯與執行
cd backend
dotnet run

# 前端專案編譯驗證
cd frontend
pnpm run build
```
