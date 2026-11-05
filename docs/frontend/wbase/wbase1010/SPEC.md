# 規格書：wbase1010 事務所資料維護作業

> **模組代號**：`wbase1010` (F4 事務所資料 `wbase1010f4`、列印 `wbase1010f41`)  
> **功能名稱**：事務所資料維護 (預設事務所單筆表單 + `<FoxProGridV2 />` 事務所資料多列盲打 + DLL 報表列印)  
> **所屬模組**：`frontend/src/wbase/wbase1010/`、`frontend/src/services/wbase1010.ts` & `backend/Controllers/Wbase1010Controller.cs` (ADO + DTO，`Models/Wbase1010Models.cs`)  
> **原始 Visual FoxPro 來源**：選單 `PROGS\base10.prg` 的 `wbasemenu01cmd01`；畫面 `LIBS\wbase.vcx` 的 `wbase1010`、`wbase1010f4`、`wbase1010f41`；報表 `REPORTS\base111.frx`  
> **資料**：`<Drive>:\w3000\comm\base.dbf`、`pub_para.dbf`、`cstore.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` 同名資料表

---

## 1. 模組定位與職責

選單「基本資料管理 → 事務所資料 → 事務所資料」(`110` `wbase1010`)。進入後先顯示「預設事務所資料」，按 `F4` 進入「事務所資料」清單 (VFP 開 `wbase1010f4` 時隱藏主表單，網頁以 `view` 切換)。

1. **預設事務所資料 (`index.tsx` + `Wbase1010Form.tsx`)**
   - 唯讀黃底：事務所名稱、英文名稱、事務所統編 (VFP `Enabled=.F.`)，只能在 F4 事務所資料按 `F5 轉入預設` 帶入。
   - 可輸入 (順序同 VFP TabIndex)：電話、傳真、地址 (`F2` 地址選單)、負責人、聯絡人、電子郵件、數位憑證公用目錄。輸入長度同 VFP InputMask (見第 2 節)，以 Big5 位元組截斷。
   - `F8 確定`：只寫有變動的鍵值，完成後顯示「設定完成!!」，表單不關閉 (同 VFP)。
   - `Esc` 離開：VFP 直接關閉不存檔；網頁版有未存檔的修改時先跳「是否放棄修改並離開？ Y/N」。
2. **F4 事務所資料 (`Wbase1010CstoreGrid.tsx`，VFP `wbase1010f4`)**
   - `<FoxProGridV2 />` 顯示 `cstore.dbf` 全部列，依統號排序 (VFP `tag no`)。每個儲存格確認時即存檔 (VFP `Text1.LostFocus`)。
   - 統號為主鍵：新增或修改統號時必須是 8 碼數字且通過統編檢查碼 (VFP `buynochk`，不通過不寫入)，且不可重複；未修改的既有統號 (例如舊資料) 放行。
   - 新增：`Ins` 在最後新增空白列並進入統號欄，輸入統號後才新增到 DBF (VFP 先插入「新代號」再改統號)；新列序號 = 筆數 + 1。
   - 刪除：`Del` 確認「是否確定刪除:統號 Y/N」後立即刪除，並依統號順序把 `serial` 重編為 1..N (VFP `reserial()`)；重編失敗時刪除仍算成功，另顯示提示。
   - `F5 轉入預設`：把目前列的名稱、統號、地址、電話、傳真、負責人、電子信箱、聯絡人、英文名稱帶入預設事務所表單 (尚未存檔，提示「已轉入預設，離開後請再按 F8 確定儲存」)。
   - `F8 尋找`：`SearchModal` 依統號、名稱、電話、負責人搜尋，選定後游標移到該列 (重新掛載格線並以 `activeRowKey` 定位)。
   - `F12 方向`：切換 Enter 往右 / 往下。
   - 存檔排隊：同一頁的存檔依序執行，新列的新增完成並取得 RECNO 後，後續欄位的存檔才以「原統號 + RECNO」更新；存檔失敗時以 DBF 為準重新載入清單。
3. **F4 列印 (`wbase1010_cstore_print.tsx`，VFP `wbase1010f41`，版面比照 `wbase3020_buyinv_print`)**
   - 起始統編 / 結束統編預設為第一筆與最後一筆 (VFP `GO TOP` / `GO BOTTOM`)，`F2` 開事務所選單；查無統號時只提示「無此編號!!」，不阻擋。
   - 區間比照 VFP `SELECT ... WHERE no >= 起始 AND no <= 結束` 在 `SET ANSI OFF` 下的結果：結束統編只比對前段 (輸入 `1234` 時 `12345678` 也在範圍內)，空白表示不設限。
   - `F7 列印`：經 LocalAgent `POST /report` 呼叫 `wbaseRP.dll` 的 `wbase1010_cstore_list` (範本 `frxReport_1010_cstore`，版面依 `base111.frx`：統號、事務所名稱、電話、傳真、負責人、聯絡人、地址)。
   - `F8 匯出`：Excel 第 1 列「事務所資料表」、第 2 列「製表日期: 民國日期」、第 3 列欄位標題 (VFP `requeryother` 的 8 欄：統號、事務所名稱、電話、傳真、負責人、聯絡人、地址、電子信箱；英文名稱可另選)。勾選「匯出 xlsx 設定」時開 `FormUtilSelectXlsxFieldsList` 自訂欄位 (存於 `localStorage` 的 `wbase1010_xlsx_export_config`)。
   - `F4 預覽資料`：全欄位預覽 (含序號、RECNO)。
   - 列印視窗開啟時格線先卸載 (兩者都監聽 `window` 按鍵)，關閉後重新掛載並回到原本的列。

