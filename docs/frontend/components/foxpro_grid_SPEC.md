# 規格書：FoxPro 鍵盤盲打前端共用組件庫規格

> **組件名稱**：`FoxProGridV2`, `FoxProGridCard` (`useFoxProCardNavigation`), `FoxProGridBill`, `FoxProPrintModal`, `FoxProPrintModalv2` (`useFoxProPrintXlsxExport`), `AddressSelectModal`, `SearchModal`, `FormUtilSelectXlsxFieldsList`, `WbasePageHeader`  
> **技術核心**：React 19 + TypeScript + Tailwind CSS (v4) + 自訂 Keyboard Traversal Hooks；AG Grid Community 只用於 `FoxProGridBill`，`FoxProGridV2` 與 `FoxProGridCard` 為自繪表格  
> **檔案目錄**：`frontend/src/components/`

---

## 1. 組件設計哲學與目錄結構

傳統 Visual FoxPro / Delphi / Lazarus 系統操作員習慣於 **100% 不碰滑鼠、純靠鍵盤熱鍵與 `Enter` / `Tab` / 方向鍵高速盲打**。
本專案於 `frontend/src/components/` 提供完整母版級可複用組件庫，涵蓋所有單檔維護、卡片表單聯動、台灣地址智慧快選、單據明細、報表列印與 Excel 動態匯出情境：

```text
frontend/src/components/
├── FoxProGrid/
│   ├── FoxProGridV2.tsx                  # [核心 1] 多列行內盲打維護表格 (支援雙層表頭、欄寬拖曳記憶、Big5 截斷、即時驗證、F2 輔助按鈕)
│   ├── FoxProPrintModal.tsx              # [核心 2] 統一列印母版組件 (區間預覽、純淨紙張列印、Excel 動態欄位匯出；另匯出 FoxProDllPrintButton)
│   ├── FoxProPrintModalv2.tsx            # 列印條件視窗母版 (VFP _form_print 條件表單：條件卡片、F7 列印、F8 匯出、Esc 離開)
│   ├── useFoxProPrintXlsxExport.ts       # FoxProPrintModalv2 的 F8 匯出 Hook (查詢 → 欄位設定 → xlsx) 與 exportFieldsToXlsx
│   ├── foxProPrintValidators.ts          # 列印條件常用檢核 (民國年、月份、起訖代號)
│   ├── AddressSelectModal.tsx            # [核心 3] 台灣地址智慧快選視窗 (縣市/鄉鎮郵遞區號/路名資料庫 + 門牌速選鈕 + 半形轉全形)；未列入 index.ts，需直接 import
│   ├── SearchModal.tsx                   # [共用] F2/F3 大型開窗模糊快查對話框
│   ├── useFoxProKeyboard.ts              # AG Grid 鍵盤導覽 Hook (僅供 FoxProGridBill 使用)
│   └── index.ts
├── FoxProGridCard/
│   ├── FoxProGridCard.tsx                # [核心 4] 主檔清單瀏覽卡片 + useFoxProCardNavigation (母版表單鍵盤導覽 Hook)
│   └── index.ts
├── FoxProGridBill/
│   ├── FoxProGridBill.tsx                # [核心 5] 單據明細專用 AG Grid 盲打表格 (目前只有進貨單 PurchaseOrderPage 使用)
│   └── index.ts
├── SelectXlsxField/
│   ├── FormUtilSelectXlsxFieldsList.tsx  # [核心 6] Excel 匯出欄位勾選、標題與順序自訂器
│   └── index.ts                          # 另提供 useSelectXlsxExport Hook
├── WbasePageHeader.tsx                   # [核心 7] 統一模組頂部導覽列 (返回鈕、麵包屑、程式代號、GRID/EDIT/ADD 模式徽章)
└── ServerConfigModal.tsx                 # 後端 API Server 位址與資料磁碟機代號 (A~Z) 動態設定彈窗 (Ctrl+Shift+S)
```

---

