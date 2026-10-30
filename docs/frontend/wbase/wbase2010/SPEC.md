# 規格書：wbase2010 公司基本資料維護作業

> **模組代號**：`wbase2010` / `wbase2010_split`  
> **功能名稱**：公司基本資料維護作業 (`<FoxProGridCard />` 雙層表頭清單 + 6 大 Tab 多頁籤跨頁盲打表單 + 8 組台灣地址選取器 + 完整稅務檢核 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase2010/` & `backend/Controllers/Wbase2010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase2010` (對應地端 `<Drive>:\w3000\comm\customer.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"customer"`)

---

## 1. 模組定位與職責

本模組為系統最核心之客戶企業主檔維護作業，用於登錄、修改與管理客戶公司之綜合登記資訊、稅籍地址、聯絡通訊、營所稅委任、房屋稅籍與變更異動紀錄（共計超過 130 個 DBF 對應欄位）。
具備以下功能特性：
1. **雙佈局支援（上下分割 `index.tsx` & 左右分割 `Wbase2010SplitPage.tsx`）**：
   - 使用 `<FoxProGridCard />` 呈現客戶清單（支援 `mergeHeader` 雙層合併表頭與欄寬拖曳記憶），支援 `↑`/`↓`/`PageUp`/`PageDown` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`)。
   - 下方（或右側）表單隨選取列即時同步預覽該公司之完整 6 大頁籤資料。
2. **多頁籤 (6 大 Tab) 全鍵盤盲打切換與跨頁順序跳欄 (`Wbase2010Form.tsx` + `useFoxProCardNavigation`)**：
   - **Tab 0 (`F3`)**：基本資料（統一編號、稅籍編號、營業地址、發票地址、負責人、聯絡人等）。
   - **Tab 1 (`F4`)**：聯絡申報（記帳費、申報設定、國稅局代號、輔導員等）。
   - **Tab 2 (`F5`)**：房屋稅籍（房屋稅籍編號 12 碼檢核、地價稅、租金扣繳等）。
   - **Tab 3 (`F6`)**：營所稅務（組織別自動推導、會計師代號、退稅帳號、帳簿地址等）。
   - **Tab 4 (`F7`)**：委任資料（記帳士/代理人委任資訊、股東與董監事結構等）。
   - **Tab 5 (`F8`)**：異動紀錄（設立、變更、停業、復業、註銷日期與核准文號等）。
   - **跨頁自動跳欄 (`useFoxProCardNavigation`)**：聚焦時自動全選 (`foxProFocusAndSelect`)，按 `Enter`/`↓` 依序跳至下一可編輯欄位，到達頁籤末尾時自動切換至下一頁籤首欄。
3. **8 組台灣地址智慧選取 (`<AddressSelectModal />`)**：
   - 於 `f3_addr`（營業地址）、`f3_invaddr`（發票地址）、`f3_ownerAddr`（負責人戶籍地址）、`f6_bkaddr`、`f6_sbkaddr`、`f7_tbkaddr`、`f8_qbkaddr`、`f8_clsaddr` 等 8 個地址欄位按 `F2` / `F4` 或點擊 `...` 按鈕開啟台灣縣市/鄉鎮區/路名智慧選取器。
4. **全方位稅務與格式檢核 (`validation.ts` + `companyFieldDefs.ts`)**：
   - **統一編號 (`checkUnifiedNo`)**：8 碼統編邏輯檢查（`UNIFIED_NO_FIELDS`）。
   - **身分證字號 (`checkTaxId`)**：10 碼身分證/居留證檢查（`NATIONAL_ID_FIELDS`）與統編/身分證複合檢查（`TAX_ID_OR_NAT_FIELDS`）。
   - **稅籍編號 (`checkTaxNo`)**：`f3_taxNo` 9 碼數字檢查。
   - **房屋稅籍編號 (`checkHouseTaxNo`)**：`f5_house` 12 碼格式檢查。
   - **日期與月日正規化 (`checkRocDate` / `checkMonthDay`)**：自動將 6/7/8 碼日期轉為 `YYY/MM/DD` 或 `MM/DD`。
   - **25 組代碼選項範圍檢核 (`WBASE210_CHOICE_RULES`)**：針對申報類別、組織別、行業性質等單碼/雙碼欄位提供即時合法值檢核與說明提示。
   - **組織別自動推導 (`deriveOrganizationFromName`)**：輸入公司名稱時自動判斷「股份有限公司」、「有限公司」、「無限公司」或「獨資/合夥」並帶入 `f6_orga`。
   - **非阻斷式 Email 提示 (`isValidEmail`)**：對非標準 Email 顯示琥珀色 `⚠️ 格式` 徽章提醒，不阻斷舊資料存檔。
