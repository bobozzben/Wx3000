# 規格書：wbase1030 建檔人員 (員工資料維護) 作業

> **模組代號**：`wbase1030`  
> **功能名稱**：建檔人員 (員工) 主檔資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + `w3000` 位移加解密 + 台灣地址選取 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1030/` & `backend/Controllers/Wbase1030Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1030` (對應地端 `<Drive>:\w3000\comm\keyin.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"keyin"`)

---

## 1. 模組定位與職責

本模組提供事務所員工/建檔人員主檔資料之整頁行內新增、線上編輯、刪除、`F3` 開窗快查、台灣地址開窗選取與報表清冊列印，並完整相容舊系統 `keyin.dbf` 之 12 個實體欄位與密碼位移加密演算法。
1. **`<FoxProGridV2 />` 試算表盲打模式 (`Wbase1030Form.tsx`)**：
   - 依實際資料筆數渲染列數（`minRows = 0`），支援直接打字覆蓋、`Enter`/`Tab` 右移、列末自動換行並即時觸發單筆存檔 (`onSaveRow`)，以及欄寬拖曳記憶 (`gridId="wbase1030"`)。
   - **完整對齊 `keyin.dbf` 12 欄位**：依序呈現代號 (`no`)、姓名 (`name`)、密碼 (`psw`)、出生日期 (`birthday`)、電話 (`tel`)、身分證字號 (`id`)、通訊地址 (`addr`)、備註 (`memo`)、單一登入帳號 (`oneuserid`)、報稅密碼 (`onepassno`)、手機 (`phone`)、E-MAIL (`email`)。
   - **`SUPERVISOR` 系統管理員保護機制**：代號為 `SUPERVISOR` 之預設帳號禁止修改代號或刪除，防止系統鎖死。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：通訊地址 (`addr`) 欄位設定 `hasEllipsis: true`，按 `F2` 或點擊儲存格右側 `...` 按鈕即可開啟縣市/鄉鎮區/路名選取器。
   - **欄位級別驗證與正規化 (`validation.ts`)**：
     - `checkRocDate`：出生日期支援 6/7 碼民國年或 8 碼西元年輸入，自動正規化為 `YYY/MM/DD`。
     - `checkPhoneDigits`：電話與手機格式檢核。
     - `checkTaxId`：身分證字號檢核。
     - `isValidEmail`：非阻斷式 Email 格式提示徽章（`⚠️ 格式`）。
2. **`w3000` 原生密碼位移加解密與 Hex 同步 (`Wbase1030Controller.cs`)**：
   - 傳統 VFP `keyin.dbf` 對 `psw` (8 bytes) 與 `onepassno` (15 bytes) 採用字元 ASCII 位移加密儲存。
   - 後端實作 `w3000EncryptPsw` / `w3000DecryptPsw` 與 `w3000EncryptOnepass` / `w3000DecryptOnepass`，並於呼叫 `EnsureTableSyncedAsync` 時指定 `hexFields: "psw,onepassno"`，確保二进制密文位元組精準同步且不因 Big5 轉碼損毀。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `keyin`)

| 順序 | DBF / PG 欄位 | EF Core 屬性 (`EmpMaster`) | 前端屬性 (`EmpItem`) | 長度 (Bytes) | 說明 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `no` | `EmpCode` (PK) | `empCode` | `10` | 人員代號 (`SUPERVISOR` 禁止改名/刪除) |
| 2 | `name` | `EmpName` | `empName` | `12` | 人員姓名 |
| 3 | `psw` | `Psw` | `psw` | `8` | 系統密碼 (`w3000` 8-byte 位移加解密 / Hex 同步) |
| 4 | `birthday` | `Birthday` | `birthday` | `9` | 出生日期 (`checkRocDate` 自動轉 `YYY/MM/DD`) |
| 5 | `tel` | `Tel` | `tel` | `15` | 聯絡電話 |
| 6 | `id` | `IdNo` | `idNo` | `10` | 身分證字號 (`checkTaxId`) |
| 7 | `addr` | `Address` | `address` | `50` | 通訊地址 (支援 `F2` `<AddressSelectModal />`) |
| 8 | `memo` | `DepName` | `depName` | `30` | 部門/備註 |
| 9 | `oneuserid` | `OneUserId` | `oneUserId` | `10` | 單一登入帳號 |
| 10 | `onepassno` | `OnePassNo` | `onePassNo` | `15` | 報稅密碼 (`w3000` 15-byte 位移加解密 / Hex 同步) |
| 11 | `phone` | `Mobile` | `mobile` | `15` | 手機號碼 |
| 12 | `email` | `Email` | `email` | `50` | 電子信箱 (`isValidEmail` 非阻斷提示) |
| - | `_record_number` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵規則 (`FoxProGridV2`)

- `Enter` / `Tab`：橫向移動至下一個可編輯儲存格；列末自動換至下一列首欄並存檔；最後一列最後一欄自動新增空白列。
- `↑` / `↓`：上下換列（底端按 `↓` 自動新增空白列）。
- `F2`：於通訊地址 (`addr`) 欄位開啟 `<AddressSelectModal />` 台灣地址選取器。
- `Ins`：插入空白列。
- `Del` / `F8`：彈出刪除確認對話框（`SUPERVISOR` 禁止刪除）。
- `F3`：開啟 `SearchModal` 關鍵字模糊快查。
- `F7`：開啟人員資料區間清冊列印視窗 (`Wbase1030Print` / `<FoxProPrintModal />`)。
- `Esc`：結束編輯、觸發批次存檔結算並返回主選單。
