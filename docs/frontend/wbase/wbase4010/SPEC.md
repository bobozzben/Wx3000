# 規格書：wbase4010 標準會計科目維護

> **模組代號**：`wbase4010` (選單 `wbase4011`~`wbase4016`，頁首代號顯示 `wbase401{mode}`)  
> **功能名稱**：會計科目基本資料維護 (`<FoxProGridV2 />` 多列行內盲打 + 六種行業模式 + F3 由參考檔複製總帳科目 + F4/F7 列印)  
> **所屬模組**：`frontend/src/wbase/wbase4010/`、`frontend/src/services/wbase4010.ts` & `backend/Controllers/Wbase4010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base40.prg` `wbasemenu0401cmd01`~`cmd06` → `SourS9BASE\LIBS\wbase.vcx` class `wbase401010` (列印 `wbase401011`、複製 `wbase401012`)

---

## 1. 模組定位與職責

維護記帳系統各行業的會計科目主檔。四碼以內為**總帳科目**，五至八碼為**明細科目** (前四碼即所屬總帳科目)。

### 1.1 行業模式

選單 411~416 都開啟 `Wbase4010Page`，由 `wbaseMainPage.tsx` 傳入 `initialMode`。畫面不顯示行業頁籤，要換行業須回選單另選 411~416。

| 選單 | `initialMode` | 行業 | DBF | 允許的科目明細 (`pubdept`) | 機關團體 |
| :--- | :-: | :--- | :--- | :--- | :-: |
| `wbase4011` 標準會計科目 | 1 | 標準會計科目 | `xmaster` | `0123456ABCDF ` | ✗ |
| `wbase4012` 營造業會計科目 | 2 | 營造業會計科目 | `xmaster2` | `01234567ABCDF ` | ✗ |
| `wbase4013` 建設業會計科目 | 3 | 建設業會計科目 | `xmaster3` | `01234567ABCDF ` | ✗ |
| `wbase4014` 文教團體會計科目 | 4 | 文教團體會計科目 | `xmaster4` | `0123456ABCDF ` | ✔ |
| `wbase4015` 社會團體會計科目 | 5 | 社會團體會計科目 | `xmaster5` | `0123456ABCDF ` | ✔ |
| `wbase4016` 衛福團體會計科目 | 6 | 衛福團體會計科目 | `xmaster6` | `0123456ABCDF ` | ✔ |

行業設定在前端 `ACCOUNT_MODES` (`services/wbase4010.ts`) 與後端 `GetModeMeta` 各有一份，內容相同。

### 1.2 主格線 (`Wbase4010Form.tsx`)

| 欄 | 欄位 | 規則 |
| :--- | :--- | :--- |
| 科目代號 | `accno` | 主鍵、大寫、最多 8 碼；總帳科目以「總帳」標籤顯示。既有科目的代號不可修改 (需先刪除再新增) |
| 科目名稱 | `accname` | 20 bytes，Big5 檢查 |
| 科目明細 | `dept` | 1 碼大寫，必須在該行業的 `pubdept` 內；`F2`/`F4` 或 `F2` 小按鈕開「選擇科目明細類別」視窗 (視窗內目前只能用滑鼠點選)，選定後立即存檔 |
| 稅額 | `taxcode` | 只接受 `*` (自動產生 5% 稅額) 或空白 |
| 長科目名稱 | `accnamel` | 60 bytes，Big5 檢查 |
| 英文科目名稱 | `engaccname` | 254 字元 |

- **逐列即時存檔**：列確認後 `handleSaveRow` 先以 `validateAccountRow` 檢查，再依代號是否已存在決定 `POST` (新增) 或 `PUT` (修改)。成功、失敗都以右下角 toast 提示。
- **新增 (`Ins`)**：在清單末端加一筆空白列；已有未完成的新列時不再新增。
  - 一般行業不可新增總帳科目 (「請使用 [F3] 複製標準總帳科目」)；機關團體只可新增 `70`、`80` 開頭的四碼總帳科目。
  - 明細科目的前四碼總帳科目必須存在；名稱、科目明細空白時帶入總帳科目的值。
  - 後端另檢查：總帳科目尚無明細科目且已有期初或 1~12 月發生額時擋下，訊息「此總帳科目已有傳票資料，若要新增子科目請執行 [F9]-3 建立子目功能轉移資料！」。
  - `serial` 為目前最大值 + 1，由 VFP 在 DBF 檔頭鎖內取號；DBF 已有同一個科目代號時回 409 (可能剛被其他工作站新增)。
