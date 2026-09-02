# Wx3000 專案系統與模組詳細規格書 (System & Module Specifications Index)

> 本目錄收錄 `Wx3000` (FoxPro 轉型 Modern Web 雲端會計進銷存與事務所管理系統) 之所有系統架構、選單、單檔維護與單據登打模組的完整規格文件，供未來維護、重組或自動化生成時參考使用。

---

## 📚 規格文件目錄 (Specifications Directory)

### 1. 前端基礎與選單模組規格 (Frontend Core & Navigation)

- 📌 [wbase 系統主畫面與選單模組規格 (`docs/frontend/wbase/menu/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/menu/SPEC.md)
  - 包含三階動態樹狀/手風琴選單 (100 - A00 分類)、純鍵盤盲打導覽 (↑↓←→, Enter, Esc, 數字鍵)、深色與淺藍色主題 (Dark / Light-Blue) 控制與切換。
- 📌 [FoxPro 鍵盤盲打 AG Grid 共用組件規格 (`docs/frontend/components/foxpro_grid_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/components/foxpro_grid_SPEC.md)
  - 包含 `<FoxProGrid />` 與 `<FoxProGridBill />` / `<FoxProGridV2 />` 鍵盤 Traversal Hook 與事件監聽規格。

---

### 2. 前端基礎主檔維護模組規格 (wbase Master Data Modules)

- 📌 [wbase1020 會計師/記帳士資料維護模組規格 (`docs/frontend/wbase/wbase1020/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1020/SPEC.md)
  - 包含單檔主檔 AG Grid 瀏覽、F2-F9 熱鍵、Enter 順序跳欄 Modal、英文字母自動大寫、報表列印預覽與 CSV 匯出功能細節。
- 📌 [wbase1030 記帳士基本資料維護模組規格 (`docs/frontend/wbase/wbase1030/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1030/SPEC.md)
  - 包含記帳士主檔資料維護、登錄字號管理與區域事務所欄位維護。
- 📌 [wbase1050 稅務人員資料維護模組規格 (`docs/frontend/wbase/wbase1050/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1050/SPEC.md)
  - 包含各區國稅局/稽徵所稅務人員聯絡方式維護、F3 開窗快查與 LocalAgent DLL 報表連線。
- 📌 [wbase1060 收費項目資料維護模組規格 (`docs/frontend/wbase/wbase1060/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1060/SPEC.md)
  - 包含事務所服務項目與標準金額設定 (`NT$ 3,500.00`)、批量存檔與區間列印。
- 📌 [wbase1070 備註資料維護模組規格 (`docs/frontend/wbase/wbase1070/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1070/SPEC.md)
  - 包含標準憑證/收費單據備註範本維護與開窗快查。
- 📌 [wbase1080 收費摘要資料維護模組規格 (`docs/frontend/wbase/wbase1080/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1080/SPEC.md)
  - 包含常用收費摘要與明細簡稱維護。
- 📌 [wbase2010 公司基本資料維護模組規格 (`docs/frontend/wbase/wbase2010/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase2010/SPEC.md)
  - 包含 6 大 Tab 多頁籤 (基本資料、聯絡申報、房屋稅籍、營所稅務、委任資料、異動記錄) 全鍵盤盲打切換與順序跳欄。
- 📌 [wbase3010 購票地點資料維護模組規格 (`docs/frontend/wbase/wbase3010/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3010/SPEC.md)
  - 包含統一發票申購地點、農會/銀行聯絡人與購票地址維護。
- 📌 [wbase3020 發票購買申購維護模組規格 (`docs/frontend/wbase/wbase3020/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3020/SPEC.md)
  - 包含期別條件開窗對話框、8 大發票本數整頁批次明細盲打登錄與國稅局申購媒體檔輸出。

---

### 3. 前端單據登打模組規格 (Transaction Modules)

- 📌 [wtaxop 進貨單盲打登錄作業模組規格 (`docs/frontend/wtaxop/purchase_order_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wtaxop/purchase_order_SPEC.md)
  - 包含 Header + Detail 雙 AG Grid 結構、快查彈窗 (F3/?)、連續跳欄自動增列、總金額自動計算與單據儲存。

---

### 4. 後端與資料庫規格 (Backend & Database)

- 📌 [C# ASP.NET Core API 與 PostgreSQL 資料庫初始化規格 (`docs/backend/backend_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/backend/backend_SPEC.md)
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
