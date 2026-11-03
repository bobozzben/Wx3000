# Wx3000 LocalAgent (本機 DBF 雙向同步與原生報表 DLL 橋接服務)

`localagent` 為運行於客戶端或伺服器本機的輕量級 Node.js 背景代理服務（預設監聽 `http://localhost:5009`，支援 HTTP 與 WebSocket，Windows 服務名稱：`Wx3000Agent`），負責解決瀏覽器/現代後端無法直接操作地端 **32-bit Visual FoxPro COM (`w3000_dbf.dll`)** 與 **64-bit Lazarus FastReport 報表 (`wbaseRP.dll`)** 的跨架構橋接問題。

---

## 🏗️ 兩大核心職責與位元架構防呆

| 橋接執行檔 | 目標位元架構 | 呼叫目標 DLL | 職責說明 |
| :--- | :---: | :--- | :--- |
| **`DBFBridge.exe`** | **32-bit (`i386-win32`)** | `w3000_dbf.dll` (32-bit VFP COM) | 執行 DBF `SHA256:FileSize` Checksum、全表同步至 PostgreSQL (`SYNC_TABLE`)、`RLOCK` 鎖定檢測與單筆權威寫入 (`WRITE_RECORD`) |
| **`WbaseBridge.exe`** | **64-bit (`x86_64-win64`)** | `wbaseRP.dll` (64-bit FastReport) | 啟動獨立 GUI 進程載入 FastReport 報表 DLL，開啟原生預覽視窗或直接驅動印表機 |

> ⚠️ **重要防呆**：`DBFBridge.exe` 必須為 **32-bit**，`WbaseBridge.exe` 必須為 **64-bit**。切勿將兩者混淆，否則載入 DLL 時將觸發 Windows `ERROR_BAD_EXE_FORMAT (Code=193)`。

---

## 🔒 存取限制

- **只監聽本機** (`127.0.0.1` 與 `::1`)，不需也不應開放防火牆。後端 `LocalAgent:Url` 必須指向同一台機器。
- **`/api/dbf/*` 不開放瀏覽器**：只有本機後端與診斷腳本可呼叫，帶 `Origin` 或 `Sec-Fetch-Site` 的請求一律回 403。
- **報表端點的瀏覽器來源**：放行 localhost、內網 IP (10/8、172.16/12、192.168/16) 與單段主機名 (如 `SERVER01`)。其他網域 (ngrok、企業內網 FQDN) 請設定環境變數 `WX3000_AGENT_ALLOWED_ORIGINS`，多筆以逗號分隔，例如 `https://erp.example.com`。
- **DLL 白名單**：`/api/call`、`/report` 與 WebSocket 只能呼叫 `dlls.json` 登記的 DLL 與函數，新增報表函數時必須同步登記。
- **Electron 限制**：目前 `file://` 頁面 (`webSecurity: false`) 的請求不帶 `Origin`，因此無 `Origin` 的跨站 POST 會放行。若日後開啟 `webSecurity`，請將實際 Origin 加入放行規則。

修改後請執行 `npm test` (`localagent/agent.test.js`)。

## 🔌 主要 API 端點

### 1. 地端 VFP DBF 資料庫橋接 (`/api/dbf/*`)
- 內建單一執行緒 Promise 串列隊列 (`dbfQueue`)，確保高併發請求下不會發生 DBF 檔案鎖定衝突。
- `GET /api/dbf/ping`：檢測 `DBFBridge.exe` 與 VFP COM 元件狀態。
- `GET` / `POST /api/dbf/checksum`：高速計算地端 `.dbf` 檔案之 `SHA256:FileSize` 校驗碼。
- `POST /api/dbf/get_pg_script`：產生 DBF 轉 PostgreSQL 的結構 (`STRUCT`) 或資料 (`DATA`) 腳本。
- `POST /api/dbf/write`：新增、修改、刪除 DBF 記錄（別名、欄位名與鍵值運算式會先經過識別字檢查）。
  - 欄位值只接受字串、數字、布林、`null` 與日期值；日期 (D) 欄位傳 `{ "$date": "yyyy-MM-dd" }`，會轉成 VFP `{^yyyy-MM-dd}`，`""` 或 `null` 代表空日期。一般字串一律當字元值。
  - DBF 被其他工作站獨佔或鎖定 (VFP 錯誤 3、108、109、130、1705) 時回 `errorType: "LOCK_TIMEOUT"`，後端據此回 409。
- `POST /api/dbf/read`：讀取單筆 DBF 記錄。

### 2. 原生 FastReport 報表 DLL 橋接 (`/report`, `/api/call`)
- 當前端傳入 `jsonData` 時，自動於 `%TEMP%/Wx3000/` 產生暫存 JSON 檔並將路徑傳遞給 `wbaseRP.dll`。
- `POST /report`：內容帶 `func` 與 `jsonData` 呼叫主檔清冊，`IsPrint=0` 預覽、`IsPrint=1` 直接送預設印表機。`waccrep3101_b` (1030 建檔人員)、`wbase1050_taxno_list`、`wbase1060_recitem_list`、`wbase1070_recnote_list`、`wbase1080_feesummary_list`、`wbase3010_ticketplace_list`。這些函數只吃 JSON 資料，不帶 `jsonData` 或 `path` 會回傳錯誤。
- `POST /wbase320_buyinv`：發票預購表報表預覽與列印（`wbase3020_buyinv_print`）。
- `POST /wbase350_buyinv_list`：統購發票清單列印（支援 `rep_type=1` A4 發票清單、`rep_type=2` 中一刀發票領取簽收單）。

---

## 📦 啟動與打包指令

```powershell
# 1. 開發模式直接啟動 (預設監聽 http://localhost:5009)
node agent.js

# 2. 打包為獨立執行檔 (自動輸出並同步至 ..\publish\localagent\dist\)
.\build_level1.bat

# 3. 進階混淆打包 (Wx3000Agent_L2.exe)
.\build_level2.bat

# 4. 安裝為 Windows 服務 (需系統管理員權限，服務名稱: Wx3000Agent)
.\install_service.bat
```