## 2. `<FoxProGridV2 />` 規格（多列行內盲打維護表格）

適用於在表格內直接連續登打多筆記錄的模組（如 `wbase1030`, `1050`, `1060`, `1070`, `1080`, `2040`, `2050`, `3010`, `3020_02`, `3060_02`, `4010`, `4020`~`4050` 各頁籤，以及 `wbase5010` 各報表清單、`wbase5070` 唯讀客戶勾選清單）。

### 核心功能與熱鍵
- **對齊原生 FoxPro GRID 筆數 (`minRows = 0`)**：預設只渲染實際資料筆數（不預塞多餘空白假列）。按 `Ins`、或在最後一列最後一欄按 `Enter`/`Tab`/`→` 時才新增空白列；底端按 `↓` 只停在最後一列，不會新增。有傳 `onInsertRow` 時改呼叫它，不在本地追加列。新增前會先檢查目前列的主鍵。
- **直接打字覆蓋 (Direct Keypress Overwrite)**：焦點在任何可編輯儲存格時，無須先按 `F2`，直接輸入英數字、中文字或 `-` 即進入編輯並覆蓋原值。
- **欄位級輸入遮罩與驗證 (`ColumnDefV2`)**：
  - `uppercase`: 自動轉換英文字母為大寫（對齊 InputMask `!`）。
  - `digitOnly`: 僅允許輸入數字 `0`~`9`。
  - `maxLength`: 輸入框的字元數上限 (`<input maxLength>`)。
  - `maxBytes`: 儲存格確認時以 `truncateBig5` 截斷到指定 Big5 位元組長度（避免中文字撐爆 DBF 欄寬）。
  - `isPrimaryKey`: 主鍵欄不可空白、不可與畫面上其他列重複 (不分大小寫)；主鍵空白時無法離開該列或編輯其他欄。
  - `validate`: 儲存格確認 (Enter/Tab/方向鍵/離焦) 時執行自訂檢核，回傳 `{ valid, message, isWarning, normalized }`。阻斷式錯誤以右下角提示訊息顯示並留在原格繼續編輯；`isWarning` 的警告只在儲存格顯示驚嘆號圖示，不阻斷盲打；`normalized` 會取代輸入值回填 (如民國日期正規化)。
  - `hasEllipsis` / `ellipsisLabel` / `onEllipsisClick`: 儲存格右側顯示小按鈕 (預設文字 `F2`，對齊 Lazarus `cbsEllipsis`)，點擊或在該欄按 `F2`/`F4` 即呼叫 `onEllipsisClick` 開啟 `<AddressSelectModal />` 等輔助視窗。
