# 規格書：系統總入口 (`mainmenu`) 與 `wbase` 主畫面選單模組

> **模組代號**：`mainmenu` & `wbase` (Menu System)  
> **所屬層級**：前端系統總入口、頂部導覽框架與三階選單模組  
> **檔案目錄**：`frontend/src/mainmenu/` & `frontend/src/wbase/menu/`  
> **原始 Visual FoxPro 來源**：奇勝資訊主控台與 `SourS9BASE\LIBS\wbase.vcx` Class: `wbase`

---

## 1. 模組定位與雙層入口架構

1. **第一層：奇勝資訊 Wx3000 系統總入口 (`frontend/src/mainmenu/MainMenuPage.tsx`)**：
   - 還原奇勝資訊經典四大系統分區面板：
     - **記帳報稅系統**：`1` 營業稅申報、`2` 帳務處理、`3` 結算申報、`4` 各類所得扣繳、`5` 固定資產管理、`Z` 基本資料管理 (`wbase`) 等。
     - **查帳簽證系統**、**機關團體系統**、**營利事業系統**（如進銷存單據作業 `PurchaseOrder`）。
   - 支援鍵盤單鍵快捷啟動（例如在總入口直接按鍵盤 `Z` 即可進入 `wbase` 基本資料管理系統）。
   - 內建快捷線上服務 (`ServiceModal`)、全台服務據點資訊與系統結束確認。
2. **整合頂部導覽列 (`frontend/src/App.tsx`)**：
   - 整合奇勝資訊品牌標誌、模組快速切換 Tabs（`系統總入口` / `基本資料 (wbase)` / `進貨單作業`）、當前資料來源磁碟機與 Schema 指示器（如 `C: (c:/w3000/comm)`）、後端連線狀態燈號、深淺色主題切換鈕，以及 `Ctrl+Shift+S` 開啟 `ServerConfigModal`（動態設定 API Server 位址與 `C:`/`F:` 資料磁碟機）。
3. **第二層：`wbase` 三階樹狀/手風琴選單 (`frontend/src/wbase/menu/`)**：
   - 分類 (Tier 1: `100`~`A00`) ➔ 群組 (Tier 2) ➔ 功能程式點 (Tier 3)。
   - 純鍵盤盲打導覽 (`↑` `↓` `←` `→` `Enter` `Esc` 及數字鍵 `1`-`9`)。

---

## 2. 檔案架構

```text
frontend/src/
├── App.tsx                       # 頂部整合導覽列、Ctrl+Shift+S 磁碟機/伺服器設定、三大入口切換
├── mainmenu/
│   ├── MainMenuPage.tsx          # 奇勝資訊四大系統總入口主頁面 (支援鍵盤單鍵快捷啟動)
│   ├── MainMenuButton.tsx        # 系統方塊按鈕組件
│   ├── SubsystemModal.tsx        # 子系統功能預覽與啟動彈窗
│   ├── ServiceModal.tsx          # 遠端客服、語音工具與線上更新彈窗
│   ├── menuData.ts               # 四大系統分區與快捷工具定義
│   └── types.ts
└── wbase/menu/
    ├── menuConfig.ts             # wbase 三階選單結構資料庫與代碼對照
    ├── useMenuKeyboard.ts        # 純鍵盤盲打導覽 Hook
    ├── WbaseMenuTree.tsx         # 選單 UI 渲染與手風琴展開動畫
    ├── WbaseMainLayout.tsx       # wbase 系統框架與底部狀態列
    ├── WbaseStatusBar.tsx        # 即時時間、使用者、熱鍵提示狀態列
    ├── ThemeContext.tsx          # 深色/淺藍色主題 Context Provider
    └── wbaseMainPage.tsx         # wbase 主頁面進入點 (控管選單與所有子模組切換)
```

---

## 3. `wbase` 選單分類與已實現模組對照 (`menuConfig.ts` & `wbaseMainPage.tsx`)

1. **`100` 事務所資料**
   - `110` `wbase1010` 事務所資料
   - `120` `wbase1020` 會計師/記帳士資料 ✅
   - `130` `wbase1030` 員工(建檔人員)資料 ✅
   - `140` `wbase1040` 密碼群組
   - `150` `wbase1050` 稅務人員 ✅
   - `160` `wbase1060` 收費項目 ✅
   - `170` `wbase1070` 備註 (`recnote.dbf`) ✅
   - `180` `wbase1080` 摘要 (`recmemo.dbf`) ✅
2. **`200` 客戶資料**
   - `210` `wbase2010` / `wbase2010_split` 客戶基本資料建檔（支援上下分割與左右分割雙模式） ✅
   - `220`~`250` 匯出、匯入、收費、總分支
3. **`300` 發票統購**
   - `310` `wbase3010` 購買地點 ✅
   - `320` `wbase3020` 預購輸入 ✅
   - `330` `wbase3030` (`wbase3020_buyinv_print`) 預購列印 ✅
   - `340` 媒體/網路轉檔
   - `350` `wbase3050` (`wbase3050_buylist_print` / `wbase3050_buyinv_setamt`) 清單列印與單價設定 ✅
   - `360` `wbase3060` 字軌輸入與 Excel 匯入 ✅
   - `370` 刪除舊檔
4. **`400` 操作設定** / **`500` 管理報表** / **`600` 系統維護** / **`800` 系統講義** / **`900` 重新連線** / **`A00` 結束離開**
