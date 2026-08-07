# Project Specification: Wx3000 (FoxPro to Modern Web Migration)

> **專案目標**：建立全端專案 `Wx3000` 用以替代傳統 FoxPro / Delphi Win32 會計進銷存系統。核心關鍵在於**前端輸入手感必須 100% 模擬傳統 FoxPro 鍵盤操作模式**，達到無需滑鼠、全鍵盤盲打（Tab/Enter/F2/F9/F12）的高效率體驗，專為 50 歲以上資深倉管與會計人員設計。

---

## 1. 技術棧與環境規格 (Tech Stack)

| 項目 | 選用技術 / 規格說明 |
| :--- | :--- |
| **專案名稱** | `Wx3000` |
| **包管理工具** | `pnpm` (Monorepo / Workspace 管理 structure) |
| **前端 (Frontend)** | React 19 + TypeScript + Vite + Axios + AG Grid Community + Tailwind CSS + Zustand |
| **後端 (Backend)** | **C# .NET 8/9 (ASP.NET Core Web API)**<br>- 可發佈為獨立單一檔案可執行檔 (Single File EXE)<br>- 可註冊安裝為 Windows 服務 (Windows Service) |
| **資料庫 (Database)** | **PostgreSQL 16**<br>- Server IP: `127.0.0.1` \| Port: `5432`<br>- User: `postgresql` \| Password: `0000`<br>- Database: `a3000` |
| **ORM / Data Access** | Entity Framework Core (EF Core) + Npgsql |
| **開發診斷與輔助** | `concurrently` + `ngrok` (用於 Reverse Proxy 區域開窗測試) |

---

## 2. 專案目錄結構 (Project Structure)

```text
Wx3000/
├── .env.example
├── package.json                   # Root package.json (concurrently, scripts)
├── Wx3000.sln                     # C# Solution 檔案
├── backend/                       # C# 後端 API 與 Win 服務專案
│   ├── Wx3000.Backend.csproj
│   ├── Program.cs                 # Web API / Windows Service 啟動入口
│   ├── Data/
│   │   ├── AppDbContext.cs        # EF Core PostgreSQL 連線與 DbSet 定義
│   │   └── DbInitializer.cs       # 種子資料 (Products, Vendors 假資料)
│   ├── Models/
│   │   ├── Product.cs
│   │   ├── Vendor.cs
│   │   ├── PurchaseHeader.cs
│   │   └── PurchaseLine.cs
│   ├── DTOs/
│   │   ├── SearchQueryDto.cs
│   │   └── CreatePurchaseOrderDto.cs
│   └── Controllers/
│       ├── ProductsController.cs
│       ├── VendorsController.cs
│       └── PurchaseController.cs
├── frontend/                      # React 前端專案
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── wbase/                 # 基本資料維護模組 (如：產品主檔、廠商主檔)
│       │   ├── components/
│       │   └── pages/
│       ├── wtaxop/                # 單據作業模組 (如：進貨單、銷貨單)
│       │   └── PurchaseOrder/
│       │       ├── PurchaseOrderHeader.tsx
│       │       └── PurchaseOrderPage.tsx
│       ├── components/            # 共用與高度可複用元件
│       │   ├── FoxProGrid/        # [核心元件 A] 單檔/主檔維護專用 盲打 AG Grid
│       │   │   ├── FoxProGrid.tsx
│       │   │   ├── useFoxProKeyboard.ts
│       │   │   ├── SearchModal.tsx
│       │   │   └── index.ts
│       │   └── FoxProGridBill/    # [核心元件 B] 單據 Header+Detail 專用 盲打 AG Grid
│       │       ├── FoxProGridBill.tsx
│       │       ├── useFoxProBillKeyboard.ts
│       │       └── index.ts
│       ├── hooks/
│       ├── services/
│       │   └── api.ts             # Axios 實例配置
│       ├── store/
│       │   └── usePurchaseStore.ts# Zustand 狀態管理
│       ├── App.tsx
│       └── main.tsx
└── scripts/
    └── dbf_to_pg.js               # 舊 DBF 資料轉移至 PostgreSQL 工具腳本
```

---

## 3. 開發階段規範與實施步驟 (Phases)

### Phase 1: 後端與資料庫 (C# .NET + PostgreSQL 16)

