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
```

- 後端實際監聽 `appsettings.json` 的 `Urls` (`http://0.0.0.0:5007`)；Vite 把 `/api` 代理到 `127.0.0.1:5007`。
- 打包與報表編譯走 `Wx3000-Manager.ps1` 選單：`[5]` 伺服器發佈、`[8]` LocalAgent 打包、`[13]` 報表 DLL 與 WbaseBridge、`[14]` 發佈 GitHub 版本 (報表元件無法在 CI 編譯，發版一律用 `[14]`)。細節見 `BUILD_AND_DEPLOY.md`。

## 架構重點

### 資料流與動態磁碟機
前端 → 後端 `api/wbaseXXXX` → LocalAgent `/api/dbf/*` → 32-bit `DBFBridge.exe` (VFP COM `w3000_dbf.dll`) → `<Drive>:\w3000\comm\*.dbf`。
- 前端 `services/apiConfig.ts` 的 Axios 攔截器在每個 `/api` 請求帶 `X-Data-Drive`；後端 `SystemConfigService` 依此選 DBF 目錄與 PostgreSQL schema `"<drive>:/w3000/comm"` (例如 `"c:/w3000/comm"`)，`DynamicModelCacheKeyFactory` 讓 EF 依 schema 快取模型。
- 正式資料在 `C:\w3000\COMM`。要測寫入時，把資料複本 `subst` 成另一個磁碟機代號 (目錄須為 `<代號>:\w3000\comm`)，並在前端設定 (`Ctrl+Shift+S`) 指向該代號；測完要刪掉對應的 PostgreSQL schema 與 `dictionary.w3000_dbf` 列。

### DBF 權威讀寫 (`IDbfSyncService`)
- **讀**：先呼叫 `EnsureTableSyncedAsync(dbfPath, dbfName, schema, table, keyFields)`。它比對 DBF 的 `SHA256:FileSize` 與 `dictionary.w3000_dbf`，不同就整表重灌快照。`keyFields` 會成為 PostgreSQL 的唯一鍵；沒有唯一鍵的表傳 `""`，否則 DBF 裡的重複值會讓重灌一直失敗。快照的 `_record_number` 等於實體 RECNO，已刪除列不在快照中。
- **寫**：一律先 `WriteRecordAsync(..., operation, keyField, keyValue, fields)` 寫 DBF，成功後才寫 PostgreSQL 並更新 checksum；DBF 失敗時不可單邊寫 PostgreSQL。`keyField` 可以是 VFP 運算式 (例如沒有唯一鍵的 `recmod` 用 `"RECNO(),rno"`)。日期欄傳 `{"$date":"yyyy-MM-dd"}`。LocalAgent 回 `LOCK_TIMEOUT` (VFP 獨佔或鎖定) 時後端回 409。
- LocalAgent 把寫入組成 `EXEC_VFP` 的 VFP `REPLACE` 腳本執行。正式 DBF 的格式可能和 VFP 原始碼裡的樣板不同 (例如 FoxPro 2.x / dBase III、金額 F/N 而非 Currency)，不要假設欄位型別。
- 控制器有兩種寫法：EF Core 實體 (`Models/*Master.cs` + `AppDbContext`)，以及 ADO + DTO (`GetDbConnection()`，如 1020、1030、2040、4010、4020、5010)。新模組比照最接近的既有模組。

### LocalAgent (`localagent/agent.js`)
- 只聽本機；`/api/dbf/*` 拒絕帶 `Origin` / `Sec-Fetch-Site` 的瀏覽器請求，只給後端用。可轉送給 DBFBridge 的動作有白名單 (`DBF_BRIDGE_ACTIONS`)，`EXEC_VFP` 只能由 `executeDbfWrite` 內部使用。
- 報表：`POST /report` 把 `jsonData` 寫成 `%TEMP%\Wx3000\` 暫存 JSON，交給 64-bit `WbaseBridge.exe` 呼叫 `wbaseRP.dll`。`/report`、`/api/call` 只能呼叫 `localagent/dlls.json` 登記過的函數，未登記回 `FORBIDDEN`。

### 報表 DLL (`report/wbase/`, Lazarus + FastReport)
- 新增一張報表要改四處：`wbase_unit1.lfm` / `.pas` 加 `TfrxReport` 範本 (資料集名 `MTable`)、`wbase_repunit1.pas` 加 stdcall 函數、`wbaseRP.lpr` 匯出、`localagent/dlls.json` 登記。`WbaseBridge_Generic.lpr` 依參數個數分派，命令列參數要 base64。`IsPrint`：`0` 預覽、`1` 直接列印、`999` 只 PrepareReport 不開視窗 (適合自動驗證)。
- 只用 Manager `[13]` 編譯 (會先檢查匯出函數才覆蓋 `localagent/wbase/wbaseRP.dll` 與 `WbaseBridge.exe`)，之後跑 `[8]` 並重啟 LocalAgent 才生效。`[13]` 會改到已追蹤的 `report/wbase/lib/x86_64-win64/wbase_unit1.lfm`，不打算提交時用 `git checkout --` 還原。
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
- 工具路徑 (見 `SKILL.md`)：Lazarus 4.6 `C:\fpcupdeluxe4\lazarus`、VFP9 `C:\Program Files (x86)\Microsoft Visual FoxPro 9`、FoxBin2PRG `C:\Thor\Thor\Tools\Components\FoxBin2PRG\FoxBin2Prg.exe`。