- **雙層表頭與項次欄**：`headerGroups` 可加一層群組表頭；`showRowIndex` 顯示「項次」欄。
- **可拖曳調整欄寬與持久化 (`gridId` / `storageKey`)**：拖曳表頭分隔線調整欄寬，雙擊分隔線還原為欄位定義的預設寬度，並自動儲存於 `localStorage` (`wx3000_grid_col_widths_<gridId 或 storageKey>`，兩者都沒給時以欄位 key 串接為名)。
- **`Enter` / `Tab` 連續跳欄與逐格存檔**：編輯中按 `Enter`/`Tab` 確認儲存格並向右移到下一欄（不會跳過不可編輯欄）；到達列末時換至下一列首欄。每次儲存格確認成功都會呼叫 `onRowsChange` 與 `onSaveRow(row, rowIndex)`。`enterDirection='down'` 時 `Enter` 改為往下移。
- **導覽模式按鍵**：`Enter` 進入編輯；`F2` 進入/確認編輯；`Tab`/`Shift+Tab`、方向鍵移動；`PageUp`/`PageDown` 依可視高度 (每列 38px) 翻頁；`Home`/`End` 到列首/列尾，加 `Ctrl` 到第一列/最後一列；`Del` 呼叫 `onDeleteRow(row, rowIndex)`。
- **`Esc`**：編輯中放棄本格編輯；否則呼叫 `onShowSummary(hasModified)`。`Esc` 不會呼叫 `onExit`，`onExit` 只綁在底部的離開按鈕。
- **`F7` / `F3`**：`F7` 呼叫 `onOpenPrint`；`F3` 在有傳 `onF3Search` 時開啟內建 `<SearchModal />`，選取結果的 `code` 會寫入目前欄位 (有 `name` 時另寫入 `empName` 欄位) 並呼叫 `onSaveRow`。
- **只能修改的清單 (`allowInsert`，預設 `true`)**：設為 `false` 時 `Ins` 鍵、最後一格 `Enter`/`Tab` 自動新增、底部新增按鈕全部停用，空表只顯示「查無資料」(例：`wbase2050` 總機構清單)。
- **新增後游標控制**：`editOnInsert` (預設 `true`) 決定新增列後是否自動進入主鍵欄 (無主鍵時為第一欄) 編輯；`activeRowKey` 搭配 `getRowKey` 由外部指定游標列 (例：後端建立收費單後定位)。
- **目前儲存格回呼 (`onActiveCellChange(row, rowIndex, colKey)`)**：列或欄改變時觸發，用於依目前欄位切換的說明列 (VFP `AfterRowColChange` 的 `flddesc`，例：`wbase2050`)。`onSelectRow` 只在換列 (或資料變更) 時觸發且不帶欄位。
- **底部操作列**：依有無傳入回呼顯示「新增 (`Ins`)」(`onInsertRow` 且 `allowInsert`)、「刪除 (`Del`)」(`onDeleteRow`)、「查詢 (`F6`)」(`onRefreshData`，只有按鈕，沒有 `F6` 鍵盤處理)、「列印 (`F7`)」(`onOpenPrint`)、`customActions`，以及 `Esc` 按鈕 (`onExit`，文字 `escLabel`，預設「儲存/離開」)。`statusBarInfo` 可自訂左側狀態資訊；`hideKeyboardHints`、`hideF2Hint` 預設都為 `true`。

### 按鍵事件攔截注意事項
- 按鍵監聽掛在 `window` (bubble 階段)；事件來源是表格以外的 `INPUT` 或內建 `SearchModal` 開啟時不處理 (`TEXTAREA` 不在排除範圍)。
- `Esc`、`F3`、`F7`、`Ins` 一律 `preventDefault` (`Esc` 另 `stopPropagation`)，不論是否有傳對應回呼。模組要維持 VFP 原本的按鍵配置時，請在頁面層以 capture 階段攔截，不要依賴 bubble 階段的註冊順序。

---

## 3. `<FoxProGridCard />` 與 `useFoxProCardNavigation` 規格（卡片+表單聯動母版）

適用於欄位眾多、採用「上方（或左側）主檔快速瀏覽卡片 + 下方（或右側）完整表單」設計的模組（如 `wbase1020` 會計師維護、`wbase2010` 公司基本資料維護，含 `Wbase2010SplitPage` 左右分割）。

### 核心功能與熱鍵
- **`FoxProGridCard` 瀏覽卡片**：
  - 支援 `mergeHeader`（將圖示、筆數徽章與欄位標題列合而為一，節省垂直空間）、欄寬拖曳記憶 (`gridId`/`storageKey`，存於 `localStorage` `wx3000_gridcard_col_widths_*`，雙擊分隔線還原預設寬度)、滑鼠滾輪捲動停止後防抖同步選取游標 (`enableScrollSync`，預設 `true`)。
  - 組件本身不處理換筆按鍵：`↑` / `↓` / `PageUp` / `PageDown` 等由模組透過 `onKeyDown` 自行實作 (例：`wbase1020`、`wbase2010`)，`selectedIndex` / `onSelectRow` / `onDoubleClickRow` 由模組控制，下方/右側表單即時同步預覽。
