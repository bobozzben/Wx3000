# wbase1030 建檔人員 (員工資料維護) 功能規格說明書 (SPEC.md)

## 1. 模組簡介與 FoxPro 原程式對照
- **FoxPro 原程式參照**：`F:\W3000SOUR\SourS9BASE\LIBS\wbase.vcx` 之 class `wbase1030`
- **功能名稱**：建檔人員 (員工) 主檔資料維護作業
- **模組代號**：`wbase1030`
- **主要功能**：提供事務所員工/建檔人員主檔資料之新增、線上編輯、刪除、查詢開窗與報表清冊列印。

---

## 2. 資料庫規格 (Database Architecture)
- **Database**：`a3000` (PostgreSQL)
- **Schema**：`e3000__comm`
- **Table**：`建檔人員`

### 欄位對照與結構 Mapping
| 前端屬性 (TypeScript) | 後端 Model 屬性 (C#) | PostgreSQL 實體欄位 | 資料型態 | 主鍵 / 必填 | 說明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `empCode` | `EmpCode` | `編號` | VARCHAR(20) | **PK / 必填** | 人員編號 |
| `empName` | `EmpName` | `姓名` | VARCHAR(50) | **必填** | 人員姓名 |
| `depName` | `DepName` | `部門` | VARCHAR(50) | 可空 | 所屬部門名稱 |
| `tel` | `Tel` | `電話` | VARCHAR(30) | 可空 | 聯絡電話 |
| `mobile` | `Mobile` | `手機` | VARCHAR(30) | 可空 | 行動電話 |
| `address` | `Address` | `地址` | VARCHAR(100) | 可空 | 通訊地址 |
| `memo` | `Memo` | `備註` | VARCHAR(200) | 可空 | 備註說明 |

---

## 3. UI 與視覺規格 (Visual & Layout Specs)
- **表格呈現模式**：Excel 試算表盲打模式，**畫面上同時顯示 15 列** (不足 15 列自動補齊空白列)。
- **禁止事項 (Do NOT)**：
  - **嚴禁做成單筆視窗彈出表單**，必須全數直接在 AG Grid 上輸入。
  - **嚴禁依賴滑鼠點擊**。
  - **嚴禁將搜尋做成 Dropdown**，必須做成 F3 Modal 視窗。
- **AG Grid 佈局設定**：
  - Theme: `ag-theme-alpine`
  - Font: `Consolas, Monaco, monospace`, `16px`
  - Row Height: `38px`, Header Height: `38px`
  - Container Height: `608px` (剛好裝載 15 列 + Header)
  - 表頭風格：深藍 `#1e3a8a`，白色字體，粗體
  - 焦點儲存格：**黃色 2px 顯眼外框 (`#eab308`)**，背景亮黃 (`#fef9c3`)
  - 隔行變色：單數列白底黑字，偶數列 `#f9fafb`
- **底部 StatusBar**：
  - 顯示 **總筆數** | **目前焦點位置** | **熱鍵提示 (`[F2]編輯 [F3]查詢開窗 [F7]列印 [ESC]存檔並結算 [Enter]下一格 [↑↓]換列`)**

---

## 4. 鍵盤事件與 Hooks 規格 (useWbase1030Keyboard.ts)
獨立鍵盤導覽 Hook 位於 `wbase\wbase1030\useWbase1030Keyboard.ts`，與全域組件徹底解耦，進入頁面焦點自動鎖定在 AG Grid 第一格 (0, 0)。

### 熱鍵行為清單 (Shortcut Rules)
1. **[Enter] 鍵**：
   - 阻止預設行為 (`preventDefault`)。
   - 橫向移動至下一個可編輯儲存格並自動開啟編輯。
   - 若為該列最後一欄，自動換至下一列第一欄。
   - 若為**最後一列最後一欄**，自動 append 一列空資料，並聚焦新列第一欄。
2. **[Tab] / [Shift+Tab] 鍵**：
   - `Tab`：橫向向右移動。
   - `Shift+Tab`：橫向向左移動 (若在第一欄則跳回上一列最後一欄)。
3. **[↑ / ↓] 方向鍵**：
   - `↑` / `↓`：上下換列。
   - 當游標位於**最後一列按 [↓]** 時，自動 append 一列空資料並聚焦新列。
4. **[F2] 鍵**：
   - 立即強制進入當前儲存格的修改模式 (`startEditingCell`)。
5. **[F3] 鍵**：
   - 彈出 `SearchModal` (F3 Modal 搜尋視窗)，可輸入關鍵字，用 `↑/↓` 選擇並按 `Enter` 帶回。
6. **[F7] 鍵**：
   - 彈出人員資料區間清冊列印視窗 (`Wbase1030Print`)。
7. **[ESC] 鍵**：
   - 結束編輯、觸發存檔，並顯示總筆數訊息 Toast。
8. **盲打支援 (Direct Typing)**：
   - `singleClickEdit={true}`，無需先按 F2，直接在儲存格打字即可覆蓋輸入。

---

## 5. 後端 API 規格 (Backend API Routes)
後端 Controller: `Wx3000.Backend.Controllers.Wbase1030Controller`

- `GET /api/wbase1030?keyword={kw}`：取得人員列表 (支援編號/姓名/部門關鍵字模糊查詢)。
- `GET /api/wbase1030/{code}`：依編號取得單筆人員資料。
- `POST /api/wbase1030`：新增人員資料。
- `PUT /api/wbase1030/{code}`：更新人員資料 (若不存在則自動建立)。
- `DELETE /api/wbase1030/{code}`：依編號刪除人員資料。
- `POST /api/wbase1030/print`：依起迄人員編號條件回傳清冊列印資料。

---

## 6. 重新產生 (Re-generation) 檔案清單
當需要重新產生本模組時，請依照下列路徑依序建置：
1. **Model**：`f:\ADSProject\Wx3000\backend\Models\EmpMaster.cs`
2. **Controller**：`f:\ADSProject\Wx3000\backend\Controllers\Wbase1030Controller.cs`
3. **Service**：`f:\ADSProject\Wx3000\frontend\src\services\wbase1030.ts`
4. **Store**：`f:\ADSProject\Wx3000\frontend\src\wbase\wbase1030\useWbase1030.ts`
5. **Print Component**：`f:\ADSProject\Wx3000\frontend\src\wbase\wbase1030\wbase1030Print.tsx`
6. **Main View Component**：`f:\ADSProject\Wx3000\frontend\src\wbase\wbase1030\index.tsx`
7. **SPEC Document**：`f:\ADSProject\Wx3000\docs\frontend\wbase\wbase1030\SPEC.md`
