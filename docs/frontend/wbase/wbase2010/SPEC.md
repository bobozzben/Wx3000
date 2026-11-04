# 規格書：wbase2010 公司基本資料維護作業

> **模組代號**：`wbase2010` / `wbase2010_split`  
> **功能名稱**：公司基本資料維護作業 (`<FoxProGridCard />` 客戶清單 + 6 大 Tab 多頁籤跨頁盲打表單 + 8 組台灣地址選取器 + 稅務格式提示檢核 + 單筆列印預覽)  
> **所屬模組**：`frontend/src/wbase/wbase2010/` & `backend/Controllers/Wbase2010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase2010` (對應地端 `<Drive>:\w3000\comm\customer.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"customer"`)

---

## 1. 模組定位與職責

本模組為系統最核心之客戶企業主檔維護作業，用於登錄、修改與管理客戶公司之綜合登記資訊、稅籍地址、聯絡通訊、營業稅、各類扣繳、結算簽證委任、暫繳與清算異動資料（前端表單共計超過 130 個 DBF 對應欄位）。
具備以下功能特性：
1. **雙佈局支援（上下分割 `index.tsx` & 左右分割 `Wbase2010SplitPage.tsx`）**：
   - 兩種佈局共用同一個 `useWbase2010` 狀態 Hook 與 `<Wbase2010Form />`，選單 `wbase2010` 開上下分割、`wbase2010_split`（「客戶資料建檔 (左右雙欄測試)」）開左右分割。
   - 使用 `<FoxProGridCard />` 呈現客戶清單（預設 `mergeHeader` 合併表頭與欄寬拖曳記憶），欄位為 編號 / 客戶名稱 / 統編 / 負責人 / 電話 / 類別（左右分割版不顯示電話），支援 `↑`/`↓`/`PageUp`/`PageDown`/`Home`/`End` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`)。
   - 下方（或右側）表單隨選取列即時同步預覽該公司之 6 大頁籤資料；左側直式頁籤列可用滑鼠點選切換（瀏覽模式點選頁籤會進入編修模式）。
2. **多頁籤 (6 大 Tab) 全鍵盤盲打切換與跨頁順序跳欄 (`Wbase2010Form.tsx` + `useFoxProCardNavigation`)**：頁籤定義於 `companyFieldDefs.ts` 的 `TABS_CONFIG`。
   - **Tab 0 (`F3`) 基本資料**：客戶編號、名稱、英文名稱、簡稱、統一編號、稅籍編號、國稅局代號、資本額、電話、傳真、Email、公司/聯絡地址、郵遞區號、會計類別、負責人與聯絡人、備註（24 欄）。
   - **Tab 1 (`F4`) 營業稅**：營業稅聯絡人、申報週期、申報種類、媒體申報類別、TET/T02/T08 媒體申報、彙總註記與總機構統編、申報人資料等（22 欄）。
   - **Tab 2 (`F5`) 各類扣繳**：房屋稅籍編號、上市上櫃、扣繳申報型態、扣繳事務所統編、扣繳聯絡人、薪資媒體代號（7 欄）。
   - **Tab 3 (`F6`) 結算簽證**：組織別、行業代號、會計師、開業/結業/復業日期、帳務處理委任與結算申報委任資料等（43 欄）。
   - **Tab 4 (`F7`) 暫繳其他**：暫繳委託代辦資料、稅務人員、購票地點、登打人員、記帳費與收費週期、其他備註１（18 欄）。
   - **Tab 5 (`F8`) 清算異動**：清算申報委託、清算人資料、申報類別、特殊會計年度核准日期與文號、其他備註２/３（20 欄）。
   - **跨頁自動跳欄 (`useFoxProCardNavigation`)**：聚焦時自動全選 (`foxProFocusAndSelect`)，按 `Enter`/`↓` 依序跳至下一可編輯欄位，到達頁籤末尾時自動切換至下一頁籤首欄；最後一欄按 `Enter` 觸發存檔。
   - **連動停用欄位**：編修模式下 `f3_code` 唯讀；`f6_bkother` 僅 `f6_bkprior = 3`、`f6_sbkother` 僅 `f6_sbkprior = 2`、`f4_mainunino` 僅 `f4_tpay = 2` 時可輸入。
3. **8 組台灣地址智慧選取 (`<AddressSelectModal />`)**：
   - 於 `f3_addr`（公司地址）、`f3_invaddr`（聯絡地址）、`f3_ownerAddr`（負責人地址）、`f6_bkaddr`、`f6_sbkaddr`、`f7_tbkaddr`、`f8_qbkaddr`、`f8_clsaddr` 等 8 個地址欄位按 `F2` / `F4` 或點擊「F2 地址」按鈕開啟台灣縣市/鄉鎮區/路名智慧選取器。
4. **稅務與格式提示檢核 (`validation.ts` + `Wbase2010Form.tsx`)**：以下檢核皆為非阻斷式提示（欄位旁顯示琥珀色警告，「此為提示，仍可正常存檔」）：
   - **統一編號 (`checkUnifiedNo`)**：8 碼統編邏輯檢查（`UNIFIED_NO_FIELDS`：`f3_uni`、`f4_mainunino`、`f4_compno`、`f5_compno5`、`f6_compno6`、`f6_bkunino`）。
   - **身分證字號**：`f3_idNo` 以 `checkNationalId` 做 10 碼身分證檢查（`NATIONAL_ID_FIELDS`）；各委任人/清算人證號以 `checkTaxId` 做統編/身分證複合檢查（`TAX_ID_OR_NAT_FIELDS`）。
   - **稅籍編號 (`checkTaxNo`)**：`f3_taxNo` 9 碼數字檢查。
   - **房屋稅籍編號 (`checkHouseTaxNo`)**：`f5_house` 12 碼格式檢查。
   - **日期與月日格式 (`checkRocDate` / `checkMonthDay`)**：民國日期欄 (`ROC_DATE_FIELDS`) 與記帳起訖月日 `f6_bkbd` / `f6_bked` (`MONTH_DAY_FIELDS`) 格式提示（僅提示，不回填正規化值）。
   - **電話格式 (`checkPhoneFormat`)**：`PHONE_FIELDS` 內各電話/傳真欄位格式提示。
   - **25 組代碼選項範圍檢核 (`WBASE210_CHOICE_RULES` / `checkChoiceField`)**：針對申報週期、申報種類、組織別、委任型態等單碼欄位提供即時合法值檢核與說明提示（欄位標籤顯示允許值，輸入自動轉大寫）。
   - **組織別自動推導 (`deriveOrganizationFromName`)**：輸入公司名稱且 `f6_orga` 空白時，依關鍵字自動帶入（股份有限公司 `1`、有限 `2`、無限 `3`、兩合 `4`、合夥 `5`、獨資 `6`、國外分公司 `7`、國外辦事處 `8`、其它 `0`）；同時簡稱空白時帶入名稱前 8 bytes (`truncateBig5`)，公司地址變更且聯絡地址空白時同步帶入。
   - **非阻斷式 Email 提示 (`isValidEmail`)**：對非標準 Email 顯示琥珀色「格式非標準」徽章，不阻斷舊資料存檔。
5. **存檔檢核 (`useWbase2010.saveForm`，對齊 `wbase210.pas`)**：
   - 客戶編號、客戶名稱必填；新增時檢查代號重複（「客戶代號已存在!!」）。
   - 記帳起始日 `f6_bkbd` 大於結束日 `f6_bked` 時確認是否為非歷年制。
   - `WBASE210_CHOICE_RULES` 中仍空白的欄位彙整後詢問是否仍要存檔。
   - 存檔前依 `FIELD_LENGTH_LIMITS` 檢查字元長度（後端 `ValidateFieldLengths` 亦同步檢查）。
   - 新增預設值：客戶編號預帶 `C` + 4 碼流水（依目前筆數 + 1）、國稅局代號 `台北市`、會計類別 `一般`，以及 F4~F8 各旗標預設值（如 `f4_t401`/`f4_tzero`/`f4_tflog` = `Y`、`f6_bkbd` = `0101`、`f6_bked` = `1231`）。
6. **列印預覽 (`wbase2010Print.tsx`)**：
   - 以彈窗顯示目前選取客戶之「客戶基本資料基本表」（編號、統編、名稱、英文名稱、簡稱、負責人、電話、地址、Email、備註），按「列印」呼叫瀏覽器 `window.print()`。目前未串接 `FoxProPrintModal`、LocalAgent 報表或 Excel 匯出。
7. **混合雲地 DBF 雙向同步 (`Wbase2010Controller.cs`)**：
   - 讀取前以 `EnsureTableSyncedAsync(DbfPath, "customer", PgSchema, "customer", "no")` 比對 `<Drive>:\w3000\comm\customer.dbf` Checksum；新增/修改/刪除時以 `WriteRecordAsync(..., KeyField = "no", 代號)` 先寫地端 DBF，成功後才寫 PostgreSQL 並更新 Checksum；DBF 回 `LOCK_TIMEOUT` 時回 409。
   - **目前讀寫範圍限制**：`CompanyMaster` 只對應基本資料 21 個欄位（見第 3 節）；前端送出的 F4~F8 頁籤欄位（`f4_*` ~ `f8_*`）以及 `f3_offno4`、`f3_postno`、`f3_contactTel` 不會被後端讀出或寫入 DBF，重新載入後這些欄位為空白。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase2010/
├── index.tsx              # 上下分割主頁面 (自繪頂部列 + FoxProGridCard + 左側 F3~F8 頁籤列 + Wbase2010Form + F2 查詢彈窗)
├── Wbase2010SplitPage.tsx # 左右分割主頁面 (左側 FoxProGridCard + 右側 6-Tab Wbase2010Form)
├── Wbase2010Form.tsx      # 6 大 Tab 欄位渲染組件 (useFoxProCardNavigation + AddressSelectModal + 稅務格式提示)
├── companyFieldDefs.ts    # CompanyItem 型別、TABS_CONFIG、130+ 欄位元資料 FIELD_METADATA 與 TAB_FIELDS_MAP
├── wbase2010Print.tsx     # 單筆客戶基本資料列印預覽 (window.print)
└── useWbase2010.ts        # 狀態管理 Hook (清單載入與欄位對映、跨頁導覽、存檔檢核、新增預設值、搜尋、CRUD)

frontend/src/services/
└── wbase2010.ts           # Axios API Client (CRUD 與 print)；目前頁面只引用其 CompanyItem 型別，useWbase2010 直接以 axios 呼叫 /api/wbase2010

backend/
├── Controllers/
│   └── Wbase2010Controller.cs  # RESTful CRUD、Print Range 查詢 & DbfSyncService (customer.dbf)
└── Models/
    └── CompanyMaster.cs        # EF Core Entity (Table: "customer", 動態對應當前資料磁碟 Schema)
```

