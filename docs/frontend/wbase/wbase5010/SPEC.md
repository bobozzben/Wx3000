# 規格書：wbase5010 管理報表 (5-1 ~ 5-6)

> **模組代號**：`wbase5010` (選單 `wbase5010`~`wbase5060` 共用 `Wbase5010Index`，以 `initialTab` 決定顯示的畫面)  
> **功能名稱**：管理報表 (客戶資料列印、郵寄標籤、登打統計、營業狀況、財務狀況參考、委任書)  
> **所屬模組**：`frontend/src/wbase/wbase5010/` (service 在 `frontend/src/wbase/wbase5010/services/wbase5010.ts`) & `backend/Controllers/Wbase5010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base50.prg` `wbasemenu05cmd01`~`wbasemenu05cmd06` (5-1 `wbase4000` 選客戶 + `wbase2011` 列印、5-2 `wbase201201` + `wbase2012`、5-3 `wbase5030`、5-4 `wbase5040`、5-5 `wbase5050`、5-6 `SourS9BASE\FORMS\wbs_rep2.scx`)

---

## 1. 模組定位與職責

選單「500 管理報表」的六個項目都進入同一個頁面 `Wbase5010Index`：`wbaseMainPage.tsx` 的 `handleSelectAction` 依選單代號設定 `wbase5010Tab` 後顯示 `<Wbase5010Index initialTab={...} onClose={...} />`。畫面不顯示頁籤，要換畫面須回選單另選 510~560。

| 選單 | 代號 | 畫面標題 (`initialTab`) | 元件 |
| :--- | :--- | :--- | :--- |
| 510 客戶明細資料 | `wbase5010` | `5010` 5-1 客戶資料列印 | `Wbase5010_CustomerPrint.tsx` |
| 520 客戶郵遞標籤 | `wbase5020` | `5020` 5-2 郵寄標籤列印 | `Wbase5020_LabelPrint.tsx` |
| 530 客戶登打統計表 | `wbase5030` | `5030` 5-3 客戶登打統計表 | `Wbase5030_KeyinStats.tsx` |
| 540 客戶營業狀況表 | `wbase5040` | `5040` 5-4 客戶營業狀況表 | `Wbase5040_BusinessStatus.tsx` |
| 550 財務狀況參考表 | `wbase5050` | `5050` 5-5 客戶財務狀況參考表 | `Wbase5050_FinanceStatus.tsx` |
| 560 委任書輸入列印 | `wbase5060` | `5060` 5-6 委任書輸入維護 | `Wbase5060_BsdescForm.tsx` |

**共通行為**
- 頂部 `<WbasePageHeader />` (類別「管理報表」、標題為上表的畫面標題、代號 `wbase{initialTab}`、模式 `grid`)，下方直接是子頁畫面。
- **5-1 ~ 5-5 分兩段** (操作方式與 `wbase5070` 相同)：第一段「選擇客戶」(`Wbase50CustomerSelect`，見 1.1)，`Esc` 離開；**有選擇客戶才進入第二段**「列印條件」(`Wbase50ConditionForm`，見 1.2)，沒有選擇任何客戶時直接回主選單 (VFP 5-1、5-2 刪除未選擇的客戶後 `if !eof()` 才開列印表單)。第二段 `F7` 查詢並開預覽，`Esc` 回主選單；不能回到第一段重選。
- 5-6 的 `Esc` 直接回到 wbase 主選單。
- 格線都是 `<FoxProGridV2 />`：選擇客戶的格線除 5-2 的「列印份數」外唯讀；5-6 的條文欄位可編輯。
- 5-1 ~ 5-5 只讀資料；5-6 讀寫 `bsdesc.dbf`。
- 5-1 ~ 5-5 的報表在瀏覽器端輸出：5-1、5-3、5-4、5-5 用 `<FoxProPrintModal showFilter={false} />` (預覽表格、`printElement` 紙張列印、xlsx 匯出；不顯示起訖篩選列，客戶已在第一段決定)，5-2 用頁面自訂的標籤預覽視窗。本模組**沒有使用 `wbaseRP.dll`**，`localagent/dlls.json` 也沒有本模組的報表函數。
- 5-6 的 `F6` 委任書編修與 `F7` Word 委任書透過本機 LocalAgent 的 `/api/office/*` 操作 Word (見 1.8)；本機沒有 Word 或連不到 LocalAgent 時，`F7` 改開頁面自訂的網頁預覽視窗。
- xlsx 匯出走 service 的 `exportReportToXlsx(data, fields, fileName)`：只輸出 `selected` 的欄位，以 `customTitle` (無則 `label`) 為欄名。

### 1.1 第一段：選擇客戶 (5-1 ~ 5-5 共用，`Wbase50CustomerSelect.tsx`)