- **刪除 (`Del`)**：總帳科目不可刪；機關團體的 `7021`~`7099`、`8021`~`8099` 在尚未設立明細科目時可刪。確認視窗提示「若本年度尚有傳票發生金額或期初餘額，系統將強制阻斷刪除」，後端在期初借貸與 1~12 月借貸金額合計不為 0 時擋下。確認視窗的「確定刪除」目前只能用滑鼠點選 (`Esc` 可取消)。刪除成功後重新載入清單。
- 底部說明列顯示目前行業的科目明細代碼對照 (`memoHint`，對齊 VFP `thisform.memo`)；格線狀態列顯示目前科目、科目明細與稅額註記。
- 右上角「快速篩選」輸入框以關鍵字重新查詢 (比對代號、名稱、長名稱、英文名稱)。

### 1.3 F3 複製標準總帳科目 (`Wbase4010BatchCopyModal.tsx`)

- 開啟時讀取 `GET /api/wbase4010/ref?mode=`：參考檔依序找 `<Drive>:\w3000\ref\80\xmaster{n}.dbf` (`n` 為空白或 2~6)、`F:\w3000\ref\80\`，都找不到時改讀目前的科目檔；只列出四碼總帳科目。
- 清單可用關鍵字篩選，目前科目檔已有的代號標示「已存在」。`↑`/`↓` 移動、`Space` 勾選、`Ctrl+Enter` 確定複製、`Esc` 離開；另有「全選 / 全消」按鈕。
- 送出 `POST /api/wbase4010/batch-copy`，後端略過已存在的代號，逐筆新增 (期初金額為 0，`serial` 由 VFP 接續最大值；複製期間被其他工作站新增的代號也會略過)，回傳實際新增筆數。

### 1.4 F4/F7 列印 (`wbase4010Print.tsx` + `Wbase4010PrintConditionModal.tsx`)

- **列印條件畫面 (`Wbase4010PrintConditionModal`，代號 `WBASE4010P`)**：以共用母版 `<FoxProRangePrintConditionModal />` 組成，標題「會計科目清冊列印 - {行業}」。起始 / 結束科目代號最多 12 碼、自動轉大寫，空白表示從頭 / 至尾；輸入框右側 `F2` 按鈕或按 `F2` 開 `<SearchModal />` 選科目 (比對代號、名稱、長名稱)。輸入的代號找得到時顯示科目名稱，並顯示「目前清冊符合：N 筆」。結束代號小於起始代號時擋下 `F7` / `F8`。`Enter` / `↓` 依序移到結束代號、「匯出 xlsx 設定」、「確定」按鈕，`↑` 回上一欄，`Esc` 關閉列印。
- 區間只篩選目前畫面上的資料 (頁面的 `rows`，含「快速篩選」後的結果)，列印與匯出都不另呼叫後端。
- **`F7` 確定 → 報表預覽**：開共用報表預覽 `<ReportPreviewModal />` (`reportId="wbase4010_account_list"`、直向、標題「{行業} - 會計科目對照表」)，欄位為序號 (`serial`，為 0 或空白時用列序)、科目代號、科目名稱、科目明細 (顯示中文說明)、稅額 (`*`)、長科目名稱。預覽可調整欄寬、列高、字型大小與縮放 (存於 `localStorage` 的 `wx3000_report_preview_wbase4010_account_list`，六個行業共用)；「編修」只改預覽內容，不回寫資料；「更新」以同一區間重新篩選畫面資料；匯出只有 PDF、JPG、Word (`.doc`)，檔名 `{行業}-會計科目對照表`。`F7` / `Ctrl+P` 直接印到右側列印設定所選的印表機 (選「Microsoft Print to PDF」時改為匯出 PDF；桌面版經 Electron `printHtml`，瀏覽器經 LocalAgent `POST /api/print/direct`)，`Ctrl+Shift+P` 開系統列印對話框，`Esc` 回到條件畫面。未設定雙擊追溯 (`onRowDrillDown`)。預覽母版規格見 `docs/frontend/components/foxpro_grid_SPEC.md` 第 8 節。
- **`F8` 匯出 Excel (`useFoxProPrintXlsxExport`)**：依已儲存的欄位設定 (`localStorage` `wbase4010_xlsx_export_config`，六個行業共用) 直接匯出 `{行業}_會計科目對照表.xlsx`；勾選「匯出 xlsx 設定」時先開 `<FormUtilSelectXlsxFieldsList />` 挑選欄位。預設勾選序號、科目代號、科目名稱、科目明細 (輸出代碼，不是中文說明)、稅額、長科目名稱，另可選英文名稱、歸屬科目、歸屬名稱。報表預覽本身沒有 Excel 匯出。
- 不呼叫 LocalAgent 報表 DLL (`wbaseRP.dll`)。

### 1.5 F8 尋找

`SearchModal` 以目前畫面上的資料搜尋科目代號或名稱，選定後移到該列。

### 1.6 快速鍵

| 按鍵 | 作用 |
| :--- | :--- |
| `Enter` / 數字、英文字母 | 編輯儲存格 (字元鍵覆蓋原值)；`Enter` 依目前方向移到下一格 |
| `Ins` / `Del` | 新增科目列 / 刪除科目 |
| `F2` / `F4` | 科目明細欄開「選擇科目明細類別」視窗 |
| `F3` | 複製標準總帳科目 |
| `F4` / `F7` | 開列印條件畫面 (畫面內 `F7` 預覽、`F8` 匯出 Excel；預覽內 `F7` 送印) |
| `F8` | 尋找 |
| `F12` | 切換 Enter 方向 (初始 → 往右) |
| `Esc` | 編輯中取消；依序關閉複製、尋找、刪除確認視窗；否則回主選單。列印時由條件畫面 / 預覽 / Excel 欄位設定自行處理：預覽回條件畫面，欄位設定只關自己，條件畫面關閉列印 |

頁面層的 keydown 註冊在 `window` 的一般 (bubble) 階段，並略過 `defaultPrevented` 的事件；`FoxProGridV2` 本身也在 `window` 監聽 `F3`、`F7`、`Esc`。列印條件畫面在 `window` 的 capture 階段攔截 `F7`、`F8`、`Esc`，報表預覽攔截 `F7`、`Ctrl+P`、`Ctrl+Shift+P`、`Esc`，都會停止事件傳遞。

- **列印開著時頁面與表格都不處理按鍵**：頁面的處理一開頭就略過 (`isPrintOpen`)，表格傳 `keyboardDisabled`。否則預覽內的 `F3` 會開複製視窗、`F8` 開尋找、`F12` 切換方向，`Ins` / `Del` / 方向鍵會作用到底下的表格，Excel 欄位設定的 `Esc` 會關掉整個列印。
- 複製、尋找、刪除確認開著時，頁面只處理 `Esc`，表格同樣停用按鍵。
- 表格也傳 `onShowSummary` (回主選單)：表格對 `Esc` 會 `preventDefault`，頁面的 `Esc` 處理就被略過；關閉列印等視窗後頁面重新註冊監聽，表格的監聽排在前面，沒有這個設定時 `Esc` 回不了主選單。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm`.`xmaster` ~ `xmaster6`)

