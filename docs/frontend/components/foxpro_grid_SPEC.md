# 規格書：FoxPro 鍵盤盲打前端共用組件庫規格

> **組件名稱**：`FoxProGridV2`, `FoxProGridCard` (`useFoxProCardNavigation`), `FoxProGridBill`, `FoxProPrintModal`, `AddressSelectModal`, `SearchModal`, `FormUtilSelectXlsxFieldsList`, `WbasePageHeader`  
> **技術核心**：React 19 + TypeScript + Tailwind CSS (v4) + AG Grid Community + 自訂 Keyboard Traversal Hooks  
> **檔案目錄**：`frontend/src/components/`

---

## 1. 組件設計哲學與目錄結構

傳統 Visual FoxPro / Delphi / Lazarus 系統操作員習慣於 **100% 不碰滑鼠、純靠鍵盤熱鍵與 `Enter` / `Tab` / 方向鍵高速盲打**。
本專案於 `frontend/src/components/` 提供完整母版級可複用組件庫，涵蓋所有單檔維護、卡片表單聯動、台灣地址智慧快選、單據明細、報表列印與 Excel 動態匯出情境：

```text
frontend/src/components/
├── FoxProGrid/
│   ├── FoxProGridV2.tsx                  # [核心 1] 多列行內盲打維護表格 (支援雙層表頭、欄寬拖曳記憶、Big5 截斷、即時驗證、F2 輔助按鈕)
│   ├── FoxProPrintModal.tsx              # [核心 2] 統一列印母版組件 (區間預覽、純淨紙張列印、Excel 動態欄位匯出)
│   ├── AddressSelectModal.tsx            # [核心 3] 台灣地址智慧快選視窗 (縣市/鄉鎮郵遞區號/路名資料庫 + 門牌速選鈕 + 半形轉全形)
│   ├── SearchModal.tsx                   # [共用] F2/F3 大型開窗模糊快查對話框
│   ├── useFoxProKeyboard.ts              # 鍵盤導覽 Hook
│   └── index.ts
├── FoxProGridCard/
│   ├── FoxProGridCard.tsx                # [核心 4] 主檔清單瀏覽卡片 + useFoxProCardNavigation (母版表單鍵盤導覽 Hook)
│   └── index.ts
├── FoxProGridBill/
│   ├── FoxProGridBill.tsx                # [核心 5] 單據 Header+Detail 專用雙 AG Grid 盲打表格
│   └── index.ts
├── SelectXlsxField/
│   ├── FormUtilSelectXlsxFieldsList.tsx  # [核心 6] 經典雙欄式 Excel 匯出欄位與格式自訂器
│   └── index.ts
├── WbasePageHeader.tsx                   # [核心 7] 統一模組頂部導覽列 (返回鈕、麵包屑、程式代號、GRID/EDIT/ADD 模式徽章)
└── ServerConfigModal.tsx                 # 後端 API Server IP/Port 與資料磁碟機 (C:/F:) 動態設定彈窗 (Ctrl+Shift+S)
```

---

## 2. `<FoxProGridV2 />` 規格（多列行內盲打維護表格）

適用於在表格內直接連續登打多筆記錄的模組（如 `wbase1030`, `1050`, `1060`, `1070`, `1080`, `3010`, `3020_02`, `3060_02`）。

### 核心功能與熱鍵
- **對齊原生 FoxPro GRID 筆數 (`minRows = 0`)**：預設只渲染實際資料筆數（不預塞多餘空白假列），按 `Ins`、底端按 `↓` 或最後一欄按 `Enter` 時才新增空白列。
- **直接打字覆蓋 (Direct Keypress Overwrite)**：焦點在任何可編輯儲存格時，無須先按 `F2`，直接輸入字元或數字即進入編輯並覆蓋原值。
- **欄位級輸入遮罩與驗證 (`ColumnDefV2`)**：
  - `uppercase`: 自動轉換英文字母為大寫（對齊 InputMask `!`）。
  - `digitOnly`: 僅允許輸入數字 `0`~`9`。
  - `maxBytes` / `maxLength`: 即時透過 `truncateBig5` 限制 Big5 位元組長度（避免中文字撐爆 DBF 欄寬）。
  - `validate`: 支援儲存格離焦/Enter 時執行自訂檢核，回傳 `{ valid, message, isWarning, normalized }`（支援阻斷式錯誤彈窗與非阻斷式警告提示，以及如民國日期自動正規化回填）。
  - `hasEllipsis` / `ellipsisLabel` / `onEllipsisClick`: 儲存格右側顯示 `F2` 小按鈕（對齊 Lazarus `cbsEllipsis`），點擊或按 `F2`/`F4` 即可開啟 `<AddressSelectModal />` 等輔助視窗。
