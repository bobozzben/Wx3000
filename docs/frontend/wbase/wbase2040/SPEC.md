# 規格書：wbase2040 客戶收費資料輸入作業

> **模組代號**：`wbase2040`  
> **功能名稱**：客戶收費資料輸入 (畫面標題「客戶收費金額登錄」：`<FoxProGridV2 />` 收費單表頭 + 明細子視窗 + 摘要 / 批次 / 列印)  
> **所屬模組**：`frontend/src/wbase/wbase2040/` & `backend/Controllers/Wbase2040Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base20.prg` `wbasemenu02cmd04` → `SourS9BASE\FORMS\recmom.scx` (明細 `recmoney.scx`、摘要 `recmemo.scx`、共用說明 `recsmemo.scx`、批次 `rec_all.scx`、列印 `recpr1/recpr2/recpr3.scx`)

---

## 1. 模組定位與職責

登錄事務所向客戶收取的費用：一張收費單 (表頭 `recmom.dbf`) 含多筆收費明細 (`recmod.dbf`)，以明細的「已收」註記計算表頭已收、未收金額。

1. **主格線 (`Wbase2040Form.tsx`)**：已收、單號、請款日 (民國)、客戶代號 (`F2` 客戶開窗，自動帶客戶簡稱)、客戶簡稱、已收金額、未收金額、收款人 (`F2` 人員開窗，存人員名稱)、註記。
2. **明細子視窗 (`Wbase2040DetailModal.tsx`，Space 開啟)**：已收、收費項目 (`F2` 開窗，帶出名稱與金額)、項目名稱、收費金額、備註 (`F2` 開窗)。Space 切換已收，Esc 離開時重算表頭。
3. **已收清鎖單**：明細全部已收時表頭 `isover = '*'`，表頭與明細唯讀、不可刪明細；仍可新增明細、以 Space 取消已收、修改收據摘要 (同 VFP)。
4. **子功能**：`F3` 收據摘要、`F8` 共用說明 (`Wbase2040MemoModal.tsx`)；`F5` 批次收款單 (`Wbase2040BatchModal.tsx`)；`F4` 收據列印、`F6` 請款單 (`wbase2040_rec_print.tsx`，DLL 報表)；`F9` 收費統計表 Excel (`wbase2040Print.tsx`)。

### F4 收據列印 / F6 請款單 (DLL 報表)

列印畫面比照 `wbase3020_buyinv_print`：`F4` 預覽資料、`F7` 列印 (預覽列印 / 立即列印)、`Esc` 離開。

| 項目 | 收據 (VFP `recpr1.scx`) | 請款單 (VFP `recpr2.scx`) |
| :--- | :--- | :--- |
| 條件 | 請款日區間、客戶區間 (`F2`)、單號區間、只印未收、印表日期 | 客戶區間 (`F2`)、帳款年月、印製日期 |
| 資料 | `GET /api/wbase2040/print/receipts` | `GET /api/wbase2040/print/bill` |
| DLL 函數 | `wbaseRP.dll` `wbase2040_receipt` | `wbaseRP.dll` `wbase2040_bill` |
| 範本 | `frxReport_2040_receipt`，由 `SourS9BASE\REPORTS\xreccno.frx` 轉換 | `frxReport_2040_bill`，由 `xrecapy.frx` 轉換 |
| 換頁 | 每張收費單 (群組 `單號`) | 每位客戶 (群組 `客戶編號`) |

- 呼叫方式：`callWbaseReport()` → LocalAgent `POST /report` (寫 JSON 暫存檔) → WbaseBridge 6 參數分派 → DLL；函數已登記於 `localagent/dlls.json`。
- JSON 暫存檔為根物件：`{ officeName, officeTaxNo, officeAddr, officeTel, printDate, data: [...] }`，事務所資料取自 `GET /api/wbase2040/office` (`base.dbf`：`000A` 名稱、`000B` 統編、`0001` 地址)。
- 與 VFP 版面的差異：VFP 把合計 (收據另含收據摘要、共用說明；請款單為共用說明) 放在頁尾，FastReport 換頁時頁尾會讀到下一筆資料，改放群組尾，緊接在明細之後；請款單不補「單據行數」空白列。

### 快速鍵 (對齊 VFP recmom.scx)

| 按鍵 | 主畫面 | 明細子視窗 |
| :--- | :--- | :--- |
| `Ins` / `Del` | 新增收費單 / 刪除整張單 (含明細) | 新增明細 / 刪除明細 |
| `Space` | 輸入明細 | 收費 (切換已收) |
| `F2` | 客戶代號、收款人開窗 | 收費項目、備註開窗 |
| `F3` `F4` `F5` `F6` | 收據摘要、收據列印、批次收款單、請款單 | - |
| `F7` `F8` `F9` | 排序 (單號大→單號小→客戶→日期大→日期小→客戶日期→日期客戶)、共用說明、收費統計表 | - |
| `F12` / `Esc` | 游標方向 → / ↓、離開 | 游標方向、離開 (重算表頭) |

`FoxProGridV2` 本身把 `F3`/`F7` 用於搜尋/列印，本模組在頁面層以 capture 攔截，維持 VFP 配置。

---

## 2. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm`)

### `recmom` (收費單表頭，以 `rno` 定位)

