# Wx3000 客戶端安裝、自動更新與部署指南 (Installation & Auto-Update Guide)

> 本指南說明如何將打包完成的 `Wx3000\publish\` 目錄（透過隨身碟或從 **GitHub Releases** 下載）部署至客戶端的**區網主機 (Server)** 與**員工工作站 (Client)**，並設定**每日凌晨從 GitHub 自動熱更新**。

---

### 📋 一、部署來源與 `publish\` 目錄結構

您可以透過以下兩種方式取得部署包：
1. **雲端自動打包（推薦）**：從 GitHub Repository 首頁右側的 **Releases** 下載最新發佈的 `Wx3000_Server_vX.Y.Z.zip` 與 `Electron` 安裝檔（或於 GitHub Actions 下載 Artifacts）。
2. **開發機本機打包**：在開發機執行根目錄的 `Wx3000-Manager.bat` 選擇 **`[A] ★ 全部一鍵打包 (5~10 全套)`**（或單選 `[5]`~`[10]`），再將整個 **`Wx3000\publish`** 資料夾複製到隨身碟。

確認 `publish\` 目錄內包含以下結構：

```text
publish\
├── Install-Wx3000.bat             # ★ 雙擊啟動「安裝與部署精靈」 (自動取得系統管理員權限)
├── Install-Wx3000.ps1             # 安裝精靈主程式 (含選單 [U] 呼叫自動更新工具)
├── Update-Wx3000.bat              # ★ 雙擊啟動「GitHub 雲端自動熱更新與每日排程工具」
├── Update-Wx3000.ps1              # 自動更新主程式 (支援互動選單與 -Silent 背景排程模式)
├── Check-DbfSync.bat              # ★ 雙擊啟動「DBF 雙向同步 6 關卡單步驗證與除錯工具」
├── Check-DbfSync.ps1              # DBF 同步診斷主程式
├── README_客戶端安裝指南.md       # 本安裝與更新說明文件
├── Wx3000_Server\
│   └── api\                       # [後端 + 前端整合包] Wx3000.Backend.exe 與 wwwroot 前端靜態網頁
├── localagent\
│   └── dist\                      # [本機代理服務] Wx3000Agent.exe、wbaseRP.dll、DBFBridge.exe、w3000_dbf.dll 等
└── frontend\
    └── Electron\
        └── release\               # [桌面端程式] win-unpacked 免安裝版、Setup 安裝精靈與 Portable 單檔版
```

> 💡 **為什麼要用 `Install-Wx3000.bat` 安裝？**
> 切勿直接在隨身碟或下載暫存區註冊 Windows 服務！因為隨身碟拔除或清除下載資料夾後服務就會失效。
> `Install-Wx3000.ps1` 會自動將所需檔案複製到客戶電腦的本機硬碟（預設為 **`C:\Wx3000\`**），並自動完成服務註冊、防火牆設定、部署自動更新腳本與桌面捷徑建立（`w3000_dbf.dll` 搭配 `w3000_dbf.VBR` 為免註冊元件，直接複製即可運作）。

---

## 🖥️ 二、步驟 1：首次安裝區網【主機電腦 (Server)】

區網內會有 **1 台主要電腦（主機）** 負責存放 PostgreSQL 資料庫與原 FoxPro `C:\w3000\comm\*.dbf` 資料。

### 1. 前置確認
- 確認主機已安裝並啟動 **PostgreSQL 16**（預設 Port `54320` 或依 `appsettings.json` 設定）。
- 確認舊系統 DBF 目錄（如 `C:\w3000\comm\`）存在且可讀寫。

### 2. 執行一鍵安裝
1. 在主機電腦打開 `publish` 資料夾，滑鼠雙擊執行 **`Install-Wx3000.bat`**（若跳出 UAC 權限視窗請點選「**是**」）。
2. 在安裝選單輸入 **`1`** 並按 `Enter`：
   - **選擇 `[1] ★ 安裝【主機端 Server 全套】 (後端服務 + LocalAgent + Electron 桌面端)`**
3. 安裝程式會自動完成以下動作：
   - 複製後端與網頁至 `C:\Wx3000\Server\api\`。
   - 同步將 **`Update-Wx3000.bat` / `Update-Wx3000.ps1`** 複製至 `C:\Wx3000\`，供日後雲端熱更新或排程使用。
   - 註冊並啟動 **`Wx3000Api`** Windows 服務（設為開機自動啟動），並開放 Windows 防火牆 **TCP Port `5007`**。
   - 複製 LocalAgent（含免註冊元件 `w3000_dbf.dll` / `w3000_dbf.VBR` 與 `wbaseRP.dll`）至 `C:\Wx3000\LocalAgent\`，並設定開機背景啟動 **`Wx3000Agent.exe` (Port `18889`)**。
   - 複製桌面端至 `C:\Wx3000\Client\`，並在桌面建立 **【Wx3000 雲端會計進銷存】** 捷徑。
4. **抄下畫面顯示的「本機伺服器區網網址」**（例如：`http://192.168.1.100:5007`），待會員工電腦連線會用到！

