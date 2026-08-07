# 規格書：C# ASP.NET Core 後端 API 與 PostgreSQL 資料庫初始化規格

> **專案代號**：`Wx3000.Backend`  
> **技術架構**：C# .NET 8/9 ASP.NET Core Web API + EF Core + Npgsql  
> **檔案目錄**：`backend/`  
> **目標資料庫**：PostgreSQL 16 (`127.0.0.1:5432` / Database: `a3000`)

---

## 1. 系統定位與部署規格

1. **獨立服務包裝**：
   - 支援 `dotnet run` 本地開發偵錯。
   - 支援發佈為 Single File Executable (`.exe`)。
   - 支援安裝為 Windows Service (服務名稱 `Wx3000BackendService`)，透過 `builder.Services.AddWindowsService()` 實現。
2. **CORS 與安全設定**：
   - 註冊 `AllowAll` 策略，允許前端 Vite (`localhost:5173`) 及 ngrok 外網開窗跨域存取。

---

## 2. 檔案目錄結構

```text
backend/
├── Wx3000.Backend.csproj
├── Program.cs                 # API 入口點、Windows Service 註冊、DbContext 注入
├── appsettings.json           # 資料庫連線字串配置
├── Data/
│   ├── AppDbContext.cs        # EF Core DbContext、DbSet 註冊與實體映射
│   └── DbInitializer.cs       # 自動建表 (Raw SQL DDL) 與初始種子資料初始化
├── Models/
│   ├── CpaMaster.cs           # 會計師主檔 Entity (schema: e3000__comm, table: 基本會計師)
│   ├── Product.cs             # 產品主檔 Entity (products)
│   ├── Vendor.cs              # 廠商主檔 Entity (vendors)
│   ├── PurchaseHeader.cs      # 進貨單頭 Entity (purchase_headers)
│   └── PurchaseLine.cs        # 進貨單明細 Entity (purchase_lines)
└── Controllers/
    ├── Wbase1020Controller.cs # 會計師維護 API
    ├── ProductsController.cs  # 產品快查 API
    ├── VendorsController.cs   # 廠商快查 API
    └── PurchaseController.cs  # 進貨單作業 API
```

---

## 3. 資料庫初始化策略 (`DbInitializer.cs`)

為了解決 EF Core `Database.EnsureCreated()` 或 `CreateTables()` 在 PostgreSQL 現存資料庫中重複執行會引發 `relation "xxxx" already exists` 異常問題，本專案採用 ** idempotency (冪等性) 原生 SQL DDL 腳本** 搭配獨立批次執行：

### 初始化腳本原則
1. 使用 `ExecuteSqlRaw` 針對每個 Table 執行 `CREATE TABLE IF NOT EXISTS ...`。
2. 確保每次服務啟動時可安全地自動建立缺少的 Table，同時不影響已存在的資料。
3. 檢查 Table 是否已有 Seed 資料，若無則自動寫入初始 Mock/測試資料。

---

## 4. API Endpoints 總攬

| 模組 | HTTP Method | Route | 說明 |
| :--- | :--- | :--- | :--- |
| **會計師主檔** | `GET` | `/api/wbase1020` | 取得會計師列表 (可含關鍵字搜尋) |
| | `POST` | `/api/wbase1020` | 新增會計師資料 |
| | `PUT` | `/api/wbase1020/{code}` | 修改會計師資料 |
| | `DELETE` | `/api/wbase1020/{code}` | 刪除會計師資料 |
| | `POST` | `/api/wbase1020/print` | 依代號區間查詢列印資料 |
| **產品快查** | `GET` | `/api/products` | 產品搜尋 (品號/品名) |
| **廠商快查** | `GET` | `/api/vendors` | 廠商搜尋 (代號/名稱) |
| **進貨單作業**| `GET` | `/api/purchase` | 進貨單列表 |
| | `POST` | `/api/purchase` | 新增進貨單與明細 |

---

## 5. 編譯與發佈指令

```bash
# 本地開發啟動
cd backend
dotnet run

# 發佈為獨立單一檔案執行檔 (.exe)
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o ../dist/backend
```
