# Wx3000 工作區開發規範與品質防呆規則

本工作區規則檔旨在強制要求 Agent 在開發與維護 `Wx3000` 專案時，遵循 FoxPro 100% 全鍵盤盲打 UX 規範、混合雲地 DBF 雙向同步原則、工程程式碼品質與 API 契約一致性。

---

## 1. FoxPro 鍵盤盲打與 UI 組件規範

在建立或修改前端 Grid 與表單 UI 時（如 `frontend/src/components/FoxProGrid*`、`frontend/src/wbase/`、`frontend/src/wtaxop/`）：

1. **100% 鍵盤驅動（完全無需使用滑鼠）**
   - 所有儲存格移動、自動新增列、開窗搜尋、列印與存檔，必須 100% 可透過鍵盤快捷鍵完成。
   - **三大核心容器組件**：
     - **`FoxProGridV2` (`frontend/src/components/FoxProGrid/FoxProGridV2.tsx`)**：適用於整頁多列行內盲打維護（如 `wbase1030`, `1050`, `1060`, `1070`, `1080`, `3010`, `3020_02`, `3060_02`）。支援 `Enter`/`Tab` 右移、列末換行、底端自動 Append 空白列並觸發 `onSaveRow`、`F3` 開窗搜尋、`F7` 報表列印、`Ins` 新增、`Del` 刪除、`Esc` 儲存/離開。
     - **`FoxProGridCard` (`frontend/src/components/FoxProGridCard/FoxProGridCard.tsx`)**：適用於主檔上方/左側清單瀏覽搭配下方/右側詳細表單即時聯動（如 `wbase1020`, `wbase2010`）。內建防抖滾動同步游標 (`enableScrollSync`)、`↑`/`↓`/`PageUp`/`PageDown` 換筆、`Ins` 新增、`F6`/`Enter` 編修、`Del` 刪除、`F2` 查詢、`F7` 列印。
     - **`FoxProGridBill` (`frontend/src/components/FoxProGridBill/FoxProGridBill.tsx`)**：適用於進銷存單據 Header + Detail 連續登打作業。
   - **直接打字覆蓋 (Direct Keypress Overwrite)**：無須先按 F2，直接鍵入字元即可即時覆蓋當前儲存格內容；表單輸入框聚焦時自動選取全文以便直接覆蓋。

2. **視覺與樣式規範**
   - 字型與欄高：字型 `Consolas, Monaco, monospace`，字級 `16px`，預設列高 `38px`。
   - 表格 Header：深藍背景 `#1e3a8a`，文字純白 `#ffffff`，粗體高對比（並支援 `ThemeContext` 深色/淺藍色雙主題切換）。
   - 焦點外框 (Focus Ring)：選中儲存格或表單欄位必須顯示顯眼黃色外框（`#eab308` / `ring-yellow-400`）與淺黃底色提示，讓操作員雙眼秒抓焦點。
   - 欄位驗證提示：對於歷史資料常見之非關鍵格式（如 Email 格式 `isValidEmail`），採用非阻斷式（Non-blocking）琥珀色提示徽章（`⚠️ 格式`），允許使用者正常存檔而不強制卡死流程。

3. **嚴格禁止行為 (Strict DO NOT Rules)**
   - ❌ 禁止依賴滑鼠點擊才能完成增列、換欄、切換頁籤或存檔。
   - ❌ 禁止 Dropdown 下拉選單搜尋：代號與名稱搜尋必須使用 `F2` / `F3` 觸發的大型彈窗 `SearchModal`。

---

## 2. 混合雲地 DBF 雙向同步與後端開發規範

1. **DBF 絕對權威原則 (`IDbfSyncService` / `DbfSyncService`)**
   - `wbase` 模組對應地端 `C:\w3000\comm\*.dbf` 與 PostgreSQL `w3000` 資料庫之 `c:/w3000/comm` Schema（資料表如 `cpa`, `keyin`, `taxno`, `recitem`, `recmemo`, `recnote`, `customer`, `place`, `buyinv`）。
   - **讀取 (`GET`)**：先呼叫 `_dbfSyncService.EnsureTableSyncedAsync(...)`，比對地端 DBF 的 SHA256 Checksum 與 PostgreSQL `dictionary.w3000_dbf` 紀錄；若不一致自動重灌快照，若一致則直接讀取 PostgreSQL（Fast-path ~2ms）。
   - **寫入 (`POST` / `PUT` / `DELETE`)**：必須先呼叫 `_dbfSyncService.WriteRecordAsync(...)` 透過 `LocalAgent` (`http://localhost:18889/api/dbf/*` ➔ `DBFBridge.exe`) 寫入地端 DBF。若 DBF 回傳鎖定衝突 (`LOCK_TIMEOUT` / HTTP `409 Conflict`) 或失敗，**嚴禁單邊寫入 PostgreSQL**；寫入 DBF 成功後，再寫入 PostgreSQL 並更新 Checksum。

2. **碼源探查優先 (禁止憑空猜測)**
   - 修改程式碼或撰寫新邏輯前，必須先檢視現有型別定義、DTO、資料庫模型 (`backend/Models/`) 與 API 簽名。

3. **API 與靜態型別契約維護**
   - 修改後端 C# DTO 或 API 控制器 (`backend/DTOs/`、`backend/Controllers/`) 時，必須同步全域搜尋並更新前端 Axios 服務 (`frontend/src/services/`) 與 Zustand Store。

4. **完整錯誤日誌診斷**
   - 出現錯誤時，必須閱讀完整 Log 及 Exception StackTrace，嚴禁採用遮蔽 Error、吞掉 Exception 或回傳預設假資料的作法。

5. **實機與編譯驗證 (Empirical Verification)**
   - 完成程式碼修改後，必須執行編譯驗證：
     - 前端：`pnpm --filter frontend build`
     - 後端：`dotnet build backend/Wx3000.Backend.csproj`
   - 未通過編譯與型別檢查前，不得宣佈任務完成。

6. **本機代理雙位元架構防呆 (Dual-Bitness Bridge Rule)**
   - `DBFBridge.exe` 必須為 **32-bit (x86)**：專職載入地端 32 位元 Visual FoxPro COM (`w3000_dbf.dll`)。
   - `WbaseBridge.exe` 必須為 **64-bit (x64)**：專職載入 64 位元 Lazarus FastReport 原生報表庫 (`wbaseRP.dll`)。
   - 嚴禁位元架構交叉混淆；若報表出現 `LoadLibrary ... Code=193` (ERROR_BAD_EXE_FORMAT)，即表示使用了 32 位元橋接器嘗試載入 64 位元 DLL，必須以 64-bit FPC 重新編譯 `WbaseBridge.exe`。
