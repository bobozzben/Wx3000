# Wx3000 Workspace Guidelines & Specification

> **專案定位**：`Wx3000` 是一個旨在無縫接軌並取代傳統 Visual FoxPro / Delphi / Lazarus Win32 會計師與記帳士事務所管理、營業稅申報與進銷存系統的全端專案。核心優勢在於**前端輸入手感 100% 模擬 FoxPro 全鍵盤盲打**（無須滑鼠），並具備 **PostgreSQL 與地端 VFP `.dbf` 動態磁碟機雙向即時同步引擎** 與 **Lazarus 64-bit 原生報表引擎**。

---

## 🛠️ 1. 技術棧與環境規格 (Tech Stack & Environment)

| 領域 | 選用技術 / 規格說明 |
| :--- | :--- |
| **專案架構** | Monorepo / `pnpm` Workspace 管理 |
| **前端 (Frontend)** | React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid Community (v36) + Zustand + Axios + SheetJS (`xlsx`) |
| **桌面端 (Desktop)** | **Electron** (`frontend/electron/main.cjs`) — 支援自動更新 (`electron-updater`)、攔截瀏覽器預設熱鍵，完整保留 `F1`~`F12` 給 FoxPro 盲打操作 |
| **後端 (Backend)** | **C# .NET 8 (ASP.NET Core Web API)**<br>- 預設監聽埠號：`http://0.0.0.0:5007`（支援區網多工作站連線與 `wwwroot` SPA 靜態託管）<br>- 支援發佈為獨立執行檔與註冊 Windows 服務 (`Wx3000Api`) |
| **資料庫与雙向同步** | **PostgreSQL 16 + Visual FoxPro DBF 動態磁碟機雙向同步**<br>- PostgreSQL: `localhost:54320` \| DB: `w3000` \| User: `postgres` \| 動態 Schema: `<drive>:/w3000/comm` (預設 `c:/w3000/comm`) & `public`<br>- 地端 DBF: `<Drive>:\w3000\comm\*.dbf`（透過 `SystemConfigService` 與 `DbfSyncService` 實現動態磁碟機切換、Checksum 快照比對與雙向同步寫入） |
| **本機代理 (LocalAgent)** | **Node.js (`localagent/agent.js`, Port: `18889`, Windows Service: `Wx3000Agent`)**<br>- **32-bit `DBFBridge.exe`** + `w3000_dbf.dll`：負責 VFP DBF 讀寫、RLOCK 鎖定檢測與 SHA256 Checksum<br>- **64-bit `WbaseBridge.exe`** / `Koffi` + `wbaseRP.dll`：負責呼叫 Lazarus FastReport 原生報表預覽與列印 |
| **一鍵管理與部署工具** | 根目錄 `Wx3000-Manager.bat/.ps1`（互動式選單）與 `publish/` 目錄下之 `Install-Wx3000.bat`、`Update-Wx3000.bat`、`Check-DbfSync.bat` |

---

## 📁 2. 專案目錄結構 (Workspace Directory Map)

