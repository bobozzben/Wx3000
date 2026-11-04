# 規格書：wbase5010 管理報表 (5-1 ~ 5-6)

> **模組代號**：`wbase5010` (選單 `wbase5010`~`wbase5060` 共用 `Wbase5010Index`，以 `initialTab` 切換子頁籤)  
> **功能名稱**：管理報表 (畫面標題「5. 客戶資料列印與委任書管理」：客戶資料列印、郵寄標籤、登打統計、營業狀況、財務狀況參考、委任書)  
> **所屬模組**：`frontend/src/wbase/wbase5010/` (service 在 `frontend/src/wbase/wbase5010/services/wbase5010.ts`) & `backend/Controllers/Wbase5010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base50.prg` `wbasemenu05cmd01`~`wbasemenu05cmd06` (5-1 `wbase4000` 選客戶 + `wbase2011` 列印、5-2 `wbase201201` + `wbase2012`、5-3 `wbase5030`、5-4 `wbase5040`、5-5 `wbase5050`、5-6 `SourS9BASE\FORMS\wbs_rep2.scx`)

---

## 1. 模組定位與職責

選單「500 管理報表」的六個項目都進入同一個頁面 `Wbase5010Index`：`wbaseMainPage.tsx` 的 `handleSelectAction` 依選單代號設定 `wbase5010Tab` 後顯示 `<Wbase5010Index initialTab={...} onClose={...} />`。

| 選單 | 代號 | 頁籤 (`initialTab`) | 元件 |
| :--- | :--- | :--- | :--- |
| 510 客戶明細資料 | `wbase5010` | `5010` 5-1 客戶資料列印 | `Wbase5010_CustomerPrint.tsx` |
| 520 客戶郵遞標籤 | `wbase5020` | `5020` 5-2 郵寄標籤列印 | `Wbase5020_LabelPrint.tsx` |
| 530 客戶登打統計表 | `wbase5030` | `5030` 5-3 客戶登打統計表 | `Wbase5030_KeyinStats.tsx` |
| 540 客戶營業狀況表 | `wbase5040` | `5040` 5-4 客戶營業狀況表 | `Wbase5040_BusinessStatus.tsx` |
| 550 財務狀況參考表 | `wbase5050` | `5050` 5-5 客戶財務狀況參考表 | `Wbase5050_FinanceStatus.tsx` |
| 560 委任書輸入列印 | `wbase5060` | `5060` 5-6 委任書輸入維護 | `Wbase5060_BsdescForm.tsx` |

**共通行為**
- 頂部 `<WbasePageHeader />` (類別「基本資料」、模式 `grid`) 下方為頁籤列，可點選或按 `Alt+1`~`Alt+6` 切換。
- 各子頁的 `Esc` 直接回到 wbase 主選單 (不是回上一個頁籤)。
- 子頁格線都是 `<FoxProGridV2 />`，除 5-2 的「列印張數」與 5-6 的條文欄位外皆唯讀。
- 5-1 ~ 5-5 只讀資料；5-6 讀寫 `bsdesc.dbf`。
- 報表全部在瀏覽器端輸出：5-1、5-3、5-4、5-5 用 `<FoxProPrintModal />` (預覽表格、`printElement` 紙張列印、xlsx 匯出)，5-2、5-6 用頁面自訂的預覽視窗。**沒有使用 LocalAgent / `wbaseRP.dll`**，`localagent/dlls.json` 也沒有本模組的報表函數。
- xlsx 匯出走 service 的 `exportReportToXlsx(data, fields, fileName)`：只輸出 `selected` 的欄位，以 `customTitle` (無則 `label`) 為欄名。

### 1.1 5-1 客戶資料列印 (`Wbase5010_CustomerPrint.tsx`)

- 開啟時 `GET /api/wbase5010/customers` 載入全部客戶，**預設全部勾選**。格線欄：選取、客戶代號、客戶簡稱、客戶全稱、統一編號、負責人、公司電話、公司地址 (`gridId="wbase5010_cust_grid"`)。點選取欄切換勾選，底部顯示「勾選: n / 總筆數」。
- 條件面板：

