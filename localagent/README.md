# Wx3000 LocalAgent (本機 DBF 雙向同步與原生報表 DLL 橋接服務)

`localagent` 為運行於客戶端或伺服器本機的輕量級 Node.js 背景代理服務（預設監聽 `http://localhost:18889`，支援 HTTP 與 WebSocket，Windows 服務名稱：`Wx3000Agent`），負責解決瀏覽器/現代後端無法直接操作地端 **32-bit Visual FoxPro COM (`w3000_dbf.dll`)** 與 **64-bit Lazarus FastReport 報表 (`wbaseRP.dll`)** 的跨架構橋接問題。

---

## 🏗️ 兩大核心職責與位元架構防呆

| 橋接執行檔 | 目標位元架構 | 呼叫目標 DLL | 職責說明 |
| :--- | :---: | :--- | :--- |
| **`DBFBridge.exe`** | **32-bit (`i386-win32`)** | `w3000_dbf.dll` (32-bit VFP COM) | 執行 DBF `SHA256:FileSize` Checksum、全表同步至 PostgreSQL (`SYNC_TABLE`)、`RLOCK` 鎖定檢測與單筆權威寫入 (`WRITE_RECORD`) |
| **`WbaseBridge.exe`** | **64-bit (`x86_64-win64`)** | `wbaseRP.dll` (64-bit FastReport) | 啟動獨立 GUI 進程載入 FastReport 報表 DLL，開啟原生預覽視窗或直接驅動印表機 |

> ⚠️ **重要防呆**：`DBFBridge.exe` 必須為 **32-bit**，`WbaseBridge.exe` 必須為 **64-bit**。切勿將兩者混淆，否則載入 DLL 時將觸發 Windows `ERROR_BAD_EXE_FORMAT (Code=193)`。

---

## 🔌 主要 API 端點

### 1. 地端 VFP DBF 資料庫橋接 (`/api/dbf/*`)
- 內建單一執行緒 Promise 串列隊列 (`dbfQueue`)，確保高併發請求下不會發生 DBF 檔案鎖定衝突。
- `GET /api/dbf/ping`：檢測 `DBFBridge.exe` 與 VFP COM 元件狀態。
- `GET` / `POST /api/dbf/checksum`：高速計算地端 `.dbf` 檔案之 `SHA256:FileSize` 校驗碼。
- `POST /api/dbf/call`：執行 `SYNC_TABLE`、`WRITE_RECORD`（含 `HEX_FIELDS` 二進位密碼欄位支援）、`READ_RECORD`。

### 2. 原生 FastReport 報表 DLL 橋接 (`/report`, `/api/call`)
- 當前端傳入 `jsonData` 時，自動於 `%TEMP%/Wx3000/` 產生暫存 JSON 檔並將路徑傳遞給 `wbaseRP.dll`。
- `POST /report` / `POST /waccrep3101_b`：通用主檔清冊報表預覽與列印（如 `wbase1020`~`3010`）。
- `POST /wbase320_buyinv`：發票預購表報表預覽與列印（`wbase3020_buyinv_print`）。
- `POST /wbase350_buyinv_list`：統購發票清單列印（支援 `rep_type=1` A4 發票清單、`rep_type=2` 中一刀發票領取簽收單）。

---

## 📦 啟動與打包指令

```powershell
# 1. 開發模式直接啟動 (預設監聽 http://localhost:18889)
node agent.js

# 2. 打包為獨立執行檔 (自動輸出並同步至 ..\publish\localagent\dist\)
.\build_level1.bat

# 3. 進階混淆打包 (Wx3000Agent_L2.exe)
.\build_level2.bat

# 4. 安裝為 Windows 服務 (需系統管理員權限，服務名稱: Wx3000Agent)
.\install_service.bat
```
