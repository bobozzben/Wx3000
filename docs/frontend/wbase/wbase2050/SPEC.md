# 規格書：wbase2050 總分支機構設定

> **模組代號**：`wbase2050` (分公司資料維護子畫面 `wbase2050f8`)  
> **功能名稱**：總分支機構設定 (總機構清單 `<FoxProGridV2 />` + F8「分公司資料維護」)  
> **所屬模組**：`frontend/src/wbase/wbase2050/`、`frontend/src/services/wbase2050.ts` & `backend/Controllers/Wbase2050Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base20.prg` `wbasemenu02cmd05` → `SourS9BASE\LIBS\wbase1.vcx` class `wbase2050` (總機構清單) 與 `wbase2050f8` (分公司資料維護)

---

## 1. 模組定位與職責

設定營業稅「總機構彙總報繳」的總機構與分支機構對應，以及媒體申報用的旗標。營業稅系統 (`wtaxop6.prg` 媒體申報) 依這些欄位決定要輸出哪些客戶、401 申報別與分支資料。

- **總機構** = `customer.tpay = '1'` 的客戶。本功能不能新增或移除總機構，要到「客戶資料建檔」改彙總註記。
- **分支機構** = `customer.mainunino` 等於總機構統一編號的客戶，存檔時 `tpay` 寫成 `'2'`。**對應鍵是統編，不是客戶代號**，兩個統編相同的總機構會看到同一組分支。

**檔案結構**：`index.tsx` (`Wbase2050Page`，頁面層 capture 按鍵、在總機構清單與分公司維護間切換)、`useWbase2050.ts` (Zustand store)、`Wbase2050Form.tsx` (總機構清單，`gridId="wbase2050_hq"`)、`Wbase2050F8Form.tsx` (分公司資料維護，`gridId="wbase2050_branch"`)、`FieldDescBar.tsx` (欄位說明列)；API Client 為 `frontend/src/services/wbase2050.ts`。

### 1.1 總機構清單 (`Wbase2050Form.tsx`)

| 欄 | 欄位 | 可編輯 | 規則 |
| :--- | :--- | :-: | :--- |
| 客戶代號 / 客戶簡稱 / 統一編號 | `no` / `abbr` / `unino` | ✗ | |
| 進銷項合併設定 | `tchk` | ✔ | 只接受 `1`、`2`；改了以後進銷項媒體連動 (`1` → `2`、`2` → `3`) |
| 進銷項媒體 | `mediatype` | ✗ | 由 `tchk` 決定：`tchk = '2'` 為 `3`.不媒體，其他 (含空白) 為 `2`.進銷項 |
| 申報書媒體 | `t401` | ✗ | 固定 `Y` |
| 零稅率媒體 / 固定資產退稅申報 / 不得扣抵媒體 | `tzero` / `tflog` / `tnot` | ✔ | 只接受 `Y`、`N` (自動轉大寫) |

- 不合法的值以 toast 阻斷並留在原格 (VFP 靜默不寫入)；值沒有變 (例如空白舊資料直接按 Enter) 時放行。
- **逐列即時存檔**：確認一格後 `PUT /api/wbase2050/headquarters/{no}`，失敗時還原為伺服器值並提示。存檔依序執行，F8 與 Esc 會先等存檔完成。
- **離開時正規化 (保留 VFP 行為)**：VFP 關閉畫面時對每個總機構回寫 `t401='Y'` 與依 `tchk` 算出的 `mediatype`。這裡畫面直接顯示算出的值，`GET` 另帶 DBF 原值 (`dbMediatype`、`dbT401`)；Esc 離開時只對兩者不同的列回寫。回寫失敗時跳出確認框列出失敗的總機構，可選擇仍要離開 (下次開啟會再回寫)。
- 底部黑底黃字的**欄位說明列** (VFP `flddesc`) 依目前欄位切換，使用 `FoxProGridV2` 的 `onActiveCellChange`。
- 沒有總機構時顯示「尚無總機構（彙總註記=1）資料，請至客戶資料建檔設定」。清單不能新增列 (`allowInsert={false}`)，也沒有刪除。

### 1.2 分公司資料維護 (`Wbase2050F8Form.tsx`，F8 開啟)

- **開啟前檢查** (訊息照 VFP)：統編空白 →「公司統編尚未輸入,請先輸入後再執行此功能」；`tchk` 空白 →「尚未設定進銷存合併方式」。
- 以條件式 render 取代總機構清單 (不是蓋在上面的 modal)：`FoxProGridV2` 監聽 `window` 按鍵，兩個格線同時掛載會一起反應。
- 頂端唯讀資訊列：合併公司 `[no] abbr`、統編、進銷存合併方式 (`1.進銷存併總公司申報總繳` / `2.子公司各別申報併總公司總繳`)。

