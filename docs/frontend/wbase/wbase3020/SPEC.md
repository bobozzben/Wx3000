# 規格書：wbase3020 發票購買申購維護與預購表列印作業

> **模組代號**：`wbase3020` & `wbase3020_buyinv_print` (`wbase3030`)  
> **功能名稱**：營業稅發票預購輸入作業 + 發票預購表列印與 Excel 動態欄位匯出  
> **所屬模組**：`frontend/src/wbase/wbase3020/` & `backend/Controllers/Wbase3020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3020` / `wbase3030` (對應地端 `C:\w3000\comm\buyinv.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."buyinv"`)

---

## 1. 模組定位與職責

本模組涵蓋營業稅統一發票預購之兩大核心作業：
1. **`wbase3020` 發票預購本數輸入作業**：
   - **階段 1：期別與過濾條件設定 (`wbase3020_01.tsx`)**：設定申購期別（如 `11505-06`，對應 DBF `yymm="150506"`）、次數 (`1` 首次 / `2` 追加)、輸入方式（`1` 全部、`2` 縣市別、`3` 購買地點、`4` 建檔人員）與條件開窗 (`F2`)，並透過 `systemParamService` 自動記憶上次設定。
   - **階段 2：8 大發票本數整頁盲打 (`wbase3020_02.tsx`)**：使用 `<FoxProGridV2 />` 展示雙層表頭與 8 種發票本數（手開二聯、二聯副、三聯、三聯副、特種；收銀二聯、三聯、三聯副），支援直接打字覆蓋、`Enter` 橫向跳欄與離列即時雙寫存檔。
2. **`wbase3020_buyinv_print` 發票預購表列印與 Excel 匯出作業（選單 `330`）**：
   - 支援依「地址縣市」或「購買地點 (`F2` 開窗)」分區、依「統一編號」或「稅籍編號」排序。
   - 整合 `<FormUtilSelectXlsxFieldsList />` 雙欄式動態欄位選擇器，可自訂匯出 Excel 欄位、標題與順序（持久化於 `localStorage`）。
   - 支援呼叫 `LocalAgent` (`POST http://localhost:18889/wbase320_buyinv`) 驅動 Lazarus `wbaseRP.dll` 開啟原生 FastReport 預購表預覽或直接列印。
3. **混合雲地 DBF 雙向同步 (`Wbase3020Controller.cs`)**：
   - 與地端 `C:\w3000\comm\buyinv.dbf` 即時比對 Checksum 並執行權威雙寫。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3020/
├── index.tsx                    # 預購輸入主進入點 (切換 01 條件視窗與 02 明細表格)
├── wbase3020_01.tsx             # 階段 1：期別/次數/輸入方式設定對話框
├── wbase3020_02.tsx             # 階段 2：8 種發票本數 FoxProGridV2 盲打明細表格
├── wbase3020_buyinv_print.tsx   # 發票預購表列印、原生報表預覽與 Excel 動態欄位匯出視窗
├── wbase3020Print.tsx           # 簡易報表與媒體檔下載對話框
└── useWbase3020.ts              # 狀態管理 Hook

backend/
├── Controllers/
│   └── Wbase3020Controller.cs   # CRUD、Batch Save、預購列印查詢與媒體檔產生 API
└── Models/
    └── InvoicePurchaseMaster.cs # EF Core Entity (Schema: "c:/w3000/comm", Table: "buyinv")
```

---

## 3. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `buyinv`)

> ⚠️ **複合主鍵 (Composite PK)**：(`Period` [`yymm`], `Times` [`times`], `CompanyCode` [`no`])

| DBF / PG 欄位 | EF Core 屬性 (`InvoicePurchaseMaster`) | 說明 |
| :--- | :--- | :--- |
| `yymm` | `Period` (PK) | 申購期別 (DBF 6 碼如 `150506`，前端顯示 `11505-06`) |
| `times` | `Times` (PK) | 申購次數 (`1`: 首次, `2`: 追加) |
| `no` | `CompanyCode` (PK) | 公司編號 |
| `name` | `CompanyShortName` | 公司簡稱 |
| `unino` | `UnifiedNo` | 統一編號 |
| `taxno` | `TaxNo` | 稅籍編號 |
| `a02` / `a02b` | `ManualTwoDup` / `ManualTwoDupSub` | 手開二聯 / 手開二聯副 本數 |
| `a03` / `a03b` | `ManualThreeDup` / `ManualThreeDupSub` | 手開三聯 / 手開三聯副 本數 |
| `spec` | `ManualSpecial` | 手開特種 本數 |
| `c02` / `c03` / `c03b` | `CashTwoDup` / `CashThreeDup` / `CashThreeDupSub` | 收銀二聯 / 收銀三聯 / 收銀三聯副 本數 |
| `_record_number` | `RecordNumber` | DBF 實體記錄號 |

---

## 4. 後端 API 規格 (`Wbase3020Controller.cs`)

- `GET /api/wbase3020?period={p}&times={t}&keyword={q}`：同步 `buyinv.dbf` 並依條件查詢發票預購明細
- `POST` / `PUT` / `DELETE /api/wbase3020`：單筆發票預購雙寫 CRUD
- `POST /api/wbase3020/batch-save`：批次儲存發票申購本數變更
- `POST /api/wbase3020/buyinv-print-query`：查詢發票預購表列印與 Excel 匯出資料（自動關聯 `customer` 公司主檔地址與電話）
- `POST /api/wbase3020/generate-purchase-file`：產生國稅局發票申購媒體檔