```text
Wx3000/
├── Wx3000-Manager.bat / .ps1          # 互動式一鍵開發、全套編譯打包 ([A]/[5]~[10]) 與服務管理選單
├── BUILD_AND_DEPLOY.md                # 四大模組開發與打包部署速查指南
├── WORKSPACE.md                       # 本工作區開發規範與規則指引
├── README.md                          # 快速啟動與專案簡介
├── Wx3000_SPEC.md                     # 全系統規格與防呆開發文件
├── GEMINI.md / SKILL.md               # AI Agent 自動載入之核心行為準則與舊系統翻新協議
├── docs/                              # 模組詳細規格索引與文件庫
│   ├── SPEC.md                        # 規格文件總目錄
│   ├── backend/backend_SPEC.md        # 後端 API、動態磁碟機、DBF 同步與 DB 規格
│   └── frontend/                      # 各前端模組規格 (wbase 1020~3060, wtaxop, components)
├── backend/                           # C# .NET 8 Web API & Windows Service (Port 5007)
│   ├── Controllers/                   # SystemConfig, SystemParam, Wbase1020~3060, Products, Vendors, Purchase
│   ├── Data/                          # AppDbContext, DynamicModelCacheKeyFactory, DbInitializer
│   ├── Models/                        # Entity 資料模型 (動態映射 <drive>:/w3000/comm 與 public)
│   ├── DTOs/                          # Data Transfer Objects
│   └── Services/                      # DbfSyncService, SystemConfigService, SystemParamService
├── frontend/                          # React 19 + Vite + Electron 前端專案
│   ├── electron/                      # Electron 桌面端主程序與 Preload 腳本
│   └── src/
│       ├── mainmenu/                  # 奇勝資訊 Wx3000 系統總入口 (四大系統分區、快捷鍵啟動)
│       ├── components/
│       │   ├── FoxProGrid/            # FoxProGridV2 + SearchModal + FoxProPrintModal + AddressSelectModal
│       │   ├── FoxProGridCard/        # FoxProGridCard + useFoxProCardNavigation (表單盲打導覽 Hook)
│       │   ├── FoxProGridBill/        # FoxProGridBill (單據 Header+Detail 盲打表格)
│       │   ├── SelectXlsxField/       # FormUtilSelectXlsxFieldsList (Excel 欄位自訂匯出器)
│       │   ├── WbasePageHeader.tsx    # 統一模組頂部標題列與模式徽章
│       │   └── ServerConfigModal.tsx  # 伺服器連線與資料來源磁碟機 (C:/F:) 設定視窗
│       ├── wbase/                     # 基本資料與發票統購模組 (menu, 1020~1080, 2010, 3010~3060)
│       ├── wtaxop/                    # 單據作業模組 (PurchaseOrder 進貨單)
│       ├── store/                     # Zustand 狀態管理
│       └── services/                  # Axios API、apiConfig、addressService、validation.ts
├── localagent/                        # 本機 DLL / DBF 橋接代理服務 (Port 18889)
│   ├── agent.js                       # HTTP & WebSocket 服務主程式
│   ├── dlls.json                      # 報表 DLL 函數簽名配置
│   └── bridge/lazarus/                # DBFBridge.exe (x86) 與 WbaseBridge.exe (x64) 源碼及執行檔
└── publish/                           # 集中打包產出目錄與客戶端安裝/更新/DBF 同步診斷腳本
```

---

## 🔑 3. 前端 FoxPro 鍵盤盲打核心規則 (Keyboard & UX Rules)

### 3.1 快捷鍵與行為規範 (Hotkeys Behavior)