---

## 💻 三、步驟 2：安裝區網【其他員工工作站 (Client)】

區網內其他會計/記帳人員的電腦，不需要安裝後端與資料庫，只需要安裝 **Electron 桌面端** 與 **LocalAgent 本機印表代理**（讓員工電腦可以彈出 Lazarus FastReport 報表預覽視窗與直印）。

### 1. 執行工作站一鍵安裝
1. 在員工電腦打開 `publish` 資料夾，滑鼠雙擊執行 **`Install-Wx3000.bat`**。
2. 在安裝選單輸入 **`2`** 並按 `Enter`：
   - **選擇 `[2] ★ 安裝【區網員工工作站】 (LocalAgent 本機印表代理 + Electron 桌面端)`**
3. 安裝程式會自動將檔案複製到員工電腦的 `C:\Wx3000\LocalAgent` 與 `C:\Wx3000\Client`，並建立桌面捷徑。

### 2. 設定連線至主機 IP（首次開啟設定一次即可）
1. 雙擊員工電腦桌面的 **【Wx3000 雲端會計進銷存】** 捷徑開啟程式。
2. 在鍵盤按下快捷鍵 **`Ctrl + Shift + S`**（或點選左上角選單「**系統 (S)**」➔「**伺服器連線設定 (C)**」）。
3. 輸入剛剛在主機抄下的區網網址（例如：`http://192.168.1.100:5007`）並儲存，畫面即會自動重新載入並連上主機！

> 🌐 **重要架構優勢（員工工作站免逐台更新）**：
> 因為前端網頁 (`wwwroot`) 是由主機端的 `Wx3000Api` (`Port 5007`) 統一提供，日後當**主機端完成更新**後，區網內所有員工電腦只要重新開啟或按 `Ctrl + R` 重新整理，**全體員工就會立即同步使用最新畫面與功能**，無須逐台更新員工電腦！

---

## ☁️ 四、步驟 3：啟用【GitHub 雲端自動熱更新與每日排程】（免人工到場維護）

為了避免每次程式更新都要人工帶隨身碟或遠端連線去客戶主機下載覆蓋，主機安裝完成後可立即啟用 **GitHub Releases 自動更新機制**。

### 1. 如何啟動自動更新工具？
- **方式 A**：直接雙擊執行 `C:\Wx3000\Update-Wx3000.bat`（或 `publish\Update-Wx3000.bat`）。
- **方式 B**：在 `Install-Wx3000.bat` 主選單輸入 **`U`** 並按 `Enter`。