- 開啟時 `useWbase50Customers` (`wbase50Shared.ts`) 呼叫 `GET /api/wbase5010/customers`，排除代號空白的客戶，**在前端依代號排序** (VFP 以 `tag no` 複製成 `tmpcust`)，全部未選擇、份數 0；不讀也不寫 `customer.sel`。讀取失敗以訊息視窗顯示。
- 兩種畫面 (`mode`)：

| `mode` | 用於 | VFP | 第一欄 | 「已選擇」的判斷 |
| :--- | :--- | :--- | :--- | :--- |
| `select` | 5-1、5-3、5-4、5-5 | `wbase4000` 報表列印多家選單 | 選擇 (`→`，點選也可切換) | `selected` |
| `copies` | 5-2 | `wbase201201` 報表列印多家選單 (標籤用) | 列印份數 (可編輯，只收數字、最多 2 碼，VFP `InputMask "99"`) | 份數大於 0 |

- 其餘兩欄為公司編號、公司名稱；狀態列顯示「已選擇 n 家」(5-2 另顯示「共 n 份」)。`gridId`：`wbase5010_cust_grid`、`wbase5020_label_grid`、`wbase5030_cust_grid`、`wbase5040_cust_grid`、`wbase5050_cust_grid`。
- 按鍵在 `window` 的 capture 階段攔截 (`FoxProGridV2` 自己也聽 `F3`/`F7`/`Esc`)；焦點在格線的輸入框 (5-2 正在編輯份數) 時交給格線：

| 按鍵 | `select` (VFP `wbase4000`) | `copies` (VFP `wbase201201`) |
| :--- | :--- | :--- |
| `Enter` | 切換目前列的選擇並移到下一列 (末筆停在末筆) | 編輯份數；輸入完 `Enter` 存入並往下一列 (`enterDirection="down"`)。直接打數字也會開始編輯 |
| `Space` | 開「客戶區間」 | 份數 0 / 1 切換並移到下一列 (VFP `space.Click`) |
| `F3` / `F4` | 全選 / 全不選 | 全部 1 份 / 全部 0 份 |
| `F8` | 開「客戶區間」 | 開「客戶區間」，區間內設為 1 份 |
| `F2` | 開客戶選單 (`SearchModal`)，選到的客戶設為選擇並移到該列；已選擇時提示「客戶已經選擇!!」 | - |
| `F7` | 開「查詢客戶」(`SearchModal`)，只移動游標，不改選擇 | 同左 |
| `Esc` | 離開第一段 (有選擇進第二段，沒有回主選單) | 同左 (看份數) |

- 客戶區間沿用 `wbase5070/Wbase5070RangeModal` (VFP `wbase4001` / `wbase201202`)：起始、結束客戶 (轉大寫、最多 8 字，空白代表第一筆 / 最後一筆)，`F8` 確定後代號在區間內的客戶設為選擇，區間外不變；代號欄 `F2` 開客戶選單、`Esc` 放棄。
- 格線修改份數後份數轉成 0~99 的整數，份數大於 0 的同時設 `selected` (VFP `Text1.LostFocus` 份數不為 0 時設 `mselect`)。

### 1.2 第二段：列印條件 (`Wbase50ConditionForm.tsx`)

- 置中的條件視窗 (標題同 VFP 表單 Caption)，欄位分兩種：
  - **選項欄** (VFP optiongroup)：`←`/`→`/`Space` 換選項，數字鍵 `1`~`n` 直接選第 n 個，也可點選。
  - **文字欄** (VFP textbox)：只收數字或轉大寫依欄位而定；`Enter` 離開時檢核，錯誤時留在原欄並選取內容 (直接打字即覆蓋)；有選單的欄位按 `F2` 開選單。
- `Enter`/`↓` 下一欄 (最後一欄到「F7 列印」鈕，再按 `Enter` 等於 `F7`)、`↑` 上一欄。下方顯示「已選擇 n 家客戶」與按鍵列 (`KeyHintBar`)。
- **`F7`**：依序檢核所有文字欄，錯誤時停在該欄；通過後查詢並開預覽 (5-2 為產生標籤)。預覽關閉後回到條件視窗，可改條件再印 (VFP `_form_print` 同樣可重複列印)。
- **`Esc`**：放棄，回主選單。預覽或選單開啟時條件視窗不處理 `F7`/`Esc`。
- 共用檢核 (`wbase50Shared.ts`)：`requireYear`「年度不可空白!」、`validMonth`「請輸入1至12 月份!」(VFP `smonth.Valid` / `emonth.Valid` 寫成 `!(value>=1 OR value<=12)` 實際不會擋；照訊息原意限制 1~12，與 `wbase5070` 相同)、`validEndMonth`「結束月份比起始月份小!」、`validEndCode` (終止代號小於起始代號)。年度預設今天的民國年 3 碼 (`currentRocYear()`)。
- VFP `_form_print` 的輸出方式 (`op1` 預覽 / 立即 / 指定 / Excel / PDF)、`F6` 設定印表機不移植；網頁版一律開預覽，由預覽視窗紙張列印或匯出 Excel。

