# Wx3000 LocalAgent (本機 DBF 雙向同步與原生報表 DLL 橋接服務)

`localagent` 為運行於客戶端或伺服器本機的輕量級 Node.js 背景代理服務（固定監聽 Port `5009`，只綁定 `127.0.0.1` 與 `::1`，支援 HTTP 與 WebSocket），負責解決瀏覽器/現代後端無法直接操作地端 **32-bit Visual FoxPro COM (`w3000_dbf.dll`)** 與 **64-bit Lazarus FastReport 報表 (`wbaseRP.dll`)** 的跨架構橋接問題。

安裝精靈 (`publish\Install-Wx3000.ps1`) 不註冊 Windows 服務，而是寫入 `HKLM\...\Run` 的 `Wx3000LocalAgent`，在使用者登入時以無視窗的 `Start-LocalAgent-Hidden.vbs` 啟動 `Wx3000Agent.exe`，報表預覽視窗才會出現在使用者桌面。`install_service.bat` 仍可把它註冊為 `Wx3000Agent` 服務，但服務在 Session 0 執行，報表預覽視窗不會出現在使用者桌面。

---

## 🏗️ 兩大核心職責與位元架構防呆

| 橋接執行檔 | 目標位元架構 | 呼叫目標 DLL | 職責說明 |
| :--- | :---: | :--- | :--- |
| **`DBFBridge.exe`** | **32-bit (`i386-win32`)** | `w3000_dbf.dll` (32-bit VFP COM) | 計算 DBF `SHA256:FileSize` Checksum (`CHECKSUM`)、產生 PostgreSQL 結構 / 資料腳本 (`GET_PG_SCRIPT`，由後端執行)、讀取單筆 (`READ`)，以及執行 LocalAgent 組成的 VFP 腳本 (`EXEC_VFP`：單筆 `INSERT` / `REPLACE` / `DELETE` 與客戶資料整批匯出入 `custbak.dbf`)；VFP 鎖定錯誤會回 `lockHint` |
| **`WbaseBridge.exe`** | **64-bit (`x86_64-win64`)** | `wbaseRP.dll` (64-bit FastReport) | 每次呼叫啟動一個獨立 GUI 進程載入 FastReport 報表 DLL，開啟原生預覽視窗或直接驅動印表機；依函數名稱與參數個數分派 (6 參數報表、7 參數 `wbase350_buyinv_list`、2 參數 `int, str`) |

> ⚠️ **重要防呆**：`DBFBridge.exe` 必須為 **32-bit**，`WbaseBridge.exe` 必須為 **64-bit**。切勿將兩者混淆，否則載入 DLL 時將觸發 Windows `ERROR_BAD_EXE_FORMAT (Code=193)`。

- 報表橋接預設為 `bridge` 模式 (環境變數 `WBASE_MODE` 可改為 `koffi`，在 Node 進程內直接載入 DLL；WebSocket `setMode` 也可切換)。
- **DLL 路徑解析**：環境變數 `WBASE_DLL_PATH` 指向存在的檔案時優先使用 (套用到所有 DLL)；否則依 `dlls.json` 的 `path` 與 `fallback_paths` 依序尋找，可寫絕對路徑，相對路徑則以執行檔目錄與目前工作目錄為基準。
- **橋接程式位置**：`WbaseBridge.exe` 依序尋找執行檔目錄、`bridge\lazarus\`、`bridge\` 與目前工作目錄 (也接受 `WbaseBridge_Generic.exe`)；`DBFBridge.exe` 尋找執行檔目錄與 `bridge\lazarus\`。

---

## 🔒 存取限制

- **只監聽本機** (`127.0.0.1` 與 `::1`)，不需也不應開放防火牆。`Host` 標頭必須是 `localhost`、`127.0.0.1` 或 `[::1]` (防 DNS rebinding)，因此後端 `LocalAgent:Url` 必須指向同一台機器 (預設 `http://localhost:5009`)。
- **`/api/dbf/*` 不開放瀏覽器**：只有本機後端與診斷腳本可呼叫，帶 `Origin` 或 `Sec-Fetch-Site` 的請求一律回 403 (`/api/dbf/check_drive` 除外)。
- **DBFBridge 動作白名單 (`DBF_BRIDGE_ACTIONS`)**：經 HTTP 轉送給 `DBFBridge.exe` 的動作只有 `PING`、`CHECKSUM`、`READ`、`GET_PG_SCRIPT`。`EXEC_VFP` 只能由 `write` 與 `export_custbak` / `import_custbak` 的固定範本在內部使用，呼叫端無法直接送 VFP 腳本。
- **報表端點的瀏覽器來源**：放行 localhost、內網 IP (10/8、172.16/12、192.168/16) 與單段主機名 (如 `SERVER01`)。其他網域 (ngrok、企業內網 FQDN) 請設定環境變數 `WX3000_AGENT_ALLOWED_ORIGINS`，多筆以逗號分隔，例如 `https://erp.example.com`。
- **DLL 白名單**：`/api/call`、`/report` (含相容路徑) 與 WebSocket 只能呼叫 `dlls.json` 登記的 DLL 與函數，未登記回 `errorType: "FORBIDDEN"`。新增報表函數時必須同步登記。
- **Electron 限制**：目前 `file://` 頁面 (`webSecurity: false`) 的請求不帶 `Origin`，因此無 `Origin` 的跨站 POST 會放行；無 `Origin` 的跨站 GET 只放行唯讀端點 (`/`、`/test.html`、`/mac`、`/config`、`/dllList`、`/api/check-drive`、`/api/dbf/check_drive`)。若日後開啟 `webSecurity`，請將實際 Origin 加入放行規則。