### 2. 自動更新選單功能說明
- **`[1] ★ 立即連線 GitHub 檢查並自動熱更新`**：
  - 自動向 GitHub Releases (`bobozzben/Wx3000`) 查詢最新版本標籤（如 `v1.0.2`），並與本機 `C:\Wx3000\version.txt` 比對。
  - 若發現新版本，自動下載 `Wx3000_Server_v*.zip` ➔ 自動備份舊版至 `C:\Wx3000\Backup\`（保留最近 3 份）➔ 停止 `Wx3000Api` 服務 ➔ 覆蓋新檔（自動保護保留本機 `appsettings.Production.json`）➔ 重啟服務並驗證狀態。
  - **防呆自動回滾（Auto-Rollback）**：若更新後服務啟動異常，會自動從 `Backup` 還原舊版並重啟服務，確保系統不中斷。
- **`[2] 強制重新下載並覆蓋安裝最新 Release 版本`**：忽略版號比對，強制重抓最新 Release 覆蓋安裝。
- **`[3] ★ 啟用/設定【Windows 每日凌晨自動更新排程】`**：
  - 一鍵在 Windows 工作排程器註冊 `Wx3000_DailyAutoUpdate`（以 `SYSTEM` 最高權限於每天凌晨預設 `03:00` 背景執行 `Update-Wx3000.ps1 -Silent`）。
  - 設定完成後，開發團隊只需在 GitHub 推送新版本 Tag（如 `git tag v1.0.3 && git push origin v1.0.3`），客戶主機即會在半夜自動完成升級！
- **`[4] 停用/移除【Windows 每日自動更新排程】`**：隨時取消自動排程。
- **`[5] 檢視本機更新歷史紀錄`**：查看 `C:\Wx3000\update.log` 歷次自動更新與版號升級紀錄。
- **`[6] 設定 GitHub 倉庫名稱或私有倉庫 Token`**：若未來倉庫改為 Private，可在此填入唯讀 Token（儲存於 `C:\Wx3000\updater.config.json`）。

---

## 🔄 五、手動單獨更新特定模組 (`Install-Wx3000.bat`)

若使用隨身碟或手動解壓縮更新包，執行 `Install-Wx3000.bat` 亦可選擇單獨更新特定元件：

- **選單 `[3]`**：只更新主機的後端 API 與網頁（會自動先停 `Wx3000Api` 服務、覆蓋檔案後再重啟服務）。
- **選單 `[4]`**：只快速熱更新主機的前端網頁檔 `wwwroot`（不重啟後端服務）。
- **選單 `[5]`**：只更新本機的 `LocalAgent` 報表 DLL 與橋接程式。
- **選單 `[6]`**：只更新本機的 `Electron 桌面端`。
- **選單 `[8]`**：隨時查看本機服務是否正常運行，以及查詢本機的區網 IP。

---

## 🔍 六、新電腦 DBF 同步單步驗證與除錯 (`Check-DbfSync.bat`)

當首次將系統安裝至一台乾淨的主機電腦，若發現 `C:\W3000\COMM\` 下的 `.dbf` 資料未同步至 PostgreSQL (`localhost:54320`, DB: `w3000`, Schema: `c:/w3000/comm`)，請直接雙擊執行 **`publish\Check-DbfSync.bat`**：

- **輸入 `[A]` 一鍵執行全流程 6 大關卡診斷**（或輸入 `[1]`~`[6]` 單步排查）：
  1. **Step 1**：檢查 `C:\W3000\COMM\*.dbf`、`w3000_dbf.dll` / `.VBR` 及 **32-bit VFP9 Runtime (`vfp9r.dll`、`msvcr71.dll`)** 是否齊全。
  2. **Step 2**：略過網路層，直接測試 `DBFBridge.exe` 免註冊載入 `w3000_dbf.dll` 計算 SHA256 Checksum。
  3. **Step 3**：檢查 `LocalAgent` (`Port 18889`) HTTP 通訊與 `/api/dbf/checksum`。
  4. **Step 4**：測試生成 PostgreSQL 建表 (`STRUCT`) 與資料 (`DATA`) SQL 腳本。
  5. **Step 5**：檢查 PostgreSQL (`Port 54320`) `w3000` 資料庫與 `dictionary.w3000_dbf` 校驗碼表。
  6. **Step 6**：實際呼叫後端 API (`GET /api/wbase1050`、`GET /api/wbase1020`) 驗證端到端同步結果。

---

## 🛠️ 七、常見問題排除 (Troubleshooting)

1. **員工電腦連不上主機 (`http://主機IP:5007`)？**
   - 在主機執行 `Install-Wx3000.bat` ➔ 選擇 **`[8]`** 確認 `Wx3000Api` 狀態為 `運行中 (Port 5007)`，並確認主機 IP 是否正確。
   - 若主機有安裝第三方防毒軟體（如趨勢、卡巴斯基、ESET），請確認防毒軟體防火牆允許 TCP Port `5007` 連入。
2. **按下 `F7` 列印報表時沒有跳出預覽視窗？**
   - 報表預覽是由操作者電腦本機的 `LocalAgent` (`localhost:18889`) 呼叫 `wbaseRP.dll` 產生。
   - 請確認該台電腦已執行過安裝選單的 `[2]` 或 `[5]`，且 `Wx3000Agent` 顯示為 `運行中`。
3. **後端需要修改資料庫密碼或連線 Port？**
   - 主機安裝完成後，建議將自訂連線設定寫入 `C:\Wx3000\Server\api\appsettings.Production.json`（或修改 `appsettings.json`）。日後透過 `Update-Wx3000.bat` 自動更新時，`appsettings.Production.json` 會被自動保護保留、不會被新版本覆蓋。
