# 規格書：wbase3025 原媒體轉檔 / 網路申購轉檔

> **模組代號**：`wbase3025` (3-4-1 原媒體轉檔)、`wbase3025n` (3-4-2 網路申購轉檔)  
> **功能名稱**：統一發票購買媒體轉檔作業 / 統一發票購買網路申購轉檔  
> **所屬模組**：`frontend/src/wbase/wbase3025/` & `backend/Controllers/Wbase3025Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\PROGS\base30.prg` `wbasemenu0304cmd01` / `wbasemenu0304cmd02` → `SourS9BASE\LIBS\wbase.vcx` Class `wbase3025` / `wbase3025n`；各縣市的列格式在 `SourS9BASE\PROGS\basefunc.prg` 的 `blank_tpe` / `blank_kkk` / `append_blank` 與 `_n` 版。只讀地端 `<Drive>:\w3000\comm\buyinv.dbf`、`customer.dbf`、`place.dbf`、`base.dbf`、`pub_para.dbf` (PostgreSQL 快照 `<drive>:/w3000/comm`)，不寫入。

---

## 1. 模組定位與職責

把指定期別的統購發票本數 (`buyinv`) 依各區國稅局 / 財政部印刷廠的格式轉成文字檔，交給媒體申報或網路申購。VFP 的兩個表單幾乎相同，網頁版用同一個畫面 `Wbase3025Transfer` 以 `mode` 區分：

| 項目 | `media` 原媒體轉檔 (VFP `wbase3025`) | `net` 網路申購轉檔 (VFP `wbase3025n`) |
| :-- | :-- | :-- |
| 發票購買期別 | 年 / 起月 / 迄月，預設 `buyinv` 最近一期 (VFP `Init`)，檢核與 3022 相同 | 同左 |
| 轉檔依據 | `1` 依地址縣市 (`customer.addr` 含縣市)、`2` 依購買地點 (`customer.placeno` = 代號，`F2` 開 `place` 選單) | 同左；縣市輸入 `*` 代表不分區全部轉出 |
| 記帳業者ＩＤ | 必填 (10 碼，自動大寫) | 同左 |
| 輸出格式 | 由縣市名稱 (依購買地點時是地點名稱) 決定：台北市 / 高雄市 / 其他 (台灣省) | 自選 `1` 台北市 `2` 高雄市 `3` 台灣省 |
| 其他 | 排序方式 (依統一編號 / 依稅籍編號)、轉出事務所資料 (台灣省檔尾加事務所簽章框)、台灣省檔名 `PODER.DAT` / `PODER.TXT` (縣市是台北市 / 高雄市時不顯示) | 無 |

與 VFP 的差異：
- VFP 輸出到磁碟機 + 路徑 (`pub_para.buydrive` / `buypath`，軟碟時還有磁片份數)；網頁版由瀏覽器下載檔案，沒有這些欄位。
- VFP 的錯誤清單以 `error_media` 報表預覽；網頁版在 F7 預覽的「錯誤」欄與 F8 完成訊息列出 (這些列仍會轉出，與 VFP 相同)。
- 轉檔縣市 / 購買地點 / 業者ＩＤ / 排序 / 格式記在 PostgreSQL `參數設定` (`統購轉檔縣市`、`統購轉檔購買地點`、`統購轉檔記帳業者ID`、`統購轉檔依據`、`原媒體轉檔排序`、`原媒體轉檔格式`、`原媒體轉檔事務所資料`、`網路申購轉檔格式`)，第一次沒有值時縣市用 `pub_para.buycity`。
- VFP 兩個表單都把 `pub_para.buydrive` 寫回；網頁版不寫 DBF。

### 1.1 畫面 (`Wbase3025Transfer.tsx`，`FoxProPrintModalv2` 母版)