- **`useFoxProCardNavigation` 表單盲打導覽 Hook**：
  - **`foxProFocusAndSelect`**：聚焦時自動全選輸入框文字並觸發閃爍提示 (`fox-flash`)，實現無須退格鍵、直接打字覆蓋 (Type-over Replacement)。
  - **`Enter` / `↓` 下一欄、`↑` 上一欄** (`handleFieldKeyDown`)：自動跳過 `disabled` 或 `isFieldDisabled` 判定停用的欄位；支援 `tabFieldsMap` 跨頁籤（如 `wbase2010` Tab 0~5）無縫自動切換 Tab 並聚焦目標欄；最後一欄按 `Enter` 直接觸發 `onSave()`。
  - `textarea` 欄位：游標不在最後一行時 `↓` 留在欄內移動，不在第一行時 `↑` 同理；`Shift+Enter` / `Ctrl+Enter` 換行。
  - `handleFieldKeyDown` 可傳入 `onEnterCommit`，回傳 `false` 時 `Enter` 不跳欄 (用於欄位檢核失敗)。

---

## 4. `<AddressSelectModal />` 規格（台灣地址智慧快選視窗）

對齊傳統系統 `util_hi_addr_form.pas`，提供全台灣地址結構化點選與鍵盤快輸：
- **三階段連動選單**：縣市 (`TAIWAN_CITIES`) ➔ 鄉鎮市區＋3碼郵遞區號 ➔ 該區所有街路名稱 (`getRoadsForZip` 首次使用時動態 import `frontend/src/data/taiwan_roads.json` 並快取，支援關鍵字即時過濾)。
- **智慧逆向解析 (`parseTaiwanAddress`)**：開啟視窗時自動解析欄位內現有地址，自動定位至對應縣市、行政區與路名。
- **門牌/樓層速選面板與全半形轉換**：內建數字（`1`~`0`, `-`, `之`）、中文數字（`一`~`十`）、單位（`段`, `巷`, `弄`, `號`, `樓`, `室`, `鄰`, `衖`, `棟`, `附`, `F`）速選鈕，以及「數字轉全形 (`digToBig`)」與「加上郵遞區號」選項。
- **按鍵**：`F8` 或在地址輸入框按 `Enter` 確認帶回 (`onConfirm`)，`Esc` 關閉。
- 使用模組：`wbase1020`、`1030`、`1050`、`2010`、`3010`。

---

## 5. `<FoxProPrintModal />` 與 `<FormUtilSelectXlsxFieldsList />` 規格

- **`<FoxProPrintModal />`**：統一全系統 `F7` 區間列印彈窗，內建起迄代號輸入、預覽表格、純淨紙張直印 (`printElement`)、自訂 `extraActions`（如以 `FoxProDllPrintButton` 透過 `LocalAgent` (`http://localhost:5009/report`) 呼叫原生 `wbaseRP.dll` 報表），並整合「匯出 xlsx 設定」勾選框。
  - 視窗內按鍵：`Esc` 關閉、`F7` 網頁列印、`F8` 匯出 xlsx (需 `enableXlsxExport` 且有資料)。
  - `showFilter` (預設 `true`) 設為 `false` 時不顯示起迄代號篩選列，用於範圍已在前一個畫面決定的報表 (例如 `wbase5010` 5-1、5-3 ~ 5-5 先選擇客戶)；此時起迄的 props 仍須傳入，但不會用到。
  - 未勾選「匯出 xlsx 設定」時直接以上次儲存的欄位設定匯出；勾選時先開啟 `<FormUtilSelectXlsxFieldsList />`。設定存於 `localStorage` (`xlsxStorageKey`，預設 `<reportTitle>_xlsx_export_config`)，檔名為 `<xlsxFileName 或 reportTitle>_<yyyy-MM-dd>.xlsx`。
  - 使用模組：`wbase1020`、`1030`、`1050`、`1060`、`1070`、`3010`、`4010`、`5010`/`5030`/`5040`/`5050` 等。
