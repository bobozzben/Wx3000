# 規格書：wbase4020 營業稅與共用參數設定 (操作設定 4-2 ~ 4-6)

> **模組代號**：`wbase4020` (五個畫面 `wbase4020`、`wbase4030`、`wbase4040`、`wbase4050`、`wbase4060`；子視窗 `wbase4021`、`wbase4031`)  
> **功能名稱**：營業稅設定、營業稅轉傳票設定、媒體/期末存貨計算方式、共用會計科目摘要、共用參數設定 (`Wbase4020Page` 五合一)  
> **所屬模組**：`frontend/src/wbase/wbase4020/` (service 在 `frontend/src/wbase/wbase4020/services/wbase4020.ts`) & `backend/Controllers/Wbase4020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base40.prg` `wbasemenu04cmd02`~`cmd06` → `SourS9BASE\LIBS\wbase.vcx` class `wbase4020` (F7 `wbase4021`)、`wbase4030` (F7 `wbase4031`)、`wbase404010`、`wbase4050`、`wbase4060`

---

## 1. 模組定位與職責

選單 420~460 都開啟 `Wbase4020Page`，由 `wbaseMainPage.tsx` 傳入 `initialTab`，決定顯示哪一個畫面。畫面不顯示頁籤，要換畫面須回選單另選 420~460。

| 選單 | `initialTab` | 畫面標題 | 畫面元件 | 主要 DBF |
| :--- | :-: | :--- | :--- | :--- |
| 420 營業稅設定 | `4020` | 4-2 營業稅設定 | `Wbase4020Form.tsx` + `Wbase4021Modal.tsx` | `customer`、`accpara` |
| 430 營業稅轉傳票設定 | `4030` | 4-3 傳票轉檔設定 | `Wbase4030Form.tsx` + `Wbase4031Modal.tsx` | `customer`、`accpara` |
| 440 媒體/期末存貨計算方式 | `4040` | 4-4 進銷存方式設定 | `Wbase4040Form.tsx` | `acc_st`、`customer` |
| 450 共用會計科目摘要 | `4050` | 4-5 共用科目摘要 | `Wbase4050Form.tsx` | `descrip`、`xmaster` |
| 460 共用參數設定 | `4060` | 4-6 共用參數設定 | `Wbase4060Form.tsx` | `pub_para` |

頁首為 `WbasePageHeader` (分類「4. 操作設定」，代號 `wbase{initialTab}`)。4-2 ~ 4-4 的客戶格線都使用 `<FoxProGridV2 />`，客戶代號與名稱唯讀、逐列確認後即時存檔，沒有新增與刪除功能。

### 1.1 頁面共用按鍵 (`index.tsx`)

| 按鍵 | 作用 |
| :--- | :--- |
| `F9` / `F3` | 4-2 ~ 4-4 開「客戶代號搜尋」(`SearchModal`，比對目前清單的代號與簡稱/名稱)。選定後以該代號為關鍵字重新查詢，清單只留下符合的客戶；按頁首的重新載入鈕回到完整清單 |
| `F12` | 切換 Enter 方向 (初始 → 往右) |
| `Esc` | 畫面上沒有 `.fixed.inset-0.z-50` 彈窗時回主選單 |

### 1.2 4-2 營業稅設定 (`Wbase4020Form.tsx`)

| 欄 | 欄位 | 規則 |
| :--- | :--- | :--- |
| 客戶代號 / 客戶簡稱 | `no` / `abbr` | 唯讀 |
| 進項借方 / 進項貸方 / 進項退出借方 / 進項退出貸方 | `bydno` / `bycno` / `bybkdno` / `bybkcno` | 會計科目代號，大寫、最多 8 碼；`F2` 開科目選單 |
| 銷項借方 / 銷項貸方 / 銷項退回借方 / 銷項退回貸方 | `sadno` / `sacno` / `sabkdno` / `sabkcno` | 同上 |
| 收銀機會計 | `casaccno` | 同上 |
| 媒體申報方式 | `mediatype` | `0`.銷項 `1`.進項 `2`.進銷項 `3`.不媒體 `4`.(藍)進銷項 |
| 申報書媒體 | `t401` | 1 碼大寫，不檢查 |
| 檔案編號 | `fileno` | 最多 10 bytes，Big5 檢查 |
| 總繳代號 | `tpay` | `0`.無總繳 `1`.總機構總繳 `2`.分支機構由總機構總繳 |
| 總機構統編 | `mainunino` | 最多 8 碼；不是 8 碼時只提示警告 |
| 申報週期 | `monthv` | `0`.每期 `1`.每月 |

