# 規格書：wbase2020 客戶資料匯出 / wbase2030 客戶資料匯入

> **模組代號**：`wbase2020` (選單 `m_220`)、`wbase2030` (選單 `m_230`)  
> **功能名稱**：客戶資料匯出 / 客戶資料匯入 (以與 VFP 互通的 `custbak.dbf` 在事務所之間搬移客戶資料)  
> **所屬模組**：`frontend/src/wbase/wbase2030/` & `backend/Controllers/Wbase2030Controller.cs` (兩個選單共用，比照 `wbase4020/` 承載 4020–4060)  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base20.prg` `wbasemenu02cmd02` → `wbase.vcx` `wbase2020` (F6 `wbase2020f6`)；`wbasemenu02cmd03` → `wbase2030` (F6 `wbaseonecust`)；密碼 `w3000func.prg` `w_get_password_2`

---

## 1. 模組定位與職責

1. **轉檔列印密碼 (`TransferPasswordModal.tsx`)**：進入兩個畫面前都要輸入 (`motherp.txt` 第 101–110 bytes，6-2 變更)。放棄回選單；錯誤顯示「密碼錯誤!」後回選單，不重試 (同 VFP)。比對只在後端，前端只收集輸入。
2. **2-2 匯出 (`Wbase2020Export.tsx`)**：列出全部客戶 (依代號排序，一開始全部未勾選)，勾選後 `F8` 由後端產生 `custbak.dbf`，以瀏覽器下載 (Electron 會跳出另存新檔)，完成後回選單。
3. **2-3 匯入 (`Wbase2030Import.tsx`)**：`Enter` 選擇 `custbak.dbf` 上傳 → 預覽 (每筆標示「新增」或「覆蓋」，全部未勾選) → 勾選後 `F9` 確認新增／覆蓋筆數 → 寫入 `customer.dbf` → 顯示結果後回選單。
4. **共用元件**：`CustomerSelectGrid.tsx` (唯讀複選清單，複選欄顯示 `=>`)、`AssignCustomerModal.tsx` (`F6` 連續指定客戶)、`Wbase2030Dialogs.tsx` (確認 / 訊息視窗)、`Toast.tsx` + `useToast.ts` (非阻斷提示)；API 在 `frontend/src/services/wbase2030.ts`。

`CustomerSelectGrid` 不使用 `FoxProGridV2`：這裡是唯讀複選清單，`FoxProGridV2` 的 `Ins`、末格 `Enter`/`Tab` 會新增空白列，也無法由外部移動游標 (`F6` 指定、`F9` 查詢都要定位)。視覺依工作區規範 (Consolas 16px、列高 38px、表頭 `#1e3a8a`、黃色焦點框、深淺色主題)。

### 快速鍵 (對齊 VFP)

| 按鍵 | 2-2 匯出 | 2-3 匯入 |
| :--- | :--- | :--- |
| `Space` / 雙擊 | 切換本列勾選並移到下一列 (到底停在末筆) | 同左 |
| `F3` / `F4` | 全選 / 全不選 | 同左 |
| `F6` | 編號：連續輸入客戶編號勾選，`F2` 客戶清單 | 指定客戶：同左 (VFP 沒有 `F2` 清單，Wx3000 也提供) |
| `F9` | 查詢：選中後只移動游標，不勾選 | **匯入資料** |
| `F8` | **匯出資料** | - |
| `Enter` | - | 尚未選檔時開啟檔案對話框 |
| `↑↓` `PgUp/PgDn` | 換列 / 換頁 | 同左 |
| `Ctrl+Home/End`、`Ctrl+PgUp/PgDn` | 首筆 / 末筆 | 同左 |
| `Esc` | 離開 (不確認) | 離開 (不確認；清除上傳的暫存檔，不顯示「匯入完成」) |

---

## 2. 檔案與資料

### `custbak.dbf`

