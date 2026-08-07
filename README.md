# Wx3000 - Modern Accounting System (FoxPro Keyboard Replica)

`Wx3000` 是一個旨在完全取代傳統 FoxPro / Delphi Win32 會計進銷存系統的全端專案。核心優勢在於**前端輸入手感 100% 模擬 FoxPro 全鍵盤盲打**（支援 Enter 右移、下行、底端自動 Append、F2 開窗搜尋與編輯、F9 查詢、F12 存檔），完全無須使用滑鼠。

---

## 🛠️ 技術架構

- **Backend**: C# .NET 8/9 ASP.NET Core Web API / Windows Service (可編譯為單一 EXE 或安裝為 Windows 服務)
- **Frontend**: React 19 + TypeScript + Vite + AG Grid Community + Tailwind CSS + Zustand
- **Database**: PostgreSQL 16 (`127.0.0.1:5432`, DB: `a3000`, User: `postgres`, Password: `0000`)
- **Package Manager**: `pnpm`
- **Dev Tools**: `concurrently` + `ngrok`

---

## 📁 核心目錄與模組說明

```text
Wx3000/
├── Wx3000_SPEC.md              # 系統完整規格與防呆開發文件
├── backend/                    # C# .NET Web API & Windows Service
│   ├── Controllers/            # Products, Vendors, Purchase API
│   ├── Data/                   # AppDbContext (EF Core) & DbInitializer (種子資料)
│   ├── Models/                 # Product, Vendor, PurchaseHeader, PurchaseLine
│   └── DTOs/
├── frontend/                   # React 19 + AG Grid 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── FoxProGrid/     # [核心元件] 單檔/主檔盲打 AG Grid 封裝 + F2 Modal
│   │   │   └── FoxProGridBill/ # [核心元件] 單據 Header+Detail 盲打 AG Grid 封裝
│   │   ├── wtaxop/
│   │   │   └── PurchaseOrder/  # 進貨單作業主頁面 (Header + Detail)
│   │   ├── store/              # Zustand 狀態管理 (usePurchaseStore)
│   │   └── services/           # Axios API
└── scripts/                    # Legacy DBF 工具
```

---

## 🚀 快速啟動指引 (Quick Start)

### 1. 啟動 PostgreSQL 16 資料庫
請確保本地 PostgreSQL 已啟動，並建立 `a3000` 資料庫：
- IP: `127.0.0.1` | Port: `5432`
- User: `postgresql` | Password: `0000`
- Database: `a3000`

### 2. 安裝前端與根目錄依賴
```bash
pnpm install
```

### 3. 啟動全棧開發環境 (Backend + Frontend)
```bash
pnpm dev
```
- 後端 C# API 服務：`http://localhost:5000` (自動建立資料庫表結構並注入預設假資料)
- 前端 React Web 服務：`http://localhost:5173`

### 4. 啟動 Reverse Proxy 測試 (選填)
```bash
pnpm ngrok
```

### 5. 後端單一可執行檔發佈 (Publish Standalone EXE)
```bash
pnpm build:api
```
執行後將在 `backend/bin/Release/net8.0/win-x64/publish/` 產生可直接發佈至客戶端主機的獨立 `Wx3000.Backend.exe`！

---

## 🔑 鍵盤操作規範指南 (FoxPro Keyboard Shortcuts)

| 快捷鍵 | 功能與觸發情境 |
| :--- | :--- |
| **Enter** | 焦點移動至右側下一個可編輯儲存格；列末自動至下一列第一欄；最後一列最後一欄自動 **Append 新增一列**。 |
| **F2** | **1. 廠商/產品代號欄位**：觸發大型開窗搜尋彈窗 (`SearchModal`)。<br>**2. 數值/備註欄位**：進入單元格編輯模式。 |
| **F9** | 觸發單據/資料歷史查詢。 |
| **F12** | 一鍵將全張單據發送至後端存檔 (Save)。 |
| **直接打字** | 無須先按 F2，直接鍵入字元即可即時覆蓋單元格內容。 |
