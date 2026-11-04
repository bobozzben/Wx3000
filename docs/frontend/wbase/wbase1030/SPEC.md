# 規格書：wbase1030 建檔人員 (員工資料維護) 作業

> **模組代號**：`wbase1030`  
> **功能名稱**：建檔人員 (員工) 主檔資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + `w3000` 位移加解密 + 台灣地址選取 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1030/` & `backend/Controllers/Wbase1030Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1030` (對應地端 `<Drive>:\w3000\comm\keyin.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"keyin"`)

---

## 1. 模組定位與職責

本模組提供事務所員工/建檔人員主檔資料之整頁行內新增、線上編輯、刪除、`F3` 開窗快查、台灣地址開窗選取與報表清冊列印，維護舊系統 `keyin.dbf` 其中 12 個欄位，並相容其密碼位移加密演算法（`keyin.dbf` 其餘欄位如 `term`、`level`、`pswnew` 等不在本模組畫面上）。
1. **`<FoxProGridV2 />` 試算表盲打模式 (`Wbase1030Form.tsx`)**：
   - 依實際資料筆數渲染列數（`minRows = 0`），支援直接打字覆蓋、`Enter`/`Tab` 右移、列末自動換至下一列首欄，以及欄寬拖曳記憶 (`gridId="wbase1030_grid"`)。每個儲存格確認時即觸發該列存檔 (`onSaveRow` → `handleSaveRow`：存檔前檢核 `validateEmpRow`，新編號走 `POST`、既有編號走 `PUT`，成功後重新載入)。
   - **對齊 `keyin.dbf` 12 欄位**：依序呈現編號 (`no`)、姓名 (`name`)、密碼 (`psw`)、生日 (`birthday`)、電話 (`tel`)、身份證字號 (`id`)、住址 (`addr`)、備註 (`memo`)、工商一站式帳號 (`oneuserid`)、一站式會計軟體驗證碼 (`onepassno`)、電子送達手機 (`phone`)、電子送達收件人EMAIL (`email`)。
   - **`SUPERVISOR` 系統管理員保護機制**：代號為 `SUPERVISOR` 之預設帳號禁止修改代號或刪除（`validateEmpRow`、`canDeleteEmp`），防止系統鎖死。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：住址 (`addr`) 欄位設定 `hasEllipsis: true`，按 `F2` / `F4` 或點擊儲存格右側 `F2` 按鈕即可開啟縣市/鄉鎮區/路名選取器，選定後直接存檔該列。
   - **頁首關鍵字搜尋**：`<WbasePageHeader />` 右側搜尋框送出時以 `GET /api/wbase1030?keyword=` 重新查詢（比對編號、姓名、電話、身份證字號、備註、電子送達手機）。
   - **欄位級別驗證與正規化 (`validation.ts`)**：
     - 阻斷存檔：編號必填且不可重複、`checkPswRule`（密碼 ≤ 8 位元組且 Big5 相容）、`checkOnepassRule`（一站式驗證碼 ≤ 15 位元組且 Big5 相容）、`checkPhoneDigits`（電子送達手機）、`checkBig5Compatible`。
     - 提示但仍可存檔：`checkRocDate`（生日支援民國年或西元年輸入，正規化為 `YYY/MM/DD`）、`checkTaxId`（身份證字號）、`isValidEmail`（E-MAIL 格式）。
2. **`w3000` 原生密碼位移加解密 (`services/validation.ts` + `services/wbase1030.ts`)**：
   - 傳統 VFP `keyin.dbf` 對 `psw` (8 bytes) 與 `onepassno` (15 bytes) 採用字元 ASCII 位移加密儲存。
   - 加解密在**前端**進行：讀取時 `normalizeEmpItem` 以 `w3000DecryptPsw` / `w3000DecryptOnepass` 解密（也接受 16 / 30 碼十六進位字串），存檔時 `sanitizeEmpItemForSave` 以 `w3000EncryptPsw` / `w3000EncryptOnepass` 加密後送後端。後端直接把收到的密文寫入 DBF，`EnsureTableSyncedAsync` 未指定 `hexFields`。
3. **列印與 DLL 報表 (`wbase1030Print.tsx` + `<FoxProPrintModal />`)**：起訖編號區間查詢 (`POST /api/wbase1030/print`)、瀏覽器預覽列印、動態欄位 Excel 匯出 (設定存於 `wbase1030_xlsx_export_config`)，以及 `DLL 報表預覽列印` 按鈕 (`FoxProDllPrintButton`)：透過 `LocalAgent` (`POST http://localhost:5009/report`) 呼叫 `wbaseRP.dll` 的 `waccrep3101_b`（建檔人員清冊）。為避免解密後的密碼寫進本機暫存檔，只傳 `no`、`name`、`tel`、`phone`、`addr`、`memo` 六個欄位。
4. **混合雲地 DBF 雙向同步 (`Wbase1030Controller.cs`)**：讀取前 `EnsureTableSyncedAsync(..., "keyin", ..., "keyin", "no")`；新增/修改/刪除以 `WriteRecordAsync(..., KeyField = "no", ...)` 先寫 `keyin.dbf`，成功後才更新 PostgreSQL 與 checksum。DBF 鎖定 (`LOCK_TIMEOUT`) 時回 `409`。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `keyin`)

