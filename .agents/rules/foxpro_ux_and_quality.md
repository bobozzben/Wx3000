# Wx3000 工作區開發規範與品質防呆規則

本工作區規則檔旨在強制要求 Agent 在開發與維護 `Wx3000` 專案時，遵循 FoxPro 100% 全鍵盤盲打 UX 規範、混合雲地 DBF 雙向同步原則、台灣稅務與 Big5 檢核標準、工程程式碼品質與 API 契約一致性。

---

## 1. FoxPro 鍵盤盲打與 UI 組件規範

在建立或修改前端 Grid 與表單 UI 時（如 `frontend/src/components/FoxProGrid*`、`frontend/src/wbase/`、`frontend/src/wtaxop/`）：

1. **100% 鍵盤驅動（完全無需使用滑鼠）**
   - 所有儲存格移動、自動新增列、開窗搜尋、地址快選、列印與存檔，必須 100% 可透過鍵盤快捷鍵完成。
   - **核心母版組件庫**：
     - **`FoxProGridV2` (`frontend/src/components/FoxProGrid/FoxProGridV2.tsx`)**：適用於整頁多列行內盲打維護（如 `wbase1030`, `1050`, `1060`, `1070`, `1080`, `3010`, `3020_02`, `3060_02`）。預設 `minRows=0`（只顯示實際資料筆數，對齊原生 FoxPro GRID），支援欄寬拖曳與 `localStorage` 持久化 (`gridId`)、`uppercase`/`digitOnly`/`maxBytes` (Big5 位元組限制)、`validate` 欄位檢核、`hasEllipsis` 儲存格內 `F2` 開窗按鈕、`Enter`/`Tab` 右移、列末換行、底端自動 Append 空白列並觸發 `onSaveRow`、`F3` 開窗搜尋、`F7` 報表列印、`Ins` 新增、`Del` 刪除、`Esc` 儲存/離開。
     - **`FoxProGridCard` + `useFoxProCardNavigation` (`frontend/src/components/FoxProGridCard/FoxProGridCard.tsx`)**：適用於主檔上方/左側清單瀏覽搭配下方/右側詳細表單即時聯動（如 `wbase1020`, `wbase2010`）。內建防抖滾動同步游標 (`enableScrollSync`)、單一整合標題列 (`mergeHeader`)、`foxProFocusAndSelect`（聚焦自動全選並支援打字直接覆蓋 Type-over）、`Enter`/`↓` 下一欄、`↑` 上一欄、跨 Tab 自動切換、自動跳過 `disabled` 欄位。
     - **`FoxProGridBill` (`frontend/src/components/FoxProGridBill/FoxProGridBill.tsx`)**：適用於進銷存單據 Header + Detail 連續登打作業。
     - **`FoxProPrintModal` (`frontend/src/components/FoxProGrid/FoxProPrintModal.tsx`)**：統一全系統 `F7` 區間列印預覽、純淨紙張直印 (`printUtil.ts`) 與 `<FormUtilSelectXlsxFieldsList />` Excel 動態欄位自訂匯出。
     - **`AddressSelectModal` (`frontend/src/components/FoxProGrid/AddressSelectModal.tsx`)**：台灣地址智慧快選彈窗（對齊 `util_hi_addr_form.pas`），支援全台縣市、鄉鎮市區郵遞區號、路名街名快選與門牌樓層速選鈕，於地址欄按 `F2`/`F4` 或點擊按鈕觸發。
     - **`WbasePageHeader` (`frontend/src/components/WbasePageHeader.tsx`)**：統一模組頂部標題列與操作模式徽章。

2. **視覺與樣式規範**
   - 字型與欄高：字型 `Consolas, Monaco, monospace`，字級 `16px`，預設列高 `38px`。
   - 表格 Header：深藍背景 `#1e3a8a`，文字純白 `#ffffff`，粗體高對比（並支援 `ThemeContext` 深色/淺藍色雙主題切換）。
   - 焦點外框 (Focus Ring)：選中儲存格或表單欄位必須顯示顯眼黃色外框（`#eab308` / `ring-yellow-400`）與淺黃底色提示，讓操作員雙眼秒抓焦點。
   - 欄位驗證與 Big5 相容性 (`frontend/src/services/validation.ts`)：
     - 嚴格攔截無法存入 VFP DBF 的罕字/Emoji (`checkBig5Compatible`) 與超過 DBF 欄寬上限之位元組 (`truncateBig5`)。
     - 對於提示性檢核（如 Email `isValidEmail`、8 碼統編 `checkUnifiedNo`、10 碼身分證/居留證 `checkTaxId`、電話格式 `checkPhoneFormat`），採非阻斷式警告或確認對話框，不強制卡死舊有歷史資料存檔。

3. **嚴格禁止行為 (Strict DO NOT Rules)**
   - ❌ 禁止依賴滑鼠點擊才能完成增列、換欄、切換頁籤或存檔。
   - ❌ 禁止 Dropdown 下拉選單搜尋：代號、名稱與地址搜尋必須使用 `F2` / `F3` / `F4` 觸發的大型彈窗 `SearchModal` 或 `AddressSelectModal`。

---

## 2. 混合雲地 DBF 雙向同步與後端開發規範

1. **DBF 絕對權威原則與動態磁碟機 (`IDbfSyncService` & `ISystemConfigService`)**
   - 系統透過 `ISystemConfigService` 與前端 `X-Data-Drive` Header 支援動態切換資料來源磁碟機（如 `C:` 或 `F:`），自動對應地端 `<Drive>:\w3000\comm\*.dbf` 與 PostgreSQL `w3000` 資料庫之 `<drive>:/w3000/comm` Schema（資料表：`cpa`, `keyin`, `taxno`, `recitem`, `recnote` [1070 備註], `recmemo` [1080 摘要], `customer`, `place`, `buyinv`）。
   - **讀取 (`GET`)**：先呼叫 `_dbfSyncService.EnsureTableSyncedAsync(...)`，比對地端 DBF 的 SHA256 Checksum 與 PostgreSQL `dictionary.w3000_dbf` 紀錄；若不一致自動重灌快照，若一致則直接讀取 PostgreSQL（Fast-path ~2ms）。
   - **寫入 (`POST` / `PUT` / `DELETE`)**：必須先呼叫 `_dbfSyncService.WriteRecordAsync(...)` 透過 `LocalAgent` (`http://localhost:18889/api/dbf/*` ➔ 32-bit `DBFBridge.exe`) 寫入地端 DBF。若 DBF 回傳鎖定衝突 (`LOCK_TIMEOUT` / HTTP `409 Conflict`) 或失敗，**嚴禁單邊寫入 PostgreSQL**；寫入 DBF 成功後，再寫入 PostgreSQL 並更新 Checksum。

2. **LocalAgent 位元架構防呆**
   - `DBFBridge.exe` 必須編譯為 **32-bit (`i386-win32`)** 以呼叫 32-bit VFP COM `w3000_dbf.dll`。
   - `WbaseBridge.exe` 必須編譯為 **64-bit (`x86_64-win64`)** 以載入 64-bit FastReport `wbaseRP.dll`（避免 `Code=193` 錯誤）。

3. **實機與編譯驗證 (Empirical Verification)**
   - 完成程式碼修改後，必須執行編譯驗證：
     - 前端：`pnpm --filter frontend build`
     - 後端：`dotnet build backend/Wx3000.Backend.csproj`
   - 未通過編譯與型別檢查前，不得宣佈任務完成。