| 欄 | 欄位 | 可編輯 | 規則 |
| :--- | :--- | :-: | :--- |
| 客戶代號 | `no` | ✔ | 大寫、8 bytes；`F2` 客戶選單；檢查見下 |
| 客戶簡稱 / 統一編號 | `abbr` / `unino` | ✗ | 輸入代號後由客戶資料帶入 |
| 彙總註記 | `tpay` | ✗ | 顯示 `2` |
| 進銷項媒體 | `mediatype` | ✔ | `0`~`4` |
| 申報書媒體 | `t401` | ✗ | 顯示 `Y` |
| 零稅率媒體 / 固定資產退稅申報 / 不得扣抵媒體 | `tzero` / `tflog` / `tnot` | ✔ | `Y` / `N`；輸入代號後由客戶資料帶入 |

- **新增 (Ins)**：新列 `tpay='2'`、`t401='Y'`，進銷項媒體與總機構相反 (總機構 `tchk='1'` → `3`、`'2'` → `2`，VFP `insert.Click`)。最後一格 Enter/Tab 也會新增。
- **客戶代號檢查** (VFP 找不到就靜默忽略，其他都不檢查)：
  1. 空白 → 阻斷；重複 → 阻斷。
  2. 查無此客戶 (完全比對，不是 VFP 的前綴 SEEK) → 阻斷。
  3. 總機構本身 → 阻斷；其他總機構 (`tpay='1'`) → 阻斷「該客戶為總機構，請先至客戶資料建檔修改彙總註記」。
  4. 已掛在其他總機構下 → 確認框「是否改掛到本總機構？」，Y 才採用 (列上標示「改掛」)，N 還原。
  5. 通過後帶入 `abbr`、`unino`、`tzero`、`tnot`、`tflog` (F2 也帶 `tflog`，修正 VFP 漏帶)。
- **既有分支改代號**：允許。列上標示「原 xxx」，存檔時先清掉原客戶的 `mainunino` (只清仍掛在本總機構下、且這次沒有再列入的客戶)，再寫新客戶；新客戶沿用該列的進銷項媒體。
- 客戶代號欄**不設 `isPrimaryKey`**：格線的主鍵空白檢查在 `validate` 之前，新列按 F2 時失焦送出的空白會被擋下並搶回焦點，客戶選單就拿不到輸入焦點。空白與重複改在欄位 `validate` 檢查，F2 選單開啟時放行；空白代號的列存檔時直接略過。
- **刪除 (Del)**：確認「是否確定刪除:代號」後**立即**清空該客戶的 `mainunino`，`tpay` 等欄不動 (同 VFP)。新列只在畫面移除；改過代號的列刪的是原客戶。
- **Esc 存檔並返回**：`PUT /api/wbase2050/headquarters/{no}/branches` 送出所有非空白代號的列。全部成功就回到總機構清單並停在原總機構；有失敗時以確認框列出失敗的代號與原因，N 留在畫面修正後再按 Esc 重送，Y 放棄未存檔的修改並返回。

### 1.3 快速鍵

| 按鍵 | 總機構清單 | 分公司資料維護 |
| :--- | :--- | :--- |
| Enter / 數字、英文字母 | 編輯 (字元鍵覆蓋原值) | 同左 |
| `Ins` / `Del` | 無作用 | 新增 / 刪除 (立即生效) |
| `F2` | - | 客戶代號欄開客戶選單 (搜尋代號、名稱、簡稱、統編) |
| `F8` | 分公司設定 (編輯框內無效) | - |
| `F12` | 切換 Enter 方向，初始 **↓ 往下** (VFP Init 先切換一次) | 切換 Enter 方向，每次開啟初始 **→ 往右** |
| `Esc` | 編輯中取消；否則離開 (先正規化) | 編輯中取消；否則存檔並返回 |
| 確認框 | `Y` / `Enter` 是，`N` / `Esc` 否 | 同左 |