5. **混合雲地 DBF 雙向同步 (`Wbase2010Controller.cs`)**：
   - 透過 `IDbfSyncService` 與地端 `<Drive>:\w3000\comm\customer.dbf` 即時比對 Checksum 並執行權威雙寫。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase2010/
├── index.tsx              # 上下分割主頁面 (WbasePageHeader + FoxProGridCard + 6-Tab Wbase2010Form)
├── Wbase2010SplitPage.tsx # 左右分割主頁面 (左側 FoxProGridCard + 右側 6-Tab Wbase2010Form)
├── Wbase2010Form.tsx      # 6 大 Tab 欄位渲染組件 (useFoxProCardNavigation + AddressSelectModal + 稅務驗證)
├── companyFieldDefs.ts    # 130+ 欄位元資料 (Metadata)、TAB_FIELDS_MAP 與預設結構
├── wbase2010Print.tsx     # FoxProPrintModal 列印預覽、LocalAgent 原生報表與動態欄位 Excel 匯出
└── useWbase2010.ts        # 狀態管理 Hook (全欄位跨頁導覽、自動編號、組織別自動推導、搜尋、CRUD)

backend/
├── Controllers/
│   └── Wbase2010Controller.cs  # RESTful CRUD & DbfSyncService (customer.dbf)
└── Models/
    └── CompanyMaster.cs        # EF Core Entity (Table: "customer", 動態對應當前資料磁碟 Schema)
```

---

## 3. 核心資料庫與 DBF Schema 對照摘要 (`<drive>:/w3000/comm` . `customer`)

| DBF / PG 欄位 | EF Core 屬性 (`CompanyMaster`) | 前端屬性 (`CompanyItem`) | 說明 |
| :--- | :--- | :--- | :--- |
| `no` | `CompanyCode` (PK) | `companyCode` | 客戶公司代號 (4 碼) |
| `name` | `CompanyName` | `companyName` | 公司全銜名稱 (支援自動推導 `f6_orga` 組織別) |
| `sname` | `ShortName` | `shortName` | 公司簡稱 |
| `unino` | `UnifiedNo` | `f3_unifiedNo` | 統一編號 (8 碼 `checkUnifiedNo`) |
| `taxno` | `TaxNo` | `f3_taxNo` | 稅籍編號 (9 碼 `checkTaxNo`) |
| `tel1` / `fax` | `Tel` / `Fax` | `f3_tel` / `f3_fax` | 公司電話 / 傳真 (`checkPhoneFormat`) |
| `addr` / `invaddr` | `Address` / `InvAddr` | `f3_addr` / `f3_invaddr` | 營業地址 / 發票地址 (`AddressSelectModal`) |
| `email` | `Email` | `f3_email` | 電子信箱 (`isValidEmail`) |
| `bos` / `id` | `Owner` / `OwnerIdNo` | `f3_owner` / `f3_ownerIdNo` | 負責人姓名 / 身分證號 (`checkTaxId`) |
| `baddr` | `OwnerAddr` | `f3_ownerAddr` | 負責人戶籍地址 (`AddressSelectModal`) |
| `con` / `bbc` | `ContactName` / `ContactMobile` | `f3_contactName` / `f3_contactMobile` | 聯絡人姓名 / 行動電話 |
| `house` | `F5House` | `f5_house` | 房屋稅籍編號 (12 碼 `checkHouseTaxNo`) |
| `orga` | `F6Orga` | `f6_orga` | 組織別代號 (可由公司名稱自動推導) |
| `_record_number` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 4. 鍵盤熱鍵與 Tab 對照表

### 瀏覽模式 (`mode === 'browse'`)
- `↑` / `↓` / `PageUp` / `PageDown`：於 `FoxProGridCard` 上下切換公司，表單即時同步預覽
- `Ins`：新增公司資料 (`startAdd`)，自動計算下一個公司代號
- `Enter` / `F6` / 雙擊列：進入編輯模式 (`startEdit`)
- `Del`：刪除選取公司資料
- `F2`：開啟公司搜尋彈窗 (`SearchModal`)
- `F3`~`F8`（或 `Alt+1`~`Alt+6`）：直接切換預覽對應 Tab 頁籤
- `F7`（工具列列印）：開啟列印與 Excel 動態欄位匯出視窗 (`Wbase2010Print`)
- `Esc`：退回 wbase 系統主選單

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter` / `↓`：依序跳至下一個可編輯輸入欄位（跨 Tab 自動切換頁籤，最後一欄按 `Enter` 觸發存檔）
- `↑`：跳回上一個可編輯輸入欄位
- `F2` / `F4`：於任一地址欄位開啟 `<AddressSelectModal />` 台灣地址選取器
- `F3`~`F8`：直接跳轉至對應 Tab 頁籤首欄
- `F9` / `Ctrl+S`：儲存變更並返回瀏覽模式
- `Esc`：放棄變更並返回瀏覽模式
