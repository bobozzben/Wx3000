# 規格書：wbase5070 碳健檢企業名單匯出 (5-7)

> **模組代號**：`wbase5070` (選單「500 管理報表」→「570 碳健檢企業名單匯出」)  
> **功能名稱**：碳健檢企業名單匯出 (勾選客戶 → 輸入資料年度與月份區間 → 計算各客戶年度銷售額合計 → 匯出 Excel)  
> **所屬模組**：`frontend/src/wbase/wbase5070/`、`frontend/src/services/wbase5070.ts` & `backend/Controllers/Wbase5070Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base50.prg` `wbasemenu05cmd07` (114/04/25 #6384)；畫面 `SourS9BASE\LIBS\wbase.vcx` 的 `wbase4000` (報表列印多家選單)、`wbase4001` (客戶區間)、`wbase5070` (碳健檢企業名單匯出功能)

---

## 1. 模組定位與職責

VFP 流程：`customer` 依 `no` 排序 `COPY TO` 暫存表 `tmpcust` (加欄 `mselect`、`t025`) → `wbase4000` 勾選客戶 → 刪除未勾選 → `wbase5070` 輸入年度、月份 → `F8` 問轉檔列印密碼 → 逐家讀 `datapath + 客戶代號 + '\' + RIGHT(年度,2) + '\t403.dbf'` 加總 `t025` → `data2excl` 轉出 Excel。

網頁版在同一個頁面 `Wbase5070Page` 分兩段，**只讀資料，不寫任何 DBF**；Excel 在瀏覽器產生，**沒有列印報表，也沒有 `wbaseRP.dll` 報表函數** (VFP 本來就只有轉 Excel)。

### 1.1 第一段：選擇客戶 (VFP `wbase4000`)

- 開啟時 `GET /api/wbase5070/customers` 載入全部客戶 (代號空白的不列出)，依代號排序，**全部未選擇** (與 VFP 新增的 `mselect` 欄相同；不讀也不寫 `customer.sel`)。
- 格線為 `<FoxProGridV2 />` 唯讀清單 (`allowInsert=false`、各欄 `editable=false`，`gridId="wbase5070_cust_grid"`)：選擇 (`→`)、公司編號、公司名稱。狀態列顯示「已選擇 n 家」。
- 按鍵在頁面 `window` 的 capture 階段攔截 (`FoxProGridV2` 自己也聽 `F3`/`F7`/`Esc`)：

| 按鍵 | 動作 | VFP |
| :--- | :--- | :--- |
| `Enter` | 切換目前列的選擇並移到下一列 (末筆停在末筆) | `enter.Click` |
| `F3` / `F4` | 全選 / 全不選 | `f3.Click` / `f4.Click` |
| `F8` 或 `Space` | 開「客戶區間」視窗 (`Wbase5070RangeModal`) | `f8.Click` → `wbase4001` |
| `F2` | 開客戶選單 (`SearchModal`)，選到的客戶設為選擇並移到該列；已選擇時提示「客戶已經選擇!!」 | 公司編號欄 `F2` (`sele9`) |
| `F7` | 開「查詢客戶」(`SearchModal`)，只移動游標，不改選擇 | `f7.Click` (`_form_find`) |
| `Esc` | 離開選擇客戶，進入第二段 (即使沒有選任何客戶) | `esc.Click` 後接著開 `wbase5070` |

- 點選「選擇」欄也可切換；`↑`/`↓`/`PgUp`/`PgDn`/`Ctrl+Home`/`Ctrl+End` 由 `FoxProGridV2` 處理。
- `Enter` 換列的做法：切換後在 `window` 送一個 `ArrowDown` 給 `FoxProGridV2` (它沒有由外部逐列移動游標的 API)。`F2`/`F7` 的定位用 `activeRowKey`，`getRowKey` 帶一個每次定位遞增的序號，同一家客戶也能重複定位。
- 客戶區間 (`Wbase5070RangeModal`)：起始客戶、結束客戶 (轉大寫、最多 8 字)，空白代表第一筆 / 最後一筆；`F8` 確定後代號 (轉大寫) 在區間內的客戶全部設為選擇，區間外不變；`Esc` 放棄。`Enter`/`↓` 下一欄 (最後到「F8 確定」鈕)、`↑` 上一欄，代號欄 `F2` 開客戶選單帶回代號 (VFP 沒有，依專案 UX 規則補上)。

### 1.2 第二段：碳健檢企業名單匯出功能 (VFP `wbase5070`，`Wbase5070Condition`)

| 欄位 | 預設 | 規則 |
| :--- | :--- | :--- |
| 資料年度 | 今天的民國年 3 碼 (`currentRocYear()`；VFP 為 `yy3(m.meyear)`) | 只收數字、最多 3 碼；`F8` 時空白顯示「年度不可空白!」 |
| 營業起始月份 | `01` | 只收數字、最多 2 碼；離開或 `F8` 時須為 1~12，否則「請輸入1至12 月份!」 |
| 結束月份 | `12` | 同上；小於起始月份時「結束月份比起始月份小!」 |

- `Enter`/`↓` 下一欄 (最後一欄到「F8 確定」鈕，再按 `Enter` 等於 `F8`)、`↑` 上一欄；檢核錯誤時留在原欄並選取內容，直接打字即覆蓋。
- `Esc` 放棄：回主選單 (VFP `fesc.Click` 關閉表單後回選單)。
- **`F8` 確定** (VFP `f8.Click`)：
  1. 檢核三個欄位 (見上表)。
  2. 沒有選擇任何客戶時提示「尚未選擇任何客戶，請先選擇要匯出的客戶!」並回第一段 (VFP 會照樣轉出只有欄名的 Excel)。
  3. 轉檔列印密碼視窗 (沿用 `wbase2030/TransferPasswordModal`)，`POST /api/wbase5070/verify-password` 比對；錯誤顯示「密碼錯誤!」並留在第二段，`Esc` 放棄也留在第二段。
  4. 每 20 家一批呼叫 `POST /api/wbase5070/sales`，顯示「計算年度銷售額中… n / N 家」進度。
  5. 有客戶的 `t403.dbf` 讀取失敗 (`source = error`)，或勾選的客戶已不在 `customer` 中時，先以確認視窗列出 (最多 10 筆) 並問「仍要匯出 Excel 嗎？」(`Y`/`Enter` 匯出、`N`/`Esc` 取消並留在第二段)。讀取失敗的客戶銷售額以 0 匯出，已不存在的客戶不匯出。
  6. 產生 Excel 下載 (見 1.3)，完成訊息「已匯出 n 家客戶，檔名 …」，該年度沒有 `t403.dbf` 的家數另外註明；關閉訊息後回主選單 (VFP 轉出後 `thisform.release`)。

### 1.3 Excel 格式 (VFP `data2excl` / `data2excl_OOXML`)

- 檔名 `碳健檢企業名單_<年度>年<起月>-<迄月>月.xlsx` (VFP 以 `PUTFILE` 讓使用者選檔名)，工作表「碳健檢企業名單」。
- 第 1 列是欄名，之後每家客戶一列，順序同第一段 (客戶代號)：

| 欄名 | 來源 | 型別 |
| :--- | :--- | :--- |
| 客戶代號 | `customer.no` | 文字 |
| 客戶名稱 | `customer.name` | 文字 |
| 聯絡人姓名 | `customer.linkman` | 文字 |
| 聯絡人電話 | `customer.linktel` | 文字 |
| 聯絡人E-mail | `customer.email` | 文字 |
| 統一編號 | `customer.unino` | 文字 |
| 地址 | `customer.addr` | 文字 |
| 資本額 | `customer.capital` | 數值 |
| 年度銷售額合計 | `t403.t025` 在月份區間內的加總，四捨五入到整數 (VFP 寫回 `tmpcust.t025 N(16)`) | 數值 |
| 行業代號 | `customer.pnostd` | 文字 |

- 欄寬依內容估算 (中文字算 2 字寬，對應 VFP 的 `AutoFit`)。VFP 的頁首「印表日期: … 碳健檢企業名單」是 Excel **列印頁首**，不在儲存格內；`xlsx` 套件無法寫列印頁首，網頁版不輸出。

---

## 2. 檔案結構與資料表

```text
frontend/src/wbase/wbase5070/
├── index.tsx                  # Wbase5070Page：兩段流程、選擇客戶格線 (FoxProGridV2)、密碼、進度、確認與訊息視窗
├── Wbase5070RangeModal.tsx    # 客戶區間 (VFP wbase4001)
└── Wbase5070Condition.tsx     # 碳健檢企業名單匯出功能 (VFP wbase5070：資料年度、起訖月份)

frontend/src/services/wbase5070.ts   # API (fetchCarbonCustomers、verifyCarbonPassword、fetchCarbonSales 分批)
                                     # + CARBON_EXCEL_FIELDS、exportCarbonExcel、currentRocYear

backend/
├── Controllers/Wbase5070Controller.cs   # ADO + DTO (GetDbConnection)
└── Models/Wbase5070Models.cs            # CarbonCustomerDto、CarbonSalesRequest、CarbonSalesRowDto、CarbonSalesResultDto
```

另沿用 `wbase2030/TransferPasswordModal`、`wbase2030/Wbase2030Dialogs` (`MessageDialog`、`ConfirmDialog`)、`wbase2040/KeyHintBar` 與後端 `TransferPasswordService`。

### 讀取的表

| DBF | 路徑 | PostgreSQL schema | 同步 keyFields | 用途 |
| :--- | :--- | :--- | :--- | :--- |
| `customer` | `<drive>:\w3000\comm` | `<drive>:/w3000/comm` | `no` | 客戶清單與匯出欄位 |
| `t403` (401 資料檔) | `<drive>:\w3000\data\<客戶代號>\<年末 2 碼>` (VFP `datapath`) | `<drive>:/w3000/data/<客戶代號小寫>/<年末 2 碼>`，例如 `c:/w3000/data/001/14` | `""` (保留全部列，和 VFP 的 `SUM` 一致) | 加總 `t025` |

- **每家客戶、每個年度各一個 schema**：第一次匯出某年度時，每家有 `t403.dbf` 的客戶都會建立一個 schema 並整表同步 (約 150 個欄位、12 列)；之後 checksum 相符就不重灌。實測 96 家客戶 (23 家有資料)：第一次約 8 秒，之後約 1.6 秒。
- 年末 2 碼：年度補滿 3 碼後取末 2 碼 (VFP `RIGHT(pyear,2)`，`yy3` 為 3 碼)，例如 `114` → `14`、`100` → `00`。
- `t403` 主要欄位：`mm` C(2) 月份 `01`~`12`、`t025` N(18,2) 銷售額合計；每個年度檔通常 12 列 (每月一列)。
- 客戶代號含路徑字元 (`\ / : * ? " < > |`)、是 `.` / `..` 或前後有空白時，不組路徑，視為沒有資料檔。

---

## 3. 後端 API 規格 (`Wbase5070Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase5070/customers` | 客戶清單 `[{ no, name, selected: false }]`，排除空白代號，依 `TRIM(no) COLLATE "C"` 排序 |
| `POST` | `/api/wbase5070/verify-password` | Body `{ password }` → `{ ok }`；轉檔列印密碼 (`TransferPasswordService`，`motherp.txt` 第 101~110 bytes) |
| `POST` | `/api/wbase5070/sales` | Body `{ password, year, startMonth, endMonth, nos }` → `{ rows, missing }`，見下 |

**`POST sales`**

- 每次都再比對密碼，錯誤回 403 `{ message: "密碼錯誤!" }`。
- 400：年度空白或不是 1~3 位數字「年度不可空白!」、月份不在 1~12「請輸入1至12 月份!」、結束 < 起始「結束月份比起始月份小!」、`nos` 為空「請先選擇客戶」、超過 50 家 (`MaxBatch`)、代號超過 8 bytes (Big5) 或含控制字元。
- 處理順序：`EnsureTableSyncedAsync(customer)` → 以 `TRIM(no) IN (...)` 讀客戶 (同代號取 `_record_number` 最小的一筆) → 依請求順序逐家：
  - 不在 `customer` 中 → 放進 `missing`。
  - 資料目錄沒有 `t403.dbf` → `t025 = 0`、`source = "nofile"` (VFP `IF FILE(...)` 不成立時為 0)。
  - `EnsureTableSyncedAsync(目錄, "t403", schema, "t403", "")` 失敗，或 SQL 例外 → `t025 = 0`、`source = "error"`、`message` 說明。
  - 否則 `SELECT COALESCE(SUM(t025),0) … WHERE mm >= @smm AND mm <= @emm` (月份補 2 碼，字串比較，同 VFP)，四捨五入 (`AwayFromZero`) 到整數，`source = "ok"`。
- `rows` 每列：`no, name, linkman, linktel, email, unino, addr, capital, t025, pnostd, source, message`。
- 其他例外回 500 `{ message }`。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 畫面 | `wbase4000`、`wbase5070` 兩個獨立表單 | 同一頁面兩段；第二段 `Esc` 回主選單 (同 VFP) |
| 公司編號欄 | 可直接輸入代號或 `F2` 選客戶，**覆蓋目前列**的 `no`、`name` (其他欄位仍是原列的資料) | 格線唯讀；`F2` 改為「選到的客戶設為選擇並移到該列」，匯出欄位一律取自該客戶本身 |
| 區間選擇比較 | `no >= sno AND no <= eno`，`SET EXACT` 未設定時空白結束代號等於不限 | 轉大寫後字串比較，空白代表不限 |
| 月份檢核 | `!(value>=1 OR value<=12)` 恆為假，實際不擋；只擋結束 < 起始 | 限制 1~12，結束不可小於起始 |
| 沒有選擇客戶 | 照樣轉出只有欄名的 Excel | 提示後回第一段，不轉出 |
| 密碼 | 前端 `w_get_password_2` 比對 | 只在後端比對，每個計算請求都再帶一次 |
| `t403` 開檔失敗 | 略過，該家為 0，不提示 | 該家為 0，匯出前列出並確認 |
| 計算 | 單一迴圈逐家 `SELECT SUM` | 前端每 20 家一批呼叫後端，顯示進度 |
| Excel | `PUTFILE` 選檔名；`.xls` (或 `UseOOXML.TXT` 時 `.xlsx`)，列印頁首含印表日期與標題，轉出後自動開啟 | 瀏覽器下載 `.xlsx`，固定檔名，無列印頁首，不自動開啟 |