修改後請執行 `npm test` (`localagent/agent.test.js`，共 35 項；其中 `HTTP surface` 含 5 個子測試，`node --test` 統計為 40)。

`guarded INSERT against real VFP` 會用真的 `DBFBridge.exe` 在暫存目錄建一張表，驗證檢查主鍵、取號 (含範圍與前綴、略過已刪除記錄) 與檔頭鎖等待的 VFP 腳本，有跑時另有 8 個子測試。

- 預設找 `localagent\DBFBridge.exe` 或 `localagent\bridge\lazarus\DBFBridge.exe`，都找不到時略過 (CI 與 worktree 沒有這些執行檔)。
- 也可以用環境變數指定，例如 `$env:WX3000_DBFBRIDGE='F:\ADSProject\Wx3000\localagent\DBFBridge.exe'; npm test`。
- 整項約需 5 秒，其中鎖定等待佔 4 秒。

## 🔌 主要 API 端點

### 1. 地端 VFP DBF 資料庫橋接 (`/api/dbf/*`)
- 內建單一執行緒 Promise 串列隊列 (`dbfQueue`)，所有 `DBFBridge.exe` 呼叫依序執行，確保高併發請求下不會發生 DBF 檔案鎖定衝突。
- `GET /api/dbf/ping`：檢測 `DBFBridge.exe` 與 VFP COM 元件狀態。
- `GET` / `POST /api/dbf/checksum`：高速計算地端 `.dbf` 檔案之 `SHA256:FileSize` 校驗碼。
- `POST /api/dbf/get_pg_script`：產生 DBF 轉 PostgreSQL 的結構 (`STRUCT`) 或資料 (`DATA`) 腳本。
- `POST /api/dbf/write`：新增、修改、刪除 DBF 記錄（別名、欄位名與鍵值運算式會先經過識別字檢查）。
  - 由 LocalAgent 組成 VFP 腳本經 `EXEC_VFP` 執行：`INSERT` 用 `INSERT INTO`，`UPDATE` 用 `LOCATE FOR` + `REPLACE`，`DELETE` 用 `LOCATE FOR` + `DELETE`；回傳 `{ success, operation, recno, checksumBefore, checksumAfter, otherChanges }`，找不到記錄時回 `errorType: "RECORD_NOT_FOUND"`。
  - 寫入前後的 `.dbf` 與這次 VFP 腳本在同一個隊列項目內讀取，中間不會插進其他 LocalAgent 動作。checksum 格式與 `CHECKSUM` 相同，為小寫 SHA-256 hex 加上 `:` 與檔案位元組數。
  - `otherChanges` 表示前後差異超出這次寫入會動到的位元組，也就是同時有舊系統或其他程式改了這個檔案。這次寫入會動到的位元組：檔頭前 32 個位元組、INSERT 的整筆與檔尾標記、UPDATE 寫入的欄位與 `_nullflags`、DELETE 的刪除旗標。後端據此決定能不能直接沿用快照。
  - `keyField` 可為欄位名、`RECNO()` 或 `ALLTRIM()` / `STR()` / `VAL()` / `TRANSFORM()` 包住的欄位，多個鍵以逗號分隔 (例如 `RECNO(),rno`)，`keyValue` 依同樣順序以逗號分隔；一般鍵以 `ALLTRIM(TRANSFORM(欄位)) == 值` 比對。
  - 欄位值只接受字串、數字、布林、`null` 與日期值；日期 (D) 欄位傳 `{ "$date": "yyyy-MM-dd" }`，會轉成 VFP `{^yyyy-MM-dd}`，`""` 或 `null` 代表空日期。一般字串一律當字元值；含換行或引號的字串以 CP950 + Base64 經 `STRCONV(..., 14)` 寫入。
  - DBF 被其他工作站獨佔或鎖定 (VFP 錯誤 3、108、109、130、1705) 時回 `errorType: "LOCK_TIMEOUT"`，後端據此回 409。
  - **新增時的防重複與取號**：`INSERT` 可以加 `unique` 與 `autoNumber` 兩個選項，`UPDATE` / `DELETE` 帶這兩個選項會回 `INVALID_REQUEST`。只要有其中一個選項，腳本就改成以下順序：
    1. `SET DELETED ON`，再用 `RLOCK("0")` 鎖住檔頭。已用真的 VFP 驗證：另一個程序持有檔頭鎖時，`INSERT INTO` 會等約 2 秒後以錯誤 108 失敗；修改既有記錄則不受影響。所以舊系統的 `APPEND` / `INSERT` 會和這段腳本排隊。
    2. 檔頭被別人鎖住時，最多重試 2 秒 (`SET REPROCESS TO 2 SECONDS`)，之後回 `errorType: "LOCK_TIMEOUT"`。
    3. 檢查或取號，然後 `INSERT`，最後 `UNLOCK`。
    - `unique: true`：以 `keyField` / `keyValue` 做 `LOCATE`，不含已刪除的記錄。DBF 已有這筆時不新增，回 `{ success: false, errorType: "DUPLICATE_KEY", message }`，後端回 409。
    - `autoNumber: { field, assignTo?, scopeField?, scopeValue?, prefix?, width? }`：用 `CALCULATE MAX(field)` 取號，不含已刪除的記錄。
      - `scopeField` / `scopeValue` 會用 `keyField` 的比對規則限定範圍。
      - 有 `prefix` 時，`field` 是字元欄，號碼 = `prefix` + `PADL(MAX(VAL(去掉前綴的部分)) + 1, width, "0")`。前綴只能是 1–10 個英數字，`width` 為 1–18。
      - 號碼會寫進 `field` 與 `assignTo` 列出的欄位，`fields` 裡同名的值不寫。成功時回傳 `autoNumber` (字串，例如 `"21"`、`"A114000012"`)。
    - 這兩個選項是後來加的，舊版 LocalAgent 會忽略它們，照一般 INSERT 寫入 `fields`。所以後端仍要在 `fields` 放入自己算的號碼，回傳沒有 `autoNumber` 時就沿用。
    - 腳本對 DBF 的實際變動與一般 INSERT 相同 (鎖不會改到檔案內容)，`checksumBefore` / `checksumAfter` / `otherChanges` 的判斷不變。`DUPLICATE_KEY` 與腳本自己回的 `LOCK_TIMEOUT` 都沒有寫入，所以不回傳 checksum。
