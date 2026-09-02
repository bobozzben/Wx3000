# Wx3000 Workspace Guidelines & Specification

> **專案定位**：`Wx3000` 是一個旨在完全取代傳統 FoxPro / Delphi Win32 會計與進銷存系統的全端專案。核心優勢在於**前端輸入手感 100% 模擬 FoxPro 全鍵盤盲打**（全鍵盤流暢操作、無須滑鼠），專為高頻率會計與倉管人員設計。

---

## 🛠️ 1. 技術棧與環境規格 (Tech Stack & Environment)

| 領域 | 選用技術 / 規格說明 |
| :--- | :--- |
| **專案架構** | Monorepo / `pnpm` Workspace 管理 |
| **前端 (Frontend)** | React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid Community (v36) + Zustand + Axios |
| **後端 (Backend)** | **C# .NET 8/9 (ASP.NET Core Web API)**<br>- 支援獨立單一可執行檔 (Single File EXE)<br>- 支援註冊為 Windows 服務 (Windows Service) |
| **資料庫 (Database)** | **PostgreSQL 16**<br>- Server: `127.0.0.1:5432`<br>- DB: `a3000` \| User: `postgres` \| Password: `0000` |
| **ORM / Data Access** | Entity Framework Core (EF Core) + Npgsql |
| **開發診斷與工具** | `concurrently` + `ngrok` (Reverse Proxy) + `oxlint` |

---

## 📁 2. 專案目錄結構 (Workspace Directory Map)

```text
Wx3000/
├── WORKSPACE.md                       # 本工作區開發規範與規則指引
├── README.md                          # 快速啟動與專案簡介
├── Wx3000_SPEC.md                     # 全系統規格與防呆開發文件
├── docs/                              # 模組詳細規格索引與文件庫
│   ├── SPEC.md                        # 規格文件總目錄
│   ├── backend/backend_SPEC.md        # 後端 API 與 DB 規格
│   └── frontend/                      # 各前端模組規格 (wbase, wtaxop, components)
├── backend/                           # C# .NET Web API & Windows Service
│   ├── Controllers/                   # RESTful API 控制器
│   ├── Data/                          # AppDbContext (EF Core) & DbInitializer (種子資料)
│   ├── Models/                        # Entity 資料模型
│   ├── DTOs/                          # Data Transfer Objects
│   └── Services/                      # 系統參數與業務邏輯服務
├── frontend/                          # React 19 + AG Grid 前端專案
│   ├── src/
│   │   ├── components/
│   │   │   ├── FoxProGrid/            # [核心組件] 單檔維護盲打 AG Grid + F2 Modal
│   │   │   └── FoxProGridBill/        # [核心組件] 單據 (Header+Detail) 盲打 AG Grid
│   │   ├── wbase/                     # 基本資料維護模組 (公司、記帳士、稅務人員、會計師等)
│   │   ├── wtaxop/                    # 單據作業模組 (進貨單、銷貨單等)
│   │   ├── store/                     # Zustand 全域/頁面狀態管理
│   │   └── services/                  # Axios API 實例與連線
└── scripts/                           # DBF 轉移與輔助腳本
```

---

## 🔑 3. 前端 FoxPro 鍵盤盲打核心規則 (Keyboard & UX Rules)

### 3.1 快捷鍵與行為規範 (Hotkeys Behavior)