六個行業各用一個 DBF，欄位相同；同步的唯一鍵為 `accno`。

| DBF 欄位 | 前端屬性 (`AccountItem`) | 型別 / 長度 | 說明 |
| :--- | :--- | :--- | :--- |
| `accno` | `accno` | C8 | 科目代號 (四碼以內為總帳科目) |
| `accname` | `accname` | C20 | 科目名稱 |
| `type` | `type` | C1 | 讀取用，本畫面不寫入 |
| `dept` | `dept` | C1 | 科目明細：`1`.進貨 `2`.進退 `3`.進折 `4`.銷貨 `5`.銷退 `6`.銷折 `7`.工程 `A`.應收帳款 `B`.應收票據 `C`.應付帳款 `D`.應付票據 `F`.固定資產 (前端另有 `G`/`H`/`I`/`T`/`P` 的顯示文字) |
| `taxcode` | `taxcode` | C1 | `*` = 自動產生 5% 稅額 |
| `accnamel` | `accnamel` | C60 | 長科目名稱 |
| `engaccname` | `engaccname` | C254 | 英文科目名稱 |
| `serial` | `serial` | N | 序號 |
| `ldamount` / `lcamount` | `ldamount` / `lcamount` | N | 期初借方 / 貸方金額 (新增時寫入，畫面不顯示) |
| `damount1`~`12` / `camount1`~`12` | - | N | 1~12 月借貸發生額，只用於新增明細科目與刪除的檢查 |
| `bpage1`、`bpage2`、`clsaccno`、`clsaccname` | `clsaccno` / `clsaccname` | - | 讀取用，本畫面不使用 |
| `_record_number` | `_record_number` | - | DBF 實體記錄號 |