- 頂部 `WbasePageHeader` (`3-4-1 原媒體轉檔` / `3-4-2 網路申購轉檔`)，下方整個畫面是 `<FoxProPrintModalv2 />` (非 overlay)。
- 摘要卡片「轉出檔案」：`<區域>格式 ‧ <預計檔名>`，註記期別與事務所名稱。
- 條件卡片依序：發票購買期別 (年 `validRocYear`、起月 `oddStartMonth`、迄月 `validEndMonth`) → 轉檔依據 (選項) → 轉檔縣市 **或** 購買地點代號 (依選項只顯示一張；代號欄 `F2` 開 `SearchModal` 查 `/api/wbase3010`，右側顯示地點名稱，輸入代號時也會自動帶出名稱) → 記帳業者ＩＤ → `media`：排序方式、轉出事務所資料、轉檔格式 (DAT / TXT，只在台灣省時顯示)；`net`：轉檔格式 (台北市 / 高雄市 / 台灣省)。
- **F7 預覽轉檔資料**：呼叫 `POST /api/wbase3025/transfer`，以 `<FoxProPrintModal showFilter={false} />` 列出轉出的公司 (代號、名稱、統編、稅籍、次數、8 種本數、錯誤)，可 `F8` 匯出 xlsx、`F7` 列印。
- **F8 轉檔下載** (VFP `F8.確定`)：同一個 API 取得檔案內容，瀏覽器下載 (`saveMediaTransferFile`)，完成後 `MessageDialog`「轉檔完成!!」列出檔名、筆數、位元組數與錯誤清單 (最多 12 筆)，並把條件記到 `參數設定`。沒有資料時不產生檔案。
- `Esc` 回主選單。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase3025/
├── index.tsx                 # Wbase3025_Media (mode media)、Wbase3025_Net (mode net)
└── Wbase3025Transfer.tsx     # 條件畫面 (FoxProPrintModalv2)、F7 預覽 (FoxProPrintModal)、F8 下載、F2 購買地點選單

frontend/src/services/
└── wbase3025.ts              # fetchMediaTransferDefaults、runMediaTransfer、saveMediaTransferFile、decodeMediaTransferText

backend/
├── Controllers/Wbase3025Controller.cs   # defaults、transfer (三種縣市格式、Big5 輸出)
└── Models/Wbase3025Models.cs            # MediaTransferRequest / Result / Row / Defaults DTO
```

選單：`menuConfig.ts` 的 `GRP_340` 子項 `wbase3025` (`/wbase/wbase3025`) 與 `wbase3025n` (`/wbase/wbase3025n`)，`wbaseMainPage.tsx` 以 `activeModule` `wbase3025` / `wbase3025n` 切換 (舊代碼 `wbase3041` / `wbase3042` 仍可對應)。

---

## 3. 後端 API (`Wbase3025Controller.cs`)

| HTTP Method | Route Endpoint | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/wbase3025/defaults` | 同步 `buyinv`、`pub_para`、`base` 後回 `{ year, startMonth, endMonth, city, officeName, officeUnino, officeTel, officeAddr, officeOwner }`：期別取 `buyinv` 最近一期 (`year100` 排序)，沒有資料時用今天所在的雙月期別；`city` = `pub_para.buycity`；事務所資料來自 `base` (`000A` 名稱、`000B` 統編、`0001` 地址、`0002` 電話、`0004` 負責人) |
| `POST` | `/api/wbase3025/transfer` | body `MediaTransferRequest { mode, year, startMonth, endMonth, filterBy, city, placeNo, agentId, sortBy, format, withOffice }`，回 `MediaTransferResultDto { region, regionName, fileName, contentBase64 (Big5), byteLength, lineCount, padded, rows[], errors[], totals, message }`。檢核字句與 VFP `f8.Click` 相同：年度不可空白!! / 月份不可空白!! / 年度輸入不正確!! (< 34) / 月份輸入不正確!! / 請輸入奇數月份!! / 月份區間不正確!! / 記帳業者ID 未輸入!! / 轉檔縣市未輸入!! / 公司電話空白無法轉檔!! (縣市為台北市且 `base` 電話空白)；購買地點代號不存在時 400 |

### 3.1 資料範圍與過濾 (VFP `tran_data` / `tran_data2`)

