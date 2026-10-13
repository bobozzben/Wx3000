# Wx3000 ERP 伺服器端 Windows Service 部署與維護指南

本目錄為 Wx3000 ERP 專用後端伺服器發佈封裝包，包含免安裝 .NET 8 Runtime 的獨立 C# Web API、**已整合的前端 Web 靜態網站 (SPA 託管)**、PostgreSQL 資料庫管理工具與自動化 Windows Service 註冊腳本。

---

## 🌟 核心特色：Web 瀏覽器與 Electron 桌面端雙軌並行

- **單一伺服器連接埠 (Port 5007)**：
  - 🌐 **Web 網頁版**：區網內任何電腦或平板，開啟瀏覽器輸入 `http://<伺服器IP>:5007` 即可直接進入 ERP 系統，免裝任何軟體！
  - 🖥️ **Electron 桌面端**：安裝桌面客戶端後，按 `Ctrl + Shift + S` 輸入同一個伺服器網址，享受無網址列干擾的 FoxPro 盲打高效率體驗！
  - 🔄 **資料即時同步**：兩者皆直接連線伺服器 PostgreSQL `a3000` 資料庫，資料無縫同步！

---

## 一、目錄結構說明

```
Wx3000_Server/
│
├── 1-安裝後端服務.bat (Install-Service.bat)          --> [主要] 一鍵以系統管理員身分安裝 Windows 服務並開通防火牆
├── 2-啟動後端服務.bat (Start-Services.bat)           --> 啟動 API 與 PostgreSQL 服務
├── 3-停止後端服務.bat (Stop-Services.bat)            --> 停止 API 服務
├── 4-解除安裝服務.bat (Uninstall-Service.bat)        --> 移除 Windows 服務註冊與防火牆規則
├── 5-檢查伺服器狀態與區網IP.bat (Check-Status.bat)  --> 檢測 API 健康度，顯示各工作站電腦應連線的伺服器 IP
│
├── api/                                             --> C# Web API 獨立執行檔 (免安裝 .NET Runtime)
│   ├── Wx3000.Backend.exe                           --> 主程式 (已內建 Windows Service 託管)
│   ├── appsettings.json                             --> 設定檔 (連接埠 5007、PostgreSQL 連線字串)
│   └── wwwroot/                                     --> [Web SPA] 前端打包網站檔案 (index.html, assets/)
│
└── database/                                        --> PostgreSQL 資料庫管理工具
    ├── a3000_current_backup.sql                     --> 目前系統完整資料庫 SQL 備份 (87.5MB)
    ├── Backup-Database.bat                          --> 一鍵即時備份資料庫 (儲存至 backups/)
    ├── Restore-Database.bat                         --> 一鍵還原備份至資料庫
    └── Register-Postgres-Service.bat                --> 將免安裝 PostgreSQL 註冊為開機常駐服務
```

---

## 二、部署情境

### 情境 A：將本機直接作為伺服器常駐運行 (最快)
若本機已安裝 PostgreSQL，且希望以後開機後自動背景運行，讓區網內其他電腦連入：
1. 進入 `publish\Wx3000_Server` 目錄。
2. 雙擊執行 `1-安裝後端服務.bat` *(程式會自動請求系統管理員權限)*。
3. 腳本會自動完成：
   - 註冊 `Wx3000Api` Windows 常駐服務（開機自啟動、當機自動重啟）。
   - 設定 Windows 防火牆開放連接埠 `5007`。
   - 啟動後端服務，並在視窗中顯示伺服器的區網 IP（例如 `http://192.168.5.51:5007`）。
4. 執行 `5-檢查伺服器狀態與區網IP.bat` 驗證 `API 健康狀態: 正常 (Healthy)`。

---

### 情境 B：遷移至獨立區網伺服器電腦 (全新伺服器)
若要將整個 ERP 後端與資料庫移到專用的 Windows 伺服器主機：
1. **備份現有資料**：在本機執行 `database\Backup-Database.bat` 產生最新的資料庫備份。
2. **複製檔案**：將整包 `Wx3000_Server` 目錄以及資料庫（例如 `C:\A3000PG` 或安裝標準版 PostgreSQL 16）複製到目標伺服器。
3. **在新伺服器安裝資料庫**：確保 PostgreSQL 16 正常運行，並執行 `database\Restore-Database.bat` 還原資料。
4. **安裝後端服務**：在新伺服器雙擊 `1-安裝後端服務.bat` 註冊服務並開通防火牆。
5. **確認連線**：執行 `5-檢查伺服器狀態與區網IP.bat` 記下新伺服器的 IP 位址。

---

## 三、區網工作站使用指南

在伺服器安裝並啟動後，假設伺服器區網 IP 為 `192.168.5.51`：

### 🌐 1. Web 網頁瀏覽器使用者 (Chrome / Edge / Safari)
- 任何工作站電腦或平板，直接在瀏覽器網址列輸入：
  ```
  http://192.168.5.51:5007
  ```
- 系統會直接載入完整的 Wx3000 ERP 操作介面，並自動綁定該伺服器 API，**零設定、一開即用**！

### 🖥️ 2. Electron 桌面客戶端使用者
- 在工作站電腦安裝並開啟 **Wx3000 桌面版**。
- 按下鍵盤熱鍵 **`Ctrl + Shift + S`**。
- 輸入伺服器網址：`http://192.168.5.51:5007` 並點擊「測試並儲存」。
- 連線成功後即可開始打單，享受獨立視窗與鍵盤盲打流暢度！

---

## 四、進階服務管理指令 (PowerShell / CMD)

| 操作 | 指令 |
| :--- | :--- |
| 查詢服務狀態 | `sc query Wx3000Api` |
| 啟動服務 | `net start Wx3000Api` |
| 停止服務 | `net stop Wx3000Api` |
| 重新啟動 | `net stop Wx3000Api && net start Wx3000Api` |
| 檢視 Windows 事件日誌 | 在 Windows「事件檢視器」->「應用程式」篩選來源 `Wx3000Api` |