---

## 3. 核心資料庫與 DBF Schema 對照摘要 (`<drive>:/w3000/comm` . `customer`)

後端實際讀寫的欄位如下（API JSON 為 EF 屬性的 camelCase，`useWbase2010` 載入時轉成 `CompanyItem`，表單再對映到 `f3_*` 欄位 ID）：

| DBF / PG 欄位 | EF Core 屬性 (`CompanyMaster`) | 前端 `CompanyItem` / 表單欄位 | 說明 |
| :--- | :--- | :--- | :--- |
| `no` | `CompanyCode` (PK) | `code` / `f3_code` | 客戶編號 (後端轉大寫；編修時唯讀) |
| `name` | `CompanyName` | `name` / `f3_name` | 公司名稱 (支援自動推導 `f6_orga` 組織別) |
| `engname` | `EnglishName` | `eng` / `f3_eng` | 英文名稱 |
| `abbr` | `ShortName` | `short` / `f3_short` | 公司簡稱 (空白時存檔帶入名稱前 8 bytes) |
| `unino` | `UnifiedNo` | `uni` / `f3_uni` | 統一編號 (8 碼 `checkUnifiedNo`) |
| `taxno` | `TaxNo` | `taxNo` / `f3_taxNo` | 稅籍編號 (9 碼 `checkTaxNo`) |
| `offno` | `TaxOffice` | `taxOffice` / `f3_offno` | 國稅局代號 |
| `capital` | `Capital` (decimal) | `capital` / `f3_capital` | 資本額 (存檔時去除逗號與「元」) |
| `tel` / `fax` | `Tel` / `Fax` | `tel`、`fax` / `f3_tel`、`f3_fax` | 公司電話 / 傳真 (`checkPhoneFormat`) |
| `addr` / `invaddr` | `Address` / `Address2` | `addr`、`addr2` / `f3_addr`、`f3_invaddr` | 公司地址 / 聯絡地址 (`AddressSelectModal`；聯絡地址空白時存檔帶入公司地址) |
| `email` | `Email` | `email` / `f3_email` | 電子郵件 (`isValidEmail`) |
| `acctype` | `AcctType` | `acctType` / `f3_acctType` | 會計類別 (A~G) |
| `hname` / `hidno` | `Owner` / `OwnerIdNo` | `owner`、`idNo` / `f3_owner`、`f3_idNo` | 負責人姓名 / 身分證號 (`checkNationalId`) |
| `mobile` | `OwnerMobile` | `ownerMobile` / `f3_mobile` | 負責人手機 |
| `haddr` | `OwnerAddr` | `ownerAddr` / `f3_ownerAddr` | 負責人地址 (`AddressSelectModal`) |
| `linkman` / `linkmobile` | `ContactName` / `ContactMobile` | `contactName`、`contactMobile` / `f3_contactName`、`f3_contactMobile` | 聯絡人姓名 / 手機 (手機空白時以 `f3_contactTel` 代入) |
| `memo01` | `Memo` | `memo` / `f3_memo` | 備註 (注意：表單 `f3_memo` 存入 `memo01`，與 F7 頁籤的 `f7_memo01` 對應同一 DBF 欄位名稱) |
| `_record_number` | `RecordNumber` | - | DBF 實體記錄號 |

