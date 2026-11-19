# 規格書：wbase1020 會計師/記帳士資料維護作業

> **模組代號**：`wbase1020`  
> **功能名稱**：會計師/記帳士資料維護作業 (上方 `<FoxProGridCard />` 瀏覽清單 + 下方即時聯動 `<Wbase1020Form />` + 台灣地址開窗選取 + 報表列印)  
> **所屬模組**：`frontend/src/wbase/wbase1020/` & `backend/Controllers/Wbase1020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1020` (對應地端 `<Drive>:\w3000\comm\cpa.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"cpa"`)

---

## 1. 模組定位與職責

本模組為系統核心主檔維護作業之一，用於登錄、修改、刪除與列印事務所合作之會計師與記帳士基本資料。
具備以下功能特性：
1. **上下分割即時聯動佈局 (`index.tsx`)**：
   - **頂部標題列 (`<WbasePageHeader />`)**：提供 `返回主選單` 與 `查詢 F2` 按鈕，並顯示目前模式與選取列 (`[代號] 姓名`)。
   - **底部操作列**：瀏覽模式提供 `Ins 新增`、`F6 編修`、`Del 刪除`、`F2 查詢`、`F7 列印` 按鈕，並顯示目前筆數與模式。
   - **上半部 (`<FoxProGridCard />`)**：高對比瀏覽清單（含欄寬拖曳記憶 `gridId="wbase1020"`），支援 `↑`/`↓`/`PageUp`/`PageDown`/`Home`/`End` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`，元件預設開啟)。
   - **下半部 (`<Wbase1020Form />`)**：隨上方選取列即時同步顯示該筆會計師完整 15 個欄位資料；按 `Enter` / `F6` 進入編輯、`Ins` / `F3` 進入新增（自動以 `getNextAutoNo` 計算下一個代號：取最大代號尾部數字遞增並保留前綴與位數，無資料時為 `01`）。
2. **全鍵盤順序跳欄、開窗選取與防呆驗證 (`Wbase1020Form.tsx` + `useFoxProCardNavigation`)**：
   - 支援 **`Enter` / `↓` 順序下跳欄位**、`↑` 跳回上一欄位，聚焦時自動全選文字 (`foxProFocusAndSelect`) 便於直接打字覆蓋。編輯模式時代號 (`cpaCode`) 停用，焦點從證書別開始；新增模式焦點從代號開始。
   - **發文字軌開窗輔助 (`DOC_TRACK_SUGGESTIONS`)**：`docTrack` 欄位可按 `F2` / `F4` 或點擊欄位右側 `F2` 按鈕開啟字軌挑選視窗，選項依證書別 (`certType`) 連動：`2`（記帳士）為 `證`、`證換`；`3`（報稅代理人）為 `財北`、`財高`、`北區`、`中區`、`南區`；其他證書別則列出以上全部 7 個選項。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：於地址 (`address`) 欄位按 `F2` / `F4` 或點擊右側 `F2 地址` 按鈕開啟縣市/鄉鎮區/路名智慧組合選取器。
   - **欄位級別檢核 (`validation.ts`、`validateCpaForm`)**：
     - 阻斷存檔：代號必填且不可重複、姓名必填、`checkCertType`（證書別僅允許空白、`1`、`2`、`3`）、`checkBig5Compatible`（姓名、申報ID、發文字軌、地址、公會名稱、E-MAIL 含 Big5 無法表示的字元時阻擋，防止寫入 VFP DBF 變 `?`）。
     - 提示但仍可存檔：`checkTaxId`（申報 ID：身分證/居留證/8 碼統編）、`checkUnifiedNo`（8 碼統一編號）、`isValidEmail`（E-MAIL 格式）、姓名超過 40 位元組、地址超過 60 位元組。
3. **列印條件、報表預覽與 Excel 匯出 (`wbase1020Print.tsx` + `Wbase1020PrintConditionModal.tsx` + `<ReportPreviewModal />`)**：
   - **列印條件畫面 (`Wbase1020PrintConditionModal`，代號 `WBASE1020P`)**：以共用母版 `<FoxProRangePrintConditionModal />` 組成。起始 / 結束編號最多 10 碼、自動轉大寫，空白表示從頭 / 至尾；輸入框右側 `F2` 按鈕或按 `F2` 開 `<SearchModal />` 選會計師 (比對目前清單的代號、姓名、統一編號；清單為空時改以 `GET /api/wbase1020?keyword=` 查詢)。輸入的代號在目前清單找得到時顯示姓名，並依目前清單估算「目前清冊符合：N 筆」。結束編號小於起始編號時擋下 `F7` / `F8`。
   - **`F7` 確定 → 報表預覽**：以 `POST /api/wbase1020/print` 查詢起訖代號區間 (查詢失敗時條件畫面的訊息列顯示「無法取得列印資料：<原因>」，不開預覽)，再開共用報表預覽 `<ReportPreviewModal />` (`reportId="wbase1020_cpa_list"`、橫向、標題「基本會計師/記帳士名冊清冊」)，欄位為代號、證書別、姓名、申報ID、電話、手機、統一編號、地址、公會名稱。預覽可調整欄寬、列高、字型大小與縮放 (存於 `localStorage` 的 `wx3000_report_preview_wbase1020_cpa_list`)；「編修」只改預覽內容，不回寫資料；「更新」以同一區間重新呼叫 `/print` (失敗時預覽顯示原因並保留原資料)；匯出只有 PDF、JPG、Word (`.doc`)，檔名 `會計師記帳士清冊`。`F7` / `Ctrl+P` 直接印到右側列印設定所選的印表機 (選「Microsoft Print to PDF」時改為匯出 PDF；桌面版經 Electron `printHtml`，瀏覽器經 LocalAgent `POST /api/print/direct`)，`Ctrl+Shift+P` 開系統列印對話框。預覽母版規格見 `docs/frontend/components/foxpro_grid_SPEC.md` 第 8 節。
   - **雙擊預覽資料列 (`onRowDrillDown`)**：`Wbase1020Print` 可由 props 傳入自訂處理；未傳入時 (目前 `index.tsx` 未傳) 關閉預覽與條件畫面，在清單選到該代號 (`selectRowFromSearch`) 並進入編修模式 (`startEdit`)。
   - **`F8` 匯出 Excel (`useFoxProPrintXlsxExport`)**：以同一區間呼叫 `POST /api/wbase1020/print`，依已儲存的欄位設定 (`localStorage` `wbase1020_xlsx_export_config`) 直接匯出 `會計師記帳士清冊.xlsx`；勾選「匯出 xlsx 設定」時先開 `<FormUtilSelectXlsxFieldsList />` 挑選欄位。候選 16 欄，預設勾選 15 欄 (「事務所名稱」`officeName` 預設不勾)。`cpa.dbf` 沒有備註欄 (`CpaMaster.Memo` 為 `NotMapped`)，所以不提供「備註」；舊的匯出設定裡若有它會被略過。查詢失敗時訊息列顯示「查詢失敗：無法取得列印資料：<原因>」。報表預覽本身沒有 Excel 匯出。
   - 關閉列印後焦點回到上方清單 (清單的按鍵掛在元素上，焦點留在 `body` 時 `Esc`、方向鍵都沒有作用)。
   - 本模組目前**未**呼叫 `LocalAgent` 原生 `wbaseRP.dll` 報表（`localagent/dlls.json` 也沒有會計師清冊函數）。
4. **混合雲地 DBF 雙向同步 (`Wbase1020Controller.cs`)**：
   - 讀取前自動執行 `_dbfSyncService.EnsureTableSyncedAsync(..., "cpa", ..., "cpa", "no")` 比對 `<Drive>:\w3000\comm\cpa.dbf` Checksum；新增/修改/刪除時以 `WriteRecordAsync(..., KeyField = "no", ...)` 優先寫入地端 `cpa.dbf`，成功後才更新 PostgreSQL `"cpa"` 與 checksum (`CommitWriteChecksumAsync`)。DBF 鎖定 (`LOCK_TIMEOUT`) 或新增時 DBF 已有同代號 (`DUPLICATE_KEY`，`DbfWriteOptions.UniqueKeyIfInsert`) 時回 `409`，其他 DBF 寫入失敗回 `400`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1020/
├── index.tsx              # 主頁面進入點 (WbasePageHeader + FoxProGridCard + Wbase1020Form + F2 內建查詢彈窗 + 刪除確認窗)
├── Wbase1020Form.tsx      # 下方詳細資料表單組件 (useFoxProCardNavigation + AddressSelectModal + 字軌 F2 開窗)
├── wbase1020Print.tsx     # F7 列印流程：條件畫面 → ReportPreviewModal 預覽 (雙擊列回編修)、條件畫面 F2 代號查詢、F8 Excel 匯出 (useFoxProPrintXlsxExport)
├── Wbase1020PrintConditionModal.tsx  # 列印條件畫面 (包裝 FoxProRangePrintConditionModal：起訖編號、帶出姓名、預估符合筆數)
└── useWbase1020.ts        # Zustand 狀態 Store (CRUD、自動編號 getNextAutoNo、選取列同步、搜尋與確認對話框)

frontend/src/services/
├── wbase1020.ts           # Axios API Client、CPA_FIELD_RULES 欄位規則與 validateCpaForm 存檔前檢核
├── addressService.ts      # 台灣地址解析與路名檢索服務
└── validation.ts          # checkCertType, checkTaxId, checkUnifiedNo, checkBig5Compatible, isValidEmail, DOC_TRACK_SUGGESTIONS, getNextAutoNo

frontend/src/components/   (列印用的共用元件)
├── FoxProGrid/FoxProRangePrintConditionModal.tsx  # 起訖區間列印條件母版 (F2 / F7 / F8 / Esc)
├── FoxProGrid/useFoxProPrintXlsxExport.ts         # 條件畫面 F8 Excel 匯出 Hook
└── ReportPreview/ReportPreviewModal.tsx           # 報表預覽、送印與 PDF / JPG / Word 匯出

backend/
├── Controllers/
│   └── Wbase1020Controller.cs  # RESTful CRUD、Print Query 與 DbfSyncService 雙向同步
└── Models/
    └── CpaMaster.cs            # EF Core Entity (Table: "cpa", 動態對應當前資料磁碟 Schema)
```

