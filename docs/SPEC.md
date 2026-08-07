# Wx3000 專案系統與模組詳細規格書 (System & Module Specifications Index)

> 本目錄收錄 `Wx3000` (FoxPro 轉型 Modern Web 雲端會計進銷存系統) 之所有系統架構、選單、單檔維護與單據登打模組的完整規格文件，供未來維護、重組或自動化生成時參考使用。

---

## 📚 規格文件目錄 (Specifications Directory)

### 1. 前端模組規格 (Frontend Modules)

- 📌 [wbase 系統主畫面與選單模組規格 (`wbase/menu_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/menu_SPEC.md)
  - 包含三階動態樹狀/手風琴選單 (100 - A00 分類)、純鍵盤盲打導覽 (↑↓←→, Enter, Esc, 數字鍵)、深色與淺藍色主題 (Dark / Light-Blue) 控制與切換。
- 📌 [wbase1020 會計師/記帳士資料維護模組規格 (`wbase/wbase1020_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1020_SPEC.md)
  - 包含單檔主檔 AG Grid 瀏覽、F2-F9 熱鍵、Enter 順序跳欄 Modal、英文字母自動大寫、報表列印預覽與 CSV 匯出功能細節。
- 📌 [wtaxop 進貨單盲打登錄作業模組規格 (`wtaxop/purchase_order_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wtaxop/purchase_order_SPEC.md)
  - 包含 Header + Detail 雙 AG Grid 結構、快查彈窗 (F3/?)、連續跳欄自動增列、總金額自動計算與單據儲存。
- 📌 [FoxPro 鍵盤盲打 AG Grid 共用組件規格 (`components/foxpro_grid_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/components/foxpro_grid_SPEC.md)
  - 包含 `<FoxProGrid />` 與 `<FoxProGridBill />` 鍵盤 Traversal Hook 與事件監聽規格。

---

### 2. 後端與資料庫規格 (Backend & Database)

- 📌 [C# ASP.NET Core API 與 PostgreSQL 資料庫初始化規格 (`backend/backend_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/backend/backend_SPEC.md)
  - 包含 C# .NET 8/9 服務、Windows Service 支持、EF Core Npgsql 設定、`DbInitializer` idempotency (冪等性) 原生 SQL DDL 自動建立 Table 腳本與 API 路徑規格。

---

## 🧪 全系統建置與驗證指令 (Build & Verification)

```bash
# 1. 後端啟動與測試
cd backend
dotnet run

# 2. 前端獨立編譯驗證
cd frontend
pnpm run build

# 3. 根目錄全端並行啟動
pnpm dev
```