### 1.1 未移植的 VFP 功能

| VFP | 原因 |
| :--- | :--- |
| `F8` 存檔同時寫回 `store.dbf` 的事務所名稱、統編、英文名 (`w_astory_save`) | `store.dbf` 是加密的版權資料 (`shiftdata` / `encrypts` 原生元件)，網頁版只寫 `base.dbf` 的 `000A`/`000B`/`000C`。VFP 啟用 Store4 時畫面本來就讀 `base.dbf`；未啟用 Store4 的舊系統仍以 `store.dbf` 為準，需在舊系統按一次 F8 同步 |
| `F5 版權資料` | 需解密 `store.dbf` / Store4 |
| 掃描電子發票設定 (`ScanOpt`、`Img_Dir`、`pub_para.setscan`) | 只在授權專案碼 `LILY168` (`PUB_IMGPROJ`) 時顯示，網頁版沒有專案碼；網頁版不讀寫 `setscan` |
| 數位憑證公用目錄 `...` 選資料夾、離開時檢查目錄存在 | 瀏覽器無法選取或檢查用戶端資料夾；路徑照輸入存檔 |
| `MovSetImg` 搬移影像、`PWD` 影像儲存位置 | VFP 已停用 (`IF Img_368 AND .f.`) |
| 隱藏的 `Command1` 取卡號、`Command2` 硬碟序號 | 版權維護工具 |
| `wbase1010f4.Unload` 刪除殘留的「新代號」列 | 網頁版不建立「新代號」暫存列；舊系統留下的「新代號」列會照常顯示，可直接改成正確統號或刪除 |

### 1.2 與 VFP 不同之處

- VFP `F8` 在 `base.dbf` 找不到 `0001`~`0006` 時只新增 `no` / `name`，該次輸入的值要再按一次 F8 才寫入；網頁版新增時一併寫入 `data`。
- 統編檢查碼：VFP 依 `NEWBUYNO.DBF` 是否存在決定除 10 或除 5；網頁版採 112 年起的新制 (除 5，涵蓋舊制)。
- 報表抬頭日期使用共用預覽流程帶入的 `[列印日期]` (西元)，與其他已移植的清冊一致；VFP 為民國日期。

---

## 2. 資料庫與 DBF Schema 對照

### 2.1 預設事務所資料 (`base.dbf`：`NO C(20)`、`NAME C(50)`、`DATA C(100)`；`pub_para.dbf`)

| 畫面欄位 | 來源 | 前端屬性 (`OfficeInfo`) | 輸入長度 (Big5 位元組) |
| :--- | :--- | :--- | :--- |
| 事務所名稱 (唯讀) | `base` `000A` | `name` | - |
| 事務所統編 (唯讀) | `base` `000B` | `taxNo` | - |
| 英文名稱 (唯讀) | `base` `000C` | `engName` | - |
| 事務所地址 | `base` `0001` (新增時 name=`地址`) | `addr` | 100 |
| 事務所電話 | `base` `0002` (`電話`) | `tel` | 15 |
| 事務所傳真 | `base` `0003` (`傳真`) | `fax` | 15 |
| 負責人 | `base` `0004` (`負責人`) | `boss` | 10 |
| 電子郵件 | `base` `0005` (`電子郵件`) | `email` | 30 |
| 聯絡人 | `base` `0006` (`聯絡人`) | `contact` | 10 |
| 數位憑證公用目錄 | `pub_para.pubimgpath` C(150) (第一筆) | `pubImgPath` | 150 |

同一鍵值有多筆時取 RECNO 最小的一筆 (VFP `LOCATE`)。後端以 DBF 欄寬 (`data` 100、`pubimgpath` 150) 與 Big5 可編碼檢查。

### 2.2 事務所資料 (`cstore.dbf`)