- **`<FormUtilSelectXlsxFieldsList />`**：單一欄位清單（選擇 / 欄位名稱 / 自訂匯出標題），可勾選匯出欄位、點選標題儲存格自訂匯出標題、調整欄位順序。設定以 `vFieldList` / `vCaptionList` / `vDisplayFormat` / `vColorList` 字串序列化 (`serializeXlsxConfigParams` / `parseXlsxConfigParams`)，持久化由呼叫端負責 (`FoxProPrintModal`，或 `SelectXlsxField/index.ts` 的 `useSelectXlsxExport` Hook，預設 key `common_xlsx_export_config`)。
  - 按鍵：`↑`/`↓` 移動、`Space` 切換勾選、`F3` 全選、`F4` 全不選、`F7` 搜尋、`F8` 預設值、`F9` 確定變更、`F11` 上移、`F12` 下移、`Esc` 放棄離開。

### 5.1 `<FoxProPrintModalv2 />` 規格（列印條件視窗母版）

對應 VFP `_form_print` 系列的「列印條件」表單，版面源自 `wbase3020_buyinv_print`。只負責條件輸入、檢核與按鍵；查詢、預覽 (可搭配 `<FoxProPrintModal showFilter={false} />`) 與匯出 (可搭配 `useFoxProPrintXlsxExport`) 由呼叫端處理。檔案：`FoxProGrid/FoxProPrintModalv2.tsx`、`FoxProGrid/useFoxProPrintXlsxExport.ts`、`FoxProGrid/foxProPrintValidators.ts` (三者都由 `FoxProGrid/index.ts` 匯出)。

- **版面**：圓角視窗 (`max-w-2xl`，深淺色主題)：漸層標題列 (圖示 `icon`、`title`、黃色標籤 `badge` 預設「Enter/F7 列印」、小字 `formCode`、淺色 / 深色切換鈕、關閉鈕) → 摘要卡片 (`summary`) → 條件卡片 (`sections`) → 「匯出 xlsx 設定」卡片 (有 `onExport` 才顯示) → 訊息列 → 按鍵列「F7. 列印預覽」「F8. 匯出」「Esc. 離開」(文字可由 `printLabel`、`exportLabel`、`cancelLabel` 改)。
- **顯示位置**：預設在所在區塊內置中 (`flex-1` 可捲動，適合放在 `WbasePageHeader` 下方取代整個畫面)；`overlay` 為 `true` 時改成蓋住整個畫面的半透明遮罩 (fixed，同 `wbase3020_buyinv_print`)。
- **`sections: PrintConditionSection[]`**：每張卡片有 `title`、`icon` (lucide)、`fields`，文字欄卡片可加右側標籤 `badge`。焦點所在的卡片以黃色外框標示，右上角自動顯示提示 (`[←/→] 切換`、`[F2] 選單 / [Enter] 下一欄`、`[Enter] 下一欄`)。欄位兩種：
  - `PrintOptionFieldDef` (`kind: 'options'`)：選項方塊 (`1. 選項` …，選中的有勾號)，`←`/`→`/`Space` 換選項、數字鍵 `1`~`n` 直接選，也可點選。值為選項的 `value` (數字)。
  - `PrintTextFieldDef` (`kind: 'text'`)：同一張卡片的文字欄排成一列，可加 `prefix` / `suffix` (例如「年」「月」「~ 終止」)；`maxLength`、`digits` (只收數字)、`uppercase`、`widthClass`、`placeholder`；`validate(value, values)` 回傳錯誤訊息或 `null`，`Enter` 離開時檢核，錯誤時留在原欄並選取內容；`onF2` 有值時 `F2` 呼叫它開選單，選完由呼叫端更新 `values` 並設 `focusRequest={{ key }}` 把焦點帶回該欄。