### 1.3 5-1 客戶資料列印 (`Wbase5010_CustomerPrint.tsx`)

VFP：`wbasemenu05cmd01` → `wbase4000` 選擇客戶 → `wbase2011` 客戶資料列印。

- 第二段條件 (依 VFP `TabIndex` 順序，預設都是第 1 個)：

| 條件 | 選項 | 說明 |
| :--- | :--- | :--- |
| 排列順序 | `1` 依客戶編號 / `2` 依統一編號 / `3` 依稅籍編號 | `orderType`，後端排序 |
| 報表種類 | `1` 基本資料 / `2` 詳細資料 | `reportType`，只影響報表標題與 xlsx 檔名 (`客戶資料清單_基本` / `客戶資料清單_詳細`) |
| 列印地址 | `1` 公司地址 / `2` 聯絡地址 | `addrType`，只影響預覽的地址欄：聯絡地址空白時改印公司地址。VFP 第三個選項「公司.聯絡地址」隱藏且停用，網頁版不提供 |
| 分組排序 | `1` 依客戶編號排序 / `2` 依登打人員排序 | `groupType`，`2` 時後端先依登打人員排序 |

- VFP `wbase2011` 的起始、終止編號隱藏 (客戶已在第一段選定)，網頁版也沒有。
- **F7**：`POST /api/wbase5010/print/customer-data`，`selectedNos` 為第一段選擇的全部客戶代號。
- 預覽欄：代號、簡稱、客戶名稱、統一編號、稅籍編號、負責人、公司電話、地址 (依列印地址)、登打人員 (姓名)。
- Excel 預設 18 欄：客戶代號、簡稱、客戶全稱、統一編號、稅籍編號、負責人、聯絡人、電話、手機、傳真、公司地址、聯絡地址、E-mail、登打人員、人員姓名、組織類別、行業代號、資本額。在 `FoxProPrintModal` 勾選「匯出設定」可開 `<FormUtilSelectXlsxFieldsList />` 調整。

### 1.4 5-2 郵寄標籤列印 (`Wbase5020_LabelPrint.tsx`)

VFP：`wbasemenu05cmd02` → `wbase201201` 設定各客戶列印份數 → 刪除份數 0 的客戶 → `wbase2012` 郵寄標籤列印。

- 第一段為 `copies` 畫面 (見 1.1)。
- 第二段條件 (依 VFP `TabIndex` 順序；預設值同 VFP `wbase2012.Init`)：

| 條件 | 選項 | 預設 |
| :--- | :--- | :-: |
| 標籤種類 | `1` 磁片標籤 / `2` 郵遞標籤 | 1 |
| 列印樣式 | `1` 橫式 (2 欄) / `2` 直式 (3 欄) | 1 |
| 列印地址 | `1` 公司地址 / `2` 聯絡地址 | 1 |
| 收信人 | `1` 負責人 / `2` 聯絡人 | 2 |

- **F7 標籤列印**：份數大於 0 的客戶 (依代號順序) 送 `POST /api/wbase5010/print/labels` 的 `items`，由後端依份數展開；沒有任何標籤時提示「無資料可列印!!」，失敗以訊息視窗顯示。成功後開「郵寄標籤排版預覽」：
  - 每張標籤：`[客戶代號]`、「國內郵資已付」、地址 (選聯絡地址而聯絡地址空白時用公司地址)、客戶名稱、收件人 (選聯絡人而聯絡人空白時用負責人) 加「先生/女士 收」、電話。
  - `F7` 紙張直接列印 (`printElement`)、`F8` 匯出 Excel (份數大於 0 的客戶名冊：代號、簡稱、客戶名稱、負責人、聯絡人、電話、地址、份數，不經欄位選擇視窗)、`Esc` 關閉。
- 標籤種類只隨查詢送到後端，前端排版與後端目前都沒有使用。VFP 的「起始行數」(`prncol` 1~3) 與隱藏的「A4」「大張套表(高雄)」網頁版沒有提供。

### 1.5 5-3 客戶登打統計表 (`Wbase5030_KeyinStats.tsx`)

VFP：`wbasemenu05cmd03` → `wbase5030` (VFP 沒有選擇客戶的畫面，以客戶起始、終止編號限定範圍；網頁版改由第一段選擇客戶，條件畫面不再有客戶起訖)。

- 第二段條件：

| 條件 | 規則 |
| :--- | :--- |
| 登打人員起始編號 | 轉大寫、最多 10 碼 (VFP `InputMask "!!!!!!!!!!"`)；空白代表第一位；`F2` 開「資料處理人員選單」(`SearchModal`，`GET /api/wbase1030` 的 `fetchEmps`) |
| 終止編號 | 同上；空白代表最後一位；比起始編號小時「終止編號比起始編號小!」 |
| 資料年度 | 今天的民國年 3 碼，只收數字；不可空白 |

