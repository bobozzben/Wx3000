# Wx3000 工作區開發規範與品質防呆規則

本工作區規則檔旨在強制要求 Agent 在開發與維護 `Wx3000` 專案時，遵循 FoxPro 100% 全鍵盤盲打 UX 規範、工程程式碼品質與 API 契約一致性。

---

## 1. FoxPro 鍵盤盲打與 AG Grid UI 規範

在建立或修改前端 Grid 與表單 UI 時（如 `frontend/src/components/FoxProGrid*`、`frontend/src/wbase/`、`frontend/src/wtaxop/`）：

1. **100% 鍵盤驅動（完全無需使用滑鼠）**
   - 所有儲存格移動、自動新增列、開窗搜尋與存檔，必須 100% 可透過鍵盤快捷鍵（`Enter`、`Tab`、`方向鍵`、`F2`、`F9`、`F12`）完成。
   - **Enter 鍵行為規範**：
     - 移動至右側下一個可編輯儲存格。
     - 當前列最後一欄按下 Enter 鍵 -> 移動至下一列第一欄。
     - 最後一列最後一欄按下 Enter 鍵 -> 自動新增一空列並聚焦至該列第一欄。
   - **F2 鍵行為規範**：
     - 代號/名稱欄位（如產品代號、廠商代號、會計師代號）：觸發大型開窗搜尋對話框 (`SearchModal`)。
     - 數值/備註欄位（如數量、單價、備註）：進入儲存格編輯模式。
   - **F9 鍵行為規範**：觸發歷史單據/資料開窗查詢。
   - **F12 鍵行為規範**：一鍵發送存檔 (Save)，並觸發全單據金額計算與驗證。
   - **直接打字覆蓋 (Direct Keypress Overwrite)**：無須先按 F2，直接鍵入字元即可即時覆蓋當前儲存格內容。

2. **視覺與樣式規範**
   - 字型與欄高：字型 `Consolas, monospace`，字級 `16px`，預設列高 `rowHeight: 38px`。
   - 表格 Header：深藍背景 `#1e3a8a`，文字純白 `#ffffff`，粗體高對比。
   - 焦點外框 (Focus Ring)：選中儲存格必須顯示 2px 顯眼黃色外框（`#eab308` / `#f59e0b`）。
   - 隔行變色：偶數列套用微灰背景 `#f9fafb`。
   - 底部狀態列 (StatusBar)：即時顯示總金額、總筆數與熱鍵提示（`[F2]開窗 [F9]查詢 [F12]存檔`）。

3. **嚴格禁止行為 (Strict DO NOT Rules)**
   - ❌ 禁止單筆表單設計：明細表格必須為大容量 Multi-Row (至少 15 列) 表格，嚴禁設計成一次只能填一筆資料的彈窗或單筆輸入框。
   - ❌ 禁止 Dropdown 下拉選單搜尋：代號與名稱搜尋必須使用 F2 觸發的大型彈窗 SearchModal。
   - ❌ 禁止強迫使用滑鼠進行增列、切換或存檔。

---

## 2. 工程開發與品質規範

1. **碼源探查優先 (禁止憑空猜測)**
   - 修改程式碼或撰寫新 logic 前，必須先檢視現有型別定義、DTO、資料庫模型與 API 簽名。

2. **API 與靜態型別契約維護**
   - 修改後端 C# DTO 或 API 控制器 (`backend/DTOs/`、`backend/Controllers/`) 時，必須同步全域搜尋並更新前端 Axios 服務 (`frontend/src/services/`) 與 Zustand Store (`frontend/src/store/`)。

3. **完整錯誤日誌診斷**
   - 出現錯誤時，必須閱讀完整 Log 及 Exception StackTrace，嚴禁採用遮蔽 Error、吞掉 Exception 或回傳預設假資料的作法。

4. **實機與編譯驗證 (Empirical Verification)**
   - 完成程式碼修改後，必須執行編譯驗證：
     - 前端：`pnpm --filter frontend build`
     - 後端：`dotnet build backend/Wx3000.Backend.csproj`
   - 未通過編譯與型別檢查前，不得宣佈任務完成。