- **`values` / `onChange`**：受控元件，值是 `Record<string, string | number>`，key 對應欄位的 `key`。
- **按鍵** (全部在 `window` 的 capture 階段處理；`active` 為 `false` 時不處理、按鈕停用)：`Enter`/`↓` 下一欄 (最後一欄之後到「匯出 xlsx 設定」，再到 F7 鈕；F7 鈕上 `Enter` 等於 `F7`)、`↑` 上一欄、`F7` 檢核全部欄位後呼叫 `onPrint`、`F8` 檢核後呼叫 `onExport`、`Esc` 呼叫 `onCancel`，其他功能鍵 (`F2` 除外) 一律 `preventDefault`。子視窗 (預覽、選單、欄位設定) 開啟或查詢中時，呼叫端要把 `active` 設為 `false`。
- **訊息列**：欄位檢核錯誤優先顯示，否則顯示 `status` (`info` / `success` / `warning` / `error`)。
- **`useFoxProPrintXlsxExport({ storageKey, fields, fileName, load, write? })`**：F8 匯出流程 — `load()` 取資料 → 查無資料時 `status` 為「查無符合資料，沒有匯出。」→ `configure` 為 `false` 時依 `localStorage[storageKey]` 的欄位設定直接匯出 (沒有設定時用 `fields` 的 `selected`)，為 `true` 時先開 `<FormUtilSelectXlsxFieldsList />`，`F9` 確定後儲存設定再匯出 → 成功時 `status` 為「已匯出 n 筆資料：檔名.xlsx」。設定在每次匯出時才讀 `localStorage`，`storageKey` 與 `FoxProPrintModal` 的 `xlsxStorageKey` 用同一個即可共用 (`FoxProPrintModal` 只在開啟時掛上才會每次重讀)。回傳 `{ configure, setConfigure, busy, status, setStatus, run, selectorOpen, selectorElement }`：把前四者與 `run` 接到 `FoxProPrintModalv2`，`busy || selectorOpen` 時 `active={false}`，畫面上放 `selectorElement`。寫檔預設 `exportFieldsToXlsx(data, fields, fileName, sheetName = '報表')` (只輸出 `selected` 欄、欄名用 `customTitle`，`seq` 欄輸出序號)，可用 `write` 換掉。
- **`foxProPrintValidators.ts`**：`currentRocYear()` 今天的民國年 3 碼；`requireYear`「年度不可空白!」；`validMonth`「請輸入1至12 月份!」；`validEndMonth(startKey)` 再檢查「結束月份比起始月份小!」；`validEndCode(startKey, message)` 終止代號小於起始代號時回傳 `message`。
- 使用模組：`wbase5010` 5-1 ~ 5-5 (第二段列印條件，見 `docs/frontend/wbase/wbase5010/SPEC.md`)。

---

## 6. `<SearchModal />` 規格（開窗快查）

- Props：`isOpen`、`title`、`onSearch(query) => Promise<SearchItem[]>`、`onSelect(item)`、`onClose`；`SearchItem` 為 `{ code, name, spec?, price? }`。
- 開啟時清空關鍵字並以空字串查詢一次，之後每次輸入都重新呼叫 `onSearch`。
- 按鍵：`↑`/`↓` 選擇、`Enter` 帶回、`Esc` 或 `F2` 關閉。

---

## 7. `<FoxProGridBill />` 規格（單據明細 AG Grid）

- 目前只有 `wtaxop` 進貨單 (`PurchaseOrderPage`) 使用，欄位固定為 `PurchaseLineItem` (項次、產品代號、品名、數量、單價、小計金額、備註)，詳見 `docs/frontend/wtaxop/purchase_order_SPEC.md`。
- 按鍵由 `useFoxProKeyboard` 在容器的 capture 階段處理：`F2` 編輯儲存格、`F4` 在產品代號/品名欄開啟產品 `SearchModal`、`F9` 呼叫 `onF9Query`、`F12` 結束編輯並呼叫 `onF12Save`、`Enter`/`Tab` 移到下一個可編輯欄 (列末換下一列，最後一列再追加新列)、最後一列按 `↓` 追加新列。
- 產品代號輸入後以 `searchProducts` 比對；找不到時清空該列並跳出提示。數量或單價變更時重算小計，底部顯示合計數量與金額。