- 寫入欄位：新增 `accno, accname, dept, taxcode, accnamel, engaccname, serial, ldamount, lcamount`；修改 `accname, dept, taxcode, accnamel, engaccname`。
- `AccountMaster` 雖登記在 `AppDbContext` (預設對應 `xmaster`)，但控制器以 ADO (`GetDbConnection()`) 依行業動態查詢 `"<schema>"."xmaster{n}"`。

---

## 3. 後端 API 規格 (`Wbase4010Controller.cs`)

所有路由以 `mode` (1~6，預設 1) 選擇 DBF；不符時視為 1。

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase4010?mode=&keyword=` | 科目清單，依 `accno` 排序；`keyword` 比對代號、名稱、長名稱、英文名稱 |
| `GET` | `/api/wbase4010/{accno}?mode=` | 單筆科目 (前端目前未使用) |
| `GET` | `/api/wbase4010/ref?mode=` | 參考檔的四碼總帳科目 (直接解析 DBF，不經 PostgreSQL)；失敗時回空陣列 |
| `POST` | `/api/wbase4010?mode=` | 新增科目 (重複、總帳科目、母科目不存在、母科目已有金額時回 400) |
| `PUT` | `/api/wbase4010/{accno}?mode=` | 修改名稱、科目明細 (不在 `pubdept` 回 400)、稅額、長名稱、英文名稱；查無回 404 |
| `DELETE` | `/api/wbase4010/{accno}?mode=` | 刪除科目 (總帳科目或有金額時回 400) |
| `POST` | `/api/wbase4010/batch-copy` | Body `{ mode, accnos }`，回傳 `{ success, copiedCount, totalRequested }` |

- 讀取前一律 `EnsureTableSyncedAsync(DbfPath, "xmaster{n}", PgSchema, "xmaster{n}", "accno")`。
- 寫入以 `WriteRecordAsync(..., "accno", 代號)` 先寫 DBF，成功後才寫 PostgreSQL 並更新 Checksum。`LOCK_TIMEOUT` (新增時另含 `DUPLICATE_KEY`) 回 409，其他 DBF 失敗回 500。
- 新增時 PostgreSQL 的 `_record_number` 使用 LocalAgent 回傳的 RECNO，並先刪除同代號或同 RECNO 的舊快照列再插入。
- 批次複製時個別科目寫入失敗會略過，只計入成功筆數。
- 前端 service 使用預設 `axios` (全域攔截器帶 `X-Data-Drive`)。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 進入作業 | 依科目代號重編 `serial`，並補英文科目名稱 (`initxmasterengaccname`) | 不重編、不補值 |
| 新增 | 先插入 `新科目` 佔位列並重編 `serial`，離開時刪除未完成的佔位列 | 前端新增空白列，列確認時才 `POST`，`serial` = 最大值 + 1 |
| 修改既有科目代號 | 允許 (`update_accno` 檢核後改代號) | 不允許，需刪除再新增 |
| 不合法的科目明細、稅額 | 靜默不寫入 | 阻斷並提示 |
| 刪除後的序號 | DBF 內大於該筆的 `serial` 減 1，再整批重編 | 只調整 PostgreSQL 快照的 `serial`，DBF 不重編 |
| F3 複製 | `wbase401012`，可先修改新科目代號再複製 | 只能照參考檔代號複製，已存在者略過 |
| F4 列印 | `wbase401011` 會計科目對照表 | 條件畫面 (`Wbase4010PrintConditionModal`) 輸入起訖科目代號，`F7` 開 `<ReportPreviewModal />` 預覽、送印或匯出 PDF / JPG / Word，`F8` 匯出 Excel；`F7` 亦可開啟列印 |