- `POST /api/dbf/read`：讀取單筆 DBF 記錄。
- `POST /api/dbf/export_custbak`：2-2 客戶資料匯出。內容 `{ dbfPath, keys, targetFile }`，把 `customer.dbf` 中指定代號的客戶 `COPY TO` 新檔 (依代號排序、CP950)，輸出檔的 `sel` 填 `"=>"`；回 `{ success, count }`。目的檔不可已存在。
- `POST /api/dbf/import_custbak`：2-3 客戶資料匯入。內容 `{ dbfPath, keys, sourceFile }`，以 customer 結構 `APPEND FROM` 來源檔 (依欄名對應)，指定代號存在就整筆覆蓋、不存在就新增，`customer.sel` 不覆蓋；回 `{ success, inserted, updated, failed: [{ key, reason }] }`，單筆被鎖定時記在 `failed`，其餘照常寫入。
  - 兩者都由固定 VFP 範本組成，呼叫端只能傳路徑與代號 (1–8 字元、不含 `|`)；代號清單寫入暫存檔再由 VFP `FILETOSTR` 讀入。路徑必須是絕對路徑、副檔名 `.dbf`、不含 `"`，且不可為 `customer.dbf` 本身。
  - 開檔失敗 (VFP 錯誤 3、108、109、130、1705) 回 `errorType: "LOCK_TIMEOUT"`。
- `GET /api/check-drive?drive=C` (別名 `/api/dbf/check_drive`)：檢查 `<Drive>:\W3000` 目錄是否存在 (前端設定磁碟機時的備用檢查)。