| 欄位 | DBF 型別 | 說明 |
| :--- | :--- | :--- |
| `rno` | C10 | 單號：`A` + 民國年 3 碼 + 流水號 6 碼 (本年度最大號 + 1)，可修改 (不可重複、連動明細) |
| `recdate` | D | 請款日，修改時連動所有明細 |
| `memo` | M | 收據摘要，新增時帶 `recmemo` 實體第一筆 |
| `cno` / `abbr` | C8 / C10 | 客戶代號 / 簡稱 (由 `customer.abbr` 帶入) |
| `isover` | C1 | `*` = 明細全部已收 |
| `recman` | C10 | 收款人 (人員名稱) |
| `amt` / `notamt` | 金額 | 已收 = 已收明細合計；未收 = 未收明細合計 |
| `tax` / `sum` | 金額 | 新增時填 0，不計算 |
| `note` | C60 | 註記 |

### `recmod` (收費明細，**無唯一鍵**，以 `RECNO()` + `rno` 定位)

`rno` (關聯表頭)、`recdate`、`itemno` (C4)、`item` (C40)、`money`、`isover`、`note` (C60)、`recman`、`cno` (只有批次產生會填)、`abbr` / `recmanname` (不使用)。

### `recsmemo` (共用說明，一筆 memo)

> 正式資料的 DBF 格式與 VFP 樣板不同 (`recmom` 為 FoxPro 2.x、`recmod` 為 dBase III，金額為 F/N 而非 Currency)，寫入一律走 LocalAgent 的 VFP `REPLACE`，不假設欄位型別。

---

## 3. 後端 API 規格 (`Wbase2040Controller.cs`)

| Method | Route | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase2040?sort=1..7` | 表頭清單 (不含 memo) |
| `GET` | `/api/wbase2040/{rno}` | 表頭 (含 memo) + 明細 |
| `POST` | `/api/wbase2040` | 新增收費單 (後端產生單號、日期、預設摘要) |
| `PUT` | `/api/wbase2040/{rno}` | 修改請款日、客戶代號、收款人、註記、摘要；已收清時只允許改摘要 (409) |
| `PUT` | `/api/wbase2040/{rno}/rename` | 改單號 (空白 400、重複 409「單號重覆，請檢查!」)，先連動明細 |
| `DELETE` | `/api/wbase2040/{rno}` | 刪除整張單 (先刪明細) |
| `POST` / `PUT` / `DELETE` | `/api/wbase2040/{rno}/lines[/{recno}]` | 明細新增 / 修改 (收費項目帶名稱與金額) / 刪除 (表頭已註明收費時 409) |
| `POST` | `/api/wbase2040/{rno}/lines/{recno}/toggle-paid` | 切換已收 (不受鎖單限制) |
| `POST` | `/api/wbase2040/{rno}/recalc` | 重算表頭已收、未收、已收註記 |
| `GET` / `PUT` | `/api/wbase2040/shared-memo` | 共用說明 |
| `POST` | `/api/wbase2040/batch` | 批次產生 (記帳費 `customer.recamt > 0` 的客戶各一張；同日已有單據回 409 `needConfirm`，`force: true` 仍產生) |
| `GET` | `/api/wbase2040/lookup/customers` | 客戶開窗 (`no`, `abbr`, `name`) |
| `GET` | `/api/wbase2040/print/receipts`、`/print/bill`、`/stats` | 收據、請款單 (前期未收彙總 + 當月未收明細)、客戶 × 收費項目統計 |
| `GET` | `/api/wbase2040/office` | 報表頁首的事務所資料 (`base.dbf`) |

- 明細每次異動後後端立即重算並寫回表頭；明細視窗關閉時再呼叫一次 `recalc`。
- 寫入順序：DBF 成功後才寫 PostgreSQL 並更新 Checksum；PostgreSQL 失敗時不更新 Checksum，下次讀取會自動重灌快照。
- 日期欄以 `{"$date":"yyyy-MM-dd"}` 交給 LocalAgent，轉成 VFP `{^yyyy-MM-dd}`。
- DBF 被 VFP 獨佔 (VFP 進入 2-4 時以獨佔開啟 `recmom`/`recmod`) 時 LocalAgent 回 `LOCK_TIMEOUT`，API 回 409。

---

## 4. 與 VFP 的差異

| 項目 | VFP | Wx3000 |
| :--- | :--- | :--- |
| 單號空白 | 可存 | 擋下 |
| 日期格式錯誤、客戶代號不存在 | 靜默略過 | 錯誤提示 / 非阻斷警告 (簡稱不變) |
| 明細已收註記 | 可輸入任意字元，已收/未收各有兩套算法 | 只能 Space 切換 `*`，已收 = 有註記、未收 = 無註記 |
| 表頭重算時機 | 明細視窗關閉時 | 每次明細異動後 + 關閉時 |
| 明細 `recman` | 登入者代號 (`meuser`) | 空白 (Wx3000 尚無登入身分) |
| 批次產生 | 不檢查重複 | 同客戶同日期已有收費單時先確認 |
| 列印 | `reccno.frx` / `recapy.frx` | `wbaseRP.dll` FastReport 範本 (合計移到群組尾、不補「單據行數」空白列)、統計表改為前端產生 `.xlsx` |
| PACK | 離開 2-4 時 PACK | 不 PACK (需獨佔)，刪除列待 VFP 下次進出 2-4 時清除 |