- VFP 的「營業稅申報年月」網頁版沒有提供。
- **F7**：`POST /api/wbase5010/print/keyin-stats` `{ year, startKeyin, endKeyin, selectedNos }`：每位客戶一列 (`customer` LEFT JOIN `keyin` 取人員姓名)，依登打人員、客戶代號排序，不做筆數彙總。
- 預覽欄：人員代號、人員姓名、客戶代號、客戶名稱、統一編號、稅籍編號、電話、地址。
- 資料年度只出現在報表標題與 xlsx 檔名 (`客戶登打統計表_{年度}年度`)，不是查詢條件。

### 1.6 5-4 客戶營業狀況表 (`Wbase5040_BusinessStatus.tsx`)

VFP：`wbasemenu05cmd04` → `wbase5040` (客戶起訖改由第一段選擇客戶決定)。

- 第二段條件：資料年度 (今天的民國年 3 碼，不可空白)、營業起始月份 (預設 `01`)、結束月份 (預設 `12`)；月份須為 1~12，結束月份不可小於起始月份。
- **F7**：`POST /api/wbase5010/print/business-status` `{ year, startMonth, endMonth, selectedNos }` (月份補成 2 碼)：只讀 `customer`，欄位為客戶代號、客戶全稱、統一編號、稅籍編號、負責人、公司電話、行業代號 (`pno`)、資本額 (千分位)、公司地址。
- 目前**沒有讀取任何營業額資料**：年度只用於標題與檔名，起訖月份由後端原樣回填到每列 (`startMonth`、`endMonth`，xlsx 的「起月」「迄月」欄)。

### 1.7 5-5 客戶財務狀況參考表 (`Wbase5050_FinanceStatus.tsx`)

VFP：`wbasemenu05cmd05` → `wbase5050` (客戶起訖改由第一段選擇客戶決定)。

- 第二段條件：列印結算年度 (今天的民國年 3 碼，不可空白)。
- **F7**：`POST /api/wbase5010/print/finance-status` `{ year, selectedNos }`：只讀 `customer`，欄位為客戶代號、客戶名稱、統一編號、稅籍編號、資本額、負責人、公司電話、公司地址。
- 目前**沒有讀取任何財務資料**：結算年度由後端原樣回填到每列 (`year`，xlsx 的「年度」欄)。

### 1.8 5-6 委任書輸入維護 (`Wbase5060_BsdescForm.tsx`)

維護 `bsdesc.dbf` 的委任書條文；`F6` 在本機以 Word 開啟委任書範本，`F7` 以範本轉出 Word 委任書 (本機沒有 Word 時改開網頁預覽)。

- **表頭**：委任日期 (預設 `115/01/01`)、負責人證號 (轉大寫)、結算年度 (預設 `115`)。只用於列印，不存檔 (VFP 會存到 `wbase001.txt`，見第 4 節)。
- **格線** (`gridId="wbase5060_bsdesc_grid"`)：

| 欄 | 欄位 | 可編輯 | 規則 |
| :--- | :--- | :-: | :--- |
| 指標 | `sel` | 點選 | `→` 或空白，點選切換並立即存檔 |
| 順序 | `seq` | ✗ | |
| 條文代號 | `no` | ✔ | 轉大寫，`maxLength` 10 |
| 委任書條文 / 查核程序說明 | `desc` | ✔ | 行內編輯 (單行輸入框，條文內的換行在編輯存檔後會消失) |

- 行內編輯確認後由 `onSaveRow` 呼叫 `PUT /api/wbase5010/bsdesc/{seq}` 自動存檔，結果顯示在狀態列。
- **Ins 新增**：`POST /api/wbase5010/bsdesc` 新增空白條文 (`seq` = 目前最大 `seq` + 1、`sel` = `→`)，加在清單最後。
- **Del 刪除**：`window.confirm`「確定要刪除第 n 條文嗎？」後 `DELETE /api/wbase5010/bsdesc/{seq}`。
- **F4 複製**：把目前條文的 `no`、`desc`、`sel` 複製成新的一筆 (`POST`)。
- **Space**：焦點不在輸入框時切換目前條文的 `sel` 並存檔。
- 「目前條文」是頁面的 `selectedRowIndex`，只在新增、複製、刪除後改變，**沒有接 `FoxProGridV2` 的 `onSelectRow`**，所以不會隨格線游標移動。
- `F6`、`F7` 由頁面在 `window` 的 capture 階段攔截並 `stopPropagation` (`FoxProGridV2` 也在 `window` 監聽 `F7` 呼叫 `onOpenPrint`，不攔下會執行兩次)；格線狀態列的「F7 列印」按鈕與頁面按鈕走同一個 `handlePrint`。Word 作業進行中兩個按鈕停用，重複按鍵不會再執行。

#### F6 委任書編修 (VFP `wbs_rep2.F6.Click`)

