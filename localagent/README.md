# Wx3000 LocalAgent (本機 DBF 雙向同步與原生報表 DLL 橋接服務)

`localagent` 為運行於客戶端或伺服器本機的輕量級 Node.js 背景代理服務（預設監聽 `http://localhost:18889`，支援 HTTP 與 WebSocket），負責解決瀏覽器/現代後端無法直接操作地端 **32-bit Visual FoxPro COM (`w3000_dbf.dll`)** 與 **64-bit Lazarus FastReport 報表 (`wbaseRP.dll`)** 的跨架構橋接問題。

---

## 🏛️ 雙架構橋接核心設計 (Dual-Architecture Bridge)

因底層 DLL 之原生編譯架構不同，LocalAgent 內部依賴兩支不同架構的獨立 Lazarus/FPC 橋接執行檔：

| 橋接模組 | 執行檔 | 架構 (Bitness) | 呼叫目標 | 目的與原因 |
| :--- | :--- | :---: | :--- | :--- |
| **地端 DBF 橋接** | `DBFBridge.exe` | **32-bit (x86)** | `w3000_dbf.dll` (VFP COM) | VFP9 原生 COM 僅支援 32 位元，必須以 32-bit 進程載入進行 COM 呼叫、`RLOCK()` 鎖定檢測與校驗碼運算。 |
| **FastReport 報表橋接** | `WbaseBridge.exe` | **64-bit (x64)** | `wbaseRP.dll` (FastReport) | 現代 Lazarus 64-bit 編譯的高解析度報表庫，必須以 64-bit 進程透過 `LoadLibrary` 載入以供預覽與列印。 |

> ⚠️ **重要觀念**：
> Windows 系統禁止 32 位元進程直接載入 64 位元 DLL（反之亦然）。
> 若 `WbaseBridge.exe` 誤使用 32 位元編譯，呼叫報表時系統將拋出 **`ERROR: LoadLibrary ... Code=193 (ERROR_BAD_EXE_FORMAT)`**。

---

## 🏗️ 兩大核心職責與 API 端點

### 1. 地端 VFP DBF 資料庫橋接 (`/api/dbf/*` ➔ `DBFBridge.exe` ➔ `w3000_dbf.dll`)
- 內建單一執行緒 Promise 串列隊列 (`dbfQueue`)，確保高併發請求下不會發生 DBF 檔案鎖定衝突。
- 透過 Base64 編碼 JSON 參數呼叫 `DBFBridge.exe`（32-bit 原生橋接執行檔），支援：
  - `GET /api/dbf/ping`：檢測 DBFBridge 與 VFP COM 元件狀態。
  - `GET` / `POST /api/dbf/checksum`：高速計算地端 `.dbf` 檔案之 `SHA256:FileSize` 校驗碼。
  - `POST /api/dbf/call`：
    - `action: "SYNC_TABLE"`：將地端 DBF 完整同步重灌至 PostgreSQL。
    - `action: "WRITE_RECORD"`：依據 DBF 絕對權威原則執行 `INSERT` / `UPDATE` / `DELETE`，具備 `RLOCK()` 鎖定偵測（若遭其他工作站鎖定立即回報 `LOCK_TIMEOUT`）。
    - `action: "READ_RECORD"`：直接讀取地端 DBF 指定主鍵紀錄。

### 2. 原生 FastReport 報表 DLL 橋接 (`/report`, `/api/call` ➔ `WbaseBridge.exe` ➔ `wbaseRP.dll`)
- 支援 **`bridge` 模式**（預設，透過 `WbaseBridge.exe` 64-bit 獨立進程載入 DLL，預覽視窗穩定不阻塞 Node 主程序）與 **`koffi` 模式**（64-bit Node.js FFI 直接載入）。
- 當前端傳入 `jsonData` 時，自動於 `%TEMP%/Wx3000/` 產生暫存 JSON 檔並將路徑傳遞給 `wbaseRP.dll`。
- 常用端點：
  - `POST /report` / `POST /waccrep3101_b`：通用主檔清冊報表預覽與列印（如 `wbase1020`~`3010`）。
  - `POST /wbase320_buyinv`：發票預購表報表預覽與列印（`wbase3020_buyinv_print`）。
  - `POST /wbase350_buyinv_list`：統購發票清單列印（支援 `rep_type=1` A4 發票清單、`rep_type=2` 中一刀發票領取簽收單）。
  - `POST /api/call`：通用 DLL 函數呼叫介面（依 `dlls.json` 定義）。

---

## 🛠️ Bridge 原始碼手動編譯指南 (Free Pascal / Lazarus)

若修改了 `bridge/lazarus/` 下的源碼，請使用系統安裝之 Free Pascal Compiler (FPC) 編譯對應架構：

```powershell
# 1. 編譯 64-bit WbaseBridge.exe (用於報表)
fpc -Px86_64 -Twin64 -O3 -FE"bridge\lazarus" -o"WbaseBridge.exe" "bridge\lazarus\WbaseBridge_Generic.lpr"

# 2. 編譯 32-bit DBFBridge.exe (用於 VFP DBF COM)
fpc -Pi386 -Twin32 -O3 -FE"bridge\lazarus" -o"DBFBridge.exe" "bridge\lazarus\DBFBridge.lpr"

# 3. 將編譯完成的 WbaseBridge.exe 複製至 localagent 根目錄
Copy-Item "bridge\lazarus\WbaseBridge.exe" "WbaseBridge.exe" -Force
```

---

## 🔍 常見錯誤與排查 (Troubleshooting)

| 錯誤代碼 / 訊息 | 發生時機 | 根因與修復方式 |
| :--- | :--- | :--- |
| **`LoadLibrary ... Code=193`** | 按下 `F7.列印` 呼叫報表時 | **位元架構不相容**：執行的 `WbaseBridge.exe` 為 32 位元，無法載入 64 位元的 `wbaseRP.dll`。請使用 64-bit FPC 重新編譯 `WbaseBridge.exe`。 |
| **`LoadLibrary ... Code=126`** | 呼叫 DBFBridge 或報表時 | **缺少相依檔案**：目標 DLL 不存在或缺少運行庫（如缺少 32-bit VFP9 Runtime：`vfp9r.dll`、`vfp9t.dll`、`msvcr71.dll`）。 |
| **`GetProcAddress <func> 失敗`** | 呼叫報表時 | `wbaseRP.dll` 未導出該函數名稱，或拼字大小寫不符。 |
| **`LOCK_TIMEOUT`** | 寫入 DBF 時 | 地端 DBF 該筆紀錄正被其他舊版 FoxPro 程式或工作站鎖定中，待釋放後重試。 |

---

## 📦 啟動與打包指令

```powershell
# 1. 開發模式直接啟動 (預設監聽 http://localhost:18889)
node agent.js

# 2. 打包為獨立執行檔 (dist/Wx3000Agent.exe 並複製 DLL 與 64-bit WbaseBridge / 32-bit DBFBridge)
.\build_level1.bat

# 3. 進階混淆打包 (dist/Wx3000Agent_L2.exe)
.\build_level2.bat

# 4. 安裝為 Windows 服務 (需系統管理員權限，服務名稱: Wx3000Agent)
.\install_service.bat
```
