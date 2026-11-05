# 規格書：系統總入口 (`mainmenu`) 與 `wbase` 主畫面選單模組

> **模組代號**：`mainmenu` & `wbase` (Menu System)  
> **所屬層級**：前端系統總入口、頂部導覽框架與三階選單模組  
> **檔案目錄**：`frontend/src/mainmenu/` & `frontend/src/wbase/menu/`  
> **原始 Visual FoxPro 來源**：奇勝資訊主控台與 `SourS9BASE\LIBS\wbase.vcx` Class: `wbase`

---

## 1. 模組定位與雙層入口架構

1. **第一層：奇勝資訊 Wx3000 系統總入口 (`frontend/src/mainmenu/MainMenuPage.tsx`)**：
   - 還原奇勝資訊經典四大系統分區面板 (`menuData.ts`)：
     - **稅務會計系統** (`TAX_ACCOUNTING_SYSTEMS`)：`1` 營業稅申報系統、`2` 會計總帳、`3` 成本分析、`4` 營建業總帳、`5` 固定資產、`6` 薪資扣繳、`7` 未分配盈餘、`8` 預估、`9` 結算申報、`G` 清算、`H` 執行業務、`I` 工商登記、`X` 電子帳簿、`Y` 事務所管理、`Z` 基本資料系統 (`wbase`)。
     - **審計簽證系統** (`AUDIT_SYSTEMS`)：`A`~`E`。
     - **機關團體系統** (`INSTITUTIONAL_SYSTEMS`)：`L`~`N`。
     - **公司版系統** (`CORPORATE_SYSTEMS`)：`O`、`P`、`Q`、`T`、`U`。
   - 目前只有兩個系統 `isAvailable: true`，點選或按鍵會直接切換頁面：
     - `1` 營業稅申報系統 (`wtaxop`，`routeTarget: 'purchase'`) ➔ 進貨單作業 `PurchaseOrderPage` (見 `docs/frontend/wtaxop/purchase_order_SPEC.md`)。
     - `Z` 基本資料系統 (`wbase`，`routeTarget: 'wbase'`) ➔ `WbaseMainPage`。
   - 其餘系統點選後只開啟 `SubsystemModal` 顯示功能說明 (`Esc` 關閉)，沒有可啟動的頁面。
   - 支援鍵盤單鍵快捷啟動：沒有開啟任何彈窗、焦點不在輸入框、且沒有按 `Ctrl`/`Alt`/`Meta` 時，按下系統代號字元 (不分大小寫) 即等同點選該系統 (例如按 `Z` 進入 `wbase`)。
   - 快捷服務 (`QUICK_SERVICES`：奇勝公告、下載合約使用版權、線上客服、語音輸入、客戶充電站) 與底部工具列 (`BOTTOM_TOOL_ACTIONS`：批次帳表、資料備份、更新單機、網路更版) 以 `ServiceModal` 顯示說明視窗；另顯示服務據點資訊 (`BRANCH_OFFICES`)。底部「離開」會先確認，Electron 環境呼叫 `electronAPI.closeWindow()`，否則 `window.close()`。
2. **整合頂部導覽列 (`frontend/src/App.tsx`)**：
   - 奇勝資訊品牌標誌，以及模組切換 Tabs：`系統主選單` (`mainmenu`) / `基本資料管理` (`wbase`) / 進貨單 (`purchase`，窄螢幕顯示「進貨單」文字，寬螢幕只顯示圖示)。
   - 伺服器狀態按鈕：顯示 API Server 主機、連線燈號 (`checkServerConnection` 載入時檢查，之後每 30 秒檢查一次) 與目前資料磁碟機 `<Drive>:\w3000`；滑鼠提示列出伺服器、資料來源與 PostgreSQL Schema (`getPgSchema()`，如 `c:/w3000/comm`)。點擊或按 `Ctrl+Shift+S` 開啟 `ServerConfigModal`。
   - `ServerConfigModal` 可設定 API Server 位址 (預設 `http://localhost:5007`) 與資料磁碟機代號 (任一英文字母 `A`~`Z`，經 `normalizeDrive` 正規化)。儲存前呼叫 `GET /api/systemconfig/check-drive` 確認 `<Drive>:\W3000` 存在，再以 `POST /api/systemconfig` 套用；設定值存於 `localStorage` (`wx3000_api_server_url`、`wx3000_data_drive`、`wx3000_data_drive_configured`)。
   - 進入系統主選單時若尚未設定過資料磁碟機，會先預設 `C` 並自動開啟 `ServerConfigModal`。
   - 深色/淺色主題切換鈕 (`ThemeContext`，預設深色，存於 `localStorage` `wx3000-theme`)。
