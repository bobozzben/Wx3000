# 規格書：wbase3050 統購發票清單列印與單價設定作業

> **模組代號**：`wbase3050` (`wbase3050_buylist_print` & `wbase3050_buyinv_setamt`)  
> **功能名稱**：統購發票清單列印 (A4 發票清單 / 中一刀發票領取簽收單) + 發票工本費單價設定  
> **所屬模組**：`frontend/src/wbase/wbase3050/` & `backend/Controllers/Wbase3050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3050` (對應資料表 `"c:/w3000/comm"."buyinv"` 與 `"e3000__comm"."總帳參數設定"`)

---

## 1. 模組定位與職責

本模組為發票統購選單 `350` 之核心報表與計價作業，負責根據客戶預購之各類發票本數與單價，計算每家客戶之發票工本費總金額，並輸出清冊或領取簽收單：
1. **`Wbase3050_buylist_print` 統購發票清單列印主視窗 (`wbase3050_buylist_print.tsx`)**：
   - 支援設定列印期別（年、起月、迄月）、分區模式（`1` 依地址縣市、`2` 依購買地點 `F2` 開窗）、排序方式（`1` 依統一編號、`2` 依稅籍編號）。
   - **雙報表格式支援 (`reportType`)**：
     - `1`：**A4 發票清單**（事務所內部彙總與核對清冊）。
     - `2`：**中一刀發票領取簽收單**（供客戶簽收發票並載明字軌、本數與工本費金額）。
   - **原生 FastReport 列印整合**：透過 `LocalAgent` (`POST http://localhost:18889/wbase350_buyinv_list`) 傳遞 `rep_type` 與計算後之 JSON 資料，驅動 `wbaseRP.dll` (`wbase350_buyinv_list`) 開啟預覽或直接列印。
   - **Excel 動態欄位匯出 (`<FormUtilSelectXlsxFieldsList />`)**：支援 25 個欄位（含各類發票本數、各類發票金額、公司本數、總金額、總家數、總本數）之自訂挑選、排序與試算表匯出。
2. **`Wbase3050_buyinv_setamt` 發票工本費單價設定彈窗 (`wbase3050_buyinv_setamt.tsx`)**：
   - 提供 8 種發票（手開二聯、二聯副、三聯、三聯副、特種；收銀二聯、三聯、三聯副）之每本工本費單價設定。
   - 支援全鍵盤 `Enter` / `↓` 順序跳欄、`↑` 上移、`F9` 儲存與 `Esc` 離開。
   - 單價參數持久化於後端 `SystemParamService` (`e3000__comm.總帳參數設定`)。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3050/
├── index.ts                      # 匯出 Wbase3050_buylist_print 與 Wbase3050_buyinv_setamt
├── wbase3050_buylist_print.tsx   # 統購發票清單列印、Excel 欄位設定與預覽主視窗
└── wbase3050_buyinv_setamt.tsx   # 8 種發票工本費單價設定 Modal

frontend/src/services/
└── wbase3050.ts                  # API 查詢、單價讀寫、LocalAgent wbase350_buyinv_list 呼叫與 XLSX 匯出

backend/Controllers/
└── Wbase3050Controller.cs        # /api/wbase3050/query 與 /api/wbase3050/prices
```

---

## 3. 後端 API 規格 (`Wbase3050Controller.cs`)

| HTTP Method | Route Endpoint | 說明 |
| :--- | :--- | :--- |
| `POST` | `/api/wbase3050/query` | 依期別、分區（縣市/購買地點）與排序方式查詢發票購買數量 > 0 之客戶明細（關聯 `CompanyMasters`） |
| `GET` | `/api/wbase3050/prices` | 讀取 8 種發票之每本單價設定（預設：二聯 15、二聯副 16、三聯 18、三聯副 19、特種 15、二收 36、三收 85、三收副 95） |
| `POST` | `/api/wbase3050/prices` | 儲存 8 種發票之每本單價設定至系統參數表 |
| `POST` | `http://localhost:18889/wbase350_buyinv_list` | 呼叫 LocalAgent 執行 `wbaseRP.dll` 之 `wbase350_buyinv_list` 函數（含 `rep_type`: `1`=A4, `2`=中一刀） |