- **可拖曳調整欄寬與持久化 (`gridId` / `storageKey`)**：支援拖曳表頭分隔線調整欄寬、雙擊自動適應內容寬度，並自動儲存於 `localStorage` (`wx3000_grid_col_widths_*`)。
- **`Enter` / `Tab` 連續跳欄與自動存檔**：向右移動至下一個可編輯欄位；到達列末時自動換至下一列首欄並觸發 `onSaveRow`；最後一列最後一欄按 `Enter` 自動新增空白列。

---

## 3. `<FoxProGridCard />` 與 `useFoxProCardNavigation` 規格（卡片+表單聯動母版）

適用於欄位眾多、採用「上方（或左側）主檔快速瀏覽卡片 + 下方（或右側）完整表單」設計的模組（如 `wbase1020` 會計師維護、`wbase2010` 公司基本資料維護）。

### 核心功能與熱鍵
- **`FoxProGridCard` 瀏覽卡片**：
  - 支援 `mergeHeader`（將圖示、筆數徽章與欄位標題列合而為一，節省垂直空間）、欄寬拖曳記憶、滑鼠滾輪防抖同步選取游標 (`enableScrollSync`)。
  - `↑` / `↓` / `PageUp` / `PageDown` 高速換筆，下方/右側表單即時同步預覽。
- **`useFoxProCardNavigation` 表單盲打導覽 Hook**：
  - **`foxProFocusAndSelect`**：聚焦時自動全選輸入框文字並觸發閃爍提示 (`fox-flash`)，實現無須退格鍵、直接打字覆蓋 (Type-over Replacement)。
  - **`Enter` / `↓` 下一欄、`↑` 上一欄**：自動跳過 `disabled` 欄位；支援 `tabFieldsMap` 跨頁籤（如 `wbase2010` Tab 0~5）無縫自動切換 Tab 並聚焦目標欄；最後一欄按 `Enter` 直接觸發 `onSave()`。

---

## 4. `<AddressSelectModal />` 規格（台灣地址智慧快選視窗）

對齊傳統系統 `util_hi_addr_form.pas`，提供全台灣地址結構化點選與鍵盤快輸：
- **三階段連動選單**：縣市 (`TAIWAN_CITIES`) ➔ 鄉鎮市區＋3碼郵遞區號 ➔ 該區所有街路名稱 (`taiwan_roads.json` 動態分塊載入與快取，支援關鍵字即時過濾)。
- **智慧逆向解析 (`parseTaiwanAddress`)**：開啟視窗時自動解析欄位內現有地址，自動定位至對應縣市、行政區與路名。
- **門牌/樓層速選面板與全半形轉換**：內建數字（`1`~`0`, `-`, `之`）、中文數字（`一`~`十`）、單位（`段`, `巷`, `弄`, `號`, `樓`, `室`, `鄰`, `衖`, `棟`, `附`, `F`）速選鈕，以及「數字轉全形 (`digToBig`)」與「帶入郵遞區號」選項。

---

## 5. `<FoxProPrintModal />` 與 `<FormUtilSelectXlsxFieldsList />` 規格

- **`<FoxProPrintModal />`**：統一全系統 `F7` 區間列印彈窗，內建起迄代號輸入、預覽表格、純淨紙張直印 (`printElement`)、自訂 `extraActions`（如呼叫 `LocalAgent` 原生 `wbaseRP.dll` 報表），並整合「匯出 xlsx 設定」勾選框。
- **`<FormUtilSelectXlsxFieldsList />`**：左欄（待選欄位）⇄ 右欄（已選匯出欄位）雙列表設計，支援自訂欄位標題、順序調整與 `localStorage` 持久化。