---

## 3. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `cpa`)

長度限制為前端 `CPA_FIELD_RULES.maxBytes` (輸入框 `maxLength`)；後端存檔前另以字元數截斷 (`Truncate`)，兩者數值不完全相同 (例如 `hno1` 後端截斷為 20)。

| DBF / PG 欄位 | EF Core 屬性 (`CpaMaster`) | 前端屬性 (`CpaItem`) | 長度限制 (Bytes) | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| `no` | `CpaCode` (PK) | `cpaCode` | `10` | 會計師/記帳士代號 (必填、不可重複、自動轉大寫) |
| `kind` | `CertType` | `certType` | `1` | 證書別 (空白或 `1`.會計師 `2`.記帳士 `3`.報稅代理人) |
| `name` | `CpaName` | `cpaName` | `40` | 姓名 (必填) |
| `id` | `TaxId` | `taxId` | `10` | 申報 ID (身分證/居留證/統編，自動轉大寫) |
| `cno1` | `LicenseNo` | `licenseNo` | `3` | 證書年度或國稅別 |
| `cword` | `DocTrack` | `docTrack` | `20` | 發文字軌 (可按 `F2`/`F4` 開窗選取) |
| `cno2` | `CertNo` | `certNo` | `8` | 證書編號 |
| `tel` | `Tel` | `tel` | `20` | 電話 |
| `mobile` | `Mobile` | `mobile` | `20` | 手機 |
| `fax` | `Fax` | `fax` | `20` | 傳真 |
| `unino` | `UnifiedNo` | `unifiedNo` | `8` | 統一編號 (扣繳單位統一編號，自動轉大寫) |
| `addr` | `Address` | `address` | `60` | 事務所地址 (支援 `F2`/`F4` 台灣地址選取器) |
| `hno1` | `GuildNo1` | `guildNo1` | `40` | 登錄區域及國稅局別 (畫面標題：公會名稱) |
| `hno2` | `GuildNo2` | `guildNo2` | `20` | 登錄字號 (畫面標題：會員證號) |
| `email` | `Email` | `email` | `255` | E-MAIL |
| `gno1` | `OfficeName` | `officeName` | - | 表單不顯示；讀出後原值回寫 (Excel 匯出欄位「事務所名稱」) |
| `gno2` | `MemberNo` | `memberNo` | - | 表單不顯示；讀出後原值回寫 (Excel 匯出欄位「會員證號」，與表單上 `hno2` 的「會員證號」不是同一欄) |
| `_record_number` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 4. 鍵盤熱鍵對照表 (Hotkeys)

