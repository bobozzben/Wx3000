# Wx3000 Agent 開發與行為準則

> 本規則文件由 Antigravity 自動載入，用於指導 AI Agent 在 `Wx3000` 專案中的開發行為。

## 核心指令

1. **FoxPro 鍵盤盲打 UX 優先**
   - 100% 純鍵盤操作（`Enter`、`Tab`、`方向鍵`、`Ins`、`Del`、`F2`、`F3`、`F6`、`F7`、`F8`、`F9`、`F12`、`Esc`）。
   - 核心表格與卡片組件：
     - `<FoxProGridV2 />`：整頁多列行內盲打維護（直接打字覆蓋、最後一欄 `Enter` 自動換列/新增列、`F3` 觸發 `SearchModal` 開窗搜尋、`F7` 觸發報表列印、`Esc` 儲存/離開）。
     - `<FoxProGridCard />`：主檔清單瀏覽卡片（支援滾輪/方向鍵同步游標、搭配下方或右側即時聯動編輯表單如 `wbase1020`、`wbase2010`）。
     - `<FoxProGridBill />`：單據 Header + Detail 連續盲打表格。
   - 禁用傳統網頁 Dropdown 下拉選單搜尋，代號/條件查詢一律使用 `SearchModal` 開窗。
   - 高對比視覺樣式（Consolas 16px 等寬字型、`#1e3a8a` 深藍 Header、`#eab308` 2px 黃色焦點框、支援深色/淺藍色雙主題 `ThemeContext`）。

2. **混合雲地雙向資料同步架構 (DBF 絕對權威原則)**
   - 本系統支援 **PostgreSQL 16 (`localhost:54320`, DB: `w3000`, Schema: `c:/w3000/comm`)** 與地端 **Visual FoxPro `.dbf` (`C:\w3000\comm\*.dbf`)** 即時雙向同步。
   - 讀取前透過 `IDbfSyncService.EnsureTableSyncedAsync` 比對地端 DBF SHA256 Checksum，若有外部異動自動重灌快照；寫入（新增/修改/刪除）時優先透過 `LocalAgent` (`http://localhost:18889/api/dbf/*` ➔ `DBFBridge.exe` ➔ `w3000_dbf.dll`) 寫入地端 DBF，成功後才同步寫入 PostgreSQL 並更新 `dictionary.w3000_dbf` 校驗碼。

3. **本機報表與週邊整合 (LocalAgent + Lazarus FastReport)**
   - 傳統中一刀/A4 報表預覽與直印透過 `LocalAgent` (`http://localhost:18889`) 以 `WbaseBridge.exe` 或 `Koffi` 呼叫 Lazarus 編譯之 `wbaseRP.dll`（如 `waccrep3101_b`、`wbase320_buyinv`、`wbase350_buyinv_list`）。
   - Excel 動態欄位匯出統一使用共用組件 `<FormUtilSelectXlsxFieldsList />`。

4. **工程品質與嚴謹度**
   - 寫代碼前先閱讀源碼，禁止憑空猜測 API 簽名、元件 Props 或資料庫 Schema（注意 DBF 對應之小寫欄位名如 `no`, `name`, `yymm`, `_record_number`）。
   - 後端 C# DTO / Model / API 變更必須同步更新前端 Axios 服務 (`frontend/src/services/`) 與 Zustand store。
   - 表單驗證（如 Email 格式 `validation.ts`）若屬提示性質，應採非阻斷式（Non-blocking）友善警告徽章，不強制阻斷舊有不合規歷史資料之存檔。
   - 遇到 Error 必須閱讀完整 Log 與 Exception StackTrace，嚴禁遮蔽錯誤或回傳假資料。
   - 宣告完成前必須通過實機編譯驗證（`pnpm --filter frontend build` 與 `dotnet build backend/Wx3000.Backend.csproj`）。

詳細規格請參閱 [.agents/rules/foxpro_ux_and_quality.md](file:///f:/ADSProject/Wx3000/.agents/rules/foxpro_ux_and_quality.md)、[WORKSPACE.md](file:///f:/ADSProject/Wx3000/WORKSPACE.md)、[BUILD_AND_DEPLOY.md](file:///f:/ADSProject/Wx3000/BUILD_AND_DEPLOY.md) 與 [docs/SPEC.md](file:///f:/ADSProject/Wx3000/docs/SPEC.md)。