- LocalAgent `POST /api/office/word/open` `{ template: "bsdesc", drive: getDataDrive() }`：以 ShellExecute (預設程式) 開啟 `<資料磁碟機>:\W3000\comm\wbase001.DOC`，使用者直接修改範本後在 Word 存檔。
- 成功時狀態列顯示範本路徑；失敗 (範本不存在、連不到 LocalAgent、LocalAgent 版本過舊回 404) 時 `window.alert` 並顯示在狀態列。

#### F7 委任書列印 (VFP `wbs_rep2.F7.Click` + `gutil.prg` `Pap1` / `decode_Pa1`)

1. 同 VFP，結算年度、委任日期、負責人證號都必填，缺的依序 `window.alert`「請輸入結算年度 / 委任日期 / 負責人證號」並把焦點移到該欄。
2. **要印的條文**：`selectBsdescForPrint(rows)` — 指標 (`sel`) 不是空白的條文，依 `seq` 排序 (同 VFP `SCAN FOR !EMPTY(sel)`)。轉出 Word 的 `[THINGS]` 與網頁預覽都用這個函式，內容一定相同。一筆都沒有勾選時，在判斷 Word 之前先 `window.confirm`「沒有勾選任何條文 (指標欄)，委任內容會是空白。仍要列印嗎？」：取消就不列印 (狀態列「沒有勾選條文，已取消列印」)，確定則照常轉出 Word 或開網頁預覽，委任內容空白 (VFP 不提示，直接印出空白內容)。
3. `GET http://localhost:5009/api/office/status`：
   - 連不到 LocalAgent、LocalAgent 太舊 (404) 或本機沒有 `Word.Application` → 開**網頁預覽** (下方)，狀態列說明原因。
   - 有 Word → 繼續。
4. `GET /api/wbase1010/office` 讀事務所資料 (失敗時事務所欄位改用假字串)，以 `buildBsdescWordRequest` 組出內容，送 LocalAgent `POST /api/office/word/merge` `{ template: "bsdesc", drive, paragraphs, copies: [巨集值] }`。
5. LocalAgent 把 `<資料磁碟機>:\W3000\comm\wbase001.DOC` 複製成暫存檔當底、取代巨集後另存 `%TEMP%\Wx3000\委任書_yyyyMMdd_HHmmss.docx` 並開啟。成功時狀態列顯示檔案路徑；失敗時 `window.alert` 錯誤後改開網頁預覽。

**範本內文位置**：`wbase001.DOC` (Word 97-2003) 第 2 段「一、委任內容及權限」之後的第 3 段整段是 `[THINGS]`；條文從這裡開始一筆一段，沿用該段格式 (標楷體 12)，後面接範本原有的空白段與「二、委任人…」。

**巨集對照** (`BSDESC_MACRO_LABELS`；VFP 每個巨集只換第一個出現處，網頁版每份文件內全部取代)：

| 巨集 | VFP 來源 | 網頁版 |
| :--- | :--- | :--- |
| `[THINGS]` | `bsdesc` 中 `sel` 不空白的條文，依 `seq`，每筆 `ALLTRIM(desc)` + 換行 | `selectBsdescForPrint` 選出的條文，每筆一段 (`desc` 去頭尾空白，不截成 254 bytes；條文內換行變成段內手動換行) |
| `[COMPNAME]`、`[COMPUNINO]`、`[COMPADDR]`、`[COMPTEL]`、`[COMPHNAME]` | `m.compname` 等，取自 `base.dbf` `000A`、`000B`、`0001`、`0002`、`0004` | `GET /api/wbase1010/office` 的 `name`、`taxNo`、`addr`、`tel`、`boss` |
| `[COMPHIDNO]` | 畫面負責人證號 | 同左 |
| `[RPDATE]` | `w_chin_date(委任日期)` | `rocDateToChinese`：民國年三碼逐字轉國字 (兩碼且 0~33 加 100)，月、日依 `chin_chk` 轉國字，例如 `115/01/01` → `一一五 年 一 月 一 日 ` |
| `[NAME]`、`[HNAME]`、`[HIDNO]`、`[UNINO]`、`[ADDR]`、`[TEL]`、`[ENGNAME]`、`[MEMO]`、`[MEMO01]`~`[MEMO03]`、`[BKCNO1]`~`[BKCNO3]`、`[CAPITAL]`、`[CAPITALBIG5]`、`[RECAMT]`、`[RECAMTBIG5]` | F7 先勾選的客戶 (`customer`) | 假字串 |
| `[CNO2]` | `cpa.cno2` (依客戶 `cpano`) | 假字串 |

- 假字串為 `【中文名稱】`，例如 `【委任人名稱】`、`【資本額大寫】`；有對應來源但值是空白時也用假字串，方便在 Word 裡看出要補的地方。