3. **第二層：`wbase` 三階樹狀/手風琴選單 (`frontend/src/wbase/menu/`)**：
   - 分類 (Tier 1: `100`~`A00`) ➔ 群組 (Tier 2) ➔ 功能程式點 (Tier 3)。
   - 純鍵盤盲打導覽 (`↑` `↓` `←` `→` `Enter` `Esc` 及數字鍵 `1`-`9`)，規則見第 4 節。

---

## 2. 檔案架構

```text
frontend/src/
├── App.tsx                       # 頂部整合導覽列、Ctrl+Shift+S 磁碟機/伺服器設定、三大入口切換
├── mainmenu/
│   ├── MainMenuPage.tsx          # 奇勝資訊四大系統總入口主頁面 (支援鍵盤單鍵快捷啟動)
│   ├── MainMenuButton.tsx        # 系統方塊按鈕組件
│   ├── SubsystemModal.tsx        # 子系統功能預覽與啟動彈窗
│   ├── ServiceModal.tsx          # 快捷服務與底部工具列說明彈窗
│   ├── menuData.ts               # 四大系統分區、快捷服務、服務據點與底部工具定義
│   ├── index.ts
│   └── types.ts
└── wbase/menu/
    ├── menuConfig.ts             # wbase 三階選單結構 (WBASE_MENU_DATA)
    ├── useMenuKeyboard.ts        # 純鍵盤盲打導覽 Hook
    ├── WbaseMenuTree.tsx         # 選單 UI 渲染與手風琴展開動畫
    ├── WbaseMainLayout.tsx       # wbase 系統框架與底部狀態列
    ├── WbaseStatusBar.tsx        # 即時日期時間、使用者與事務所名稱 (目前為固定文字)、熱鍵提示狀態列
    ├── ThemeContext.tsx          # 深色/淺色主題 Context Provider
    └── wbaseMainPage.tsx         # wbase 主頁面進入點 (handleSelectAction 與子模組 render 分支)
```

---

## 3. `wbase` 選單分類與已實現模組對照 (`menuConfig.ts` & `wbaseMainPage.tsx`)

選單項目以 `code` 分派，`menuConfig.ts` 的 `actionUrl` 目前沒有被使用。已實作的項目必須同時在 `wbaseMainPage.tsx` 的 `handleSelectAction` 設定 `activeModule` (必要時帶入頁籤或模式) 並在 render 分支掛上頁面；未註冊的 `code` 會跳出「目前此模組正在移植建置中！」提示。

圖例：✅ 已實作；🚧 選單已列出但仍顯示「移植建置中」。

1. **`100` 事務所資料**
   - `110` `wbase1010` 事務所資料 (`base.dbf` / `pub_para.dbf`；F4 事務所資料 `cstore.dbf`) ✅ (`Wbase1010Page`)
   - `120` `wbase1020` 會計師/記帳士資料 ✅ (`Wbase1020Page`)
   - `130` `wbase1030` 員工資料 (建檔人員 `keyin.dbf`) ✅ (`Wbase1030Page`，render 分支的最後預設分支)
   - `140` `wbase1040` 密碼群組 🚧
   - `150` `wbase1050` 稅務人員 ✅ (`Wbase1050Page`)
   - `160` `wbase1060` 收費項目 ✅ (`Wbase1060Page`)
   - `170` `wbase1070` 備註 (`recnote.dbf`) ✅ (`Wbase1070Page`)
   - `180` `wbase1080` 摘要 (`recmemo.dbf`) ✅ (`Wbase1080Page`)
2. **`200` 客戶資料**
   - `210` `wbase2010` 客戶資料建檔 (上下分割) ✅ (`Wbase2010Page`)
   - `215` `wbase2010_split` 客戶資料建檔 (左右雙欄測試) ✅ (`Wbase2010SplitPage`)
   - `220` `wbase2020` 客戶資料匯出、`230` `wbase2030` 客戶資料匯入 (`custbak.dbf` ⇄ `customer.dbf`，共用 `Wbase2030Page`，以 `mode='export' | 'import'` 區分) ✅
   - `240` `wbase2040` 客戶收費資料輸入 (`recmom.dbf` / `recmod.dbf`) ✅ (`Wbase2040Page`)
   - `250` `wbase2050` 總分支機構設定 (`customer.dbf`；F8 分公司資料維護 `wbase2050f8`) ✅ (`Wbase2050Page`)