| 項目 | 內容 |
| :--- | :--- |
| 格式 | VFP 自由表 (header `0x30`)、codepage `0x78` (CP950)、無 CDX、無 memo |
| 結構 | 與 `customer.dbf` 相同的 249 欄 |
| 內容 | 匯出時只含勾選的客戶，依 `no` 排序，`SEL` 欄填 `=>` (與 VFP 匯出檔相同) |
| 互通 | VFP 2-3 可匯入 Wx3000 匯出的檔案，Wx3000 也可匯入 VFP 匯出的檔案 (欄位順序不同也可以，依欄名對應) |

### 讀寫的表

| 檔案 | 匯出 | 匯入 |
| :--- | :--- | :--- |
| `customer.dbf` | 讀 (LocalAgent `COPY TO`) | 依 `no` 新增或整筆覆蓋 (LocalAgent，CDX tag `no`) |
| PostgreSQL `customer` | 讀清單 (`no`, `name`, `unino`) | 預覽比對新增／覆蓋；匯入後整表重灌 |
| `motherp.txt` | 讀第 101–110 bytes | 同左 |
| `mopath.txt` | 不使用 | 不使用 |
| 後端暫存 `%TEMP%\Wx3000\custbak\<guid>\custbak.dbf` | 產生後回傳即刪除 | 上傳後保留到匯入完成或離開畫面；超過一天的由後端清除 |

### 勾選狀態

勾選只存在前端 state，送出時只傳勾選的代號。不讀也不寫 `customer.sel`：匯出畫面不會因 `customer.sel = '=>'` 預先勾選；匯入時 `sel` 不覆蓋 (既有客戶保留原值，新客戶為空白)，其餘 248 欄照 VFP 整筆覆蓋。

---

## 3. 後端 API 規格 (`Wbase2030Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `POST` | `/api/wbase2030/verify-password` | body `{ password }` → `{ ok }` |
| `GET` | `/api/wbase2030/customers` | `[{ no, name, unino, selected: false }]`，依代號排序 (不列空白代號)；`selected` 是計算欄位 |
| `POST` | `/api/wbase2030/export` | body `{ password, nos }` → `{ fileName, count, missing, content }`，`content` 為 Base64 的 `custbak.dbf`；`missing` 是地端已找不到的代號 |
| `POST` | `/api/wbase2030/import/preview` | multipart `password`、`file` (上限 20 MB) → `{ importId, rows: [{ no, name, unino, exists }], missingFields, extraFields }` |
| `POST` | `/api/wbase2030/import` | body `{ password, importId, nos }` → `{ inserted, updated, failed: [{ no, reason }], synced }` |
| `DELETE` | `/api/wbase2030/import/{importId}` | 清除上傳的暫存檔 |

- **密碼**：`TransferPasswordService` 依 VFP 比對：輸入補空白到 10 bytes (Big5)，與寫死的主密碼或 `motherp.txt` 解密值 (`(byte - i) mod 256`，i = 1–10) 相等即通過；檔案不存在或該段空白時密碼為 10 個空白。主密碼在後端只保存加鹽 PBKDF2-SHA256 雜湊 (版本庫是公開的，不放明文)，不出現在前端、API 回應、log 或文件。匯出、預覽、匯入每次都重新驗證，錯誤回 403「密碼錯誤!」。
- **預覽檢查** (錯誤回 400)：DBF 版本 (`0x03`/`0x30`/`0x31`/`0x32`)、不可含 memo 欄、表頭與記錄長度一致、必須有 `NO` 字元欄；略過已刪除記錄；代號不可空白、不可重複、不可超過 8 bytes。依表頭欄位描述取欄，不寫死位移。`missingFields` 是 customer 有、來源沒有的欄位 (匯入後會被清空，不含 `sel`)，`extraFields` 是來源多出、會被忽略的欄位。
- **importId** 只接受後端產生的 GUID (N 格式)，再組暫存路徑。
- **匯入**：呼叫 LocalAgent `import_custbak`，**不論成功或失敗**都呼叫 `EnsureTableSyncedAsync` 整表重灌 PostgreSQL；不手動寫 PG、不直接更新 checksum。錯誤：`LOCK_TIMEOUT` 回 409、LocalAgent 連不上回 502、其他 VFP 錯誤回 500，回應帶中斷前的 `inserted` / `updated`。

