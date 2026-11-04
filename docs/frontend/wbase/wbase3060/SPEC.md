# 規格書：wbase3060 統購發票字軌輸入與 Excel 匯入作業

> **模組代號**：`wbase3060` (`wbase3060_01` & `wbase3060_02`)  
> **功能名稱**：統購發票字軌起迄號盲打輸入 + 國稅局網路購買 / 代售點購買 Excel 批次匯入  
> **所屬模組**：`frontend/src/wbase/wbase3060/` & `backend/Controllers/Wbase3060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase3060` (對應地端 `<Drive>:\w3000\comm\buyinv.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"buyinv"`)

---

## 1. 模組定位與職責

本模組為發票統購選單 `360` 之核心作業（選單代碼 `wbase3060_01`，`wbaseMainPage.tsx` 對應到 `Wbase3060`），用於在每期統一發票配發後，登錄或從國稅局/代售點提供的配號 Excel 檔批次匯入各客戶之 **發票字軌（2碼英文）與起迄號碼（8碼數字）**：
1. **階段 1：期別條件設定與 Excel 批次匯入 (`wbase3060_01.tsx`)**：
   - **上半部（手動進入條件）**：設定期別（年、起月、迄月）、購買次數（`1` 本期首次購買、`2` 本期追加購買）與排序方式（`1` 依公司統編（預設）、`2` 依公司編號、`3` 依稅籍編號），按 `F8` 確定進入階段 2 表格。期別、次數與排序透過 `systemParamService` 存於 `參數設定`（`營業稅發票購買期別`、`營業稅發票購買次數`、`統購字軌排序方式`）。
   - **下半部（Excel 字軌自動匯入區）**：
     - 按 `[...]` 選擇 `.xls` / `.xlsx` 檔案，前端透過 SheetJS (`xlsx`) 解析第一個工作表：在前 5 列中找出含「統編 / 統一編號 / 字軌 / 起號」的表頭列，再依關鍵字對應統一編號、稅籍編號、發票種類、字軌、起號、迄號、本數欄位（找不到時使用預設欄位位置），字軌轉為大寫，最後呼叫 `/api/wbase3060/import-track`。
     - 支援兩種匯入來源格式 (`sourceType`)：
       1. **`1` 網路購買格式**（財政部電子發票整合服務平台下載格式）。
       2. **`2` 代售點購買格式**（印刷廠/代售點提供之字軌配號表；表頭沒有本數欄時可選 `I` 欄或 `F` 欄作為本數欄）。
     - 內建兩種格式的「格式預覽」範例彈窗，以及「下載點網址」彈窗（財政部電子發票整合服務平台、財政部印刷廠發票網路申購）。
2. **階段 2：8 大發票種類字軌與起迄號整頁盲打 (`wbase3060_02.tsx`)**：
   - 使用 `<FoxProGridV2 />` 搭配雙層表頭 (`headerGroups`)，呈現每家公司之 8 種發票（二聯、二聯副、三聯、三聯副、特種、收銀二聯、收銀三聯、收銀三聯副）的 **「本數(唯讀) | 字軌 | 起號 | 迄號」** 加上公司編號、簡稱、統編、稅籍編號 4 個唯讀欄，共 36 個欄位。
   - 列出該期別與次數在 `buyinv` 中的所有公司，可用關鍵字搜尋（公司編號、簡稱、統編、稅籍編號）。
   - **迄號自動推算 (`wbase3060_02.tsx` 的 `handleSaveRowWithAutoCalc`)**：
     - 存檔時若某種發票的「迄號」空白、「起號」為 8 碼數字且該類申購「本數」> 0，依每本張數（手開發票每本 50 張、收銀機發票每卷 250 張）**自動推算並填入 8 碼「迄號」**（例如本數 2 本、起號 `12345600` ➔ 迄號 `12345699`）。
   - 離列即時存檔：每次存檔以單筆陣列呼叫 `PUT /api/wbase3060/batch`。
3. **混合雲地 DBF 雙向同步 (`Wbase3060Controller.cs`)**：
   - 查詢前以 `EnsureTableSyncedAsync(..., "buyinv", ..., "buyinv", keyFields: "_record_number")` 同步。
   - 修改字軌時透過 `IDbfSyncService.WriteRecordAsync(keyField: "yymm,times,no")` 寫入地端 `<Drive>:\w3000\comm\buyinv.dbf`（欄位 `a02beg`, `a02begno`, `a02endno` ... 等），並同步更新 PostgreSQL `<drive>:/w3000/comm` . `"buyinv"`；DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。
   - ⚠️ Excel 匯入 (`import-track`) 與資料清除 (`clear`) 目前只更新 PostgreSQL 快照，未寫入 `buyinv.dbf`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3060/
├── index.tsx              # 模組主進入點 (切換 01 條件/匯入畫面 與 02 字軌盲打表格)
├── wbase3060_01.tsx       # 階段 1：期別/排序條件設定 + 網路購買/代售點 Excel 解析與匯入介面
├── wbase3060_02.tsx       # 階段 2：8 種發票 (本數/字軌/起號/迄號) FoxProGridV2 盲打表格 (含迄號自動推算)
└── useWbase3060.ts        # 狀態管理 Hook (Zustand：查詢、單筆存檔、清除、Excel 匯出、預覽視窗)

frontend/src/services/
└── wbase3060.ts           # Axios API 通訊模組

backend/Controllers/
└── Wbase3060Controller.cs # 字軌查詢、批次雙寫更新、Excel 匯入與清除 API
```

---

## 3. 資料庫與 DBF 字軌欄位對照 (`<drive>:/w3000/comm` . `buyinv`)

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
| `GET` | `/api/wbase3060?period={p}&times={t}&sortOrder={s}&keyword={q}` | 同步 `buyinv.dbf` 後查詢指定期別與次數之客戶字軌清單（關聯 `customer` 補齊簡稱、統編、稅籍編號） |
| `PUT` | `/api/wbase3060/batch` | 更新一筆或多筆客戶字軌與起迄號：逐筆以 `WriteRecordAsync(UPDATE, keyField: "yymm,times,no")` 寫入 `buyinv.dbf`，再更新 PostgreSQL |
| `POST` | `/api/wbase3060/import-track` | 接收前端解析之 Excel 配號陣列，依公司編號、統一編號、稅籍編號依序比對當期客戶（前端解析時只帶統編與稅籍編號），再依「發票種類」寫入對應字軌、起號、迄號（只更新 PostgreSQL） |
| `POST` | `/api/wbase3060/clear` | 清除指定期別與次數所有客戶的字軌與起迄號，保留申購本數（只更新 PostgreSQL） |

---

## 5. 鍵盤熱鍵對照表

### 階段 1 (`wbase3060_01.tsx`)
- `Enter` / `↓` / `↑`：於年、起月、迄月、次數、排序之間移動
- `F8`：確定並進入階段 2
- `Esc`：退回 wbase 主選單

### 階段 2 (`wbase3060_02.tsx`)
- `Enter` / `Tab` / 方向鍵：`<FoxProGridV2 />` 儲存格導覽與跳欄（本數與公司資料欄位唯讀），離列自動存檔
- `F5`：切換排序方式 (`1` → `2` → `3`) 並重新查詢
- `F7`：匯出 Excel（`統購字軌資料_<期別>_<次數>次.xlsx`）
- `F8`：確認後清除當期所有字軌資料
- `Esc`：回到階段 1
- 工具列另有「預覽畫面」（以新視窗顯示目前選取公司的字軌，可列印）、「查詢」與「方向」按鈕；`F12` / 「方向」目前只切換按鈕上的方向圖示，未影響表格跳欄方向。
