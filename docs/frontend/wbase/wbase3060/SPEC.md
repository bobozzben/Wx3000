# 規格書：wbase3060 統購發票字軌輸入與 Excel 匯入作業

> **模組代號**：`wbase3060` (`wbase3060_01` & `wbase3060_02`)  
> **功能名稱**：統購發票字軌起迄號盲打輸入 + 國稅局網路購買 / 代售點購買 Excel 批次匯入  
> **所屬模組**：`frontend/src/wbase/wbase3060/` & `backend/Controllers/Wbase3060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3060` (對應地端 `C:\w3000\comm\buyinv.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."buyinv"`)

---

## 1. 模組定位與職責

本模組為發票統購選單 `360` 之核心作業，用於在每期統一發票配發後，登錄或從國稅局/代售點提供的配號 Excel 檔批次匯入各客戶之 **發票字軌（2碼英文）與起迄號碼（8碼數字）**：
1. **階段 1：期別條件設定與 Excel 批次匯入 (`wbase3060_01.tsx`)**：
   - **上半部（手動進入條件）**：設定期別（年、起月、迄月）、購買次數（`1` 首次購買、`2` 追加購買）與排序方式（`1` 依公司統編、`2` 依公司編號、`3` 依稅籍編號），按確定進入階段 2 表格。
   - **下半部（Excel 字軌自動匯入區）**：
     - 支援選擇 `.xls` / `.xlsx` / `.csv` 檔案，前端透過 SheetJS (`xlsx`) 解析後呼叫 `/api/wbase3060/import-excel`。
     - 支援兩種匯入來源格式：
       1. **`1` 網路購買格式**（財政部電子發票整合服務平台下載格式，可選 `I` 欄或 `F` 欄作為本數欄）。
       2. **`2` 代售點購買格式**（印刷廠/代售點提供之字軌配號表）。
     - 內建「查看網路購買格式範例」、「查看代售點格式範例」與「財政部電子發票平台連結」輔助彈窗。
2. **階段 2：8 大發票種類字軌與起迄號整頁盲打 (`wbase3060_02.tsx`)**：
   - 使用 `<FoxProGridV2 />` 搭配雙層表頭 (`headerGroups`)，呈現每家公司之 8 種發票（二聯、二聯副、三聯、三聯副、特種、收銀二聯、收銀三聯、收銀三聯副）的 **「本數(唯讀) | 字軌 | 起號 | 迄號」** 共 36 個欄位。
   - **智慧起迄號自動推算 (`useWbase3060.ts`)**：
     - 字軌自動轉為 2 碼大寫英文字母。
     - 當操作員輸入「起號」並按 `Enter` 時，系統依據該類發票申購「本數」（手開發票每本 50 張、收銀機發票每卷 250 張），**自動推算並填入 8 碼「迄號」**（例如本數 2 本、起號 `12345600` ➔ 自動算出迄號 `12345699`）。
   - 支援離列即時雙寫存檔 (`updateRow`) 與整頁批次存檔 (`batch-save`)。
3. **混合雲地 DBF 雙向同步 (`Wbase3060Controller.cs`)**：
   - 每次修改字軌或匯入 Excel 時，優先透過 `IDbfSyncService.WriteRecordAsync` 寫入地端 `C:\w3000\comm\buyinv.dbf`（欄位 `a02beg`, `a02begno`, `a02endno` ... 等），成功後同步更新 PostgreSQL `"c:/w3000/comm"."buyinv"`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3060/
├── index.tsx              # 模組主進入點 (切換 01 條件/匯入畫面 與 02 字軌盲打表格)
├── wbase3060_01.tsx       # 階段 1：期別/排序條件設定 + 國稅局/代售點 Excel 解析與匯入介面
├── wbase3060_02.tsx       # 階段 2：8 種發票 (本數/字軌/起號/迄號) FoxProGridV2 盲打表格
└── useWbase3060.ts        # 狀態管理 Hook (含起迄號自動推算與雙寫存檔邏輯)

frontend/src/services/
└── wbase3060.ts           # Axios API 通訊模組

backend/Controllers/
└── Wbase3060Controller.cs # 字軌查詢、單筆/批次雙寫更新與 Excel 匯入 API
```

---

## 3. 資料庫與 DBF 字軌欄位對照 (`c:/w3000/comm` . `buyinv`)

| 發票種類 | 本數欄位 | 字軌欄位 (2碼) | 起號欄位 (8碼) | 迄號欄位 (8碼) | 每本張數 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **手開二聯** | `a02` (`ManualTwoDup`) | `a02beg` | `a02begno` | `a02endno` | 50 張 |
| **手開二聯副** | `a02b` (`ManualTwoDupSub`) | `a02bbeg` | `a02bbegno` | `a02bendno` | 50 張 |
| **手開三聯** | `a03` (`ManualThreeDup`) | `a03beg` | `a03begno` | `a03endno` | 50 張 |
| **手開三聯副** | `a03b` (`ManualThreeDupSub`) | `a03bbeg` | `a03bbegno` | `a03bendno` | 50 張 |
| **特種發票** | `spec` (`ManualSpecial`) | `specbeg` | `specbegno` | `specendno` | 50 張 |
| **收銀二聯** | `c02` (`CashTwoDup`) | `c02beg` | `c02begno` | `c02endno` | 250 張 |
| **收銀三聯** | `c03` (`CashThreeDup`) | `c03beg` | `c03begno` | `c03endno` | 250 張 |
| **收銀三聯副** | `c03b` (`CashThreeDupSub`) | `c03bbeg` | `c03bbegno` | `c03bendno` | 250 張 |

---

## 4. 後端 API 規格 (`Wbase3060Controller.cs`)

| HTTP Method | Route Endpoint | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase3060?period={p}&times={t}&sortOrder={s}&keyword={q}` | 同步 `buyinv.dbf` 後查詢指定期別且有申購本數之客戶字軌清單 |
| `PUT` | `/api/wbase3060/update-row` | 單筆客戶字軌與起迄號雙寫更新（先寫入 `buyinv.dbf`，再更新 PostgreSQL） |
| `POST` | `/api/wbase3060/batch-save` | 批次儲存多筆客戶字軌變更 |
| `POST` | `/api/wbase3060/import-excel` | 接收前端解析之 Excel 配號陣列，依統編/稅籍編號/公司編號自動匹配客戶並雙寫更新對應發票種類之字軌、起號、迄號與本數 |
