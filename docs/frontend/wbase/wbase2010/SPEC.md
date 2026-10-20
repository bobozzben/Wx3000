# 規格書：wbase2010 公司基本資料維護作業

> **模組代號**：`wbase2010` / `wbase2010_split`  
> **功能名稱**：公司基本資料維護作業 (`<FoxProGridCard />` 瀏覽清單 + 6 大 Tab 多頁籤跨頁盲打表單 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase2010/` & `backend/Controllers/Wbase2010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase2010` (對應地端 `C:\w3000\comm\customer.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."customer"`)

---

## 1. 模組定位與職責

本模組為系統核心客戶企業主檔維護作業，用於登錄、修改與管理客戶公司之綜合登記資訊、稅籍地址、聯絡通訊、營所稅委任、房屋稅籍與變更異動紀錄。
具備以下功能特性：
1. **雙佈局支援（上下分割 `index.tsx` & 左右分割 `Wbase2010SplitPage.tsx`）**：
   - 使用 `<FoxProGridCard />` 呈現客戶清單，支援 `↑`/`↓`/`PageUp`/`PageDown` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`)。
   - 下方（或右側）表單隨選取列即時同步預覽該公司之完整 6 大頁籤資料。
2. **多頁籤 (6 大 Tab) 全鍵盤盲打切換與跨頁順序跳欄 (`Wbase2010Form.tsx`)**：
   - **Tab 0 (`F3`)**：基本資料與負責人/聯絡人。
   - **Tab 1 (`F4`)**：聯絡申報與憑證設定。
   - **Tab 2 (`F5`)**：房屋稅籍資料。
   - **Tab 3 (`F6`)**：營所稅務與委任代理。
   - **Tab 4 (`F7`)**：委任詳細資料與收費備註。
   - **Tab 5 (`F8`)**：異動紀錄與變更歷史。
   - **跨頁自動跳欄 (`allFieldsOrdered`)**：按 `Enter` 時依序跳至下一欄位，到達頁籤末尾時自動切換至下一頁籤首欄。
   - **非阻斷式 Email 格式提示 (`isValidEmail`)**：對非標準 Email 顯示琥珀色 `⚠️ 格式` 徽章提醒，不阻斷舊資料存檔。
3. **混合雲地 DBF 雙向同步 (`Wbase2010Controller.cs`)**：
   - 透過 `IDbfSyncService` 與地端 `C:\w3000\comm\customer.dbf` 即時比對 Checksum 並執行權威雙寫。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase2010/
├── index.tsx              # 上下分割主頁面 (上方 FoxProGridCard + 下方 6-Tab Wbase2010Form)
├── Wbase2010SplitPage.tsx # 左右分割主頁面 (左側 FoxProGridCard + 右側 6-Tab Wbase2010Form)
├── Wbase2010Form.tsx      # 6 大 Tab 多頁籤動態欄位渲染組件 (含 Email 非阻斷驗證提示)
├── companyFieldDefs.ts    # 所有欄位元資料 (Metadata)、TAB_FIELDS_MAP 與預設結構
├── wbase2010Print.tsx     # 列印與 CSV 匯出 Modal
└── useWbase2010.ts        # 狀態管理 Hook (全欄位跨頁導覽、搜尋、CRUD)

backend/
├── Controllers/
│   └── Wbase2010Controller.cs  # RESTful CRUD & DbfSyncService (customer.dbf)
└── Models/
    └── CompanyMaster.cs        # EF Core Entity (Schema: "c:/w3000/comm", Table: "customer")
```

---

## 3. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `customer`)

| DBF / PG 欄位 | EF Core 屬性 (`CompanyMaster`) | 說明 |
| :--- | :--- | :--- |
| `no` | `CompanyCode` (PK) | 客戶公司編號 |
| `name` | `CompanyName` | 公司全銜名稱 |
| `engname` | `EnglishName` | 英文登記名稱 |
| `abbr` | `ShortName` | 公司簡稱 |
| `unino` | `UnifiedNo` | 統一編號 |
| `taxno` | `TaxNo` | 稅籍編號 |
| `offno` | `TaxOffice` | 管轄國稅局/稽徵所代號 |
| `capital` | `Capital` | 實收資本額 |
| `tel` / `fax` | `Tel` / `Fax` | 公司電話 / 傳真 |
| `addr` / `invaddr` | `Address` / `Address2` | 登記地址 / 聯絡(發票)地址 |
| `email` | `Email` | 電子信箱 |
| `acctype` | `AcctType` | 會計申報類別 |
| `hname` / `hidno` | `Owner` / `OwnerIdNo` | 負責人姓名 / 身分證號 |
| `mobile` / `haddr` | `OwnerMobile` / `OwnerAddr` | 負責人手機 / 戶籍地址 |
| `linkman` / `linkmobile` | `ContactName` / `ContactMobile` | 聯絡人姓名 / 手機 |
| `memo01` | `Memo` | 備註事項 |
| `_record_number` | `RecordNumber` | DBF 實體記錄號 |

---

## 4. 鍵盤熱鍵與 Tab 對照表

### 瀏覽模式 (`mode === 'browse'`)
- `↑` / `↓` / `PageUp` / `PageDown`：於 `FoxProGridCard` 上下切換公司，表單即時同步預覽
- `Ins`：新增公司資料 (`startAdd`)
- `Enter` / `F6` / 雙擊列：進入編輯模式 (`startEdit`)
- `Del`：刪除選取公司資料
- `F2`：開啟公司搜尋彈窗
- `F3`~`F8`（或 `Alt+1`~`Alt+6`）：直接切換預覽對應 Tab 頁籤
- `Esc`：退回 wbase 系統主選單

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter`：依序跳至下一個輸入欄位（跨 Tab 自動切換頁籤）
- `F9` / `Ctrl+S`：儲存變更並返回瀏覽模式
- `Esc`：放棄變更並返回瀏覽模式