- **科目選單 (`AccountSearchModal.tsx`)**：列出 `xmaster` (標準會計科目) 全部科目，可用代號或名稱篩選；`↑`/`↓` 移動、`Enter` 選定、`Esc` 關閉 (capture 階段攔截，不會穿透到頁面)。選定後立即寫入該欄並存檔。
- **`F7` 標準科目 (`Wbase4021Modal.tsx`)**：維護 `accpara.dbf` 的九個標準營業稅科目 (欄位同上方九個科目欄)。每欄旁的「F2 快選」按鈕開科目選單 (目前只能點選，輸入框未綁定 `F2` 鍵)；`F8` 存檔、`Esc` 取消。存檔後重新載入格線。
- **`F8` 標準參數**：把 `accpara` 的九個標準科目寫入目前客戶 (`POST /api/wbase4020/taxop/apply-default/{no}`)。
- 底部說明列顯示固定的操作提示與筆數、游標方向。

### 1.3 4-3 傳票轉檔設定 (`Wbase4030Form.tsx`)

| 欄 | 欄位 | 規則 |
| :--- | :--- | :--- |
| 客戶代號 / 客戶簡稱 | `no` / `abbr` | 唯讀 |
| 週期 | `monthv` | `0`.每期 `1`.每月 |
| 申報方式 | `mediatype` | `0`~`4` (同 4-2) |
| 銷項連線型態 | `trantype` | `1`.逐筆 `2`.同一天合併 `3`.多天合併 `4`.逐筆切傳票(分開) `5`.多天逐筆 `9`.不轉檔 |
| 銷項連線種類 | `trankind` | `1`.多種科目 `2`.單一科目 |
| 銷項連線天數 | `trandate` | 0~99 |
| 進項連線型態 | `trantypeb` | 同銷項，另加 `6`.單筆 |
| 進項連線種類 | `trankindb` | `1` / `2` |
| 進項連線天數 | `trandateb` | 0~99 |
| 檔案編號 | `fileno` | 最多 8 bytes，Big5 檢查 |
| 總繳代號 | `tpay` | `0`~`2` |

- **`F7` 標準參數 (`Wbase4031Modal.tsx`)**：維護 `accpara.dbf` 的 `sm_monthv`、`sm_media`、`sm_type`、`sm_kind`、`sm_date`、`sm_typeb`、`sm_kindb`、`sm_dateb`；代碼欄以下拉選單選擇，天數欄為 1~99 的數字欄。`F8` 存檔、`Esc` 取消。
- **`F8` 套用標準參數**：把上述標準值寫入目前客戶的 `monthv`、`mediatype`、`trantype`、`trankind`、`trandate`、`trantypeb`、`trankindb`、`trandateb` (`POST /api/wbase4020/voucher/apply-default/{no}`)。

### 1.4 4-4 進銷存方式設定 (`Wbase4040Form.tsx`)

| 欄 | 欄位 | 規則 |
| :--- | :--- | :--- |
| 客戶代號 / 客戶名稱 | `no` / `name` | 唯讀 |
| 期末存貨計算方式 | `stock` | `A`.由進銷存檔計算 `B`.自行輸入期末金額 `C`.自行輸入期末傳票 (大寫) |
| 會計類別 | `acctype` | `A`.標準會計 `B`.非歷年制 `C`.營造業 `D`.建設業 (大寫) |

- 清單以 `customer` 為主、左聯結 `acc_st`；顯示值依序取 `acc_st`、`customer`，都空白時為 `A`。
- 存檔時先寫 `acc_st` (查無該客戶時新增一筆)，再寫 `customer.stock`、`customer.acctype`。