#### 1. 資料庫連線配置 (`a3000`)
- **Connection String**: `Host=127.0.0.1;Port=5432;Database=a3000;Username=postgresql;Password=0000`
- 使用 EF Core Npgsql Provider。

#### 2. 資料模型 (Models & Tables)
- **Product** (`products`)
  - `Code` (String, PK) - 品號
  - `Name` (String) - 品名
  - `Spec` (String) - 規格
  - `Price` (Decimal) - 單價
  - `Stock` (Decimal) - 庫存量
- **Vendor** (`vendors`)
  - `Code` (String, PK) - 廠商代號
  - `Name` (String) - 廠商名稱
- **PurchaseHeader** (`purchase_headers`)
  - `Id` (Int, PK, AutoIncrement)
  - `BillNo` (String, Unique) - 單號
  - `VendorCode` (String)
  - `VendorName` (String)
  - `Total` (Decimal) - 總金額
  - `CreatedAt` (DateTime)
  - `Lines` (List<PurchaseLine>)
- **PurchaseLine** (`purchase_lines`)
  - `Id` (Int, PK, AutoIncrement)
  - `HeaderId` (Int, FK)
  - `LineNo` (Int) - 項次
  - `ProductCode` (String) - 品號
  - `ProductName` (String) - 品名
  - `Qty` (Decimal) - 數量
  - `Price` (Decimal) - 單價
  - `Amount` (Decimal) - 小計
  - `Remark` (String) - 備註

#### 3. API Endpoints (需求支援 CORS)
- `GET /api/products/search?q={keyword}` -> 回傳符合條件的品號、品名、規格、單價。
- `GET /api/vendors/search?q={keyword}` -> 回傳符合條件的廠商代號與名稱。
- `POST /api/purchase` -> 接收 Header 及 Lines，以資料庫交易 (DB Transaction) 寫入 DB。

---

### Phase 2: 前端核心模組 — FoxPro 鍵盤體驗 (AG Grid 封裝)

為了確保任何單檔輸入與單據作業都能 100% 盲打，需打造兩個高度可複用元件：
1. `<FoxProGrid />`：適用於單檔/主檔多筆資料維護。
2. `<FoxProGridBill />`：適用於單據頁面 (Header + Detail) 明細表格。

#### 1. AG Grid 基礎設定參數 (Core AgGridReact Config)
```tsx
<AgGridReact
  rowData={rows}
  columnDefs={columnDefs}
  editType="fullRow"
  singleClickEdit={true}
  stopEditingWhenCellsLoseFocus={false}
  suppressClickEdit={false}
  suppressRowClickSelection={true}
  suppressCellFocus={false}
  enterNavigatesVertically={true}
  enterNavigatesVerticallyAfterEdit={true}
  undoRedoCellEditing={true}
  undoRedoCellEditingLimit={100}
  enableCellTextSelection={false}
  suppressScrollOnNewData={true}
/>
```

#### 2. 鍵盤導引機制 (`useFoxProKeyboard` / `useFoxProBillKeyboard`)
- **[Enter 鍵]**：
  - 阻止預設行為，焦點右移至下一個可編輯儲存格。
  - 當前列最後一欄按下 Enter -> 移動至下一列第一欄。
  - 最後一列最後一欄按下 Enter -> 自動 **Append 新增一空列** 並聚焦至該列第一欄。
- **[Tab / Shift+Tab 鍵]**：左右單元格切換。
- **[Arrow Up / Arrow Down 鍵]**：上下切換列。到達底端時 Arrow Down 可自動新增列。
- **[F2 鍵] (關鍵開窗與編輯鍵)**：
  - 焦點位於「產品代號」或「品名」時 -> 觸發 `SearchModal` (開窗搜尋)。
  - 焦點位於「數量」、「單價」、「備註」等數值欄位時 -> 進入儲存格編輯模式。
- **[F9 鍵]**：觸發全頁單據 / 資料查詢。
- **[F12 鍵]**：觸發存檔 (Save) 並計算與顯示總計。
- **直接打字 (Direct Typing)**：直接輸入字元即可覆蓋目前單元格內容，無須先按 F2。

