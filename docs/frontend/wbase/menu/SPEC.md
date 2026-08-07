# 規格書：wbase 系統主畫面與選單模組 (wbase Menu System)

> **模組代號**：`wbase` (Menu System)  
> **所屬層級**：前端系統主框架與導覽模組  
> **檔案目錄**：`frontend/src/wbase/menu/`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase`

---

## 1. 模組定位與職責

本模組為系統主要進入點，還原傳統 Visual FoxPro 系統之主選單架構，並升級為現代化 Web 控制介面。
具備以下核心能力：
1. **三階樹狀選單 (3-Tier Dynamic Menu)**：分類 (Tier 1) ➔ 群組 (Tier 2) ➔ 功能程式點 (Tier 3)。
2. **漸進式展開與手風琴動畫 (Accordion Transition)**：預設僅顯示第一階，選擇後平滑滑入展開下階。
3. **純鍵盤盲打導覽 (Full Keyboard Navigation)**：支援 `↑` `↓` `←` `→` `Enter` `Esc` 及數字鍵 `1`-`9` 快捷操作。
4. **雙色主題支援 (Dark / Light-Blue Theme)**：提供深色時尚主題與深淺適中的淺藍色 (Sky Blue) 主題，支援即時切換與 `localStorage` 偏好儲存。
5. **模組頁面無縫切換**：與 `wbase1020` 等子模組完美整合，支援 `Esc` 快捷鍵一鍵退回主選單。

---

## 2. 檔案架構

```text
frontend/src/wbase/menu/
├── menuConfig.ts         # 三階選單結構資料庫與代碼對照
├── useMenuKeyboard.ts    # 純鍵盤盲打導覽 Hook
├── WbaseMenuTree.tsx     # 選單 UI 渲染與手風琴展開動畫
├── WbaseMainLayout.tsx   # 系統框架 (頂部標題列、主畫面、底部狀態列)
├── WbaseStatusBar.tsx    # 經典/現代化狀態列 (即時時間、使用者、熱鍵提示)
├── ThemeContext.tsx      # 深色/淺藍色主題 Context Provider
└── wbaseMainPage.tsx     # 主頁面進入點 (控管選單與子模組切換)
```

---

## 3. 選單資料結構規格 (`menuConfig.ts`)

### `MenuItem` 介面
```typescript
export interface MenuItem {
  id: string;             // 唯一識別碼
  code: string;           // 系統代號 (如 100, 120, wbase1020)
  title: string;          // 顯示名稱
  hasChildren?: boolean;  // 是否有下一階子選單
  icon?: string;          // Lucide Icon 名稱 (如 Building2, Users)
  shortcut?: string;      // 快捷熱鍵提示 (如 Alt+A, 1-4)
  actionUrl?: string;     // 路由/動作 URL
  children?: MenuItem[];  // 子選單陣列
}
```

### 選單分類架構 (根據 FoxPro 原始選單 100 - A00 完整設定)
1. **`100` 事務所資料**
   - `110` wbase1010 事務所資料
   - `120` wbase1020 會計師/記帳士資料 (已實現)
   - `130` wbase1030 員工資料
   - `140` wbase1040 密碼群組
   - `150` wbase1050 稅務人員
   - `160` wbase1060 收費項目
   - `170` wbase1070 備註
   - `180` wbase1080 摘要
2. **`200` 客戶資料** (210 建檔, 220 匯出, 230 匯入, 240 收費, 250 總分支)
3. **`300` 發票統購** (310 購買地點, 320 預購輸入, 330 預購列印, 340 媒體/網路轉檔 [341, 342], 350 清單列印, 360 字軌輸入, 370 刪除舊檔)
4. **`400` 操作設定** (410 標準科目 [411-416], 420 營業稅設定, 430 轉傳票設定, 440 期末存貨, 450 共用摘要, 460 共用參數)
5. **`500` 管理報表** (510 客戶明細, 520 郵遞標籤, 530 登打統計, 540 營業狀況, 550 財務參考, 560 委任書)
6. **`600` 系統維護** (610 母版密碼, 620 轉檔密碼, 630 標準檔匯出入)
7. **`800` 系統講義**
8. **`900` 重新連線**
9. **`A00` 結束離開**

---

## 4. 鍵盤盲打控制規範 (`useMenuKeyboard.ts`)

| 按鍵 | 當前焦點 (Level 1) | 當前焦點 (Level 2) | 當前焦點 (Level 3) |
| :--- | :--- | :--- | :--- |
| `↓` (ArrowDown) | 移動至下一個分類 (並自動收合子選單) | 移動至下一個群組 (並收合 Tier 3) | 移動至下一個程式點 |
| `↑` (ArrowUp) | 移動至上一個分類 (並自動收合子選單) | 移動至上一個群組 (並收合 Tier 3) | 移動至上一個程式點 |
| `→` (ArrowRight) | 若有子群組，展開並移至 Tier 2 第一項 | 若有子程式點，展開並移至 Tier 3 第一項 | 無動作 |
| `←` (ArrowLeft) | 無動作 | 收合 Tier 2，焦點退回 Tier 1 | 收合 Tier 3，焦點退回 Tier 2 |
| `Enter` | 展開 Tier 2；若為葉節點則執行 | 展開 Tier 3；若為葉節點則執行 | 執行該功能 (如開啟 `wbase1020`) |
| `Esc` | 無動作 | 收合 Tier 2 | 收合 Tier 3 |
| `1`-`9` | 直接切換至相對應數字之 Tier 1 分類 (不自動展開) | 同上 | 同上 |

---

## 5. UI 與主題設計規範 (`ThemeContext.tsx`, `WbaseMenuTree.tsx`)

### 主題切換 (Theme Toggle)
- 持久化 Key: `wx3000-theme` (`dark` / `light`)。
- 頂部標題列提供 `☀️ 淺色` / `🌙 深色` 切換按鈕。

### 淺色主題 (Light Blue Theme Palette)
- **整體背景**：`bg-sky-100/70` 到 `bg-gradient-to-br from-sky-100/90 via-blue-100/50 to-sky-200/70`。
- **側邊欄**：`bg-sky-100/95` border `sky-300/80` shadow-md。
- **選單高亮**：`bg-gradient-to-r ${colors.lightBg} ${colors.accent} text-blue-950 font-bold shadow-md`。
- **狀態列與面板**：`bg-sky-100 border-sky-300 text-blue-950`。

### 深色主題 (Dark Slate Theme Palette)
- **整體背景**：`bg-slate-900`。
- **側邊欄**：`bg-slate-900/80 backdrop-blur border-slate-700/50`。
- **選單高亮**：`bg-gradient-to-r ${colors.darkBg} ${colors.accent} text-white shadow-lg`。

---

## 6. 重現建置範例指令

```bash
# 前端專案編譯驗證
pnpm --filter frontend run build
```
