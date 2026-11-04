# 多人使用壓力測試

模擬多位使用者同時操作網頁版，並模擬舊系統 (VFP) 同時修改 DBF，檢查四件事：
- 回應時間與錯誤率
- DBF 與 PostgreSQL 快照是否一致
- 自動取號是否重複
- 同時存檔是否互相覆蓋

測試需要 VFP COM (`w3000_dbf.dll`) 與 DBF 資料，CI 無法執行，請在開發機或伺服器上手動跑。

## 執行

1. 啟動後端與 LocalAgent，例如 `pnpm dev`，或使用已安裝的服務。
2. 在專案根目錄執行：

```powershell
.\tests\stress\Run-StressTest.ps1
.\tests\stress\Run-StressTest.ps1 -Users '1,5,10,20,30' -Duration 20 -Burst 20 -Rounds 20
.\tests\stress\Run-StressTest.ps1 -Scenarios 'read-load,legacy-race' -ApiUrl http://127.0.0.1:5017
```

`Run-StressTest.ps1` 會依序：
1. 把 `C:\w3000\comm` 的 DBF、CDX、FPT 複製到 `%TEMP%`。
2. 用 subst 把複本掛到一個空的磁碟機代號（預設從 W: 往前找）。
3. 執行 `stress.mjs`。
4. 不論成功或失敗，最後都會卸載磁碟機，刪除 PostgreSQL schema `"<代號>:/w3000/comm"` 與 `dictionary.w3000_dbf`、`dictionary.w3000_dbf_dupkey` 中該代號的列，再刪除複本。

報告寫在 `tests/out/stress/`（Markdown 與 JSON，不納入版本控制）。有任何 FAIL 時，結束代碼為 1。

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `-Users` | `1,5,10,20` | `read-load` 依序測試的同時使用者數 |
| `-Duration` | `15` | `read-load` 每個級數的秒數 |
| `-Burst` | `10` | 其他情境同時送出的請求數 |
| `-Rounds` | `20` | `legacy-race` 的輪數 |
| `-Scenarios` | `all` | 只跑部分情境，以逗號分隔 |
| `-ApiUrl` / `-AgentUrl` | `http://localhost:5007` / `http://127.0.0.1:5009` | 後端與 LocalAgent 的位址 |
| `-KeepCopy` | 關 | 測完保留 DBF 複本，方便檢查 |

模擬舊系統寫入要用 `localagent\bridge\lazarus\DBFBridge.exe`，這個檔案不在版控內。在 git worktree 等沒有這個檔案的目錄執行時，先從主目錄複製過來 (已在 `.gitignore` 內)。

`stress.mjs` 也可以直接執行，例如 `node tests/stress/stress.mjs --drive V`。為了保護正式資料，下列情況會拒絕執行：
- 磁碟機代號是 C。
- 磁碟機不是 subst 掛上的。如果確定是複本，可以加 `--allow-non-subst` 略過這項檢查。
- 磁碟機與後端目前的預設磁碟機相同。

## 情境

| 名稱 | 模擬什麼 | 怎麼判定 |
| --- | --- | --- |
| `cold-sync` | 新的磁碟機第一次使用時，多人同時開 4 個畫面 | 全部回 200，且每張表的快照筆數等於 DBF 筆數 |
| `agent-queue` | 直接對 LocalAgent 同時送出多個 checksum | 只記錄數據（INFO）：單次耗時與排隊時間 |
| `read-load` | N 位使用者不停開 6 個清單畫面，沒有思考時間，代表最壞情況 | 有錯誤為 FAIL；p95 超過 3 秒為 WARN |
| `stampede` | 舊系統改了會計師或客戶資料後，多人同時開清單 | 全部成功，且沒有人拿到舊資料 |
| `dup-key` | 多人同時新增同一個會計師代號；另測舊系統剛新增某代號、快照還沒重灌時，網頁再新增同一代號 | DBF 只能有 1 筆，恰好 1 人成功、其餘收到 409；舊系統已新增的代號回 409 |
| `numbering` | 多人同時新增委任書條文（5-6）、共用摘要（4-5）、收費單（2-4） | DBF 中 seq、serial、單號沒有重複，每個請求都成功，DBF 新增的筆數等於成功的回應數 |
| `lost-update` | 甲、乙打開同一筆資料，甲改電話後存檔，乙改傳真後存檔 | 甲修改的電話仍保留 |
| `legacy-race` | 網頁存檔的同時，舊系統改另一筆資料 | 網頁每輪都讀得到舊系統的修改 |
| `consistency` | 全部情境跑完後 | 網頁讀到的資料與 DBF 一致 |