| 快捷鍵 / 操作 | 觸發行為與控制邏輯 |
| :--- | :--- |
| **Enter** | 1. **表格模式 (`FoxProGridV2`)**：向右移動至下一個可編輯儲存格；列末跳至下一列第一欄；**最後一列最後一欄自動 Append 新增一空列**並觸發存檔。<br>2. **卡片+表單模式 (`wbase1020`/`2010`)**：在卡片上按 `Enter` 進入下方表單編修；在表單內按 `Enter` 依序跳至下一欄位（支援跨 Tab 自動切換，最後一欄自動觸發存檔）。 |
| **Tab / Shift+Tab** | 在可編輯儲存格或表單欄位之間進行左右/前後切換。 |
| **Arrow Up / Down** | 切換上/下一筆資料列或表單上/下一欄位。在 `FoxProGridV2` 底端按下 Arrow Down 自動新增空白列；在 `FoxProGridCard` 上下移動時下方表單即時同步預覽。 |
| **Ins** | 新增一筆記錄（自動帶入下一個編號 `getNextAutoNo`）或插入空白列。 |
| **F2 / F4** | 在瀏覽模式按 `F2` 開啟快速查詢彈窗；在地址或字軌欄位按 `F2`/`F4` 開啟 `AddressSelectModal` 台灣地址智慧快選視窗或字軌選單。 |
| **F3** | 觸發大型開窗搜尋對話框 (`SearchModal`)，或於 `wbase2010` 切換頁籤 (`F3`~`F8`)。 |
| **F6** | 於卡片+表單模式進入編修狀態 (`startEdit`)，或於表格模式重新整理資料 (`onRefreshData`)。 |
| **F7 / F9** | `F7` 開啟區間報表列印與 Excel 匯出視窗 (`FoxProPrintModal`)；`F9` 或 `Ctrl+S` 執行表單/批次存檔。 |
| **Del / F8** | 刪除目前選取之資料列（附帶鍵盤可控之確認對話框，並保護 `SUPERVISOR` 保留帳號）。 |
| **Esc** | 取消當前編輯、觸發批次結算存檔，或退回上一層/系統主選單。 |
| **直接打字 (Direct Typing)** | **無須先按 F2**，直接鍵入字元即可即時覆蓋當前單元格或已全選之表單輸入框內容 (`foxProFocusAndSelect`)。 |

### 3.2 視覺與 UI 渲染規範 (Visual Style Rules)

- **字型與欄高**：字型 `Consolas, Monaco, monospace`，字級 `16px`，預設列高 `rowHeight: 38px`。
- **雙主題支援 (`ThemeContext`)**：支援淺藍色高對比主題（預設，Header `#1e3a8a` 深藍配白字）與深色主題（Dark Slate）。
- **焦點外框 (Focus Ring)**：選中儲存格或焦點輸入框必須顯示 **顯眼黃色外框 (`#eab308` / `ring-yellow-400`)** 與高亮背景。
- **欄位驗證與 Big5 防護 (`validation.ts`)**：嚴格阻斷 Big5 不相容罕字/Emoji，對 Email、統編、身分證、電話等提示性規則提供友善警告或徽章提示，不阻斷歷史舊資料存檔。

---

## 🚫 4. 開發防呆與嚴格禁忌 (Strict DO NOT Rules)

1. ❌ **禁止強迫使用滑鼠**：所有搜尋、換行、切換欄位、切換頁籤、增刪列與存檔必須 100% 可透過鍵盤完成。
2. ❌ **禁止 Dropdown 下拉選單搜尋**：代號、名稱與地址搜尋必須使用 **`F2` / `F3` / `F4` 觸發的大型彈窗 `SearchModal` 或 `AddressSelectModal`**。
3. ❌ **禁止單邊寫入破壞 DBF 同步**：在已接入 `IDbfSyncService` 的控制器中，任何新增/修改/刪除必須先通過 `_dbfSyncService.WriteRecordAsync` 寫入地端 DBF，嚴禁繞過 DBF 直接單邊修改 PostgreSQL。
4. ❌ **禁止破壞既存 API 協定與靜態型別**：修改方法簽名或 DTO 時，必須全域搜尋並同步更新所有呼叫端與模型。

---

## 🚀 5. 常用開發與編譯指令 (Commands & Workflows)

```powershell
# 0. 啟動互動式一鍵管理選單 (涵蓋啟動、全套編譯 [A]、部署、重啟服務)
.\Wx3000-Manager.ps1

# 1. 啟動全棧開發環境 (API + Web + LocalAgent)
pnpm dev

# 2. 實機編譯驗證 (修改代碼後必跑)
pnpm --filter frontend build
dotnet build backend/Wx3000.Backend.csproj

# 3. 打包完整伺服器發佈包 (產出至 publish/Wx3000_Server/api 並更新 backend/wwwroot)
pnpm publish:server

# 4. 單步驗證與除錯 DBF ⇄ PostgreSQL 雙向同步
.\publish\Check-DbfSync.bat
```