### 2. 原生 FastReport 報表 DLL 橋接 (`/report`, `/api/call`)
- 當請求帶 `jsonData` 時，自動於 `%TEMP%\Wx3000\` 產生 `report_data_<時間>.json` 暫存檔並將路徑傳給 `wbaseRP.dll` (`/api/call` 會取代 `args` 的最後一個參數)。
- 預覽 (`IsPrint=0`) 時，橋接程式穩定執行 600ms 後即先回應成功，預覽視窗由使用者自行關閉；`IsPrint=1` 直接送預設印表機，等橋接程式結束後回傳 `OK:<回傳值>`。
- `POST /report`：內容帶 `func`、`jsonData` 與 `hs_chk`、`top_mag`、`left_mag`、`PrtIndex`、`IsPrint` (預設 `0.125`、`0`、`0`、`0`、`0`)，組成 6 個參數呼叫 `wbaseRP` 的函數 (`wbase350_buyinv_list` 另帶 `rep_type`，共 7 個)。主檔清冊類函數只吃 JSON 資料，不帶 `jsonData` 或 `path` 會回傳錯誤。
- `POST /api/call`：內容 `{ dll, func, args, jsonData }`，依 `dlls.json` 呼叫任一已登記函數 (`GET /api/call?dll=&func=&args=<JSON>` 亦可)。3020 預購表 (`wbase320_buyinv`) 與 3050 統購清單 (`wbase350_buyinv_list`) 由前端經此端點呼叫。
- 相容路徑：`GET` / `POST /waccrep3101_b`、`/wbase320_buyinv`、`/wbase350_buyinv_list` (未帶 `func` 時以路徑名稱為函數名)，以及舊版 `GET /wbaseReport` (固定呼叫 `waccrep3101_b`)。
- 其他：`GET /mac` (本機網卡 MAC)、`GET /config`、`GET /dllList`、`GET /` (`test.html` 測試頁)。WebSocket 指令：`mac`、`dllList`、`setMode`、`call`、`wbaseReport`。

#### `dlls.json` 已登記的 `wbaseRP` 報表函數 (10 個)

| 函數 | 參數 | 用途 |
| :--- | :--- | :--- |
| `waccrep3101_b` | 6 | 1030 建檔人員清冊 |
| `wbase1050_taxno_list` | 6 | 1050 稅務人員清冊 |
| `wbase1060_recitem_list` | 6 | 1060 收費項目清冊 |
| `wbase1070_recnote_list` | 6 | 1070 收費備註名冊 |
| `wbase1080_feesummary_list` | 6 | 1080 收費摘要清冊 |
| `wbase3010_ticketplace_list` | 6 | 3010 發票購買地點清冊 |
| `wbase320_buyinv` | 6 | 3020 預購統一發票列印 |
| `wbase350_buyinv_list` | 7 (含 `rep_type`：`1` A4 發票清單、`2` 中一刀發票領取簽收單) | 3050 統購發票清單 |
| `wbase2040_receipt` | 6 | 2040 客戶收費收據 |
| `wbase2040_bill` | 6 | 2040 客戶請款單 |

6 參數為 `hs_chk, top_mag, left_mag, PrtIndex, IsPrint, path`。`dlls.json` 另有範例項目 `myOther.myFunc1`，對應的 DLL 不在專案內。

---

## 📦 啟動與打包指令

```powershell
# 1. 開發模式直接啟動 (監聽 127.0.0.1:5009 與 [::1]:5009)
node agent.js

# 2. 打包為獨立執行檔 Wx3000Agent.exe (Manager [8] 與 GitHub Actions 皆使用此腳本，自動輸出並同步至 ..\publish\localagent\dist\)
.\build.ps1 -Level 1

# 3. 進階混淆打包 (Wx3000Agent_L2.exe，等同 .\build.ps1 -Level 2)
.\build_level2.bat

# 4. 安裝為 Windows 服務 (需系統管理員權限，服務名稱: Wx3000Agent；報表預覽視窗不會出現在使用者桌面)
.\install_service.bat
```

- `build.ps1` 會複製各系統別子目錄 (如 `wbase\`) 的報表 DLL、`WbaseBridge.exe` (優先取 `bridge\lazarus\WbaseBridge.exe`)、`DBFBridge.exe`、`dlls.json`、`test.html`、`install_service.bat`、`w3000_dbf.dll` / `w3000_dbf.VBR` / `vfpencryption.fll` 與 VFP9 執行元件 (`vfp9r.dll`、`vfp9t.dll`、`vfp9rcht.dll`、`VFP9RENU.DLL`、`msvcr71.dll`、`msvcp71.dll`、`GdiPlus.dll`)；來源檔不存在時略過。
- 舊的 `build_level1.bat` 不會複製 VFP9 執行元件，請改用 `build.ps1`。
- 這些二進位檔都不在版控內，GitHub Actions 打包出的 LocalAgent 只含主程式與設定；報表 DLL 與 `WbaseBridge.exe` 由 `Wx3000-Manager.ps1` `[14]` 另外附在 Release 的 `Wx3000_ReportBin_<版本>.zip`。
- `agent_v*.js`、`test_v*.html`、`README_v1.md` 為歷史留存版本 (仍使用 Port 18889)，不再使用。
