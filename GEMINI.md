# Wx3000 Agent 開發與行為準則

> 本規則文件由 Antigravity 自動載入，用於指導 AI Agent 在 `Wx3000` 專案中的開發行為。

## 核心指令

1. **FoxPro 鍵盤盲打 UX 優先**
   - 100% 純鍵盤操作（`Enter`、`Tab`、`方向鍵`、`F2`、`F9`、`F12`）。
   - 儲存格直接打字覆蓋、最後一欄 Enter 自動新增列、F2 觸發 `SearchModal` 開窗（禁用 Dropdown 下拉選單）。
   - 高對比視覺樣式（Consolas 16px 字型、`#1e3a8a` 深藍 Header、`#eab308` 2px 黃色焦點框、15+ 列大容量明細）。

2. **工程品質與嚴謹度**
   - 寫代碼前先閱讀源碼，禁止憑空猜測 API 簽名或資料庫 Schema。
   - 後端 C# DTO / API 變更必須同步更新前端 Axios 服務與 Zustand store。
   - 遇到 Error 必須閱讀完整 Log 與 Exception StackTrace，嚴禁遮蔽錯誤或回傳假資料。
   - 宣告完成前必須通過實機編譯驗證（`pnpm --filter frontend build` 與 `dotnet build backend/Wx3000.Backend.csproj`）。

詳細規格請參閱 [.agents/rules/foxpro_ux_and_quality.md](file:///f:/ADSProject/Wx3000/.agents/rules/foxpro_ux_and_quality.md) 與 [workspace.md](file:///f:/ADSProject/Wx3000/workspace.md)。