### 瀏覽模式 (`mode === 'grid'`)
- `↑` / `↓` / `PageUp` / `PageDown` (每次 8 筆) / `Home` / `End`：於上方 `FoxProGridCard` 切換選取列，下方表單即時同步預覽
- `Ins` / `F3`：進入新增模式 (`startAdd`)，自動填入下一個可用代號並聚焦代號欄位
- `Enter` / `F6` / 雙擊列：進入編修模式 (`startEdit`)，聚焦證書別欄位（代號不可修改）
- `Del`：彈出刪除確認對話框（`取消` / `確定刪除` 按鈕），確認後先刪 `cpa.dbf` 再刪 PostgreSQL
- `F2`：開啟快速查詢彈窗（比對代號、姓名、統一編號、申報ID、公會名稱；`↑`/`↓` 選擇、`Enter` 選取、`Esc` 取消）
- `F7`：開啟列印條件畫面 (`Wbase1020Print` → `Wbase1020PrintConditionModal`)
- `Esc`：退回 wbase 系統主選單

### 列印條件畫面 (`Wbase1020PrintConditionModal`)
- `Enter` / `↓`：起始編號 → 結束編號 →「匯出 xlsx 設定」→「確定」按鈕；`↑` 回上一欄
- `F2`：於起始或結束編號開啟會計師查詢視窗
- `F7`：查詢並開啟報表預覽
- `F8`：匯出 Excel (勾選「匯出 xlsx 設定」時先開欄位挑選視窗)
- `Esc`：關閉列印，回到清單