「舊系統修改」的模擬方式：另外啟動一個 32-bit `DBFBridge.exe` 程序，執行 VFP `REPLACE` 或 `INSERT INTO`（預設用 `localagent/bridge/lazarus/DBFBridge.exe`，可用 `--bridge` 指定）。這個程序和真正的 VFP 工作站一樣，不經後端，也不經 LocalAgent 的隊列，所以 PostgreSQL 與 checksum 字典都不會更新，寫入時間點也不受 LocalAgent 排隊限制。

## 2026-11-04 實測結果（修正同步遺失前）

測試環境：
- 開發機，後端以 Release 建置，LocalAgent 為 bridge 模式。
- 資料是 `C:\w3000\comm` 的複本：會計師 4 筆，客戶 97 筆（358 KB）。
- 參數：`-Users '1,5,10,20,30' -Duration 20 -Burst 20 -Rounds 20`。

| 結果 | 情境 | 說明 |
| --- | --- | --- |
| PASS | cold-sync | 80 個請求同時讀 4 張沒有快照的表，全部成功，但最慢 17.6 秒 |
| INFO | agent-queue | 單次 checksum 72 ms；20 個同時送出，最後一個要等 1.42 秒 |
| PASS | read-load | 沒有錯誤；回應時間與人數成正比（見下表） |
| PASS | stampede | 沒有拿到舊資料；20 人同時開客戶清單，最慢 14.4 秒（單人 1 秒） |
| FAIL | dup-key | 20 人同時新增同一代號：DBF 寫入 20 筆，其中 19 人收到 500 |
| FAIL | numbering | 委任書條文 20 筆的 seq 都是 4；共用摘要 20 筆的 serial 都是 1 |
| PASS | numbering | 收費單 20 張，單號沒有重複 |
| FAIL | lost-update | 乙存檔後，甲剛改的電話被乙畫面上的舊值蓋回去 |
| FAIL | legacy-race | 20 輪中有 11 輪，網頁讀不到舊系統的修改，隔 1 秒再讀仍是舊資料 |
| FAIL | consistency | 測完時 `cpa.dbf` 有 20 筆重複代號 |

`read-load` 各級數的結果：

| 同時使用者 | 每秒請求 | p50 | p95 | 最慢 | 錯誤 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 13.4 | 74 ms | 84 ms | 115 ms | 0 |
| 5 | 13.9 | 360 ms | 404 ms | 438 ms | 0 |
| 10 | 14.3 | 719 ms | 748 ms | 765 ms | 0 |
| 20 | 14.8 | 1.44 s | 1.51 s | 1.53 s | 0 |
| 30 | 15.3 | 2.16 s | 2.24 s | 2.26 s | 0 |

這一輪的「舊系統修改」是經 LocalAgent `/api/dbf/write` 模擬的。之後改為另外啟動 DBFBridge，比較接近真正的 VFP；用這個方式對修正前的後端重跑 `legacy-race`，30 輪中有 22 輪遺失。

## 修正同步遺失後

