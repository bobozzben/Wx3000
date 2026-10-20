# 規格書：FoxPro 鍵盤盲打前端共用組件庫規格

> **組件名稱**：`FoxProGridV2`, `FoxProGridCard`, `FoxProGridBill`, `SearchModal`, `FormUtilSelectXlsxFieldsList`  
> **技術核心**：React 19 + TypeScript + Tailwind CSS + AG Grid Community + 自訂 Keyboard Traversal Hooks  
> **檔案目錄**：`frontend/src/components/`

---

## 1. 組件設計哲學

傳統 Visual FoxPro / Delphi 系統操作員習慣於 **100% 不碰滑鼠、純靠鍵盤熱鍵與 `Enter` / `Tab` / 方向鍵高速盲打**。
本專案於 `frontend/src/components/` 提供四大核心可複用組件，涵蓋所有單檔維護、卡片表單聯動、單據明細與 Excel 匯出情境：

```text
frontend/src/components/
├── FoxProGrid/
│   ├── FoxProGridV2.tsx                  # [核心 1] 多列試算表行內盲打維護表格 (支援雙層表頭 headerGroups)
│   ├── SearchModal.tsx                   # [共用] F2/F3 大型開窗模糊快查對話框
│   ├── useFoxProKeyboard.ts              # 鍵盤導覽 Hook
│   └── index.ts
├── FoxProGridCard/
│   ├── FoxProGridCard.tsx                # [核心 2] 主檔清單瀏覽卡片 (支援滾動防抖游標同步 + 下方/右側表單聯動)
│   └── index.ts
├── FoxProGridBill/
│   ├── FoxProGridBill.tsx                # [核心 3] 單據 Header+Detail 專用雙 AG Grid 盲打表格
│   └── index.ts
├── SelectXlsxField/
│   ├── FormUtilSelectXlsxFieldsList.tsx  # [核心 4] 經典雙欄式 Excel 匯出欄位與格式自訂器
│   └── index.ts
└── ServerConfigModal.tsx                 # 後端 API Server IP/Port 動態設定彈窗
```

---

## 2. `<FoxProGridV2 />` 規格（多列試算表行內盲打表格）

適用於欄位數量適中、需在表格內直接連續登打多筆記錄的模組（如 `wbase1030`, `1050`, `1060`, `1070`, `1080`, `3010`, `3020_02`, `3060_02`）。

### 核心功能與熱鍵
- **直接打字覆蓋 (Direct Keypress Overwrite)**：焦點在任何可編輯儲存格時，無須先按 `F2`，直接輸入字元或數字即進入編輯並覆蓋原值。
- **`Enter` / `Tab` 連續跳欄與自動存檔**：
  - 向右移動至同一列下一個 `editable !== false` 的欄位。
  - 到達列末時自動換至下一列第一個可編輯欄位，並觸發當前列 `onSaveRow(row, rowIndex)` 即時持久化。
  - 在最後一列最後一欄按 `Enter`，自動呼叫 `createEmptyRow()` 新增空白列並聚焦至新列首欄。
- **多層表頭支援 (`headerGroups`)**：支援如 `wbase3020_02` 與 `wbase3060_02` 之頂部跨欄群組表頭。
- **快捷鍵列**：
  - `Ins` / 新增鈕：插入空白列 (`onInsertRow`)
  - `Del` / `F8`：刪除目前選取列 (`onDeleteRow`)
  - `F3`：開啟 `SearchModal` 快查視窗 (`onF3Search`)
  - `F6`：重新整理資料 (`onRefreshData`)
  - `F7`：開啟列印預覽視窗 (`onOpenPrint`)
  - `Esc`：結束編輯、儲存結算並退回 (`onShowSummary` / `onExit`)

---

## 3. `<FoxProGridCard />` 規格（主檔清單瀏覽卡片）

適用於欄位眾多、採用「上方（或左側）主檔快速瀏覽卡片 + 下方（或右側）完整表單」設計的模組（如 `wbase1020` 會計師維護、`wbase2010` 公司基本資料維護）。

### 核心功能與熱鍵
- **智慧防抖滾動同步 (`enableScrollSync`)**：
  - 當使用者使用滑鼠滾輪捲動清單，且原先選取列滾出可視範圍時，自動將選取游標同步至可視範圍頂部第一列；若原選取列仍在可視範圍內則保持不跳動。
- **全鍵盤游標導覽**：
  - `↑` / `↓` / `PageUp` / `PageDown`：高速上下移動選取列並自動平滑捲動 (`scrollIntoView`)，同時即時更新下方/右側詳細表單內容。
  - `Enter` / `F6` / 雙擊資料列：進入下方詳細表單的編修模式 (`onDoubleClickRow` / `startEdit`)。
- **高對比焦點高亮**：
  - 選取列套用顯眼琥珀黃外框 (`ring-2 ring-amber-400`) 與漸層高亮底色，深淺雙色主題皆具備極佳辨識度。

---

## 4. `<FoxProGridBill />` 規格（單據 Header + Detail 連續登打）

適用於進貨單、銷貨單等單據作業（如 `wtaxop/PurchaseOrder`）。
- 於明細列輸入品號或廠商代號時，輸入 `?` 或按 `F2`/`F3` 自動彈出 `SearchModal`。
- 最後一欄（單價/備註）按 `Enter` 自動計算小計與單據總金額，並在底端 Append 新明細列。

---

## 5. `<FormUtilSelectXlsxFieldsList />` 規格（Excel 動態欄位匯出器）

適用於報表與清單作業（如 `wbase3020_buyinv_print`、`wbase3050_buylist_print`）之「畫面匯出欄位設定」。
- **左欄（待選區）⇄ 右欄（已選匯出區）**：支援單選/全選加入、移除，以及上移 (`▲`) / 下移 (`▼`) 調整匯出欄位順序。
- **自訂標題與格式**：支援即時修改匯出 Excel 的欄位標題 (`caption`)、顯示格式 (`金額` / `本數` / `家數`) 與底色標記，並自動將設定序列化儲存於 `localStorage`。

---

## 6. 建置驗證

```powershell
pnpm --filter frontend build
```
