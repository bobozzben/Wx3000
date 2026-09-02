# 規格書：wbase2010 公司基本資料維護作業

> **模組代號**：`wbase2010`  
> **功能名稱**：公司基本資料維護作業 (多頁籤頁面維護 CRUD + 全鍵盤跳欄 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase2010/` & `backend/Controllers/Wbase2010Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase2010` (對應資料表 `e3000__comm.公司資料`)

---

## 1. 模組定位與職責

本模組為系統核心企業主檔維護作業，用於登錄、修改與管理客戶公司之綜合登記資訊、稅籍地址、聯絡通訊、營所稅委任、房屋稅籍與變更異動紀錄。
具備以下功能特性：
1. **多頁籤 (6 大 Tab) 全鍵盤盲打切換與順序跳欄**：
   - **Tab 0 (F3)**：基本資料與負責人/聯絡人。
   - **Tab 1 (F4)**：聯絡申報與憑證設定。
   - **Tab 2 (F5)**：房屋稅籍資料。
   - **Tab 3 (F6)**：營所稅務與委任代理。
   - **Tab 4 (F7)**：委任詳細資料與收費備註。
   - **Tab 5 (F8)**：異動紀錄與變更歷史。
2. **全動態 Enter 鍵跨 Tab 自動下跳 (`allFieldsOrdered`)**：
   - 焦點在最後一個欄位按 `Enter` 時自動循環回 Tab 0 第一個輸入框，傳承 Visual FoxPro 盲打輸入體驗。
3. **主表格/表單雙模式切換 (Grid Mode vs Edit Form Mode)**：
   - 表格瀏覽模式支援 `↑` `↓` 導覽、`F2` 新增、`F3` 搜尋開窗、`F4`/`Enter` 進入編輯表單。
4. **列印與 CSV 匯出 modal (`wbase2010Print.tsx`)**。
5. **RESTful API 後端整合**：連結 C# ASP.NET Core API (`Wbase2010Controller.cs`) 與 PostgreSQL `公司資料` 資料表。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase2010/
├── index.tsx              # 主頁面進入點 (包含模式切換、Tab Header、熱鍵監聽)
├── Wbase2010Form.tsx      # 6 大 Tab 多頁籤動態欄位渲染組件
├── companyFieldDefs.ts    # 所有欄位元資料 (Metadata)、TAB_FIELDS_MAP 與預設範例資料
├── wbase2010Print.tsx     # 列印與 CSV 匯出 Modal
└── useWbase2010.ts        # Zustand / Hook 狀態管理 (全欄位順序導覽、搜尋、CRUD)

backend/
├── Controllers/
│   └── Wbase2010Controller.cs  # RESTful CRUD & Query Endpoints
├── Models/
│   └── CompanyMaster.cs        # EF Core Entity Model (公司資料)
└── Data/
    └── DbInitializer.cs        # DDL 表格建立與初始種子資料 (Seeding)
```

---

## 3. 資料庫 Schema (`e3000__comm` . `公司資料`)

| 欄位名稱 (Column) | 資料型別 (Type) | EF Core 屬性 (Property) | 說明 (Description) |
| :--- | :--- | :--- | :--- |
| `公司編號` | `VARCHAR(30)` | `CompanyCode` (PK) | 客戶公司統一編號/內部代號 |
| `公司名稱` | `VARCHAR(255)`| `CompanyName` | 公司全銜名稱 |
| `公司英文名稱` | `VARCHAR(255)`| `CompanyEngName` | 英文登記名稱 |
| `公司簡稱` | `VARCHAR(255)`| `CompanyShortName` | 簡短顯示名稱 |
| `公司統編` | `VARCHAR(20)` | `TaxId` | 統一編號 |
| `稅籍編號` | `VARCHAR(30)` | `TaxRegNo` | 稅籍編號 |
| `國稅局` | `VARCHAR(100)`| `TaxBureau` | 管轄國稅局/稽徵所 |
| `資本額` | `NUMERIC(18,2)`| `Capital` | 實收資本額 |
| `聯絡電話` | `VARCHAR(255)`| `Phone` | 公司主要電話 |
| `公司傳真` | `VARCHAR(255)`| `Fax` | 公司傳真電話 |
| `公司地址` | `VARCHAR(255)`| `Address` | 登記地址 |
| `聯絡地址` | `VARCHAR(255)`| `ContactAddress` | 通訊/郵寄地址 |
| `電子信箱` | `VARCHAR(255)`| `Email` | 連絡 Email |
| `會計類別` | `VARCHAR(50)` | `AcctType` | 會計申報類別 |
| `負責人` | `VARCHAR(255)`| `Owner` | 負責人姓名 |
| `負責人證號` | `VARCHAR(30)` | `OwnerId` | 負責人身分證號 |
| `負責人手機` | `VARCHAR(255)`| `OwnerMobile` | 負責人行動電話 |
| `負責人地址` | `VARCHAR(255)`| `OwnerAddress` | 負責人戶籍地址 |
| `聯絡人` | `VARCHAR(255)`| `ContactPerson` | 常用聯絡窗口姓名 |
| `聯絡人手機` | `VARCHAR(255)`| `ContactMobile` | 聯絡人行動電話 |
| `備註` | `VARCHAR(255)`| `Memo` | 備註事項 |
| `上市公司` | `VARCHAR(20)` | `IsListed` | 是否為公開發行/上市公司 |
| `事務所編號` | `VARCHAR(30)` | `FirmCode` | 所屬事務所代號 |

---

## 4. 後端 API 規格 (`Wbase2010Controller.cs`)

| HTTP Method | Route Endpoint | 說明 (Description) |
| :--- | :--- | :--- |
| `GET` | `/api/wbase2010?keyword={q}` | 查詢公司列表 (依公司編號、名稱、統編、負責人模糊比對) |
| `GET` | `/api/wbase2010/{code}` | 取得指定公司詳細完整資料 |
| `POST` | `/api/wbase2010` | 新增公司主檔資料 |
| `PUT` | `/api/wbase2010/{code}` | 更新指定公司主檔資料 |
| `DELETE` | `/api/wbase2010/{code}` | 刪除指定公司主檔資料 |
| `POST` | `/api/wbase2010/print` | 依區間查詢報表列印資料 |

---

## 5. 鍵盤熱鍵與 Tab 對照表 (Hotkeys)

### 主表格視窗 (Grid Mode)
- `F2`：開啟新增公司資料表單 (Form Mode)
- `F3`：開啟公司搜尋彈窗 (Search Modal)
- `F4` 或 `Enter`：進入目前選取公司之編輯表單
- `F8` 或 `Delete`：刪除選取公司資料
- `F9`：開啟列印對話框
- `Esc`：退回 wbase 系統主選單

### 編輯表單模式 (Form Mode)
- `F3` / `Alt+3`：切換至 **Tab 0 基本資料**
- `F4` / `Alt+4`：切換至 **Tab 1 聯絡申報**
- `F5` / `Alt+5`：切換至 **Tab 2 房屋稅籍**
- `F6` / `Alt+6`：切換至 **Tab 3 營所稅務**
- `F7` / `Alt+7`：切換至 **Tab 4 委任資料**
- `F8` / `Alt+8`：切換至 **Tab 5 異動記錄**
- `Enter`：依序跳至下一個輸入欄位 (跨 Tab 自動切換頁籤)
- `F9` / `Ctrl+S`：儲存變更並返回表格模式
- `Esc`：放棄變更並返回表格模式

---

## 6. 建置與測試說明

```bash
# 1. 後端編譯與執行
cd backend
dotnet run

# 2. 前端專案編譯驗證
cd frontend
pnpm run build
```
