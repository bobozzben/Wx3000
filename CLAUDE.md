# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Wx3000 把 Visual FoxPro 的會計師事務所 / 營業稅 / 進銷存系統 (W3000) 移植成 React + ASP.NET Core。轉型期間新舊系統共用同一份 VFP `.dbf` 資料，所以 **DBF 是權威資料**，PostgreSQL 只是快照。文件、畫面文字與提交說明以繁體中文為主。

## 常用指令

```powershell
pnpm install
pnpm dev                     # 同時啟動 API (:5007) + Vite (:5173) + LocalAgent (:5009)
pnpm dev:api / dev:web / dev:agent

# 修改後的驗證 (CI 只跑前端建置、Electron 打包與後端建置；沒有前端或後端的測試專案)
pnpm --filter frontend build           # tsc -b + vite build
pnpm --filter frontend lint            # oxlint
dotnet build backend/Wx3000.Backend.csproj
cd localagent; npm test                # node --test agent.test.js
cd localagent; node --test --test-name-pattern "<測試名稱>" agent.test.js   # 單一測試

# 壓力測試 (CI 無法執行；需先啟動後端與 LocalAgent，自動建立 subst 複本並在測完清除，見 tests/stress/README.md)
.\tests\stress\Run-StressTest.ps1 [-Scenarios 'read-load,legacy-race'] [-ApiUrl http://127.0.0.1:5017]   # 多人競態與負載
.\tests\stress\Run-StressTest.ps1 -Suite large [-Rows '10000,30000'] [-Tables 'buyinv,recmom,customer']  # 灌到上萬筆後量測
```

- 後端實際監聽 `appsettings.json` 的 `Urls` (`http://0.0.0.0:5007`)；Vite 把 `/api` 代理到 `127.0.0.1:5007`。
- 打包與報表編譯走 `Wx3000-Manager.ps1` 選單：`[5]` 伺服器發佈、`[8]` LocalAgent 打包、`[13]` 報表 DLL 與 WbaseBridge、`[14]` 發佈 GitHub 版本 (報表元件無法在 CI 編譯，發版一律用 `[14]`)。細節見 `BUILD_AND_DEPLOY.md`。

## 架構重點

### 資料流與動態磁碟機
前端 → 後端 `api/wbaseXXXX` → LocalAgent `/api/dbf/*` → 32-bit `DBFBridge.exe` (VFP COM `w3000_dbf.dll`) → `<Drive>:\w3000\comm\*.dbf`。
- 前端 `services/apiConfig.ts` 的 Axios 攔截器在每個 `/api` 請求帶 `X-Data-Drive`；後端 `SystemConfigService` 依此選 DBF 目錄與 PostgreSQL schema `"<drive>:/w3000/comm"` (例如 `"c:/w3000/comm"`)，沒有標頭時用執行檔目錄的 `system_config.json` (預設 `C`)。`DynamicModelCacheKeyFactory` 讓 EF 依 schema 快取模型。
- 正式資料在 `C:\w3000\COMM`。要測寫入時，把資料複本 `subst` 成另一個磁碟機代號 (目錄須為 `<代號>:\w3000\comm`)，並在前端設定 (`Ctrl+Shift+S`) 指向該代號；測完要刪掉對應的 PostgreSQL schema 與 `dictionary.w3000_dbf`、`dictionary.w3000_dbf_dupkey` 列。