| 條件 | 選項 | 說明 |
| :--- | :--- | :--- |
| 客戶起訖 | 起始、終止客戶代號 | 輸入時轉大寫；輸入框右側放大鏡按鈕開「客戶基本資料選單」(`SearchModal`，比對前端已載入客戶的代號、名稱) |
| 種類 | `1` 基本資料 / `2` 詳細資料 | 只影響報表標題與 xlsx 檔名 (`客戶資料清單_基本` / `客戶資料清單_詳細`) |
| 地址 | `1` 公司地址 / `2` 聯絡地址 / `3` 公司.聯絡 | 只影響預覽的地址欄：聯絡地址空白時改印公司地址；公司.聯絡印成「公司 / 聯絡」 |
| 排序 | `1` 客戶編號 / `2` 統一編號 / `3` 稅籍編號 | 後端排序 |
| 分組 | `1` 客戶編號排序 / `2` 依登打人員分組 | `2` 時後端先依登打人員排序 |

- **F7 列印預覽**：`POST /api/wbase5010/print/customer-data` 後開 `<FoxProPrintModal />`。只有「部分勾選」時才送 `selectedNos`，全部勾選時只依起訖篩選。
- 預覽欄：代號、簡稱、客戶名稱、統一編號、稅籍編號、負責人、公司電話、地址 (依地址選項)、登打人員 (姓名)。
- Excel 預設 18 欄：客戶代號、簡稱、客戶全稱、統一編號、稅籍編號、負責人、聯絡人、電話、手機、傳真、公司地址、聯絡地址、E-mail、登打人員、人員姓名、組織類別、行業代號、資本額。在 `FoxProPrintModal` 勾選「匯出設定」可開 `<FormUtilSelectXlsxFieldsList />` 調整。

### 1.2 5-2 郵寄標籤列印 (`Wbase5020_LabelPrint.tsx`)

- 開啟時載入與 5-1 相同的客戶清單，**預設全部不勾、張數 0**。格線欄：選取、客戶代號、客戶簡稱、客戶名稱、統一編號、負責人、聯絡人、列印張數、公司地址 (`gridId="wbase5020_label_grid"`)。
- 「列印張數」是唯一可編輯欄 (只收數字，須 >= 0)；只改張數不會自動勾選。
- 選項：標籤種類 (郵遞標籤 / 磁片標籤)、列印樣式 (橫式 2 欄 / 直式 3 欄)、列印地址 (公司 / 聯絡)、收件人 (負責人 / 聯絡人)、預設份數 (1~99)、紙張規格 (A4、大張(高雄))。
- 勾選方式：
  - 點選取欄：勾選時張數 = 原張數 (大於 0) 或預設份數；取消時張數歸 0。
  - `F3` 全選 (張數 = 預設份數)、`F4` 全不選 (張數歸 0)。
  - `F8` 區間選取視窗：起始、終止客戶代號 (空白代表第一筆 / 最後一筆，轉大寫後以字串比較) 與張數 (1~99)，「套用勾選」把區間內客戶設為勾選並套用張數，區間外不變。
- **F7 標籤列印**：只取「已勾選且張數 > 0」的客戶 (沒有時提示「請先勾選至少一家客戶並設定列印張數！」)，`POST /api/wbase5010/print/labels` 由後端依張數展開，開「郵寄標籤排版預覽」：
  - 每張標籤：`[客戶代號]`、「國內郵資已付」、地址 (選聯絡地址而聯絡地址空白時用公司地址)、客戶名稱、收件人 (選聯絡人而聯絡人空白時用負責人) 加「先生/女士 收」、電話。
  - 「紙張直接列印」(`printElement`)；「匯出 Excel」輸出已勾選客戶名冊 (代號、簡稱、客戶名稱、負責人、聯絡人、電話、地址、份數)，不經欄位選擇視窗。
- 標籤種類、A4、大張(高雄) 只隨查詢送到後端，前端排版與後端目前都沒有使用。

### 1.3 5-3 客戶登打統計表 (`Wbase5030_KeyinStats.tsx`)

