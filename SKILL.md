# Legacy FoxPro / Pascal Modernization Protocol

## 核心目標
將 FoxPro (`.prg`, `.scx`, `.dbf` 相關邏輯) 或 Pascal (`.pas`, `.dpr`, `.lpr`) 的舊系統邏輯，翻新為現代化架構（如 C# .NET Core, TypeScript, Python 或 Go）。著重於將程序化邏輯解耦為現代物件導向/函數式架構，並落實強型別與現代異步設計。

## 角色分工與權限

### 1. 總化工頭 (Legacy System Architect)
- **指定模型**：`gemini-4-argon`
- **思考層級**：`thinking_level: HIGH`
- **核心職責**：
  - **特徵提取**：識別 FoxPro 的 `PUBLIC/PRIVATE` 變數相依性，或 Pascal 的 `var` 區塊與全域單元 (Units) 狀態。
  - **解耦規劃**：將舊程式中的 UI 刻板邏輯（如 FoxPro 的 `DEFINE WINDOW/SCREEN` 或 Pascal 的 Win32 Control 視窗行為）與核心業務邏輯（Business Logic）剝離。
  - **資料層對應**：規劃如何將舊式的 `SEEK`, `LOCATE`, `SCAN...ENDSCAN` (FoxPro) 或舊式 Record 指標操作 (Pascal)，轉換為現代的 ORM 查詢（如 Entity Framework, Prisma）或記憶體結構。
  - **合規驗收**：嚴格審查 Flash 轉換後的程式碼是否遺漏了原有的邊界邏輯或型別轉換缺陷。

### 2. 重構苦力 (Translation & Test Worker)
- **指定模型**：`gemini-3.8-flash`
- **思考層級**：`thinking_level: MEDIUM`
- **核心職責**：
  - 依照工頭指定的型別與介面規格，將單一 Procedure/Function/Method 逐行翻譯為目標現代語言。
  - 負責處理繁瑣的字串處理、數學運算與基礎資料結構映射。
  - 針對新產出的現代化模組撰寫單元測試。

---

## 執行流程與派工規範（Workflow）

### 階段一：架構審查與型別映射（由 Argon 執行）
1. 掃描舊程式碼，優先找出隱式依賴：
   - **FoxPro 審查**：找出全域環境設定（如 `SET EXACT`, `SET DELETED`）對邏輯的影響，捕捉 `LOCAL` 與 `PRIVATE` 變數。
   - **Pascal 審查**：分析 `uses` 區塊與 Pointers (指標) 的使用，注意有沒有 Delphi DLL 呼叫字串時的記憶體分配錯誤風險（如 `PChar` 與 `AnsiString` 的轉換細節）。
2. 設計現代語言的 Class 結構、Interface 與 DTO (Data Transfer Objects)，確保型別安全。

### 階段二：非阻塞平行派工（由 Argon 觸發 Subagent）
工頭將拆解後的函式或區塊，以非阻塞方式派發給多個 Flash 苦力。

**派工指令範本：**
```javascript
// 範例：將 FoxPro 邏輯/Pascal 函數轉為 C# Service
invoke_subagent(
  model="gemini-3.8-flash", 
  task="將附帶的 FoxPro PROCEDURE calculate_tax 轉寫為 C# 異步方法 Task<decimal> CalculateTaxAsync。原邏輯包含對舊資料表的 SCAN 迴圈，請改用 LINQ 與強型別 DTO 替代。請維持原業務邏輯的計算精確度。", 
  background=true
);

// 範例：針對翻新後的程式碼產生單元測試
invoke_subagent(
  model="gemini-3.8-flash", 
  task="針對轉換後的 ModernTaxService.cs，使用 xUnit 撰寫單元測試，必須覆蓋原 Pascal/FoxPro 邏輯中可能出現的 null、0 或負數等邊界條件。", 
  background=true
);
```

### 階段三：程式碼驗收與 Bug 修正（由 Argon 執行）
1. 收集 Flash 返回的現代化程式碼。
2. Argon 發揮高推理能力，重點審查：
   - 舊程式的**副作用（Side Effects）**是否被正確隔離？
   - 是否有字串或陣列索引從 1 開始（FoxPro/Pascal 特性）轉為 0 開始（現代語言特性）時導致的 **Off-by-one 錯誤**？
   - Pascal 轉過來的指標或記憶體操作，在現代安全語言中是否已妥善容器化或物件化？
3. 發現不符規範處，利用錯誤日誌退回給 Flash 重新修正。

### 階段四：整合與輸出
驗收通過後，輸出完整的現代化專案架構，並附帶一份「新舊邏輯對照與資料庫映射報告」。