**網頁預覽** (本機沒有 Word 或轉出失敗時)：A4 預覽 —「委　任　書」標題、委任日期與結算年度、`selectBsdescForPrint` 選出的條文 (與 Word 相同，只列指標有勾的，依 `seq`；每筆印 `seq、desc`，所以順序號可能不連續)、簽章區 (營利事業與事務所各欄空白，只帶入表頭的負責人身分證號)。預覽內「紙張直接列印」(`printElement`)、「匯出 Excel」(順序、條文代號、內容說明、記號；這是條文清單，仍匯出**全部**條文，以「記號」欄標示是否勾選)。

- service 另有 `batchSaveBsdesc` (`PUT /bsdesc/batch`)，畫面目前沒有呼叫。

### 1.9 快速鍵

| 按鍵 | 第一段 5-1、5-3 ~ 5-5 | 第一段 5-2 | 第二段 5-1 ~ 5-5 | 5-6 |
| :--- | :--- | :--- | :--- | :--- |
| `Enter` | 選擇 / 取消並移到下一列 | 編輯份數，完成後往下一列 | 下一欄 (最後一欄到 F7 鈕) | 編輯條文代號、說明 |
| `Space` | 客戶區間 | 份數 0 / 1 切換並移到下一列 | 選項欄換選項 | 切換指標 |
| `←` / `→` | - | - | 選項欄換選項 | - |
| `F2` | 指定客戶 | - | 文字欄開選單 (5-3 登打人員) | - |
| `F3` / `F4` | 全選 / 全不選 | 全部 1 份 / 全部 0 份 | - | `F4` 複製條文 |
| `F6` | - | - | - | 以 Word 開啟委任書範本 |
| `F7` | 查詢客戶 (只移動游標) | 查詢客戶 | 查詢並開預覽 (5-2 產生標籤) | 轉出 Word 委任書 (沒有 Word 時網頁預覽) |
| `F8` | 客戶區間 | 客戶區間 (區間內 1 份) | - | - |
| `Ins` / `Del` | - | - | - | 新增 / 刪除條文 |
| `Esc` | 有選擇進第二段，沒有回主選單 | 有份數進第二段，沒有回主選單 | 回主選單 | 回主選單 |

- `<FoxProPrintModal />` 開啟時 (5-1、5-3 ~ 5-5)：`F7` 紙張列印、`F8` 匯出 Excel、`Esc` 關閉。5-2 的標籤預覽相同 (`F7` 紙張列印、`F8` 匯出 Excel、`Esc` 關閉)。
- 5-6 的委任書網頁預覽是頁面自訂視窗，只能以按鈕操作 (未綁定 `Esc`、不會自動聚焦)。

---

## 2. 檔案結構與資料表

```text
frontend/src/wbase/wbase5010/
├── index.tsx                      # Wbase5010Index：WbasePageHeader + 依 initialTab 顯示子頁 (不顯示頁籤)
├── Wbase50CustomerSelect.tsx      # 5-1 ~ 5-5 第一段選擇客戶 (select：VFP wbase4000；copies：VFP wbase201201)
├── Wbase50ConditionForm.tsx       # 5-1 ~ 5-5 第二段列印條件 (選項欄、文字欄、F7 列印、Esc 放棄)
├── wbase50Shared.ts               # useWbase50Customers、isCustomerChosen、toCopies、條件檢核 (年度、月份、起訖)
├── Wbase5010_CustomerPrint.tsx    # 5-1 客戶資料列印 (條件 VFP wbase2011 + FoxProPrintModal)
├── Wbase5020_LabelPrint.tsx       # 5-2 郵寄標籤列印 (條件 VFP wbase2012 + 標籤排版預覽)
├── Wbase5030_KeyinStats.tsx       # 5-3 客戶登打統計表 (條件 VFP wbase5030，登打人員 F2 選單)
├── Wbase5040_BusinessStatus.tsx   # 5-4 客戶營業狀況表 (條件 VFP wbase5040)
├── Wbase5050_FinanceStatus.tsx    # 5-5 客戶財務狀況參考表 (條件 VFP wbase5050)
├── Wbase5060_BsdescForm.tsx       # 5-6 委任書條文維護、F6 開範本、F7 轉出 Word / 網頁預覽
└── services/
    └── wbase5010.ts               # Axios client (預設 axios，全域攔截器帶 X-Data-Drive) + exportReportToXlsx
                                   # + 5-6 Word 套印內容 (buildBsdescWordRequest、rocDateToChinese、BSDESC_MACRO_LABELS)

frontend/src/services/localagent.ts    # getOfficeStatus、openWordTemplate、mergeWordTemplate (LocalAgent /api/office/*)
                                       # 另沿用 wbase5070/Wbase5070RangeModal (客戶區間)、wbase2030/Wbase2030Dialogs (MessageDialog)、
                                       # wbase2040/KeyHintBar、services/wbase1030 fetchEmps (5-3 登打人員選單)
localagent/agent.js                    # WORD_TEMPLATES.bsdesc = wbase001.DOC 與 Word 套印腳本

backend/
├── Controllers/Wbase5010Controller.cs   # ADO + DTO (GetDbConnection)，讀取前 EnsureTableSyncedAsync
└── Models/Wbase5010Models.cs            # 查詢參數與回傳 DTO
```