修正內容：
- **LocalAgent：** 在同一個隊列項目內讀取寫入前後的 `.dbf`，回傳 `checksumBefore`、`checksumAfter`。同時比對位元組，若有這次寫入以外的變動，就回傳 `otherChanges`。
- **後端：** 控制器改呼叫 `CommitWriteChecksumAsync`，以條件式 UPDATE 更新字典。只有同一請求的寫入首尾相接、沒有其他變動，而且字典仍是寫入前的值時才更新；否則不動字典，讓下次讀取重灌。

相同參數下重跑（`-Rounds 30`）的結果：

| 情境 | 修正前 | 修正後 |
| --- | --- | --- |
| `legacy-race` | 30 輪中 22 輪遺失 | 30 輪中 0 輪遺失 |
| 其他情境 | 見上表 | 結果與修正前相同。dup-key、numbering、lost-update 仍為 FAIL，要另外修正 |

修正後的速度數據比上表慢約 25%（單次 checksum 約 90 ms）。讀取路徑並沒有改；直接啟動 DBFBridge.exe 也要 80～90 ms，所以是測試當時電腦本身較慢。

修正後仍無法偵測一種情況：網頁與舊系統在同一個約 80 ms 的時間窗內，修改同一筆記錄的同一個欄位。此時位元組變動落在本次寫入的範圍內，無法分辨是誰改的。

## 修正重複代號與取號後

修正內容：

**LocalAgent**

`POST /api/dbf/write` 的 INSERT 新增 `unique` 與 `autoNumber` 兩個選項，詳見 `localagent/README.md`。帶這兩個選項時，VFP 腳本依序做三件事：
1. 先以 `RLOCK("0")` 鎖住檔頭。
2. 再以 `LOCATE` 確認代號不存在，或以 `CALCULATE MAX()` 取號。都不含已刪除的記錄。
3. 最後 `INSERT`。代號已存在時回 `DUPLICATE_KEY`，取到的號碼回傳給後端。

用檔頭鎖而不用 `FLOCK()`，原因是實測結果不同：
- 另一個程序鎖著某筆記錄時，`FLOCK()` 會失敗，`RLOCK("0")` 仍會成功。所以舊系統有人在編輯資料時，網頁還是能新增。
- 另一個程序持有檔頭鎖時，`INSERT INTO` 等約 2 秒後以 VFP 錯誤 108 失敗。所以舊系統的 `APPEND` / `INSERT` 會和網頁的新增排隊。

**後端**

- 先查後插的新增都改為帶 `Unique`，重複時回 409，涵蓋 1020、1030、1050~1080、2010、3010、3020、4010、4020 `acc_st`。
- 取號改由 VFP 執行：5-6 `bsdesc.seq`、4-5 `descrip.serial`、4010 `serial`、2-4 收費單號。
- 5-6 與 4-5 的新增先同步快照：原本在新磁碟機第一次新增會 500，因為快照表不存在。
- 寫 PostgreSQL 前先確認快照裡沒有同一個 `_record_number`：寫完 DBF 後，快照可能已被別人的請求重灌。
- 5-6 的 `_record_number` 改用 DBF 回傳的 RECNO，原本是快照最大值 + 1。

**測試**

- `dup-key` 加測一種情況：舊系統直接在 DBF 新增某代號 (快照還沒重灌)，網頁再新增同一代號。
- `numbering` 改為三項都要成立才 PASS：每個請求都成功、DBF 新增的筆數等於成功的回應數、號碼不重複。原本只檢查重複，所以在新磁碟機上 20 個請求全部 500 時也算 PASS。

2026-11-04 實測：同一台開發機，後端以 Release 建置，LocalAgent 為 bridge 模式，參數 `-Users '1,5,10,20,30' -Duration 20 -Burst 20 -Rounds 30`。