| DBF / PG 欄位 | 型別 | 前端屬性 (`CstoreItem`) | 表格標題 |
| :--- | :--- | :--- | :--- |
| `no` | C(8) | `no` (主鍵；`origNo` 為已存檔的統號) | 統號 |
| `name` | C(60) | `name` | 名稱 |
| `tel` | C(12) | `tel` | 電話 |
| `fax` | C(12) | `fax` | 傳真 |
| `hname` | C(10) | `hname` | 負責人 |
| `linkman` | C(10) | `linkman` | 聯絡人 |
| `addr` | C(60) | `addr` (`F2` 地址選單) | 地址 |
| `email` | C(60) | `email` (格式不符只警示) | 電子信箱 |
| `engname` | C(60) | `engname` | 英文名稱 |
| `serial` | N(8) | `serial` (不顯示；VFP 隔列底色) | - |
| `wtsaccno2` | C(1) | - (不讀寫) | - |
| `_record_number` | - | `recordNumber` | - |

---

## 3. 鍵盤熱鍵對照表

### 預設事務所資料
- `Enter` / `↓` 下一欄、`↑` 上一欄；最後一欄 `Enter` 移到「F8 確定」按鈕
- `F2`：在事務所地址欄開 `<AddressSelectModal />`
- `F4`：進入事務所資料清單
- `F8`：存檔 (確定)
- `Esc`：離開 (有未存檔修改時確認 Y/N)

### 事務所資料 (wbase1010f4)
- 格線導覽同 `<FoxProGridV2 />` (`Enter`/`Tab` 跳欄、方向鍵、`PageUp`/`PageDown`、`Home`/`End`)
- `F2`：地址欄開地址選單 (選單關閉後重新掛載格線，清掉殘留的編輯狀態)
- `Ins` 新增、`Del` 刪除 (Y/N 確認)
- `F5` 轉入預設、`F4` 列印、`F8` 尋找、`F12` 游標方向
- `Esc`：編輯中取消該格；否則等存檔完成後回到預設事務所資料
- `F4`/`F5`/`F8`/`F12` 在頁面以 capture 階段攔截 (格線編輯框內不作用，同 VFP)；確認框與存檔中的按鍵一律攔下

### 列印 (wbase1010f41)
- `Enter` 下一欄 (起始 → 結束 → 匯出設定 → 列印)、`F2` 事務所選單
- `F4` 預覽資料、`F7` 列印、`F8` 匯出、`Esc` 關閉 (預覽或子視窗開啟時先關子視窗)

---

## 4. 後端 API 規格 (`Wbase1010Controller.cs`)

三張表都以空 `keyFields` 同步 (畫面要看到全部列)。寫入以快照的 RECNO 搭配鍵值定位 (`RECNO(),no`，鍵值含逗號時改用 `no`)，RECNO 過期時回 409；`pub_para` 以第一筆 RECNO 更新，空檔時新增。先寫 DBF，成功後才寫 PostgreSQL 並 `CommitWriteChecksumAsync`。

- `GET /api/wbase1010/office`：預設事務所資料 (`OfficeInfoDto`)
- `PUT /api/wbase1010/office`：只寫有變動的鍵值 (依 VFP 順序 `0001`~`0006`、`000A`~`000C`，查無時新增)，再寫 `pub_para.pubimgpath`；回傳存檔後的資料
- `GET /api/wbase1010/cstore`：事務所資料清單 (依統號、RECNO 排序)
- `POST /api/wbase1010/cstore`：新增 (`CstoreSaveRequest`，檢查統編檢查碼與重複；`serial` = 筆數 + 1)，回傳 `{ row }`
- `PUT /api/wbase1010/cstore`：修改 / 改統號 (body 帶 `origNo`、`recordNumber`)，只寫有變動的欄位，回傳 `{ row }`
- `DELETE /api/wbase1010/cstore/{no}?recno=`：刪除後重編序號，回傳 `{ warning }`
- `POST /api/wbase1010/cstore/print`：依 `noStart` / `noEnd` 查詢列印資料
- DBF 鎖定 (`LOCK_TIMEOUT`)、記錄已變動 (`RECORD_NOT_FOUND`)、DBF 已有相同統號 (`DUPLICATE_KEY`) 回 409；寫入結果未確認 (`WRITE_UNCONFIRMED`) 回 504

---

## 5. 報表 DLL (`report/wbase/`)

- `wbase_unit1.lfm` / `.pas`：`frxReport_1010_cstore` (A4 直式，資料集 `MTable`，欄位 `統號`、`事務所名稱`、`電話`、`傳真`、`負責人`、`聯絡人`、`地址`；頁首 `[列印日期]`、`[總筆數]`，頁尾頁次)
- `wbase_repunit1.pas`：`wbase1010_cstore_list` 以 `RunListReport` 讀 JSON 陣列 (`no`、`name`、`tel`、`fax`、`hname`、`linkman`、`addr`)
- `wbaseRP.lpr` 匯出、`localagent/dlls.json` 登記 (6 參數：`hs_chk, top_mag, left_mag, PrtIndex, IsPrint, path`)
- 修改範本後以 Manager `[13]` 重新編譯 (會檢查 `dlls.json` 登記的函數都已匯出)