- 條件：資料年度 (預設 `115`)、客戶起訖、人員起訖 (轉大寫)。開啟時自動查詢一次，「重新查詢」按鈕再查。
- `POST /api/wbase5010/print/keyin-stats`：每位客戶一列 (`customer` LEFT JOIN `keyin` 取人員姓名)，依登打人員、客戶代號排序，不做筆數彙總。
- 格線與預覽欄：登打人員、人員姓名、客戶代號、客戶名稱、統一編號、稅籍編號、公司電話、公司地址 (`gridId="wbase5030_keyin_grid"`)。
- 資料年度只出現在報表標題與 xlsx 檔名 (`客戶登打統計表_{年度}年度`)，不是查詢條件。

### 1.4 5-4 客戶營業狀況表 (`Wbase5040_BusinessStatus.tsx`)

- 條件：年度 (預設 `115`)、月份起訖 (預設 `01` ~ `12`，各 2 碼)、客戶起訖。開啟時自動查詢一次。
- `POST /api/wbase5010/print/business-status`：只讀 `customer`，欄位為客戶代號、客戶全稱、統一編號、稅籍編號、負責人、公司電話、行業代號 (`pno`)、資本額 (千分位)、公司地址 (`gridId="wbase5040_business_grid"`)。
- 目前**沒有讀取任何營業額資料**：年度只用於標題與檔名，起訖月份由後端原樣回填到每列 (`startMonth`、`endMonth`，xlsx 的「起月」「迄月」欄)。

### 1.5 5-5 客戶財務狀況參考表 (`Wbase5050_FinanceStatus.tsx`)

- 條件：結算年度 (預設 `115`)、客戶起訖。開啟時自動查詢一次。
- `POST /api/wbase5010/print/finance-status`：只讀 `customer`，欄位為客戶代號、客戶名稱、統一編號、稅籍編號、資本額、負責人、公司電話、公司地址 (`gridId="wbase5050_finance_grid"`)。
- 目前**沒有讀取任何財務資料**：結算年度由後端原樣回填到每列 (`year`，xlsx 的「年度」欄)。

### 1.6 5-6 委任書輸入維護 (`Wbase5060_BsdescForm.tsx`)

維護 `bsdesc.dbf` 的委任書條文，並以瀏覽器列印委任書。

- **表頭**：委任日期 (預設 `115/01/01`)、負責人證號 (轉大寫)、結算年度 (預設 `115`)。只用於列印預覽，不存檔。
- **格線** (`gridId="wbase5060_bsdesc_grid"`)：

| 欄 | 欄位 | 可編輯 | 規則 |
| :--- | :--- | :-: | :--- |
| 指標 | `sel` | 點選 | `→` 或空白，點選切換並立即存檔 |
| 順序 | `seq` | ✗ | |
| 條文代號 | `no` | ✔ | 轉大寫，`maxLength` 10 |
| 委任書條文 / 查核程序說明 | `desc` | ✔ | 行內編輯；儲存格內 `[F6 編輯]` 開全文編輯 |

- 行內編輯確認後由 `onSaveRow` 呼叫 `PUT /api/wbase5010/bsdesc/{seq}` 自動存檔，結果顯示在狀態列。
- **Ins 新增**：`POST /api/wbase5010/bsdesc` 新增空白條文 (`seq` = 目前最大 `seq` + 1、`sel` = `→`)，加在清單最後。
- **Del 刪除**：`window.confirm`「確定要刪除第 n 條文嗎？」後 `DELETE /api/wbase5010/bsdesc/{seq}`。
- **F4 複製**：把目前條文的 `no`、`desc`、`sel` 複製成新的一筆 (`POST`)。
- **F6 全文編修**：textarea 視窗，「儲存條文」→ `PUT`。
- **Space**：焦點不在輸入框時切換目前條文的 `sel` 並存檔。
- 「目前條文」是頁面的 `selectedRowIndex`，只在新增、複製、刪除後改變，**沒有接 `FoxProGridV2` 的 `onSelectRow`**，所以不會隨格線游標移動。
- **F7 委任書列印**：A4 預覽 —「委　任　書」標題、委任日期與結算年度、依清單順序列出全部條文 (`seq、desc`，不論 `sel`)、簽章區 (營利事業與事務所各欄空白，只帶入表頭的負責人身分證號)。預覽內「紙張直接列印」(`printElement`)、「匯出 Excel」(順序、條文代號、內容說明、記號)。
- service 另有 `batchSaveBsdesc` (`PUT /bsdesc/batch`)，畫面目前沒有呼叫。

### 1.7 快速鍵

