# 規格書：wbase1030 建檔人員 (員工資料維護) 作業

> **模組代號**：`wbase1030`  
> **功能名稱**：建檔人員 (員工) 主檔資料維護作業 (`<FoxProGridV2 />` 整頁多列盲打 + 列印)  
> **所屬模組**：`frontend/src/wbase/wbase1030/` & `backend/Controllers/Wbase1030Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1030` (對應地端 `C:\w3000\comm\keyin.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."keyin"`)

---

## 1. 模組定位與職責

本模組提供事務所員工/建檔人員主檔資料之整頁行內新增、線上編輯、刪除、F3 開窗快查與報表清冊列印。
1. **`<FoxProGridV2 />` 試算表盲打模式 (`Wbase1030Form.tsx`)**：
   - 畫面上同時顯示至少 15 列，支援直接打字覆蓋、`Enter`/`Tab` 右移、列末自動換行並即時觸發單筆存檔 (`onSaveRow`)。
   - **非阻斷式 Email 格式提示 (`isValidEmail`)**：若 `E-MAIL` 格式非標準，於儲存格內顯示琥珀色 `⚠️ 格式` 提示徽章，仍允許正常儲存。
2. **混合雲地 DBF 雙向同步 (`Wbase1030Controller.cs`)**：
   - 透過 `IDbfSyncService` 與地端 `C:\w3000\comm\keyin.dbf` 保持 Checksum 快照同步與權威雙寫。

---

## 2. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `keyin`)

| DBF / PG 欄位 | EF Core 屬性 (`EmpMaster`) | 前端屬性 (`EmpItem`) | 說明 |
| :--- | :--- | :--- | :--- |
| `no` | `EmpCode` (PK) | `empCode` | 人員編號 |
| `name` | `EmpName` | `empName` | 人員姓名 |
| `memo` | `DepName` | `depName` | 部門/備註 |
| `phone` | `Mobile` | `mobile` | 聯絡電話/手機 |
| `email` | `Email` | `email` | 電子信箱 |
| `oneuserid` | `OneUserId` | `oneUserId` | 單一登入帳號 |
| `onepassno` | `OnePassNo` | `onePassNo` | 報稅密碼/證號 |
| `psw` | `Psw` | `psw` | 系統密碼 |
| `birthday` | `Birthday` | `birthday` | 生日 |
| `_record_number` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 3. 鍵盤熱鍵規則 (`FoxProGridV2`)

- `Enter` / `Tab`：橫向移動至下一個可編輯儲存格；列末自動換至下一列首欄並存檔；最後一列最後一欄自動新增空白列。
- `↑` / `↓`：上下換列（底端按 `↓` 自動新增空白列）。
- `Ins`：插入空白列。
- `Del` / `F8`：彈出刪除確認對話框。
- `F3`：開啟 `SearchModal` 關鍵字模糊快查。
- `F7`：開啟人員資料區間清冊列印視窗 (`Wbase1030Print`)。
- `Esc`：結束編輯、觸發批次存檔結算並返回主選單。
