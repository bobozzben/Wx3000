# 規格書：wbase3050 統購發票清單列印與單價設定作業

> **模組代號**：`wbase3050` (`wbase3050_buylist_print` & `wbase3050_buyinv_setamt`)  
> **功能名稱**：統購發票清單列印 (A4 發票清單 / 中一刀發票領取簽收單) + 發票工本費單價設定  
> **所屬模組**：`frontend/src/wbase/wbase3050/` & `backend/Controllers/Wbase3050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3050` (對應資料表 `<drive>:/w3000/comm` . `"buyinv"` (源自地端 `<Drive>:\w3000\comm\buyinv.dbf`) 與 `<drive>:/w3000/comm` . `"參數設定"`)

---

## 1. 模組定位與職責

本模組為發票統購選單 `350` 之核心報表與計價作業，負責根據客戶預購之各類發票本數與單價，計算每家客戶之發票工本費總金額，並輸出清冊或領取簽收單：
1. **`Wbase3050_buylist_print` 統購發票清單列印主視窗 (`wbase3050_buylist_print.tsx`)**：
   - 選單 `350` (`wbase3050`) 由 `wbaseMainPage.tsx` 對應到此視窗。
   - 支援設定列印期別（年、起月、迄月）、分區模式（`1` 依地址縣市，`*` 代表全部；`2` 依購買地點，`F2` 開窗查詢 `/api/wbase3010`）、排序方式（`1` 依統一編號、`2` 依稅籍編號）。查詢時次數固定為 `1`。
   - **雙報表格式支援 (`reportType`)**：
     - `1`：**A4 發票清單**（事務所內部彙總與核對清冊，FastReport 範本 `frxReport_3501_buyinv`）。
     - `2`：**中一刀發票領取簽收單**（供客戶簽收發票並載明字軌、本數與工本費金額，FastReport 範本 `frxReport_3502_buyinv`）。
   - **前端金額試算**：查詢後依單價設定計算各類發票金額（本數 × 單價）、公司本數，以及總家數、總本數、總金額，並加上民國製表日期。
   - **原生 FastReport 列印整合**：透過 `LocalAgent` (`POST http://localhost:5009/api/call`，`dll: "wbaseRP"`、`func: "wbase350_buyinv_list"`) 傳遞 `rep_type` 與計算後之 JSON 資料，驅動 `wbaseRP.dll` 開啟預覽（`IsPrint = 0`）。
   - **Excel 動態欄位匯出 (`<FormUtilSelectXlsxFieldsList />`)**：預設匯出 25 個欄位（含各類發票本數、各類發票金額、公司本數、總金額、總家數、總本數），另可加選公司電話、傳真、地址、期別等欄位；自訂挑選、標題與排序後匯出試算表（設定存於 `localStorage` 的 `wbase3050_xlsx_export_config`）。
2. **`Wbase3050_buyinv_setamt` 發票工本費單價設定彈窗 (`wbase3050_buyinv_setamt.tsx`)**：
   - 選單沒有獨立項目；在清單列印視窗按 `F6`（金額設定）以 Modal 開啟。（`wbaseMainPage.tsx` 雖保留 `wbase3050_buyinv_setamt` 代碼分支，但 `menuConfig.ts` 沒有對應項目。）
   - 提供 8 種發票（手開二聯、二聯副、三聯、三聯副、特種；收銀二聯、三聯、三聯副）之每本工本費單價設定。
   - 支援全鍵盤 `Enter` / `↓` 順序跳欄、`↑` 上移、`←` / `→` 於左側（手開式 4 種）與右側（特種與收銀機 4 種）欄位間切換；`Esc` 或「儲存並離開」按鈕會先儲存再關閉。
   - 單價參數持久化於後端 `SystemParamService`（`<drive>:/w3000/comm` . `"參數設定"`，名稱：`手開二聯單價`、`手開二聯副單價`、`手開三聯單價`、`手開三聯副單價`、`特種單價`、`收銀二聯單價`、`收銀三聯單價`、`收銀三聯副單價`，並同步寫入 `四聯式收銀機發票單價`）。API 失敗時前端改用 `systemParamService` 直接讀寫。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3050/
├── index.ts                      # 匯出 Wbase3050_buylist_print 與 Wbase3050_buyinv_setamt
├── wbase3050_buylist_print.tsx   # 統購發票清單列印、金額試算、Excel 欄位設定與預覽主視窗
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
| `POST` | `/api/wbase3050/query` | 先以 `EnsureTableSyncedAsync(..., "buyinv", ..., "buyinv", keyFields: "yymm,times,no")` 同步，再依期別、分區（縣市/購買地點）與排序方式查詢客戶明細（關聯 `CompanyMasters`）；該期只要有任一筆本數 > 0，就只列出本數 > 0 的公司。前端呼叫失敗時改呼叫 `/api/wbase3020/buyinv-print-query` |
| `GET` | `/api/wbase3050/prices` | 讀取 8 種發票之每本單價設定（預設：二聯 15、二聯副 16、三聯 18、三聯副 19、特種 15、二收 36、三收 85、三收副 95） |
| `POST` | `/api/wbase3050/prices` | 儲存 8 種發票之每本單價設定至系統參數表 |
| `POST` | `http://localhost:5009/api/call` | 呼叫 LocalAgent 執行 `wbaseRP.dll` 之 `wbase350_buyinv_list` 函數：`args: [0.125, 0, 0, 0, 0, rep_type, <path>]`（`rep_type`: `1`=A4, `2`=中一刀），`jsonData` 由 LocalAgent 寫成暫存 JSON 並取代最後一個參數。`wbase350_buyinv_list` 已登記於 `localagent/dlls.json` |

---

## 4. 鍵盤熱鍵對照表

### 清單列印 (`wbase3050_buylist_print.tsx`)
- `Enter`：依序於年、起月、迄月、分區、條件、排序、列印表格、匯出 xlsx 設定之間移動，最後停在 `F7. 列印` 按鈕
- 分區、排序、列印表格欄位可直接按 `1` / `2` 切換
- `F2`：分區為購買地點時開窗選擇
- `F4`：預覽查詢與試算後的全欄位資料
- `F6`：開啟發票工本費單價設定
- `F7`：呼叫 LocalAgent `wbase350_buyinv_list` 報表預覽
- `F8`：匯出 Excel（勾選「匯出 xlsx 設定」時先開欄位選擇器）
- `Esc`：離開

### 單價設定 (`wbase3050_buyinv_setamt.tsx`)
- `Enter` / `↓`：下一欄（最後一欄移到「儲存並離開」按鈕）
- `↑`：上一欄
- `←` / `→`：左右欄切換
- `Esc`：儲存並關閉