長度為前端 `EMP_FIELD_RULES.maxBytes` / 欄位定義 `maxBytes`（存檔前以 `truncateBig5` 截斷）。

| 順序 | DBF / PG 欄位 | EF Core 屬性 (`EmpMaster`) | 前端屬性 (`EmpItem`) | 長度 (Bytes) | 說明 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `no` | `No` (PK，別名 `EmpCode`) | `no` (別名 `empCode`) | `10` | 編號 (必填、不可重複、自動轉大寫；`SUPERVISOR` 禁止改名/刪除) |
| 2 | `name` | `Name` (別名 `EmpName`) | `name` (別名 `empName`) | `20` | 姓名 |
| 3 | `psw` | `Psw` | `psw` | `8` | 密碼 (自動轉大寫；`w3000` 8-byte 位移加解密) |
| 4 | `birthday` | `Birthday` | `birthday` | `9` | 生日 (`checkRocDate` 自動轉 `YYY/MM/DD`) |
| 5 | `tel` | `Tel` | `tel` | `20` | 電話 |
| 6 | `id` | `Id` | `id` | `10` | 身份證字號 (自動轉大寫；`checkTaxId` 提示) |
| 7 | `addr` | `Addr` | `addr` (別名 `address`) | `60` | 住址 (支援 `F2`/`F4` `<AddressSelectModal />`) |
| 8 | `memo` | `Memo` (別名 `DepName`) | `memo` (別名 `depName`) | `20` | 備註 |
| 9 | `oneuserid` | `OneUserId` | `oneuserid` (別名 `oneUserId`) | `20` | 工商一站式帳號 |
| 10 | `onepassno` | `OnePassNo` | `onepassno` (別名 `onePassNo`) | `15` | 一站式會計軟體驗證碼 (`w3000` 15-byte 位移加解密) |
| 11 | `phone` | `Phone` (別名 `Mobile`) | `phone` (別名 `mobile`) | `10` | 電子送達手機 (僅限數字) |
| 12 | `email` | `Email` | `email` | `60` | 電子送達收件人EMAIL (`isValidEmail` 非阻斷提示) |
| - | `_record_number` | `RecordNumber` | `_record_number` | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵規則 (`FoxProGridV2`)

- `Enter`：瀏覽儲存格時進入編輯；編輯中確認並右移至下一儲存格（列末換至下一列首欄；最後一列最後一欄自動新增空白列）。
- `Tab` / `Shift+Tab`、`←` / `→`：左右移動儲存格。
- `↑` / `↓`：上下換列（編輯中先確認再移動；底端按 `↓` 停在最後一列，不新增列）。
- `PageUp` / `PageDown`：依可視高度翻頁；`Home` / `End`：移至列首 / 列尾欄位，加 `Ctrl` 移至第一列 / 最後一列。
- `F2` / `F4`：於住址 (`addr`) 欄位開啟 `<AddressSelectModal />` 台灣地址選取器；其他欄位按 `F2` 切換儲存格編輯狀態。
- `Ins`：在清單末端插入空白列。
- `Del`：彈出刪除確認對話框（`SUPERVISOR` 禁止刪除）。
- `F3`：開啟 `SearchModal` 建檔人員開窗搜尋（比對編號、姓名、電話、身份證字號）。
- `F7`：開啟人員資料區間清冊列印視窗 (`Wbase1030Print` / `<FoxProPrintModal />`)。
- `Esc`：編輯中取消該儲存格編輯；否則關閉列印視窗 / 刪除確認窗，或返回主選單（各列已於確認時逐筆存檔，離開時不另做批次存檔）。

---

## 4. 後端 API 規格 (`Wbase1030Controller.cs`)

- `GET /api/wbase1030?keyword={q}`：同步檢核 `keyin.dbf` 後查詢人員列表（依編號排序）
- `GET /api/wbase1030/{code}`：查詢單筆人員資料
- `POST /api/wbase1030`：雙寫新增（編號已存在時改為更新；先寫入 `keyin.dbf` 再寫入 PostgreSQL）
- `PUT /api/wbase1030/{code}`：雙寫更新（編號不存在時改為新增）
- `DELETE /api/wbase1030/{code}`：雙寫刪除
- `POST /api/wbase1030/print`：依起訖編號 (`codeStart` / `codeEnd`) 查詢列印資料
- `GET /api/wbase1030/inspect`：回傳 PostgreSQL `keyin` 表欄位結構（除錯用）