| 按鍵 | 5-1 | 5-2 | 5-3 / 5-4 / 5-5 | 5-6 |
| :--- | :--- | :--- | :--- | :--- |
| `Alt+1`~`Alt+6` | 切換頁籤 | 同左 | 同左 | 同左 |
| `F3` / `F4` | 全選 / 全不選 | 全選 / 全不選 | - | `F4` 複製條文 |
| `F6` | - | - | - | 全文編修 |
| `F7` | 查詢並開列印預覽 | 產生標籤並開預覽 | 開列印預覽 | 委任書預覽 |
| `F8` | - | 區間選取 | - | - |
| `Ins` / `Del` | - | - | - | 新增 / 刪除條文 |
| `Space` | - | - | - | 切換指標 |
| `Enter` | 格線換欄 | 修改列印張數 | 格線換欄 | 編輯條文代號、說明 |
| `Esc` | 回主選單 | 回主選單 | 回主選單 | 回主選單 |

- `<FoxProPrintModal />` 開啟時 (5-1、5-3 ~ 5-5)：`F7` 紙張列印、`F8` 匯出 Excel、`Esc` 關閉。
- 5-2 的區間選取與標籤預覽、5-6 的全文編修與委任書預覽是頁面自訂視窗，只能以按鈕操作 (未綁定 `Esc`、不會自動聚焦)。
- 5-1、5-2 底部狀態列提示的 `[F2] 查詢客戶`、`[Space] 勾選/取消` 目前沒有綁定按鍵：客戶選單只能點放大鏡按鈕開啟，勾選只能點選取欄或用 `F3`/`F4`/`F8`。

---

## 2. 檔案結構與資料表

