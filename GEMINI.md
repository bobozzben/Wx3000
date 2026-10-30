# Wx3000 Agent 開發與行為準則

> 本規則文件由 Antigravity 自動載入，用於指導 AI Agent 在 `Wx3000` 專案中的開發行為。

## 核心指令

1. **FoxPro 鍵盤盲打 UX 優先**
   - 100% 純鍵盤操作（`Enter`、`Tab`、`方向鍵`、`Ins`、`Del`、`F2`、`F3`、`F4`、`F6`、`F7`、`F8`、`F9`、`F12`、`Esc`）。
   - 核心表格、卡片與輔助開窗組件：
     - `<FoxProGridV2 />`：整頁多列行內盲打維護（預設 `minRows=0` 對齊原生 FoxPro GRID 實際筆數、支援欄位拖曳寬度記憶 `gridId`、直接打字覆蓋、`uppercase`/`digitOnly`/`maxBytes` Big5 截斷、`validate` 即時檢核、`hasEllipsis` 儲存格內 `F2` 輔助開窗按鈕、最後一欄 `Enter` 自動換列/新增列、`F3` 觸發 `SearchModal`、`F7` 觸發列印、`Esc` 儲存/離開）。
     - `<FoxProGridCard />` + `useFoxProCardNavigation`：主檔清單瀏覽卡片與下方/右側即時聯動編輯表單母版（如 `wbase1020`、`wbase2010`），支援滾輪/方向鍵同步游標、`Enter`/`↓`/`↑` 跨欄或跨 Tab 導覽、聚焦自動全選打字覆蓋 (`foxProFocusAndSelect`)、自動跳過停用欄位。
     - `<FoxProGridBill />`：單據 Header + Detail 連續盲打表格。
     - `<FoxProPrintModal />`：全系統標準化 `F7` 區間列印預覽、純淨紙張直印 (`printUtil.ts`) 與 `<FormUtilSelectXlsxFieldsList />` Excel 動態欄位自訂匯出母版。
     - `<AddressSelectModal />`：台灣地址智慧快選視窗（對齊 `util_hi_addr_form.pas`，內建全台縣市/鄉鎮郵遞區號/路名資料庫、門牌樓層速選鈕與半形轉全形），於地址欄位按 `F2`/`F4` 或點擊按鈕觸發。
     - `<WbasePageHeader />`：統一模組頂部導覽與模式狀態列（`GRID 瀏覽模式 / EDIT 編修中 / ADD 新增中`）。
   - 禁用傳統網頁 Dropdown 下拉選單搜尋，代號/條件/地址查詢一律使用 `SearchModal` 或 `AddressSelectModal` 開窗。
   - 高對比視覺樣式（Consolas 16px 等寬字型、`#1e3a8a` 深藍 Header、`#eab308` 2px 黃色焦點框、支援深色/淺藍色雙主題 `ThemeContext`）。

2. **混合雲地雙向資料同步與動態磁碟機架構 (DBF 絕對權威原則)**
   - 系統透過 `ISystemConfigService` (`/api/systemconfig`) 與前端 `X-Data-Drive` Header 搭配 EF Core `DynamicModelCacheKeyFactory`，支援動態切換資料來源磁碟機（如 `C:` 或 `F:` 碟），自動對應地端 `<Drive>:\w3000\comm\*.dbf` 與 PostgreSQL 16 (`localhost:54320`, DB: `w3000`, Schema: `<drive>:/w3000/comm`)。
   - 讀取前透過 `IDbfSyncService.EnsureTableSyncedAsync` 比對地端 DBF SHA256 Checksum，若有外部異動自動重灌快照；寫入（新增/修改/刪除）時優先透過 `LocalAgent` (`http://localhost:18889/api/dbf/*` ➔ `DBFBridge.exe` ➔ `w3000_dbf.dll`) 寫入地端 DBF，成功後才同步寫入 PostgreSQL 並更新 `dictionary.w3000_dbf` 校驗碼。

3. **本機報表與週邊整合 (LocalAgent + Lazarus FastReport)**
   - 傳統中一刀/A4 報表預覽與直印透過 `LocalAgent` (`http://localhost:18889`) 以 **64-bit `WbaseBridge.exe`** 或 `Koffi` 呼叫 64-bit Lazarus 編譯之 `wbaseRP.dll`（如 `waccrep3101_b`、`wbase320_buyinv`、`wbase350_buyinv_list`）。
   - ⚠️ **位元架構防呆**：`DBFBridge.exe` 必須為 **32-bit (x86)**（橋接 32-bit VFP COM `w3000_dbf.dll`）；`WbaseBridge.exe` 必須為 **64-bit (x64)**（橋接 64-bit `wbaseRP.dll`），嚴禁混淆以避免 Windows `Code=193` 錯誤。

4. **工程品質、台灣稅務檢核與 Big5 相容性 (`validation.ts`)**
   - 寫代碼前先閱讀源碼，禁止憑空猜測 API 簽名、元件 Props 或資料庫 Schema（注意 DBF 對應之小寫欄位名如 `no`, `name`, `yymm`, `_record_number`）。
   - 統一使用 `frontend/src/services/validation.ts` 執行欄位檢核與加解密（台灣 8 碼統編、10 碼身分證/居留證、9 碼稅籍編號、12 碼房屋稅籍、民國年日期正規化、Big5 位元組長度截斷與罕字/Emoji 哨兵、`w3000` 位移式加解密 `psw`/`onepassno`）。提示性檢核（如 Email、統編/身分證警告）應採非阻斷式（Non-blocking）友善警告，不強制阻斷舊有歷史資料之存檔。
   - 宣告完成前必須通過實機編譯驗證（`pnpm --filter frontend build` 與 `dotnet build backend/Wx3000.Backend.csproj`）。

詳細規格請參閱 [.agents/rules/foxpro_ux_and_quality.md](file:///f:/ADSProject/Wx3000/.agents/rules/foxpro_ux_and_quality.md)、[WORKSPACE.md](file:///f:/ADSProject/Wx3000/WORKSPACE.md)、[BUILD_AND_DEPLOY.md](file:///f:/ADSProject/Wx3000/BUILD_AND_DEPLOY.md)、[SKILL.md](file:///f:/ADSProject/Wx3000/SKILL.md) 與 [docs/SPEC.md](file:///f:/ADSProject/Wx3000/docs/SPEC.md)。
