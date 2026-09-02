# 規格書：wbase3020 發票購買申購維護作業

> **模組代號**：`wbase3020`  
> **功能名稱**：發票購買申購維護作業 (雙階段條件開窗 + 批量發票數量登錄 AG Grid + 申購媒體檔輸出)  
> **所屬模組**：`frontend/src/wbase/wbase3020/` & `backend/Controllers/Wbase3020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3020` (對應資料表 `e3000__comm.基本發票購買`)

---

## 1. 模組定位與職責

本模組為營業稅申購發票之核心作業，用於登錄、批次維護客戶公司每期 (如 11505-06) 各式手開與收銀機發票申購本數 (二聯、三聯、特種等)，並產出國稅局申購媒體檔與報表。
具備以下功能特性：
1. **雙階段操作流程**：
   - **階段 1：期別條件設定彈窗 (`wbase3020_01.tsx`)**：
     - 設定申購期別 (如 `11505-06`)、次數、輸入方式 (1.全部 2.縣市別 3.地點別 4.建檔人員) 與輸入條件。
     - 自動記憶上一次系統參數設定值。
     - 全鍵盤熱鍵 `Enter` 順序移動，`F2` 開窗快查條件。
   - **階段 2：發票數量整頁明細盲打表格 (`wbase3020_02.tsx`)**：
     - 列出過濾後之所有公司列表。
     - 提供 **8 大發票本數欄位** (手開二聯、二聯副、三聯、三聯副、特種；收銀二聯、三聯、三聯副) 盲打輸入。
     - 支援橫向 `Enter`/`Tab` 自動在數字欄位與下一公司間順滑流轉。
2. **全自動發票數量試算與行內狀態維護**：
   - 內建 `sanitizeInvoicePurchaseItem` 自動數字修整與轉型。
   - 支援 `Ctrl+S` / `F9` 批次儲存 (`batchSaveInvoicePurchaseItems`)。
3. **媒體檔產出與列印**：
   - 支援 `wbase3020Print.tsx` 報表輸出與媒體檔匯出介面。
4. **RESTful API 後端整合**：
   - 連結 C# ASP.NET Core API (`Wbase3020Controller.cs`) 與 PostgreSQL `基本發票購買` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3020/
├── index.tsx              # 進入點 (依 state 切換 Step 1 條件彈窗與 Step 2 主表格)
├── wbase3020_01.tsx       # 階段 1：期別/次數/過濾條件設定對話框
├── wbase3020_02.tsx       # 階段 2：發票申購本數批次明細表格與數字熱鍵盲打
├── wbase3020Print.tsx     # 報表列印與媒體檔下載對話框
└── useWbase3020.ts        # Zustand 狀態管理 Store (條件過濾、發票本數計算與 CRUD)

frontend/src/services/
└── wbase3020.ts           # Axios API 通訊 (Batch Save & Search)

backend/
├── Controllers/
│   └── Wbase3020Controller.cs  # RESTful CRUD, Composite PK & Batch Endpoints
├── Models/
│   └── InvoicePurchaseMaster.cs# EF Core Entity Model (基本發票購買)
└── Data/
    └── DbInitializer.cs        # DDL 複合主鍵建立與初始化資料
```

---

## 3. 資料庫 Schema (`e3000__comm` . `基本發票購買`)

> ⚠️ **複合主鍵 (Composite PK)**：(`期別`, `次數`, `公司編號`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `期別` | `VARCHAR(30)` | `Period` (PK) | 申購期別 (例: 11505-06) |
| `次數` | `VARCHAR(10)` | `Times` (PK) | 申購次數 (預設: 1) |
| `公司編號` | `VARCHAR(50)` | `CompanyCode` (PK) | 公司編號 |
| `公司簡稱` | `VARCHAR(255)`| `CompanyShortName` | 公司簡稱 |
| `公司統編` | `VARCHAR(20)` | `UnifiedNo` | 統一編號 |
| `稅籍編號` | `VARCHAR(30)` | `TaxNo` | 稅籍編號 |
| `手開二聯` | `INTEGER` | `ManualTwoDup` | 手開二聯發票本數 |
| `手開二聯副` | `INTEGER` | `ManualTwoDupSub` | 手開二聯副發票本數 |
| `手開三聯` | `INTEGER` | `ManualThreeDup` | 手開三聯發票本數 |
| `手開三聯副` | `INTEGER` | `ManualThreeDupSub` | 手開三聯副發票本數 |
| `手開特種` | `INTEGER` | `ManualSpecial` | 手開特種發票本數 |
| `收銀二聯` | `INTEGER` | `CashTwoDup` | 收銀二聯發票本數 |
| `收銀三聯` | `INTEGER` | `CashThreeDup` | 收銀三聯發票本數 |
| `收銀三聯副` | `INTEGER` | `CashThreeDupSub` | 收銀三聯副發票本數 |
| `縣市別` | `VARCHAR(50)` | `City` | 縣市分類 |
| `購買地點` | `VARCHAR(50)` | `PlaceCode` | 指定購票地點代號 |
| `建檔人員` | `VARCHAR(50)` | `EmpCode` | 建檔/負責人員代號 |
| `guid` | `VARCHAR(100)`| `Guid` | 全球唯一識別碼 |

---

## 4. 後端 API 規格 (`Wbase3020Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase3020?period={p}&times={t}&keyword={q}` | 依期別、次數與搜尋條件查詢發票申購明細 |
| `GET` | `/api/wbase3020/{period}/{times}/{companyCode}` | 取得指定複合鍵之申購資料 |
| `POST` | `/api/wbase3020` | 新增單筆發票申購資料 |
| `PUT` | `/api/wbase3020` | 更新指定申購資料 (由 Request Body 帶入複合主鍵) |
| `DELETE` | `/api/wbase3020/{period}/{times}/{companyCode}` | 刪除指定申購資料 |
| `POST` | `/api/wbase3020/batch-save` | 批次整頁儲存所有發票申購本數變更 |
| `POST` | `/api/wbase3020/print` | 依期別與過濾條件查詢報表預覽資料 |
| `POST` | `/api/wbase3020/generate-purchase-file` | 產生國稅局發票申購媒體檔格式 |

---

## 5. 鍵盤熱鍵對照表 (Hotkeys)

### 階段 1：期別條件彈窗 (`wbase3020_01.tsx`)
- `Enter`：順序下跳 (年度 ➔ 起始月 ➔ 結束月 ➔ 次數 ➔ 輸入方式 ➔ 輸入條件 ➔ 確定按鈕)
- `F2`：在「輸入條件」欄位時開啟對應之開窗快查彈窗
- `Esc`：關閉彈窗並退回主選單

### 階段 2：發票數量明細表格 (`wbase3020_02.tsx`)
- `Enter` / `Tab`：於發票本數儲存格間向右移動，最後一格按下時自動跳至下一公司行首
- `↑` / `↓`：於公司資料列間垂直滑動游標
- `F3`：開啟發票申購搜尋彈窗
- `F9` / `Ctrl+S`：儲存全頁發票申購資料
- `Esc`：返回階段 1 重新設定條件

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