| 情境 | 修正前 | 修正後 |
| --- | --- | --- |
| `dup-key` | 20 人同時新增同一代號：DBF 寫入 20 筆，19 人收到 500 | DBF 1 筆；1 人 201，19 人 409 (「代號 Z0 已存在 (可能剛被其他工作站新增)…」) |
| `dup-key` (舊系統剛新增) | 未測；網頁只查快照，會再寫入一筆 | 409，DBF 仍為 1 筆 |
| `numbering` 5-6 | 20 筆的 seq 都是 4 | 20 筆全部成功，seq 不重複 |
| `numbering` 4-5 | 20 筆的 serial 都是 1 | 20 筆全部成功，serial 不重複 |
| `numbering` 2-4 | 不重複 (只靠後端的 `SemaphoreSlim`) | 20 筆全部成功，單號不重複；舊系統的新增也會和網頁排隊 |
| `consistency` | `cpa.dbf` 有 20 筆重複代號 | PASS |
| `legacy-race` | 30 輪中 0 輪遺失 (修正同步遺失後) | 30 輪中 0 輪遺失，沒有退步 |
| `lost-update` | FAIL | FAIL，不在這次範圍內 |

其他情境的結果與修正前相同 (cold-sync、stampede 為 PASS，agent-queue 為 INFO)。read-load 沒有錯誤，回應時間仍與人數成正比，但這次 30 人時 p95 為 3.20 s，超過 3 秒而變成 WARN；同一天另一輪 Debug 建置的測試是 3.06 s。

讀取路徑 (`EnsureTableSyncedAsync` 與各清單 API) 這次沒有修改。變慢是因為測試期間的 DBFBridge 啟動較慢：單次 checksum 平均 133 ms，Debug 那輪是 74 ms，第一次實測時是 72 ms。

仍未處理的情況：
- 以 UPDATE 改代號 (1060 改項目代號、2040 改單號)，仍只查快照。
- `recsmemo` 空表時的第一筆新增。
- 舊系統自己取號：VFP 在 `APPEND` 之前就算好號碼，仍可能與網頁取到同一號，這只能改舊系統。
- 寫完 DBF 後若快照剛好被重灌，EF Core 寫法的控制器 (例如 1020) 寫 PostgreSQL 時仍可能遇到唯一鍵衝突而回 500，但 DBF 與下次重灌後的快照都正確。

## 分析

### 效能：全公司的讀寫排成同一列

- **LocalAgent 一次只執行一個動作：** 伺服器上只有一個 LocalAgent，它把所有 DBF 動作（PING、CHECKSUM、READ、GET_PG_SCRIPT、寫入）排成一列，見 `localagent/agent.js` 的 `callDbfBridge`。每個動作都會重新啟動一次 32-bit `DBFBridge.exe` 並載入 VFP COM，約 70 ms。
- **每次讀取都要排隊：** 後端每次讀取都會先呼叫 `EnsureTableSyncedAsync` 計算 DBF 的 SHA256，所以每次開畫面都要進這一列。不論多少人使用，全公司每秒最多約 14 個請求；同時操作的人數增加時，每個人的等待時間跟著拉長，大約是「人數 × 72 ms」。有些畫面一次要同步多張表，例如 2040、4020、5010，等待時間還要乘上表數。
- **重灌不會合併：** 舊系統改過 DBF 後，第一批同時進來的請求都會發現 checksum 不同，各自整表重灌一次。後端記錄顯示，20 人同時開客戶清單時，客戶表被重灌了 20 次，每次約 0.55 秒，依序排隊，最後一人等了 14.4 秒；第一次使用新磁碟機時也是同樣的情形。客戶資料越多，重灌越慢。後端呼叫 LocalAgent 的逾時是 60 秒，超過就會失敗。

以 5～15 人的事務所來說，平常的讀取還能接受。比較需要注意的是上班時間大家同時開畫面，以及舊系統剛改過大表的時候。

### 正確性：同時寫入時會出錯