頁面層的 keydown 以 capture 註冊在 `window`：確認框、讀取或存檔中時攔下所有按鍵，不會落到格線。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm`.`customer`)

只用 `customer.dbf`，同步不設唯一鍵 (`EnsureTableSyncedAsync(..., "customer", ..., "customer", "")`，與 `wbase4020` 相同；`wbase2010`、`wbase2030` 則以 `no` 為 keyFields)。

| 欄位 | DBF 型別 | 說明 |
| :--- | :--- | :--- |
| `no` | C8 | 客戶代號 |
| `abbr` / `name` | C | 客戶簡稱 / 名稱 |
| `unino` | C8 | 統一編號 |
| `tpay` | C1 | 彙總註記：`0`.單一機構報繳、`1`.總機構彙總報繳、`2`.各單位(分支機構)分別申報 |
| `tchk` | C1 | 進銷項合併設定：`1`.進銷項併總公司申報總繳、`2`.子公司各別申報併總公司總繳 |
| `mediatype` | C1 | 進銷項媒體：`0`.銷項、`1`.進項、`2`.進銷項、`3`.不媒體、`4`.(藍)進銷項 |
| `t401` / `tzero` / `tflog` / `tnot` | C1 | 申報書媒體 / 零稅率媒體 / 固定資產退稅申報 / 不得扣抵媒體 (Y/N) |
| `mainunino` | C8 | 總機構統編 (只有分支機構有值) |

寫入欄位與 VFP 回寫相同：總機構 `tchk, mediatype, t401, tzero, tnot, tflog` (不寫 `tpay`)；分支 `tpay, mediatype, t401, tnot, tzero, mainunino, tflog`；刪除只寫 `mainunino`。

---

## 3. 後端 API 規格 (`Wbase2050Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase2050/headquarters` | `tpay='1'` 依客戶代號排序；`mediatype`、`t401` 為算出的值，另附 `dbMediatype`、`dbT401` 原值 |
| `PUT` | `/api/wbase2050/headquarters/{no}` | Body `{ tchk, tzero, tflog, tnot }`；`tchk` ∈ {空白,1,2}、Y/N 欄 ∈ {空白,Y,N} (400)；已不是總機構回 409；伺服器決定 `mediatype` 與 `t401='Y'`；回傳存檔後的列 |
| `GET` | `/api/wbase2050/headquarters/{no}/branches` | `{ hq, branches }`；前置檢查不過回 400 (訊息照 VFP)；分支 = `mainunino` 等於總機構統編，排除總機構本身與其他總機構 |
| `PUT` | `/api/wbase2050/headquarters/{no}/branches` | Body `{ branches: [{ no, origNo, mediatype, tzero, tflog, tnot, allowMove }] }`，回傳 `{ success, results: [{ no, success, errorType, message }], branches }` |
| `DELETE` | `/api/wbase2050/headquarters/{no}/branches/{branchNo}` | 清空 `mainunino`；該客戶已掛在別的總機構下回 409，查無客戶回 404，已不是分支直接成功 |
| `GET` | `/api/wbase2050/customers?keyword=` | 客戶選單與代號檢查 (`no, name, abbr, unino, tpay, mainunino, tzero, tnot, tflog`)，keyword 比對代號、名稱、簡稱、統編 |

- **分支整批存檔**：先檢查全部列 (客戶存在、不是總機構本身、不是其他總機構、代碼合法、重複；已掛在其他總機構下而 `allowMove` 不是 true 的列也擋下)，再清改代號的原客戶，最後逐筆寫入。`mainunino` 一律由伺服器填入總機構統編。遇到失敗就記錄下來繼續下一筆 (VFP `lock_rec` 取消時略過該筆，但不提示)，全部處理完才更新一次 Checksum。
- 只寫入與目前資料不同的欄位，值相同的回寫不改變 DBF 內容，略過以減少鎖定與快照重灌。
- DBF 以 `RECNO(),no` 定位 (RECNO 過期時回 `RECORD_NOT_FOUND` 而不是改錯列)，找不到再只用 `no` 完全比對；DBF 成功後以 LocalAgent 回傳的 RECNO 更新 PostgreSQL，再更新 Checksum。PostgreSQL 失敗時不更新 Checksum，下次讀取會重灌快照。
- `LOCK_TIMEOUT` 回 409「資料正被地端其他工作站鎖定中，請稍後再試」；整批存檔則在該列的 `errorType`、`message` 回報。
- 前端 service 使用預設 `axios` (全域攔截器帶 `X-Data-Drive`)。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 不合法輸入 | 靜默不寫入 | toast 阻斷並留在原格 |
| 客戶代號找不到 | 靜默忽略 | 阻斷 |
| 代號比對 | `SET EXACT OFF` 前綴 SEEK (`A0` 可能對到 `A01`) | 完全比對 |
| 重複、總機構本身、其他總機構 | 不檢查，存檔會把其他總機構降級為 `tpay='2'` | 阻斷 |
| 已屬其他總機構的分支 | 靜默改掛 | 確認後改掛 |
| 既有列改代號 | 原客戶的 `mainunino` 殘留 | 存檔時清掉原客戶的 `mainunino` |
| F2 選客戶 | 漏帶 `tflog` | 補帶 |
| 分支清單 | 列出 `mainunino` 相符的所有客戶 (含總機構) | 排除總機構本身與其他總機構 |
| 總機構寫入時機 | 關閉整個畫面才回寫全部總機構 | 逐列即時存檔；離開時只回寫需要正規化的列 (結果與 VFP 相同) |
| 分支寫入時機 | 子畫面關閉才寫，刪除立即生效 | 相同 |
| 鎖定失敗 | 重試約 5 秒後問重試／取消，取消就略過不提示 | 409 / 逐列回報，可重送或放棄 |
| 末筆按 ↓ 新增、往下模式末筆 Enter 新增 | 自動新增一列 | `FoxProGridV2` 不支援，改用 Ins 或最後一格 Enter (往右) |
| 從子畫面返回 | 焦點移到總機構的進銷項合併設定欄 | 回到該總機構列的第 1 欄 |
| 標題 | 「基本資料系統-總分支機構設定」 | `WbasePageHeader`：客戶資料 / 總分支機構設定 (`wbase2050`)，子畫面為「總分支機構設定 › 分公司資料維護」(`wbase2050f8`) |