> `CompanyMaster` 另有 `placeno` (`PlaceCode`)、`keyin` (`EmpCode`) 對應但 Wbase2010 未讀寫；`ListedType`、`OfficeId` 為 `[NotMapped]`。

---

## 4. 鍵盤熱鍵與 Tab 對照表

### 瀏覽模式 (`mode === 'grid'`)
- `↑` / `↓` / `PageUp` / `PageDown` / `Home` / `End`：於 `FoxProGridCard` 上下切換公司，表單即時同步預覽
- `Enter` / `F6` / 雙擊列：進入編輯模式 (`startEdit`)，聚焦 `f3_name`
- `Del`：確認後刪除選取公司資料 (`window.confirm`)
- `F2`：開啟公司搜尋彈窗（可依編號、名稱、統編、負責人篩選；`↑`/`↓` 移動、`Enter` 選擇、`Esc`/`F2` 關閉）
- 底部按鈕：`Ins 新增`（`startAdd`，自動帶入下一個客戶編號；清單目前未綁定 `Insert` 鍵）、`Del 刪除`、`F6 編修`、`F2 查詢`、`P 列印`（開啟 `Wbase2010Print`；未綁定按鍵）
- 點選左側頁籤按鈕：進入編輯模式 (`startEdit`)
- `Esc`：退回 wbase 系統主選單

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter` / `↓`：依序跳至下一個可編輯輸入欄位（跨 Tab 自動切換頁籤，最後一欄按 `Enter` 觸發存檔）
- `↑`：跳回上一個可編輯輸入欄位
- `F2` / `F4`：於任一地址欄位開啟 `<AddressSelectModal />` 台灣地址選取器
- `F3`~`F8`：直接跳轉至對應 Tab 頁籤首欄
- `Esc`：儲存變更並返回瀏覽模式（`saveForm`；畫面提示文字寫「Esc / F9」，但目前未綁定 `F9` 鍵）
- 底部「放棄修改」按鈕：放棄變更並返回瀏覽模式 (`cancelEdit`)

---

## 5. 後端 API 規格 (`Wbase2010Controller.cs`)

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase2010?keyword=` | 同步 `customer.dbf` 後回傳清單 (依 `no` 排序；`keyword` 比對代號、名稱、簡稱、統編、負責人、電話) |
| `GET` | `/api/wbase2010/{code}` | 取得單筆 |
| `POST` | `/api/wbase2010` | 新增 (代號已存在時改為 UPDATE)；先寫 DBF 再寫 PostgreSQL |
| `PUT` | `/api/wbase2010/{code}` | 修改 (PostgreSQL 無資料時改為 INSERT)；先寫 DBF 再寫 PostgreSQL |
| `DELETE` | `/api/wbase2010/{code}` | 先刪 DBF 再刪 PostgreSQL |
| `POST` | `/api/wbase2010/print` | 依 `{ codeStart, codeEnd }` 代號區間查詢 (前端目前未使用) |