1. **舊系統的修改可能永遠不會同步到網頁**（`legacy-race`，已修正）
   - **原因：** 網頁存檔依序做三件事：寫 DBF、寫 PostgreSQL、重新取 checksum 存進字典。如果舊系統的修改剛好發生在第一步和第三步之間，字典記下的 checksum 已經包含舊系統的修改，但 PostgreSQL 沒有。之後每次讀取都會判定「沒有變動」而不重灌。
   - **後果：** 網頁會一直顯示舊資料，直到 DBF 下次被修改。如果使用者又在網頁上存了同一筆資料，網頁送出的是整筆資料，會把舊系統的修改從 DBF 蓋掉，等於永久遺失。
   - **頻率：** 實測 20 輪有 11 輪發生，在新舊系統並行的期間不是罕見情況。
2. **同時新增同一代號，DBF 會出現重複記錄**（`dup-key`，已修正）
   - **原因：** 新增前只查 PostgreSQL，然後直接 `INSERT` 進 DBF，而 DBF 沒有唯一限制。
   - **後果：** 收到 500 的使用者以為新增失敗，其實 DBF 已經寫入；如果再按一次，又會多一筆。之後依代號修改或刪除，只會找到第一筆。
3. **自動取號重複**（`numbering`，已修正）
   - **原因：** 委任書條文的 seq（`Wbase5010Controller`）、共用摘要的 serial（`Wbase4020Controller`）、會計科目的 serial（`Wbase4010Controller`），都是從 PostgreSQL 取最大值加 1，沒有任何鎖。
   - **後果：** 委任書條文的 seq 是主鍵，重複後只有第一筆看得到。共用摘要沒有唯一鍵，所以重複不會報錯，也不容易察覺。
   - **例外：** 收費單（2040）在後端用 `SemaphoreSlim` 排隊，所以沒有重複。但這個鎖只擋得住同一個後端程序內的請求；舊系統同時開收費單，仍可能取到同一個單號。
4. **後存檔的人會覆蓋前一位的修改**（`lost-update`）
   - **原因：** 1020 等畫面存檔時送出整筆資料，後端用 `REPLACE` 把所有欄位寫回 DBF，沒有任何版本檢查。
   - **差異：** VFP 原本大多是逐欄寫回，所以舊系統沒有這個問題。
5. **未測項目：所有人共用一個預設磁碟機**
   - **原因：** `POST /api/systemconfig` 會改後端全域的預設磁碟機，也會寫回 `system_config.json`；沒有帶 `X-Data-Drive` 標頭的請求都用這個預設值。
   - **現況：** 目前前端的請求都帶這個標頭，所以影響有限。但任何一個人在設定畫面切換磁碟機，都會改到所有人共用的預設值。

### 建議修正（依影響排序）

1. ~~**寫入與取 checksum 合併成一個動作**~~：已修正，見「修正同步遺失後」。除了比對 checksum，也比對寫入前後的位元組，所以 VFP 在同一段時間改了別的記錄或別的欄位也偵測得到。
2. ~~**在 VFP 腳本內檢查主鍵與取號**~~：已修正，見「修正重複代號與取號後」。實作時沒有用 `FLOCK()`，改為鎖檔頭 `RLOCK("0")`：`FLOCK()` 只要有人鎖著任何一筆記錄 (例如舊系統正在編輯) 就會失敗，檔頭鎖只擋新增。
3. **重灌合併**：每張表（schema + table）加一個鎖。拿到鎖之後重新比對一次 checksum，相同就直接讀快照。這樣 20 人同時開畫面只會重灌一次。可以用後端的 `SemaphoreSlim` 字典，或 PostgreSQL 的 `pg_advisory_xact_lock`。
4. **存檔只送出有改的欄位，或加上比對舊值**：前端只送出有變動的欄位；或者把原始值一起送出，由 VFP 腳本在 `REPLACE` 前確認原始值沒有被改過，改過就回 409。
5. **DBFBridge 常駐**：改成常駐程序並重複使用 COM 物件，省掉每次約 70 ms 的啟動時間。