- 讀 `buyinv` 中 `yymm` = 期別 (2 碼年 + 起月 + 迄月，例如 `150506`)、任一本數 ≠ 0 的列，**不分購買次數**；客戶以 `TRIM(no)` 對應 `customer` (同代號多筆取 RECNO 最小)。
- 排序：`media` 依 `sortBy` 以統編 (`cmd01` `SET ORDER TO UNINO`) 或稅籍 (`f8` `SET ORDER TO TAXNO`)；`net` 依 RECNO (`cmd02` 沒有設定索引)。
- 略過的列 (照 VFP 各分支)：依購買地點 → `customer.placeno` ≠ 代號；台灣省 → 地址空白或不含縣市 (`net` 的 `*` 不比縣市)；原媒體台北市 → 地址非空白且不含「台北市 / 臺北市」；其他 → 地址非空白且不含縣市 (`net` 的 `*` 不比縣市)。
- 錯誤清單 (列仍轉出)：客戶代號不存在 / 地址空白 / 地址不在 `<縣市>` (依購買地點時不檢查縣市)。

### 3.2 三種格式 (`basefunc.prg`)

| 區域 | 列格式 | 檔名 | 寫法 |
| :-- | :-- | :-- | :-- |
| 台北市 `blank_tpe` / `blank_tpe_n` | `統編(8)` + 代理人代號 8 碼 (`media`：事務所電話 `-` 後 8 碼；`net`：業者ＩＤ前 8 碼) + `稅籍(9)` + 8 組「旗標 + `Str(本數,4)`」(旗標 1~8 = 二聯、二副、三聯、三副、特種、二收、三收、三收副，本數 0 時旗標 `0`)；`net` 再接公司名稱 | `media` `<電話8碼>.VAX`、`net` `<業者ＩＤ>.VAX` | SDF |
| 高雄市 `blank_kkk` / `blank_kkk_n` | 表頭 `代理人編號;發票期別;統一編號;公司名稱;二聯;二副;三聯;三副;特種;二收;三收;三收副`，每家 `PADR(業者ＩＤ,10);期別;統編;公司名稱;8 種本數`；期別 `media` 為 `0YYMM`、`net` 為 `YYYMM` 並在尾端加 `;稅籍` | `media` `<業者ＩＤ>` (沒有副檔名)、`net` `<業者ＩＤ>.DAT` | `media` SDF、`net` FWRITE |
| 台灣省 `append_blank` / `append_blank_n` | 每家每種本數 ≠ 0 的發票一列 `統編(8)` + 種類碼 (`20` 二聯 `21` 二副 `10` 三聯 `11` 三副 `40` 特種 `30` 二收 `60` 三收 `61` 三收副) + `STRZERO(本數,4)` + 迄月 2 碼 + 業者ＩＤ (`net` 再加 `;稅籍;公司名稱`)；檔尾各種類合計列 `########` + 種類碼 + 合計 + 迄月 + 業者ＩＤ；`media` 勾轉出事務所資料時再接事務所簽章框 (10 列框線，台東縣字句為「印鑑」) | `media` `PODER.DAT` / `PODER.TXT`、`net` `<業者ＩＤ>.DAT` | `media` SDF、`net` FWRITE |

- **SDF** (VFP `COPY TO ... SDF`，暫存檔 `one_line c(254)`)：每列補滿 254 位元組 + CRLF，檔尾 `0x1A`；**FWRITE** (VFP 99/06/24 改法)：每列 `ALLTRIM` 後 + CRLF，沒有檔尾記號。`padded` 欄位告訴前端是哪一種。
- 全部以 Big5 編碼，`PADR` 以 Big5 位元組計 (`CodePagesEncodingProvider`)，無法編碼的字以 `?` 取代。
- `STR(n,4)` / `STRZERO(n,4)` 放不下時與 VFP 一樣輸出 `****`。

---

## 4. 鍵盤熱鍵對照表

- `Enter` / `↓` / `↑`：欄位間移動 (`FoxProPrintModalv2`)；選項卡片 `←` `→` `Space` 或數字鍵換選項
- `F2`：購買地點代號欄開 `SearchModal` (`↑` `↓` 選擇、`Enter` 帶回、`Esc` 關閉)
- `F7`：預覽轉檔資料 (預覽視窗內 `F7` 列印、`F8` 匯出 xlsx、`Esc` 關閉)
- `F8`：轉檔並下載；完成訊息 `Enter` / `Esc` 關閉
- `Esc`：回主選單