### 讀寫的表 (`<drive>:/w3000/comm`)

| 表 | 同步 keyFields | 用途 |
| :--- | :--- | :--- |
| `customer` | `no` | 5-1 ~ 5-5 唯讀 |
| `keyin` | `no` | 5-1、5-3 取登打人員姓名 (`TRIM(k.no) = TRIM(c.keyin)`) |
| `bsdesc` | `seq` | 5-6 讀寫 |

### `customer` 使用欄位

`no` 客戶代號、`abbr` 簡稱、`name` 名稱、`unino` 統一編號、`taxno` 稅籍編號、`hname` 負責人、`linkman` 聯絡人、`tel`、`mobile`、`fax`、`addr` 公司地址、`invaddr` 聯絡地址、`email`、`keyin` 登打人員、`orga` 組織型態、`pno` 行業代號、`pnostd`、`offno`、`offno1`、`cpano`、`capital` 資本額、`serial` (後端客戶清單的排序；5-1 ~ 5-5 的選擇客戶畫面在前端改依代號排序)。

`orga` 由後端轉成 `organame`：`1` 股份有限公司、`2` 有限公司、`3` 無限公司、`4` 兩合公司、`5` 合夥、`6` 獨資、`7` 國外分公司、`8` 國外辦事處、`9` 其它。

### `bsdesc` (委任書條文)

正式資料 `C:\w3000\comm\bsdesc.dbf` 的結構：

| 欄位 | DBF 型別 | 說明 |
| :--- | :--- | :--- |
| `sel` | C2 | 指標，`→` 或空白 |
| `no` | C8 | 條文代號 (前端 `maxLength` 為 10) |
| `desc` | M | 條文內容 |
| `serial` | N4 | 新增時等於 `seq`；批次重編時用來定位 |
| `seq` | N11 | 順序，寫入時的定位鍵 |

寫入一律先 `WriteRecordAsync` 寫 DBF，成功後才以 SQL 更新 PostgreSQL，再更新 Checksum：

| 動作 | operation | keyField | 寫入欄位 |
| :--- | :--- | :--- | :--- |
| 新增 | `INSERT` | `seq` | `seq`、`no`、`desc`、`sel`、`serial` (= `seq`)；PostgreSQL 的 `_record_number` 取現有最大值 + 1 |
| 修改 | `UPDATE` | `seq` | `no`、`desc`、`sel` |
| 刪除 | `DELETE` | `seq` | - |
| 批次重編 | `UPDATE` | `serial` (舊值) | `seq`、`serial` 依清單順序重編為 1..n，另寫 `no`、`desc`、`sel` |

---

## 3. 後端 API 規格 (`Wbase5010Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase5010/customers?keyword=` | 客戶清單 (`no, abbr, name, unino, hname, linkman, tel, addr, invaddr, recordNumber`，`prn=1`、`selected=false`)，依 `serial`、`no` 排序；keyword 不分大小寫比對代號、名稱、簡稱，並比對統編 |
| `POST` | `/api/wbase5010/print/customer-data` | Body `{ startNo, endNo, reportType, addrType, groupType, orderType, selectedNos }`；起訖以字串比較 `no`，`selectedNos` 以單一陣列參數 `TRIM(no) = ANY(@selectedNos)` 篩選 (畫面一律傳第一段選擇的客戶)；`orderType` 1 `no`、2 `unino, no`、3 `taxno, no`，`groupType=2` 時先依登打人員；`reportType`、`addrType` 未使用；回傳含 `keyinna`、`organame` |
| `POST` | `/api/wbase5010/print/labels` | Body `{ startNo, endNo, labelType, layoutType, addrType, recipientType, copies, startRow, isA4, isKaohsiungFormat, items }`；有 `items` 時依各筆 `prn` (<= 0 視為 1) 展開，不重讀資料庫；沒有 `items` 時依起訖讀 `customer` (依 `no` 排序)，每家展開 `copies` 張；其餘選項未使用 |
| `POST` | `/api/wbase5010/print/keyin-stats` | Body `{ year, startNo, endNo, startKeyin, endKeyin, selectedNos }`；依 `keyin`、`no` 排序；`year` 未使用 |
| `POST` | `/api/wbase5010/print/business-status` | Body `{ year, startMonth, endMonth, startNo, endNo, selectedNos }`；依 `no` 排序；`startMonth`、`endMonth` 原樣回填 (未傳時 `01`、`12`) |
| `POST` | `/api/wbase5010/print/finance-status` | Body `{ year, startNo, endNo, selectedNos }`；依 `no` 排序；`year` 原樣回填 |