### LocalAgent 動作 (`localagent/agent.js`)

| 端點 | body | 腳本 |
| :--- | :--- | :--- |
| `POST /api/dbf/export_custbak` | `{ dbfPath, keys, targetFile }` | `USE customer SHARED` → (有 tag `no` 時依代號排序) `COPY TO targetFile FOR 代號在清單中` → 輸出檔 `REPLACE sel WITH "=>" ALL` |
| `POST /api/dbf/import_custbak` | `{ dbfPath, keys, sourceFile }` | `CREATE CURSOR wx_src FROM ARRAY AFIELDS(customer)` → `APPEND FROM sourceFile` → 逐筆 `SEEK(no, "wx_cust", "no")`：存在且 `RLOCK` 成功就 `m.sel = wx_cust.sel` 後 `GATHER MEMVAR`，否則 `m.sel = ""` 後 `INSERT INTO wx_cust FROM MEMVAR` |

- 腳本是固定範本，呼叫端只能傳路徑與代號；代號清單寫入暫存檔 (CP950，`|A001|A002|`) 由 VFP `FILETOSTR` 讀入，不組進腳本。
- 驗證：`dbfPath` 必須是絕對路徑且有 `customer.dbf`；檔案必須是絕對路徑、副檔名 `.dbf`、目錄存在、不含 `"`，不可為 `customer.dbf` 本身；匯出目的檔不可已存在，匯入來源檔必須存在；代號 1–8 字元、不含 `|` 與控制字元。不合格回 `INVALID_REQUEST`。
- 整段包在 `TRY…CATCH…FINALLY`，確保關閉 `wx_cust`、`wx_src`、`wx_bak`。逐筆 `TRY`：單筆被鎖定 (`RLOCK` 失敗，`SET REPROCESS TO 10`) 或寫入錯誤時記在 `failed`，其餘照常匯入。開檔失敗 (VFP 錯誤 3、108、109、130、1705) 回 `LOCK_TIMEOUT`。
- 自由表沒有交易，部分失敗無法回滾，所以逐筆回報，再由整表重灌讓 PostgreSQL 與 DBF 一致。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 檔案位置 | `getdir()` 選伺服器目錄，記在 `mopath.txt` | 匯出由瀏覽器下載、匯入由使用者上傳；不讀寫 `mopath.txt` |
| 匯出畫面預設勾選 | 沿用 `customer.sel` (以前匯入留下的 `=>`) | 全部未勾選 |
| 匯入寫入 `sel` | 整筆覆蓋，把 `=>` 寫進 `customer` | 不覆蓋 `sel` |
| 未勾選就執行 | 匯出 0 筆空檔；匯入不做事但仍顯示「匯入完成」 | 提示先選擇客戶 |
| 匯入前確認 | 無 | 確認新增／覆蓋筆數，提示來源缺少的欄位 (匯入後會被清空) |
| 匯入清單 | 複選、代號、名稱 | 另加「狀態」欄 (新增／覆蓋) |
| 記錄被鎖定 | 重試 10 次後跳 VFP 系統錯誤，可能部分匯入 | 逐筆列出失敗代號，其餘照常匯入 |
| 「匯入完成」 | 關閉畫面時一律顯示 | 只有真的匯入才顯示，並附筆數 |
| 匯出失敗或取消 | 關閉畫面 | 留在畫面可重試 |
| `F6` 比對 | `SET EXACT OFF` 下可能比對到前綴相同的客戶，找不到時無提示 | 完全比對，找不到時提示 |
| 匯入預覽檢查 | 無 | 非 DBF、含 memo、代號空白／重複／超過 8 碼時拒絕 |

保留：依 `no` upsert、整筆覆蓋其餘 248 欄、依欄名對應、來源缺欄被清空 (空白數值存成 0、邏輯存成 .F.)、匯出檔 `sel = '=>'` 與依代號排序、CP950、轉檔列印密碼 (含主密碼)、密碼錯誤不重試、匯入後不補建 `cust_sal`。