3. **`300` 發票統購**
   - `310` `wbase3010` 購買地點 ✅ (`Wbase3010Page`)
   - `320` `wbase3020` 預購統一發票輸入 ✅ (`Wbase3020Page`)
   - `330` `wbase3030` 預購統一發票列印 ✅ (`Wbase3020_buyinv_print`)
   - `340` 媒體/網路申購轉檔 (群組 `GRP_340`)
     - `341` `wbase3041` 原媒體轉檔 🚧
     - `342` `wbase3042` 網路申購轉檔 🚧
   - `350` `wbase3050` 購買統一發票清單列印 ✅ (`Wbase3050_buylist_print`；單價設定 `Wbase3050_buyinv_setamt` 在清單列印畫面按 `F6` 開啟，選單沒有獨立項目)
   - `360` `wbase3060_01` 統購發票字軌輸入 (含 Excel 匯入) ✅ (`Wbase3060`)
   - `370` `wbase3070` 刪除舊年度統購資料 🚧
4. **`400` 操作設定**
   - `410` 標準會計科目維護 (群組 `GRP_410`)：`411`~`416` `wbase4011`~`wbase4016` (標準、營造業、建設業、文教團體、社會團體、衛福團體會計科目) ✅ (共用 `Wbase4010Page`，以 `initialMode` `1`~`6` 區分)
   - `420` `wbase4020` 營業稅設定 ✅
   - `430` `wbase4030` 營業稅轉傳票設定 ✅
   - `440` `wbase4040` 媒體/期末存貨計算方式 ✅
   - `450` `wbase4050` 共用會計科目摘要 ✅
   - `460` `wbase4060` 共用參數設定 ✅
   - (`420`~`460` 共用 `Wbase4020Page`，以 `initialTab` `'4020'`~`'4060'` 決定開啟的頁籤)
5. **`500` 管理報表** (`510`~`560` 共用 `Wbase5010Index`，以 `initialTab` `'5010'`~`'5060'` 決定開啟的頁籤)
   - `510` `wbase5010` 客戶明細資料 ✅
   - `520` `wbase5020` 客戶郵遞標籤 ✅
   - `530` `wbase5030` 客戶登打統計表 ✅
   - `540` `wbase5040` 客戶營業狀況表 ✅
   - `550` `wbase5050` 財務狀況參考表 ✅
   - `560` `wbase5060` 委任書輸入列印 ✅
6. **`600` 系統維護**
   - `610` `wbase6010` 回存母版密碼變更 🚧
   - `620` `wbase6020` 轉檔列印密碼變更 🚧
   - `630` `wbase6030` 標準檔匯出匯入 🚧
7. **`800` 系統講義** (Tier 1 葉節點) 🚧
8. **`900` 重新連線** (Tier 1 葉節點)：執行 `window.location.reload()`。
9. **`A00` 結束離開** (Tier 1 葉節點)：回到系統主選單 (`onBackToMainMenu`)；未提供時改為確認後 `window.close()`。

子模組頁面皆以 `onBackToMenu` (`Wbase3020_buyinv_print`、`Wbase3050_*`、`Wbase5010Index` 為 `onClose`) 回到 `wbase` 選單。

---

## 4. 選單鍵盤操作 (`useMenuKeyboard.ts`)

僅在沒有開啟子模組 (`activeModule === null`) 且焦點不在 `input`/`textarea` 時作用。

| 按鍵 | 行為 |
| :--- | :--- |
| `↑` / `↓` | 在目前層級上下移動 (循環)；Tier 1 移動時收合 Tier 2/3 |
| `→` | 展開下一層 (Tier 1 ➔ Tier 2、Tier 2 群組 ➔ Tier 3) |
| `←` / `Esc` | 收合目前層級，回到上一層 |
| `Enter` | 有子項目時展開；葉節點則執行 `handleSelectAction` |
| `1`~`9` | 直接選取第 N 個 Tier 1 分類 (只選取不展開) |

滑鼠操作：點選 Tier 1 分類會展開並選取第一個 Tier 2 項目 (再點一次收合)；點選 Tier 1/Tier 2 葉節點或 Tier 3 項目即執行。