### 報表預覽 (`<ReportPreviewModal />`)
- `F7` / `Ctrl+P`：直接送印到右側列印設定所選的印表機；`Ctrl+Shift+P`：開系統列印對話框
- `PageUp` / `PageDown` / `Home` / `End`：換頁；`Ctrl` + `+` / `-`：縮放
- 雙擊資料列：關閉預覽與條件畫面，帶入該筆進入編修模式
- `Esc`：關閉匯出選單或設定視窗、結束編修；都沒有時關閉預覽回到條件畫面

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter`：執行該欄位檢核後跳至下一欄位（依 `CPA_FIELDS_ORDERED` 順序，自動跳過停用欄位）；最後一欄 (`email`) 按 `Enter` 直接觸發儲存 (`saveForm`)
- `↓` / `↑`：跳至下一欄 / 上一欄位
- `F2` / `F4`：於 `docTrack` 開啟字軌選單，或於 `address` 開啟 `<AddressSelectModal />` 台灣地址選取器
- `Esc` / `F9`：儲存變更並回到清單
- `F12`：放棄變更並退回瀏覽模式

---

## 5. 後端 API 規格 (`Wbase1020Controller.cs`)

- `GET /api/wbase1020?keyword={q}`：同步檢核 `cpa.dbf` 後查詢會計師列表（依代號排序；比對代號、姓名、`gno1`、證書年度、電話）
- `GET /api/wbase1020/{code}`：查詢單筆會計師資料
- `POST /api/wbase1020`：雙寫新增（代號已存在時改為更新；先寫入 `cpa.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1020/{code}`：雙寫更新（代號不存在時改為新增）
- `DELETE /api/wbase1020/{code}`：雙寫刪除
- `POST /api/wbase1020/print`：同步檢核 `cpa.dbf` 後依起訖代號 (`cpaCodeStart` / `cpaCodeEnd`，空白不限) 查詢列印資料，依代號排序；`F7` 預覽、預覽「更新」與 `F8` Excel 匯出都用這支
- `GET /api/wbase1020/inspect`：回傳 PostgreSQL `cpa` 表欄位結構（除錯用）