| 快捷鍵 / 操作 | 觸發行為與控制邏輯 |
| :--- | :--- |
| **Enter** | 1. 焦點移動至右側下一個可編輯儲存格。<br>2. 當前列最後一欄按下 Enter -> 自動移動至下一列第一欄。<br>3. **最後一列最後一欄按下 Enter -> 自動 Append 新增一空列**並聚焦至該列第一欄。 |
| **Tab / Shift+Tab** | 在可編輯儲存格之間進行左右切換。 |
| **Arrow Up / Down** | 切換上/下一列。在表格底端按下 Arrow Down 可自動新增列。 |
| **F2 (關鍵開窗與編輯)** | 1. **代號/名稱欄位** (如產品代號、廠商代號、會計師代號)：觸發大型開窗搜尋對話框 (`SearchModal`)。<br>2. **數值/備註欄位** (如數量、單價、備註)：進入儲存格編輯模式。 |
| **F9** | 觸發歷史單據/資料開窗查詢。 |
| **F12** | 一鍵發送存檔 (Save)，並觸發全單據金額計算與驗證。 |
| **直接打字 (Direct Typing)** | **無須先按 F2**，直接鍵入字元即可即時覆蓋 (Overwrite) 當前單元格內容。 |

### 3.2 視覺與 UI 渲染規範 (Visual Style Rules)

- **字型與欄高**：字型 `Consolas, monospace`，字級 `16px`，預設列高 `rowHeight: 38px`。
- **Header 樣式**：深藍背景色 `#1e3a8a`，文字純白 `#ffffff`，粗體高對比。
- **焦點外框 (Focus Ring)**：選中儲存格必須顯示 **2px 顯眼黃色外框 (`#eab308` / `#f59e0b`)**，便於快速定位。
- **隔行變色**：偶數列套用微灰背景 `#f9fafb`。
- **狀態列 (StatusBar)**：表格底部即時顯示總金額、總筆數與熱鍵列 (`[F2]開窗 [F9]查詢 [F12]存檔`)。

---

## 🚫 4. 開發防呆與嚴格禁忌 (Strict DO NOT Rules)

1. ❌ **禁止單筆表單設計**：明細表格必須為大容量 Multi-Row (至少 15 列) 表格，嚴禁設計成一次只能填一筆資料的彈窗或單筆輸入框。
2. ❌ **禁止強迫使用滑鼠**：所有搜尋、換行、切換欄位、增列與存檔必須 100% 可透過 Enter / Tab / F2 / F9 / F12 完成。
3. ❌ **禁止 Dropdown 下拉選單搜尋**：代號與名稱搜尋必須使用 **F2 觸發的大型彈窗 SearchModal**，還原 FoxPro 開窗習慣。
4. ❌ **禁止預設需要先按 F2 才能打字**：儲存格必須支援 Direct Keypress Overwrite。
5. ❌ **禁止破壞既存 API 協定與靜態型別**：修改方法簽名或 DTO 時，必須全域搜尋並同步更新所有呼叫端與模型。

---

## ⚙️ 5. 工程開發與品質規範 (Engineering Guidelines)

1. **碼源探查優先 (No Guessing)**：禁止憑空猜測 API 簽名、資料庫 Schema 或元件 Prop，撰寫代碼前必須先檢視對應源碼。
2. **完整錯誤日誌診斷**：出現錯誤時，必須閱讀完整 Log 及 Exception StackTrace，嚴禁採用遮蔽 Error、吞掉 Exception 或回傳預設假資料的掩耳盜鈴做法。
3. **實機與編譯驗證**：完成代碼修改後，必須執行型別檢查或編譯指令（如 `pnpm run build` / `dotnet run`），驗證無誤後始可宣告完成。
4. **保持文件與註解完整性**：修改代碼時需維護無關註解與 JSDoc/XML 文檔，並及時更新 `docs/` 下的對應 SPEC 文件。

---

## 🚀 6. 常用開發與編譯指令 (Commands & Workflows)

```bash
# 1. 啟動全棧開發環境 (API + Web 並行)
pnpm dev

# 2. 僅啟動前端 Vite 開發服務
pnpm dev:web

# 3. 僅啟動後端 C# API 服務
pnpm dev:api

# 4. 前端型別檢查與 Vite 打包編譯
cd frontend && pnpm run build

# 5. 後端發佈 Windows 獨立單一可執行檔 (Single-File EXE)
pnpm build:api

# 6. 啟動 Reverse Proxy 測試對外開窗
pnpm ngrok
```
