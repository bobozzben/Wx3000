# 規格書：wbase3060 統購發票字軌輸入與 Excel 轉入作業

> **模組代號**：`wbase3060` (`wbase3060_01` & `wbase3060_02`)  
> **功能名稱**：統購發票字軌起迄號盲打輸入 + 財政部印刷廠網路購買 / 代售點購買 Excel 批次轉入  
> **所屬模組**：`frontend/src/wbase/wbase3060/` & `backend/Controllers/Wbase3060Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class `wbase3022` (期別條件 + 資料匯入 [轉入])、`wbase3026` (字軌輸入)；`SourS9BASE\PROGS\base30.prg` `wbasemenu03cmd06` (把轉入的 `netbuy.dbf` 併回 `buyinv.dbf`)。對應地端 `<Drive>:\w3000\comm\buyinv.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"buyinv"`

---

## 1. 模組定位與職責

本模組為發票統購選單 `360` 之核心作業（選單代碼 `wbase3060_01`，`wbaseMainPage.tsx` 對應到 `Wbase3060`），用於在每期統一發票配發後，登錄或從財政部印刷廠 / 代售點提供的配號 Excel 檔批次轉入各客戶之 **發票字軌（2碼英文）與起迄號碼（8碼數字）** 及本數：

### 1.1 階段 1：期別條件設定與 Excel 轉入 (`wbase3060_01.tsx`，VFP `wbase3022`)

- **上半部（手動進入條件）**：設定期別（年、起月、迄月）、購買次數（`1` 本期首次購買、`2` 本期追加購買）與排序方式（`1` 依公司統編（預設）、`2` 依公司編號、`3` 依稅籍編號），按 `F8` 確定進入階段 2 表格。期別、次數與排序透過 `systemParamService` 存於 `參數設定`（`營業稅發票購買期別`、`營業稅發票購買次數`、`統購字軌排序方式`）。
- **下半部「資料匯入」**（VFP `Label14` / `Text7` XLS檔 / `Command1` [...] / `Command2` [轉入] / `BUYPOSI` / `GPQTY` / `Command4`~`Command6`）：
  - `XLS檔`：`Enter` 或點選開啟檔案選擇 (`.xls` / `.xlsx`)，`[...]` 同。
  - **來源格式** (`importMode`，VFP `BUYPOSI`)：`1` 網路購買、`2` 代售點購買。購買次數輸入 `2` (追加) 時強制為代售點購買且網路購買不可選，輸入 `1` 時回到網路購買 (VFP `Text2.Valid`)。
  - VFP 的 `GPQTY` (I 欄數量 / F 欄數量) 在舊版畫面已隱藏，網頁版不提供這個選項，代售點購買一律用 I 欄數量格式。
  - **格式預覽**：以 `GET /api/wbase3060/doc-image/{name}` 讀取資料磁碟機的圖檔顯示在彈窗 (`Esc`/`Enter` 關閉)：網路購買 `tgo01.jpg`、代售點購買 `tgo02.jpg` (VFP `Command4` / `Command5`)。圖檔不存在時彈窗顯示後端訊息「找不到格式預覽圖檔 X:\W3000\doc\tgo02.jpg」。
  - **下載點網址**：另開 `https://invoice.ppmof.gov.tw/` (VFP `Command6`)。
  - **[轉入]** (VFP `Command2.Click`)：依序檢查「年度不可空白!!」「月份不可空白!!」「年度輸入不正確!!」(< 34)「月份輸入不正確!!」(1~12)「請輸入奇數月份!!」「月份區間不正確!!」與是否選了檔案，再以 `ConfirmDialog` 問「確定轉入 財政部印刷廠發票網路購買配號明細 Excel資料 / 代售點購買發票配號明細 Y/N ?」。確定後在前端用 SheetJS 解析第一個工作表 (`wbase3060Import.ts`)，呼叫 `POST /api/wbase3060/import-track`，結果以 `MessageDialog` 顯示「轉入期別:11506 / 共轉入 N 家公司資料：新增 X 筆、更新 Y 筆、Z 筆無異動 / 找不到客戶資料，未轉入：... / 請繼續執行 <F8.確定> 編輯該資料.」，並在匯入區顯示一行摘要。
