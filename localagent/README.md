# Wx3000 LocalAgent (本機 DBF 雙向同步與原生報表 DLL 橋接服務)

`localagent` 為運行於客戶端或伺服器本機的輕量級 Node.js 背景代理服務（預設監聽 `http://localhost:18889`，支援 HTTP 與 WebSocket），負責解決瀏覽器/現代後端無法直接操作地端 **32-bit Visual FoxPro COM (`w3000_dbf.dll`)** 與 **64-bit Lazarus FastReport 報表 (`wbaseRP.dll`)** 的跨架構橋接問題。

---

## 🏗️ 兩大核心職責

### 1. 地端 VFP DBF 資料庫橋接 (`/api/dbf/*` ➔ `DBFBridge.exe` ➔ `w3000_dbf.dll`)
- 內建單一執行緒 Promise 串列隊列 (`dbfQueue`)，確保高併發請求下不會發生 DBF 檔案鎖定衝突。
- 透過 Base64 編碼 JSON 參數呼叫 `DBFBridge.exe`（Lazarus 32-bit 橋接執行檔），支援：
  - `GET /api/dbf/ping`：檢測 DBFBridge 與 VFP COM 元件狀態。
  - `GET` / `POST /api/dbf/checksum`：高速計算地端 `.dbf` 檔案之 `SHA256:FileSize` 校驗碼。
  - `POST /api/dbf/call`：
    - `action: "SYNC_TABLE"`：將地端 DBF 完整同步重灌至 PostgreSQL。
    - `action: "WRITE_RECORD"`：依據 DBF 絕對權威原則執行 `INSERT` / `UPDATE` / `DELETE`，具備 `RLOCK()` 鎖定偵測（若遭其他工作站鎖定立即回報 `LOCK_TIMEOUT`）。
    - `action: "READ_RECORD"`：直接讀取地端 DBF 指定主鍵紀錄。

### 2. 原生 FastReport 報表 DLL 橋接 (`/report`, `/api/call` ➔ `WbaseBridge.exe` / `Koffi` ➔ `wbaseRP.dll`)
- 支援 **`bridge` 模式**（預設，透過 `WbaseBridge.exe` 獨立進程載入 DLL，預覽視窗穩定不阻塞 Node 主程序）與 **`koffi` 模式**（FFI 直接載入）。
- 當前端傳入 `jsonData` 時，自動於 `%TEMP%/Wx3000/` 產生暫存 JSON 檔並將路徑傳遞給 `wbaseRP.dll`。
- 常用端點：
  - `POST /report` / `POST /waccrep3101_b`：通用主檔清冊報表預覽與列印（如 `wbase1020`~`3010`）。
  - `POST /wbase320_buyinv`：發票預購表報表預覽與列印（`wbase3020_buyinv_print`）。
  - `POST /wbase350_buyinv_list`：統購發票清單列印（支援 `rep_type=1` A4 發票清單、`rep_type=2` 中一刀發票領取簽收單）。
  - `POST /api/call`：通用 DLL 函數呼叫介面（依 `dlls.json` 定義）。

---

## 📦 啟動與打包指令

```powershell
# 1. 開發模式直接啟動 (預設監聽 http://localhost:18889)
node agent.js

# 2. 打包為獨立執行檔 (dist/Wx3000Agent.exe 並複製 DLL 與 Bridge)
.\build_level1.bat

# 3. 進階混淆打包 (dist/Wx3000Agent_L2.exe)
.\build_level2.bat

# 4. 安裝為 Windows 服務 (需系統管理員權限，服務名稱: Wx3000Agent)
.\install_service.bat
```