```text
frontend/src/wbase/wbase5010/
├── index.tsx                      # Wbase5010Index：WbasePageHeader + 頁籤列 (Alt+1~6)，依 initialTab 切換子頁
├── Wbase5010_CustomerPrint.tsx    # 5-1 客戶資料列印 (FoxProGridV2 勾選 + SearchModal + FoxProPrintModal)
├── Wbase5020_LabelPrint.tsx       # 5-2 郵寄標籤列印 (張數設定、F8 區間、標籤排版預覽)
├── Wbase5030_KeyinStats.tsx       # 5-3 客戶登打統計表
├── Wbase5040_BusinessStatus.tsx   # 5-4 客戶營業狀況表
├── Wbase5050_FinanceStatus.tsx    # 5-5 客戶財務狀況參考表
├── Wbase5060_BsdescForm.tsx       # 5-6 委任書條文維護與委任書預覽
└── services/
    └── wbase5010.ts               # Axios client (預設 axios，全域攔截器帶 X-Data-Drive) + exportReportToXlsx

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

`no` 客戶代號、`abbr` 簡稱、`name` 名稱、`unino` 統一編號、`taxno` 稅籍編號、`hname` 負責人、`linkman` 聯絡人、`tel`、`mobile`、`fax`、`addr` 公司地址、`invaddr` 聯絡地址、`email`、`keyin` 登打人員、`orga` 組織型態、`pno` 行業代號、`pnostd`、`offno`、`offno1`、`cpano`、`capital` 資本額、`serial` (客戶清單排序)。

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
| 新增 | `INSERT` | `seq` | `seq`、`no`、`desc`、`sel`、`serial` (= `seq`)。自動取號時由 VFP 在 DBF 檔頭鎖內取 `MAX(seq)+1` (`DbfWriteOptions.AutoNumber`，同時寫入 `serial`)；指定 `seq` 時 DBF 已有同一個 `seq` 回 409。PostgreSQL 的 `_record_number` 為 DBF 回傳的 RECNO |
| 修改 | `UPDATE` | `seq` | `no`、`desc`、`sel` |
| 刪除 | `DELETE` | `seq` | - |
| 批次重編 | `UPDATE` | `serial` (舊值) | `seq`、`serial` 依清單順序重編為 1..n，另寫 `no`、`desc`、`sel` |

---

## 3. 後端 API 規格 (`Wbase5010Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase5010/customers?keyword=` | 客戶清單 (`no, abbr, name, unino, hname, linkman, tel, addr, invaddr, recordNumber`，`prn=1`、`selected=false`)，依 `serial`、`no` 排序；keyword 不分大小寫比對代號、名稱、簡稱，並比對統編 |
| `POST` | `/api/wbase5010/print/customer-data` | Body `{ startNo, endNo, reportType, addrType, groupType, orderType, selectedNos }`；起訖以字串比較 `no`，`selectedNos` 以 `TRIM(no) IN (...)`；`orderType` 1 `no`、2 `unino, no`、3 `taxno, no`，`groupType=2` 時先依登打人員；`reportType`、`addrType` 未使用；回傳含 `keyinna`、`organame` |
| `POST` | `/api/wbase5010/print/labels` | Body `{ startNo, endNo, labelType, layoutType, addrType, recipientType, copies, startRow, isA4, isKaohsiungFormat, items }`；有 `items` 時依各筆 `prn` (<= 0 視為 1) 展開，不重讀資料庫；沒有 `items` 時依起訖讀 `customer` (依 `no` 排序)，每家展開 `copies` 張；其餘選項未使用 |
| `POST` | `/api/wbase5010/print/keyin-stats` | Body `{ year, startNo, endNo, startKeyin, endKeyin }`；依 `keyin`、`no` 排序；`year` 未使用 |
| `POST` | `/api/wbase5010/print/business-status` | Body `{ year, startMonth, endMonth, startNo, endNo }`；依 `no` 排序；`startMonth`、`endMonth` 原樣回填 (未傳時 `01`、`12`) |
| `POST` | `/api/wbase5010/print/finance-status` | Body `{ year, startNo, endNo }`；依 `no` 排序；`year` 原樣回填 |
| `GET` | `/api/wbase5010/bsdesc` | 委任書條文，依 `seq`、`serial` 排序 |
| `POST` | `/api/wbase5010/bsdesc` | 新增；`seq > 0` 時用傳入值 (DBF 已有同一個 `seq` 回 409)，否則由 VFP 在 DBF 取 `MAX(seq) + 1`，多人同時新增或舊系統剛新增時也不重號；回傳 `{ success, seq }` |
| `PUT` | `/api/wbase5010/bsdesc/{seq}` | 修改 `no`、`desc`、`sel` |
| `DELETE` | `/api/wbase5010/bsdesc/{seq}` | 刪除 |
| `PUT` | `/api/wbase5010/bsdesc/batch` | Body `{ rpdate, comphidno, endyear, items }`；依 `items` 順序重編 `seq`、`serial`；`rpdate`、`comphidno`、`endyear` 未使用；畫面未呼叫 |

- 讀取前一律 `EnsureTableSyncedAsync` (keyFields 見第 2 節)。
- DBF 寫入失敗回 500 `{ error, message }` (例如「寫入 bsdesc.dbf 失敗」)，不寫 PostgreSQL；沒有把 `LOCK_TIMEOUT` 轉成 409。其他例外回 500 `{ error }`。
- 前端查詢失敗只在狀態列顯示訊息。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 5-1 流程 | 先開 `wbase4000` 勾選客戶，再開 `wbase2011` 列印 | 單一頁面：格線勾選 + `F7` 列印預覽 |
| 5-1 開啟時回寫 | `pnostd` 空白且 `pno` 在 `class107` 找得到的客戶，回寫 `pnostd = pno` | 不回寫 (唯讀) |
| 5-1 關聯資料 | 關聯行業 (`class107`)、國稅局 (`taxof`)、稅捐處 (`taxof1`)、會計師 (`cpa`) | 只 JOIN `keyin` 取登打人員姓名；`pno`、`pnostd`、`offno`、`offno1`、`cpano` 只回傳代碼 |
| 5-2 流程與順序 | `wbase201201` 設定張數 → 展開後依客戶代號建索引 → `wbase2012` 列印 | 單一頁面；標籤沿用客戶清單順序 (`serial`、`no`) |
| 5-5 資料 | 開 `refpath` 的 `XPROFIT` (資產負債表資產表格檔) 建立暫存表 | 只列客戶基本欄位 |
| 5-6 開啟的表 | `cpa`、`customer`、`bsdesc` (`wbs_rep2.scx`)，格線欄 `sel`、`seq`、`desc` | 只讀寫 `bsdesc`；格線多一個可編輯的 `no`；委任書預覽的營利事業、事務所欄位留白 |