- **Excel 解析規則** (`wbase3060Import.ts`，與 VFP `APPEND FROM ... XL8` 一樣依欄位位置，不看表頭文字)：
  - **網路購買 (`tgo01.jpg`)**：第 1 列 `N` 欄為期別 (年 3 碼 + 迄月 2 碼，例如 `11506`)，與畫面的年度、迄月不符時回「轉入期別:11506 與發票購買期別不符!」(VFP 錯誤 #6809)。資料列為 `A` 欄以數字開頭的列：`A` 統編 `B` 公司名稱 `C` 稅籍編號，之後每 4 欄 (數量、字軌、起號、迄號) 依序為 `D~G` 二聯式、`H~K` 二聯副、`L~O` 三聯式、`P~S` 三聯副、`T~W` 特種、`X~AA` 二收銀、`AB~AE` 三收銀、`AF~AI` 三收副；每種發票有任一值才產生一筆。
  - **代售點購買 (`tgo02.jpg`)**：`A` 期別 `B` 統編 `C` 稅籍 `D` 公司名稱 `E` 發票種類 `F` 字軌 `G` 起號 `H` 迄號 `I` 數量 `J` 購買方式 `K` 購買地點 `L` 購買日期 (取前 7 碼，VFP `netbuy.buydate c(7)`)。解析器另保留 VFP `GPQTY` F 欄數量格式 (`F` 數量 `G` 字軌 `H` 起號 `I` 迄號，`qtyCol: 'F'`) 但畫面不提供。追加購買只取購買方式以「零售」開頭的列，首次購買只取非零售 (VFP `SET FILTER TO btype='零售'`)；期別取第一列 5 碼數字的 `A` 欄，年度與迄月不符即拒絕，每列的迄月也要相同。發票種類對應：`二聯式` `二聯副` `三聯式` `三聯副` `二收銀` `三收銀` `三收副` `特種` / `特種稅`，其他種類略過並在結果列出。
  - 統編與起迄號為純數字且不足 8 碼時補前導 0 (Excel 數值儲存格會掉 0)；字軌轉大寫；數量用 `parseInt` (VFP `Val()`)。

### 1.2 階段 2：8 大發票種類字軌與起迄號整頁盲打 (`wbase3060_02.tsx`)

- 使用 `<FoxProGridV2 />` 搭配雙層表頭 (`headerGroups`)，呈現每家公司之 8 種發票（二聯、二聯副、三聯、三聯副、特種、收銀二聯、收銀三聯、收銀三聯副）的 **「本數(唯讀) | 字軌 | 起號 | 迄號」** 加上公司編號、簡稱、統編、稅籍編號 4 個唯讀欄，共 36 個欄位。
- 列出該期別與次數在 `buyinv` 中的所有公司，可用關鍵字搜尋（公司編號、簡稱、統編、稅籍編號）。
- **迄號自動推算 (`wbase3060_02.tsx` 的 `handleSaveRowWithAutoCalc`)**：存檔時若某種發票的「迄號」空白、「起號」為 8 碼數字且該類申購「本數」> 0，依每本張數（手開發票每本 50 張、收銀機發票每卷 250 張）**自動推算並填入 8 碼「迄號」**（例如本數 2 本、起號 `12345600` ➔ 迄號 `12345699`）。
- 離列即時存檔：每次存檔以單筆陣列呼叫 `PUT /api/wbase3060/batch`。

### 1.3 混合雲地 DBF 雙向同步 (`Wbase3060Controller.cs`)

- 查詢前以 `EnsureTableSyncedAsync(..., "buyinv", ..., "buyinv", keyFields: "_record_number")` 同步；Excel 轉入另以 `"no"` 同步 `customer`。
- 修改字軌時透過 `IDbfSyncService.WriteRecordAsync(UPDATE, keyField: "RECNO(),yymm,times,no")` 寫入地端 `buyinv.dbf`（欄位 `a02beg`, `a02begno`, `a02endno` ... 等），全部成功後才同步 PostgreSQL 並 `CommitWriteChecksumAsync`；DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。
- Excel 轉入 (`import-track`) 與資料清除 (`clear`) 同樣先寫 DBF；轉入新增的列以 `INSERT` 寫入 DBF，再以回傳的 RECNO 補進 PostgreSQL 快照。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3060/
├── index.tsx              # 模組主進入點 (切換 01 條件/匯入畫面 與 02 字軌盲打表格)
├── wbase3060_01.tsx       # 階段 1：期別/排序條件設定 + 網路購買/代售點 Excel 轉入介面、格式預覽、確認與訊息視窗
├── wbase3060Import.ts     # Excel 解析 (兩種格式的欄位位置、期別與購買方式過濾、VFP 期別檢查字句)
├── wbase3060_02.tsx       # 階段 2：8 種發票 (本數/字軌/起號/迄號) FoxProGridV2 盲打表格 (含迄號自動推算)
└── useWbase3060.ts        # 狀態管理 Hook (Zustand：查詢、單筆存檔、清除、Excel 匯出、預覽視窗)

frontend/src/services/
└── wbase3060.ts           # Axios API 通訊模組 (含 importExcelTracks、fetchDocImage)

backend/Controllers/
└── Wbase3060Controller.cs # 字軌查詢、批次雙寫更新、Excel 轉入、格式預覽圖檔與清除 API
```

---

## 3. 資料庫與 DBF 字軌欄位對照 (`<drive>:/w3000/comm` . `buyinv`)

| 發票種類 | `kind` / 本數欄位 | 字軌欄位 (2碼) | 起號欄位 (8碼) | 迄號欄位 (8碼) | 每本張數 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **手開二聯** | `a02` (`ManualTwoDup`) | `a02beg` | `a02begno` | `a02endno` | 50 張 |
| **手開二聯副** | `a02b` (`ManualTwoDupSub`) | `a02bbeg` | `a02bbegno` | `a02bendno` | 50 張 |
| **手開三聯** | `a03` (`ManualThreeDup`) | `a03beg` | `a03begno` | `a03endno` | 50 張 |
| **手開三聯副** | `a03b` (`ManualThreeDupSub`) | `a03bbeg` | `a03bbegno` | `a03bendno` | 50 張 |
| **特種發票** | `spec` (`ManualSpecial`) | `specbeg` | `specbegno` | `specendno` | 50 張 |
| **收銀二聯** | `c02` (`CashTwoDup`) | `c02beg` | `c02begno` | `c02endno` | 250 張 |
| **收銀三聯** | `c03` (`CashThreeDup`) | `c03beg` | `c03begno` | `c03endno` | 250 張 |
| **收銀三聯副** | `c03b` (`CashThreeDupSub`) | `c03bbeg` | `c03bbegno` | `c03bendno` | 250 張 |

其他轉入會用到的欄位：`yymm` (6 碼期別，例如 `150506`)、`times`、`no`、`name`、`unino`、`taxno`、`buydate` (購買日期 `c(9)`，舊檔可能沒有，VFP 會動態 `ALTER TABLE` 加上；快照沒有這個欄位時轉入不讀寫它)。

---

## 4. 後端 API 規格 (`Wbase3060Controller.cs`)

| HTTP Method | Route Endpoint | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase3060?period={p}&times={t}&sortOrder={s}&keyword={q}` | 同步 `buyinv.dbf` 後查詢指定期別與次數之客戶字軌清單（關聯 `customer` 補齊簡稱、統編、稅籍編號） |
| `PUT` | `/api/wbase3060/batch` | 更新一筆或多筆客戶字軌與起迄號：逐筆以 `WriteRecordAsync(UPDATE, keyField: "RECNO(),yymm,times,no")` 寫入 `buyinv.dbf`，再更新 PostgreSQL |
| `POST` | `/api/wbase3060/import-track` | 轉入前端解析的 Excel 資料，見 4.1 |
| `GET` | `/api/wbase3060/doc-image/{name}` | 讀 `<Drive>:\W3000\doc\{name}.jpg` (`name` 只接受 `tgo01`、`tgo02`)，回 `image/jpeg`；不存在回 `404 { message }` |
| `POST` | `/api/wbase3060/clear` | 清除指定期別與次數所有客戶的字軌與起迄號，保留申購本數 |

### 4.1 `POST /api/wbase3060/import-track`

**Request**：`{ period: "11505-06", times: "1" | "2", sourceType: "1" | "2", items: ImportExcelTrackItem[] }`，每筆 `items` 是一個「公司 × 發票種類」：`{ unifiedNo, taxNo, companyName, buyDate, kind, quantity, track, startNo, endNo }`（網路購買一列公司最多展開 8 筆；代售點購買一列即一筆）。

**對應與寫入規則**（為了避免舊程式轉入後的重覆列，見第 6 節）：

1. 同步 `buyinv` (`_record_number`) 與 `customer` (`no`)，讀出該期別、次數的所有購買紀錄。
2. 每筆資料找客戶代號：**統編 + 稅籍都相同的當期購買紀錄 → 統編 + 稅籍都相同的客戶 → 只比統編的當期購買紀錄 (RECNO 最小，與 VFP `LOCATE` 一致) → 只比統編的客戶 (RECNO 最小)**。總分公司同統編不同稅籍時各自對應，不會像 VFP 寫進同統編的第一家。都找不到的列不新增，回報在 `unmatched`。
3. 決定寫到哪一列：**首次購買每家每期只有一列**（有就更新，沒有才新增）；**追加購買依購買日期**：同日期的列 → 購買日期空白的既有列 (順便補上日期) → 新增；Excel 沒有購買日期時直接用該客戶既有的列。同一次轉入裡同一家公司的多筆資料都併到同一列。
4. **Excel 有值的欄位才寫入**（本數 > 0、字軌 / 起迄號非空白），不清掉既有資料（VFP 首次購買的做法，錯誤 #5994；追加購買在 VFP 會整列覆蓋，這裡一樣不覆蓋）。與目前值相同的欄位不算異動。
5. 既有列以 `RECNO(),yymm,times,no` 定位 `UPDATE`；新列 `INSERT` 時 LocalAgent 先在 DBF 找 `yymm,times,no[,buydate]` 相同的未刪除記錄，有就回 `DUPLICATE_KEY` → 後端回 `409`「已被其他工作站新增，Excel 轉入中止，請重新執行轉入」。新列的 `name` 用客戶簡稱 (`abbr`，沒有才用全名)、`taxno` 用客戶稅籍 (沒有才用 Excel 的)，`yymm` / `times` 跟既有列的格式。
6. DBF 全部成功後同步 PostgreSQL (更新列 `UPDATE`、新列 `INSERT` 帶 `_record_number`) 並 `CommitWriteChecksumAsync`；任一筆 DBF 失敗即中止並回報已寫入筆數。

**Response**：`{ success, period, times, sourceType, totalItems, companies (對應到的家數), rows (對應到的列數), inserted, updated, unchanged, skipped, unmatched: [{ unifiedNo, taxNo, companyName }], message }`。同一個檔案轉入第二次會是 `inserted: 0, updated: 0`。

---

## 5. 鍵盤熱鍵對照表

### 階段 1 (`wbase3060_01.tsx`)
- `Enter` / `↓` / `↑`：於年、起月、迄月、次數、排序之間移動；排序欄 `↓` 進入 `XLS檔`
- `XLS檔`：`Enter` / `Space` 選擇檔案、`↓` 到 [轉入]、`↑` 回排序欄
- [轉入]：`Enter` 轉入 (先確認 Y/N)、`↓` 到 [F8. 確定]、`↑` 回 `XLS檔`；[F8. 確定] `↑` 回 [轉入]
- 網路購買 / 代售點購買：`Tab` 到單選鈕後以 `←` `→` 切換
- 確認視窗 `Y`/`Enter` 確定、`N`/`Esc` 取消；訊息視窗與格式預覽 `Enter`/`Esc` 關閉
- `F8`：確定並進入階段 2（轉入中不作用）
- `Esc`：退回 wbase 主選單

### 階段 2 (`wbase3060_02.tsx`)
- `Enter` / `Tab` / 方向鍵：`<FoxProGridV2 />` 儲存格導覽與跳欄（本數與公司資料欄位唯讀），離列自動存檔
- `F5`：切換排序方式 (`1` → `2` → `3`) 並重新查詢
- `F7`：匯出 Excel（`統購字軌資料_<期別>_<次數>次.xlsx`）
- `F8`：確認後清除當期所有字軌資料
- `Esc`：回到階段 1
- 工具列另有「預覽畫面」（以新視窗顯示目前選取公司的字軌，可列印）、「查詢」與「方向」按鈕；`F12` / 「方向」目前只切換按鈕上的方向圖示，未影響表格跳欄方向。

---

## 6. VFP 舊程式的轉入流程與重覆資料的成因

舊程式分兩段：`wbase3022.Command2.Click` [轉入] 把 Excel 讀進暫存檔 `c:\w3000\temp\netbuy.dbf`（網路購買直接 `APPEND FROM ... XL8` 對位；代售點先讀進 `xxls` 游標，依 `unino+taxno+buydate` 併成 netbuy 的一列），按 `F8` 後 `wbasemenu03cmd06` 把當期 `buyinv` 複製到暫存檔 `mbuyinv`、把 netbuy 併進去、開 `wbase3026` 編輯，離開時對每一列 mbuyinv 執行 `DELETE ALL FOR no == mbuyinv.no AND unino == ... AND taxno == ... AND times = ... AND yymm = ...` 再 `APPEND FROM mbuyinv`。重覆列的來源：

1. **追加購買以「統編 + 購買日期」找列** (`SEEK Alltrim(netbuy.unino)+netbuy.buydate`)：先在畫面手動輸入的追加列購買日期是空白，Excel 的列有日期，找不到就 `APPEND BLANK`，同一家公司變成兩列；首次購買在 20241206 已改成只比統編 (程式註解「避免重覆」)，追加購買沒有改。實際資料裡 `buyinv` 已存在 `140910/2/47077D`、`130506/2/58004` 各兩列內容相同的追加紀錄。
2. **離開時用「現在的值」刪舊列**：若 `no` / `unino` / `taxno` 在編輯或合併過程中改了，`DELETE ALL FOR` 比對不到原本那列，`APPEND FROM` 又把新列加回去，舊列留在檔案裡。
3. **只比統編找客戶** (`LOCATE FOR unino == ...` 取第一家)：客戶檔同統編有多家 (總分公司、換代號後留下的舊客戶) 時，轉入的列可能掛到另一個代號，和手動輸入的那家並存。
4. **刪除不 `PACK`、`APPEND FROM` 不去重**：已經重覆的列每次轉入都原樣複製回去，永遠不會合併；多人同時操作時刪除與附加也不是原子操作。

新作法 (第 4.1 節) 不再「整批刪除再附加」，而是逐列對應後 `UPDATE`，只有確定沒有那家公司 (或追加購買沒有該購買日期) 時才 `INSERT`，並由 LocalAgent 在 DBF 上做最後一次重複檢查，因此同一檔案重複轉入、先手動輸入再轉入、總分公司同統編都不會多出列。已經存在的重覆列需另外清理，轉入時一律只更新 RECNO 最小的那列。

### 與 VFP 的其他差異

- VFP 轉入只在 3022 建 netbuy，要按 `F8` 進編輯畫面、再離開才真的寫回 `buyinv`；網頁版按 [轉入] 確認後直接寫入 DBF。
- VFP 網路購買 + 追加購買時 netbuy 會建立但 `wbasemenu03cmd06` 不合併 (`xFlag`)；網頁版在次數為 2 時直接不允許選網路購買。
- 新列的公司名稱直接用客戶簡稱 (VFP 先寫客戶全名，下次進入 3-6 時才被 `customer.abbr` 蓋掉)。
- VFP 的 `GPQTY` (I 欄 / F 欄數量) 在畫面上是隱藏的，網頁版同樣不顯示，代售點購買固定用 I 欄數量格式與 `tgo02.jpg`。