- 四個 `print/*` 查詢的 `selectedNos` 規則相同：有值時以 `TRIM(no) = ANY(@selectedNos)` 只列這些客戶，沒傳或空陣列時不篩選。畫面已不送 `startNo`、`endNo` (客戶由第一段選擇)，API 仍接受。
| `GET` | `/api/wbase5010/bsdesc` | 委任書條文，依 `seq`、`serial` 排序 |
| `POST` | `/api/wbase5010/bsdesc` | 新增；`seq > 0` 時用傳入值，否則取 PostgreSQL `MAX(seq) + 1`；回傳 `{ success, seq }` |
| `PUT` | `/api/wbase5010/bsdesc/{seq}` | 修改 `no`、`desc`、`sel` |
| `DELETE` | `/api/wbase5010/bsdesc/{seq}` | 刪除 |
| `PUT` | `/api/wbase5010/bsdesc/batch` | Body `{ rpdate, comphidno, endyear, items }`；依 `items` 順序重編 `seq`、`serial`；`rpdate`、`comphidno`、`endyear` 未使用；畫面未呼叫 |

- 讀取前一律 `EnsureTableSyncedAsync` (keyFields 見第 2 節)。
- DBF 寫入失敗回 500 `{ error, message }` (例如「寫入 bsdesc.dbf 失敗」)，不寫 PostgreSQL；沒有把 `LOCK_TIMEOUT` 轉成 409。其他例外回 500 `{ error }`。
- 前端查詢失敗：5-1、5-3 ~ 5-5 顯示在預覽視窗的表格區，5-2 與客戶清單讀取失敗以訊息視窗顯示；5-6 顯示在狀態列。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 5-1 流程 | 先開 `wbase4000` 勾選客戶，再開 `wbase2011` 列印 | 同 VFP 分兩段；列印一律開網頁預覽 (不移植 `_form_print` 的輸出方式與印表機設定) |
| 5-3 ~ 5-5 客戶範圍 | 直接開條件表單，以客戶起始、終止編號限定 | 先開與 5-1 相同的選擇客戶畫面，條件畫面不再有客戶起訖 |
| 5-3 營業稅申報年月、5-2 起始行數 | 條件表單上有 (`tx_up`、`prncol` 1~3) | 不提供 |
| 5-1 開啟時回寫 | `pnostd` 空白且 `pno` 在 `class107` 找得到的客戶，回寫 `pnostd = pno` | 不回寫 (唯讀) |
| 5-1 關聯資料 | 關聯行業 (`class107`)、國稅局 (`taxof`)、稅捐處 (`taxof1`)、會計師 (`cpa`) | 只 JOIN `keyin` 取登打人員姓名；`pno`、`pnostd`、`offno`、`offno1`、`cpano` 只回傳代碼 |
| 5-2 流程與順序 | `wbase201201` 設定張數 → 展開後依客戶代號建索引 → `wbase2012` 列印 | 同 VFP 分兩段；標籤依客戶代號順序展開 |
| 5-5 資料 | 開 `refpath` 的 `XPROFIT` (資產負債表資產表格檔) 建立暫存表 | 只列客戶基本欄位 |
| 5-6 開啟的表 | `cpa`、`customer`、`bsdesc` (`wbs_rep2.scx`)，格線欄 `sel`、`seq`、`desc` | 只讀寫 `bsdesc`；格線多一個可編輯的 `no`；委任書網頁預覽的營利事業、事務所欄位留白 |
| 5-6 表頭 | 開啟時從 `commpath\wbase001.txt` 讀出結算年度、委任日期 (`99/99/99`)、負責人證號，關閉與 F7 時寫回 | 不讀也不寫 `wbase001.txt`，每次開啟都是預設值 |
| 5-6 條文全文 | Enter 在說明欄開多行 editbox | 只有單行行內編輯 (原本的 F6 全文編輯視窗已移除) |
| 5-6 F7 委任人 | 先開 `wbase4000` 勾選客戶，每家一份 (分頁接續)；讀各客戶 `<年度>\tx_01.dbf` 代理申報人，自行申報 (`3`) 的不印；`[CNO2]` 取 `cpa` | 不選客戶，固定一份，委任人欄位與 `[CNO2]` 用假字串 (LocalAgent 的 `copies` 已可接受多份) |
| 5-6 F7 輸出 | Word 開啟暫存 `.DOC`，不另存 | 另存 `%TEMP%\Wx3000\委任書_*.docx` 後開啟；本機沒有 Word 時改用網頁預覽 |
| 5-6 巨集取代 | 依序 `Find/Replace` (wdReplaceOne)，`[THINGS]` 超過 255 字時 Word 會失敗；條文內容含巨集名稱時會被誤換 | 每份從開頭單次掃描，以 `Range.Text` 取代，沒有長度限制，換上的內容不會再被取代 |