### 1.5 4-5 共用科目摘要 (`Wbase4050Form.tsx`)

- 左側「會計科目清單」列出 `xmaster` 科目 (代號、名稱、科目明細)，上方輸入框可篩選，點選科目後右側載入該科目的摘要。
- 右側 `<FoxProGridV2 />`：序號 (畫面順序，唯讀)、常用摘要內容 (`descrip`，60 bytes，Big5 檢查)。
  - **新增 (`Ins` / 按鈕)**：立即在 `descrip.dbf` 新增一筆空白摘要 (`serial` = 該科目最大值 + 1)，再於格線中輸入內容。
  - **修改**：列確認後 `PUT /api/wbase4020/descrip/{recno}`。
  - **刪除 (`Del` / 按鈕)**：瀏覽器確認框「確定要刪除此筆摘要…」後刪除。
  - **上移 / 下移 (按鈕)**：與相鄰摘要交換 `serial`。
- 該科目沒有摘要時不顯示格線，只顯示提示文字，此時只能用「新增 [Ins]」按鈕新增。左側科目清單、上移 / 下移目前只能用滑鼠操作。

### 1.6 4-6 共用參數設定 (`Wbase4060Form.tsx`)

- 單一欄位「多家列印作業模式」(`pub_para.qqsel`)：`0`.開窗選單模式、`1`.自行輸入代號模式。輸入框自動取得焦點，直接輸入 `0`/`1` 或點選選項。
- `F8` 存檔、`Esc` 離開。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm`)

| DBF | 同步 keyFields | 使用畫面 | 讀寫欄位 |
| :--- | :--- | :--- | :--- |
| `customer` | `""` (無唯一鍵，與 `wbase2050` 相同) | 4-2、4-3、4-4 | 4-2：`bydno, bycno, bybkdno, bybkcno, sadno, sacno, sabkdno, sabkcno, casaccno, mediatype, t401, fileno, tpay, mainunino, monthv`；4-3：`monthv, mediatype, trantype, trankind, trandate, trantypeb, trankindb, trandateb, fileno, tpay`；4-4：`stock, acctype` |
| `accpara` | `""` (單筆) | 4-2 F7、4-3 F7 | 營業稅標準科目 `bydno` … `casaccno`；轉傳票標準參數 `sm_monthv, sm_media, sm_type, sm_kind, sm_date, sm_typeb, sm_kindb, sm_dateb` |
| `acc_st` | `no` | 4-4 | `no, name, stock, acctype, serial` |
| `descrip` | `""` (無唯一鍵，以 RECNO 定位) | 4-5 | `accno` (C8)、`descrip` (C60)、`serial` (N4) |
| `xmaster` | `accno` | 4-2 科目選單、4-5 科目清單 | 只讀 `accno, accname, dept, taxcode` |
| `pub_para` | `""` (單筆) | 4-6 | `qqsel` (C1) |

- `customer` 欄位：九個科目欄為 C8，`mediatype`、`t401`、`tpay`、`monthv`、`trantype`、`trankind`、`trantypeb`、`trankindb`、`stock`、`acctype` 為 C1，`trandate`、`trandateb` 為 N2，`mainunino`、`fileno` 為 C8。
- 控制器採 ADO + DTO (`Models/Wbase4020Models.cs`：`CustomerTaxDto`、`CustomerVoucherDto`、`AccParaTaxDto`、`AccParaVoucherDto`、`AccStDto`、`DescripItemDto`、`PubParaDto`)，以 `GetDbConnection()` 讀寫 PostgreSQL 快照。

---

## 3. 後端 API 規格 (`Wbase4020Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase4020/taxop?keyword=` | 4-2 客戶清單，依 `serial`、`no` 排序；`keyword` 比對代號、名稱、簡稱 |
| `PUT` | `/api/wbase4020/taxop/{no}` | 4-2 存檔一列 |
| `POST` | `/api/wbase4020/taxop/apply-default/{no}` | 4-2 套用 `accpara` 標準科目，回傳 `{ success, applied }` |
| `GET` / `PUT` | `/api/wbase4020/accpara/tax-accounts` | 4-2 F7 標準營業稅科目 |
| `GET` | `/api/wbase4020/voucher?keyword=` | 4-3 客戶清單 |
| `PUT` | `/api/wbase4020/voucher/{no}` | 4-3 存檔一列 |
| `POST` | `/api/wbase4020/voucher/apply-default/{no}` | 4-3 套用 `accpara` 標準轉傳票參數，回傳 `{ success, applied }` |
| `GET` / `PUT` | `/api/wbase4020/accpara/voucher-params` | 4-3 F7 標準轉傳票參數 |
| `GET` | `/api/wbase4020/stock-mode?keyword=` | 4-4 清單 (`customer` 左聯結 `acc_st`)；`keyword` 比對代號、名稱 |
| `PUT` | `/api/wbase4020/stock-mode/{no}` | 4-4 存檔：寫 `acc_st` (DBF 回 `RECORD_NOT_FOUND` 才新增) 後連動 `customer` |
| `GET` | `/api/wbase4020/descrip/accounts?keyword=` | 4-5 科目清單 (`xmaster`)，亦供科目選單使用 |
| `GET` | `/api/wbase4020/descrip?accno=` | 4-5 摘要清單，依科目、`serial` 排序 |
| `POST` | `/api/wbase4020/descrip` | 新增摘要 (`serial` = 該科目最大值 + 1，由 VFP 在 DBF 檔頭鎖內取號，多人同時新增也不重號) |
| `PUT` / `DELETE` | `/api/wbase4020/descrip/{recno}` | 修改內容 / 刪除摘要 |
| `POST` | `/api/wbase4020/descrip/swap-order` | Body `{ recno1, serial1, recno2, serial2 }`，交換兩筆的 `serial` |
| `GET` / `PUT` | `/api/wbase4020/pub-para` | 4-6 `qqsel` |

- 讀取前以 `EnsureTableSyncedAsync` 同步上表的 DBF。
- 寫入先 `WriteRecordAsync` 寫 DBF，成功後才寫 PostgreSQL 並更新 Checksum：
  - `customer`：有 `_record_number` 時以 `RECNO()` 定位，失敗再改用 `no`。
  - `acc_st`：以 `no` 定位。
  - `descrip`：以 `RECNO()` 定位。
  - `accpara`、`pub_para`：固定 `RECNO()` = 1。
- `LOCK_TIMEOUT` 回 409 的只有 `taxop/{no}`、`voucher/{no}`、`stock-mode/{no}`；其他寫入失敗一律回 500。
- 前端 service 使用 `services/api.ts` 的 `api` 實例 (攔截器只設定 `baseURL`)。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 4-2 會計科目欄 | `chk_accno` 檢查科目存在且不是彙總科目，否則「不可輸入彙總科目!!」不寫入 | 只檢查長度 (最多 8 碼)，不檢查科目是否存在或為彙總科目 |
| 4-2 總機構統編 | 離開欄位時開客戶選單，帶入所選客戶的統編 | 自由輸入，不是 8 碼時只警告 |
| 4-2 / 4-3 總繳代號 | 接受 `0`、`1`、`2`、`9` | 只接受 `0`~`2` |
| 4-3 欄位檢查 | `LostFocus` 的檢查與欄位說明錯位：連線型態不檢查、連線種類以型態值檢查、天數限 1~31 | 依欄位說明檢查，天數 0~99 |
| 不合法輸入 | 訊息框後不寫入 (4-3 靜默不寫入) | 阻斷提示並留在原格 |
| `F9` 尋找 | 定位到該客戶 | 以代號為關鍵字重新查詢，只列出符合的客戶 |
| 4-4 進入作業 | 以 `customer` 的 `stock`、`acctype` 覆寫 `acc_st`，補齊缺少的客戶、刪除多餘的列；離開時再寫回 `customer` | 不預先整理；顯示時以 `acc_st` 優先，每列存檔時同時寫 `acc_st` 與 `customer` |
| 4-2 / 4-3 / 4-4 進入作業 | 依順序重編 `customer.serial` (4-4 為 `acc_st.serial`) | 不重編，依現有 `serial` 排序 |