#### 3. 視覺規格 (Visual Style Rules)
- **字型與高矮**：`fontFamily: Consolas, monospace`, `fontSize: 16px`, `rowHeight: 38px`。
- **Header 樣式**：深藍底色 `#1e3a8a`，文字純白 `#ffffff`，粗體高對比。
- **焦點提示 (Focus State)**：選中 Cell 顯示 **2px 顯眼黃色外框 (`#eab308` / `#f59e0b`)**，讓使用者眼睛秒抓焦點。
- **隔行變色**：偶數列套用背景 `#f9fafb`。
- **底部狀態列 (StatusBar)**：即時顯示「總金額 | 總筆數 | [F2]開窗搜尋 [F9]查詢 [F12]存檔」。

#### 4. 產品與廠商輸入驗證邏輯
- **產品代號輸入 (onBlur 或 Enter 時)**：
  - 發送 `/api/products/search?q={input}` 檢查。
  - **存在**：自動帶入品名、規格、單價、預設數量 1，並自動計算小計金額。
  - **不存在 (例如輸入 A999)**：自動重置該列欄位，並跳出警告提示：  
    `⚠️ 品號 [A999] 不存在，請重新輸入或按 F2 開窗搜尋！`
- **廠商代號驗證**：
  - 廠商欄位按下 **F2** 可開啟廠商開窗彈窗。
  - 輸入不存在的廠商代號時，離焦 (onBlur) 亦會自動清空並警示不存在。

---

### Phase 3: 進貨單頁面實作 (`/wtaxop/PurchaseOrder`)

結合 Header 表單與 `<FoxProGridBill />` 元件：
- **上方區塊 (Header Field)**：
  - 單別 (預設 'PI')
  - 單號 (自動產生，如 `PI-20260805001`)
  - 廠商代號 (支援鍵盤 **F2** 開窗搜尋) + 廠商名稱 (自動帶出)
  - 進貨日期
- **中間區塊 (Grid Detail)**：
  - `<FoxProGridBill />` 包含 8 個欄位：`[項次, 產品代號(F2), 品名(F2), 規格, 數量, 單價, 小計, 備註]`
- **下方區塊 (Footer Summary & Actions)**：
  - 總數量、總金額統計欄
  - 快捷鍵提示：`[F2] 開窗搜尋/編輯` \| `[F9] 查詢單據` \| `[F12] 存檔`

---

### Phase 4: 開發環境與整合 (Dev Tools & Deployment)

#### 1. `package.json` Root Scripts
```json
{
  "name": "wx3000-root",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:web\"",
    "dev:web": "pnpm --filter frontend dev",
    "dev:api": "dotnet run --project backend/Wx3000.Backend.csproj",
    "build:api": "dotnet publish backend/Wx3000.Backend.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true",
    "ngrok": "ngrok http 5173"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

#### 2. `.env.example`
```ini
DATABASE_URL="Host=127.0.0.1;Port=5432;Database=a3000;Username=postgresql;Password=0000"
VITE_API_URL="http://localhost:5000"
```

#### 3. C# 發佈與部署 (Win 服務 / 單一 EXE)
- C# 後端可使用 `dotnet publish` 打包為單一可執行檔 `Wx3000.Backend.exe`。
- 可整合 `.UseWindowsService()` 讓客戶端一鍵安裝為 Windows 服務開機自動執行。

---

## 4. 開發防呆與禁忌 (Strict Guidelines - DO NOT)

1. ❌ **禁止單筆表單設計**：明細表格必須為大容量 Multi-Row (至少 15 列) 表格，嚴禁設計成一次只能填一筆資料的彈窗或單筆輸入框。
2. ❌ **禁止強迫使用滑鼠**：所有搜尋、換行、存檔必須能透過 Enter / Tab / F2 / F9 / F12 完成。
3. ❌ **禁止 Dropdown 下拉搜尋**：產品與廠商搜尋必須使用 **F2 觸發的大型開窗 SearchModal**，以還原 FoxPro 開窗習慣。
4. ❌ **禁止預設需要先按 F2 才能打字**：儲存格必須支援 Direct Keypress Overwrite。

---

## 5. 啟動與測試流程指引 (Quick Start)

1. **資料庫建置**：確保 PostgreSQL 16 服務已啟動，Database `a3000` 已建立。
2. **安裝依賴**：執行 `pnpm install`。
3. **後端資料庫初始化**：執行 `dotnet run --project backend` (自動套用 Migration 並寫入假資料)。
4. **啟動全棧開發環境**：執行 `pnpm dev` (同時啟動 C# Backend 與 React Frontend)。
5. **對外測試**：如需 Reverse Proxy 測試，執行 `pnpm ngrok`。
