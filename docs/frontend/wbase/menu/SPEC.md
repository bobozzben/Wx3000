# 規格書：wbase 系統主畫面與選單模組 (wbase Menu System)

> **模組代號**：`wbase` (Menu System)  
> **所屬層級**：前端系統主框架與導覽模組  
> **檔案目錄**：`frontend/src/wbase/menu/`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase`

---

## 1. 模組定位與職責

本模組為系統主要進入點，還原傳統 Visual FoxPro 系統之主選單架構，並升級為現代化 Web / Electron 控制介面。
具備以下核心能力：
1. **三階樹狀選單 (3-Tier Dynamic Menu)**：分類 (Tier 1) ➔ 群組 (Tier 2) ➔ 功能程式點 (Tier 3)。
2. **漸進式展開與手風琴動畫 (Accordion Transition)**：預設顯示第一階，選擇後平滑展開下階。
3. **純鍵盤盲打導覽 (Full Keyboard Navigation)**：支援 `↑` `↓` `←` `→` `Enter` `Esc` 及數字鍵 `1`-`9` 快捷操作。
4. **雙色主題支援 (Dark / Light-Blue Theme)**：提供深色時尚主題與深淺適中的淺藍色 (Sky Blue) 主題，支援即時切換與 `localStorage` 偏好儲存。
5. **已實作子模組無縫路由 (`wbaseMainPage.tsx`)**：
   - `wbase1020`：會計師/記帳士資料維護
   - `wbase1030`：員工(建檔人員)資料維護
   - `wbase1050`：稅務人員資料維護
   - `wbase1060`：收費項目資料維護
   - `wbase1070`：備註資料維護
   - `wbase1080`：摘要資料維護
   - `wbase2010` / `wbase2010_split`：客戶(公司)基本資料維護（支援上下分割與左右分割雙模式）
   - `wbase3010`：發票購買地點維護
   - `wbase3020`：發票預購輸入作業
   - `wbase3030` / `wbase3020_buyinv_print`：發票預購列印與 Excel 匯出作業
   - `wbase3050` / `wbase3050_buylist_print` / `wbase3050_buyinv_setamt`：統購發票清單列印（A4/中一刀簽收單）與單價設定
   - `wbase3060` / `wbase3060_01`：統購發票字軌輸入與國稅局/代售點 Excel 匯入作業

---

## 2. 檔案架構

```text
frontend/src/wbase/menu/
├── menuConfig.ts         # 三階選單結構資料庫與代碼對照
├── useMenuKeyboard.ts    # 純鍵盤盲打導覽 Hook
├── WbaseMenuTree.tsx     # 選單 UI 渲染與手風琴展開動畫
├── WbaseMainLayout.tsx   # 系統框架 (頂部標題列、伺服器連線設定鈕、主畫面、底部狀態列)
├── WbaseStatusBar.tsx    # 經典/現代化狀態列 (即時時間、使用者、熱鍵提示)
├── ThemeContext.tsx      # 深色/淺藍色主題 Context Provider
└── wbaseMainPage.tsx     # 主頁面進入點 (控管選單與所有子模組切換)
```

---

## 3. 選單分類架構 (`menuConfig.ts`)

1. **`100` 事務所資料**
   - `110` `wbase1010` 事務所資料
   - `120` `wbase1020` 會計師/記帳士資料 ✅
   - `130` `wbase1030` 員工資料 ✅
   - `140` `wbase1040` 密碼群組
   - `150` `wbase1050` 稅務人員 ✅
   - `160` `wbase1060` 收費項目 ✅
   - `170` `wbase1070` 備註 ✅
   - `180` `wbase1080` 摘要 ✅
2. **`200` 客戶資料**
   - `210` `wbase2010` / `wbase2010_split` 客戶基本資料建檔 ✅
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

---

## 4. 鍵盤盲打控制規範 (`useMenuKeyboard.ts`)

| 按鍵 | 當前焦點 (Level 1) | 當前焦點 (Level 2) | 當前焦點 (Level 3) |
| :--- | :--- | :--- | :--- |
| `↓` / `↑` | 上下移動分類並自動收合子選單 | 上下移動群組並收合 Tier 3 | 上下移動程式點 |
| `→` | 展開並移至 Tier 2 第一項 | 展開並移至 Tier 3 第一項 | 無動作 |
| `←` / `Esc` | 無動作 | 收合 Tier 2，焦點退回 Tier 1 | 收合 Tier 3，焦點退回 Tier 2 |
| `Enter` | 展開 Tier 2 或執行葉節點 | 展開 Tier 3 或執行葉節點 | 啟動對應功能模組 |
| `1`-`9` | 直接跳轉至對應編號之 Tier 1 分類 | 同左 | 同左 |