### DBF 權威讀寫 (`IDbfSyncService`)
- **讀**：先呼叫 `EnsureTableSyncedAsync(dbfPath, dbfName, schema, table, keyFields)`。它比對 DBF 的 `SHA256:FileSize` 與 `dictionary.w3000_dbf`，不同才整表重灌快照。重灌在單一交易內：清空舊快照並移除先前的 `ux_` 唯一索引 → 結構腳本 → 資料腳本；任何一步失敗整個回復、保留舊快照。`keyFields` 會成為 PostgreSQL 的唯一鍵；DBF 主鍵重複時，資料腳本回到 savepoint，改為每個主鍵只保留 RECNO 最小的一筆，並記在 `dictionary.w3000_dbf_dupkey` (`GetDuplicateKeysAsync` 可讀)。需要看到所有列的表傳 `""`。同一張 DBF 被不同畫面以不同 `keyFields` 同步時 (例如 `customer`)，快照內容取決於 DBF 變動後第一個觸發重灌的畫面。快照的 `_record_number` 等於實體 RECNO，已刪除列不在快照中。
- **寫**：一律先 `WriteRecordAsync(..., operation, keyField, keyValue, fields)` 寫 DBF，成功後才寫 PostgreSQL，再呼叫 `CommitWriteChecksumAsync(dbfPath, dbfName)` 更新 checksum；DBF 失敗時不可單邊寫 PostgreSQL，PostgreSQL 失敗時不要呼叫 Commit。**不要**在寫入後自己 `GetChecksumAsync` + `UpdateDictionaryChecksumAsync`：舊系統若在同一段時間改了 DBF，字典會記下包含舊系統修改的 checksum，網頁從此讀不到那筆修改。LocalAgent 在同一個隊列項目內讀取寫入前後的 DBF，回傳 `checksumBefore`、`checksumAfter`，並比對位元組，用 `otherChanges` 標示是否有這次寫入以外的變動。Commit 只有在同一請求的寫入首尾相接、沒有其他變動，而且字典仍是寫入前的 checksum 時，才以條件式 UPDATE 改成寫入後的 checksum；否則不動字典，下次讀取重灌。`keyField` 可以是 VFP 運算式 (例如沒有唯一鍵的 `recmod` 用 `"RECNO(),rno"`)。日期欄傳 `{"$date":"yyyy-MM-dd"}`。LocalAgent 回 `LOCK_TIMEOUT` (VFP 獨佔或鎖定) 時後端回 409。
- LocalAgent 把寫入組成 `EXEC_VFP` 的 VFP 腳本執行 (`INSERT INTO`、`LOCATE FOR` + `REPLACE`、`LOCATE FOR` + `DELETE`；找不到記錄回 `RECORD_NOT_FOUND`)。`INSERT` 預設先在同一段腳本找未刪除、鍵值相同的記錄，有就回 `DUPLICATE_KEY` 不新增；鍵值本來就會重複的表 (例如收費明細以 `rno`、共用摘要以 `accno` 新增) 要傳 `WriteRecordAsync(..., allowDuplicateKey: true)`。寫入在 LocalAgent 隊列排超過 `queueTimeoutMs` (後端送 45 秒) 或後端已斷線就不執行，回 `AGENT_BUSY`；後端自己等到 60 秒逾時則回 `WRITE_UNCONFIRMED` (可能已寫入)，錯誤訊息用 `DbfWriteResult.FailureText(...)`，不可說成寫入失敗。正式 DBF 的格式可能和 VFP 原始碼裡的樣板不同 (例如 FoxPro 2.x / dBase III、金額 F/N 而非 Currency)，不要假設欄位型別。
- **新增與取號**：不要只查 PostgreSQL 就新增或取 `MAX()+1`，多人同時新增、或舊系統剛新增而快照還沒重灌時 DBF 會重複 (DBF 沒有唯一限制)。有查重或取號的 INSERT，LocalAgent 都在同一段 VFP 腳本內先 `RLOCK("0")` 鎖住檔頭再檢查 / 取號，然後才 `INSERT`；舊系統的 `APPEND` 會等這段結束。INSERT 可帶 `DbfWriteOptions`：
  - `Unique`：明確要求查重 (預設查重已涵蓋一般鍵值；鍵值含 `RECNO()` 或要與取號併用時才需要)。`DbfWriteOptions.UniqueKeyIfInsert(operation)` 給 upsert 寫法用；`DbfWriteResult.IsConflict` (`LOCK_TIMEOUT` 或 `DUPLICATE_KEY`) 時回 409。
  - `AutoNumber`：由 VFP 取 `MAX()+1`，可加範圍或前綴 + 位數，號碼回在 `AutoNumber`；有 `AutoNumber` 時不做預設查重。`fields` 仍要放後端由快照算的號碼，給舊版 LocalAgent 用，再以 `AutoNumberOr(該號碼)` 取得實際號碼。
  - 用法見 `docs/backend/backend_SPEC.md` 3.2，例如 1020 的 POST、5010 的 bsdesc、2040 的單號。
