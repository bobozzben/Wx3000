# 規格書：FoxPro 鍵盤盲打 AG Grid 共用組件規格

> **組件名稱**：`FoxProGrid` & `FoxProGridBill`  
> **技術核心**：React 19 + AG Grid Community + 自訂 Keyboard Traversal Hooks  
> **檔案目錄**：`frontend/src/components/FoxProGrid/` & `frontend/src/components/FoxProGridBill/`

---

## 1. 組件設計哲學

傳統 Visual FoxPro / Delphi 系統使用者習慣於不需要滑鼠、100% 透過鍵盤熱鍵與 `Enter` / `Tab` 鍵連續登打資料。
本共用組件庫提供兩大核心包裝：
1. **`FoxProGrid` (單檔/主檔維護專用 Grid)**：用於主檔瀏覽與搜尋。
2. **`FoxProGridBill` (單據 Header+Detail 專用 Grid)**：用於進銷存單據之雙 Grid 上下結構與連續跳欄登打。

---

## 2. `FoxProGrid` 規格與熱鍵

### 支援熱鍵
- `↑` / `↓`：於 Grid 列表資料列間快速移動高亮選取
- `F2`：觸發新增 callback (`onAdd`)
- `F3`：觸發搜尋焦點 callback (`onSearchFocus`)
- `F4` / `Enter`：觸發編輯 callback (`onEdit`)
- `F8` / `Delete`：觸發刪除 callback (`onDelete`)
- `F9`：觸發列印 callback (`onPrint`)

---

## 3. `FoxProGridBill` 規格與連續跳欄

### 連續跳欄邏輯 (Cell Traversal)
- 當使用者於 Cell 編輯狀態按下 `Enter` 鍵：
  1. 若非最後一欄，自動將焦點與編輯狀態推移至同一列的下一個可編輯欄位。
  2. 若為當前列的最後一個欄位 (例如：單價/金額)，自動儲存當前列、在 Grid 底端新增一空白明細列，並將焦點自動移至新品號欄位。
- 當使用者於品號或廠商欄位輸入 `?` 或按下 `F3` 時：
  - 自動彈出快查 Modal (`SearchModal.tsx`)，允許模糊搜尋品號/廠商，按 `Enter` 選取後自動將資料帶回 Cell 並恢復 Enter 跳欄。

---

## 4. 建置驗證

```bash
# 前端專案編譯驗證
pnpm --filter frontend run build
```