- 控制器有兩種寫法：EF Core 實體 (`Models/*Master.cs` + `AppDbContext`，如 1020、1030、1050~1080、2010、3010、3020、3050、3060)，以及 ADO + DTO (`GetDbConnection()`，如 1010、2030、2040、2050、3025、4010、4020、5010)。新模組比照最接近的既有模組。

### LocalAgent (`localagent/agent.js`)
- 只聽本機 (`127.0.0.1` / `::1` 的 5009)；`/api/dbf/*` 拒絕帶 `Origin` / `Sec-Fetch-Site` 的瀏覽器請求，只給後端用。可轉送給 DBFBridge 的動作有白名單 (`DBF_BRIDGE_ACTIONS`：`PING`、`CHECKSUM`、`READ`、`GET_PG_SCRIPT`)，`EXEC_VFP` 只能由 `executeDbfWrite` 與 custbak 匯出入的固定範本內部使用。
- 報表：`POST /report` 把 `jsonData` 寫成 `%TEMP%\Wx3000\` 暫存 JSON，交給 64-bit `WbaseBridge.exe` 呼叫 `wbaseRP.dll`。`/report`、`/api/call` 只能呼叫 `localagent/dlls.json` 登記過的函數 (目前 `wbaseRP` 11 個)，未登記回 `FORBIDDEN`。DLL 路徑依 `dlls.json` 的 `path` / `fallback_paths` (可用絕對路徑)，環境變數 `WBASE_DLL_PATH` 可整個覆蓋。
- Word：`/api/office/*` 由前端直接呼叫 (查 Word、ShellExecute 開範本、以範本套印成 docx)，只接受 `WORD_TEMPLATES` 白名單的範本代號與磁碟機字母，路徑固定為 `<磁碟機>:\W3000\comm\<範本檔>`，以固定的 PowerShell 腳本操作 Word COM。
- 修改後跑 `npm test` (43 項，含子測試共 53；有 DBFBridge 時 61)。其中「guarded INSERT against real VFP」會用真的 DBFBridge 在暫存目錄建表驗證寫入腳本，找不到 `localagent\DBFBridge.exe` 或 `bridge\lazarus\DBFBridge.exe` 時略過，在 worktree 等沒有執行檔的地方可用環境變數 `WX3000_DBFBRIDGE` 指定 (有跑時另有 8 個子測試)。`agent_v*.js`、`test_v*.html`、`README_v1.md` 是歷史留存 (Port 18889)，不用改。

### 報表 DLL (`report/wbase/`, Lazarus + FastReport)
- 新增一張報表要改四處：`wbase_unit1.lfm` / `.pas` 加 `TfrxReport` 範本 (資料集名 `MTable`)、`wbase_repunit1.pas` 加 stdcall 函數、`wbaseRP.lpr` 匯出、`localagent/dlls.json` 登記。`WbaseBridge_Generic.lpr` 依參數個數分派，命令列參數要 base64。`IsPrint`：`0` 預覽、`1` 直接列印、`999` 只 PrepareReport 不開視窗 (適合自動驗證)。
- 只用 Manager `[13]` 編譯：報表 DLL 用 Debug 模式、`WbaseBridge_Generic.lpi` 用 Release 模式，先確認 `dlls.json` 登記的函數都已匯出並試跑橋接程式，才覆蓋 `localagent/wbase/wbaseRP.dll`、`localagent/bridge/lazarus/WbaseBridge.exe` 與 `localagent/WbaseBridge.exe`。開發中用 `node agent.js` 跑的 LocalAgent (bridge 模式每次列印都重新啟動橋接程式) 下次列印就用新版；隨身碟安裝檔要再跑 `[8]`。`[13]` 會改到已追蹤的 `report/wbase/lib/x86_64-win64/wbase_unit1.lfm`，不打算提交時用 `git checkout --` 還原。
- `[14]` 發版：本機必須是 GitHub `main` 最新提交且報表 / 橋接原始碼無未提交修改；先編譯報表元件，再推 tag 讓 `release.yml` 建立草稿 Release (附 Server、LocalAgent zip 與 Electron 安裝檔)，補傳 `Wx3000_ReportBin_<版本>.zip` 後才正式發佈。各機自動更新只看得到正式版。
- `DBFBridge.exe` 必須 32-bit、`WbaseBridge.exe` 必須 64-bit (位元錯誤會出現 `LoadLibrary ... Code=193`)。

### 前端模組
- 選單項目在 `frontend/src/wbase/menu/menuConfig.ts`，但**還要在 `wbaseMainPage.tsx` 的 `handleSelectAction` 與 render 分支註冊**，否則點選只會跳「目前此模組正在移植建置中」。
- 一個模組通常是：`frontend/src/wbase/wbaseXXXX/`、`frontend/src/services/wbaseXXXX.ts`、`backend/Controllers/WbaseXXXXController.cs`、`docs/frontend/wbase/wbaseXXXX/SPEC.md`，並更新 `docs/SPEC.md`、`docs/backend/backend_SPEC.md`、`docs/frontend/wbase/menu/SPEC.md`。
- 表格母版：`FoxProGridV2` (多列行內盲打)、`FoxProGridCard` + `useFoxProCardNavigation` (清單 + 表單)、`FoxProGridBill` (單據表頭 + 明細)，規格在 `docs/frontend/components/foxpro_grid_SPEC.md`。`FoxProGridV2` 在 `window` 上監聽按鍵並自用 `F3`/`F7`；模組要維持 VFP 原本的按鍵配置時，在頁面層用 capture 階段攔截。
- 能寫入 DBF 的文字都要經 `services/validation.ts` 的 Big5 檢查 (`checkBig5Compatible`、`truncateBig5`)。

## 移植規範

- UX 硬性規則 (詳見 `.agents/rules/foxpro_ux_and_quality.md`、`WORKSPACE.md`)：全部操作可純鍵盤完成；代號、名稱、地址查詢用 `F2`/`F3`/`F4` 開大型彈窗 (`SearchModal`、`AddressSelectModal`)，不用下拉選單；焦點用黃色外框；`Consolas` 16px、列高 38px。
- VFP 原始碼在 `F:\W3000SOUR\SourS9BASE\` (`PROGS`、`FORMS`、`LIBS`、`REPORTS`)。選單按鈕對應 `base20.prg` 等檔裡的 `wbasemenuNNcmdMM` 函數。`.scx`/`.vcx`/`.frx` 本身是 DBF 表 (memo 在 `.sct`/`.vct`/`.frt`)，文字是 Big5 (cp950)；`.frx` 座標單位是 1/10000 英吋。
- 分析時注意 VFP 全域環境 (`w3000func.prg` 的 `w_init_env`：`SET DELETED ON`、`SET EXACT` 未設定，字串 `=` 可能變成前綴比對)。
- 工具路徑 (見 `SKILL.md`)：VFP9 `C:\Program Files (x86)\Microsoft Visual FoxPro 9`、FoxBin2PRG `C:\Thor\Thor\Tools\Components\FoxBin2PRG\FoxBin2Prg.exe`。
- Lazarus：Manager (`[13]`、`[14]`、`[A]`) 依序在環境變數 `LAZBUILD` → `PATH` → `C:\fpcupdeluxe\lazarus` → `C:\lazarus` → `C:\Program Files\Lazarus` 找 `lazbuild.exe`，**不會**找 `SKILL.md` 所列 Lazarus 4.6 的 `C:\fpcupdeluxe4\lazarus`。要用 4.6 編譯時先設 `LAZBUILD=C:\fpcupdeluxe4\lazarus\lazbuild.exe`。
