# Wx3000 專案系統與模組詳細規格書 (System & Module Specifications Index)

> 本目錄收錄 `Wx3000` (FoxPro 轉型 Modern Web / Electron 混合雲地會計進銷存與事務所管理系統) 之所有系統架構、選單、單檔維護、發票統購與單據登打模組的完整規格文件，供開發維護、重構或 AI Agent 參考使用。

---

## 📚 規格文件目錄 (Specifications Directory)

### 1. 前端基礎、選單與共用組件規格 (Frontend Core, Navigation & Components)

- 📌 [wbase 系統主畫面與選單模組規格 (`docs/frontend/wbase/menu/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/menu/SPEC.md)
  - 包含奇勝資訊系統總入口 (`frontend/src/mainmenu/`)、三階動態樹狀/手風琴選單 (`100` - `A00` 分類)、純鍵盤盲打導覽 (`↑↓←→`, `Enter`, `Esc`, 數字/字母鍵)、深色與淺藍色主題 (`Dark` / `Light-Blue`) 切換，以及所有已掛載子模組路由。
- 📌 [FoxPro 鍵盤盲打共用組件庫規格 (`docs/frontend/components/foxpro_grid_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/components/foxpro_grid_SPEC.md)
  - 包含 `<FoxProGridV2 />`（多列行內盲打+欄寬記憶+欄位驗證）、`<FoxProGridCard />` + `useFoxProCardNavigation`（主檔清單卡片+母版表單導覽 Hook）、`<FoxProGridBill />`（單據明細盲打）、`<FoxProPrintModal />`（統一列印與 Excel 匯出母版）、`<AddressSelectModal />`（台灣地址智慧快選視窗）、`<WbasePageHeader />` 與 `<FormUtilSelectXlsxFieldsList />`。

---

### 2. 前端事務所主檔維護模組規格 (wbase Master Data Modules)

- 📌 [wbase1020 會計師/記帳士資料維護模組規格 (`docs/frontend/wbase/wbase1020/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1020/SPEC.md)
  - 上方 `<FoxProGridCard />` 瀏覽清單 + 下方即時聯動 `<Wbase1020Form />`、`useFoxProCardNavigation` 順序跳欄、證書別連動發文字軌快選 (`F2`)、地址智慧快選 (`F2`/`F4`)、統編/申報ID/Email/Big5 檢核、`FoxProPrintModal` 列印匯出與 DBF (`cpa.dbf`) 雙向同步。
- 📌 [wbase1030 建檔人員(員工)基本資料維護模組規格 (`docs/frontend/wbase/wbase1030/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1030/SPEC.md)
  - 對齊 `keyin.dbf` 完整 12 欄位 `<FoxProGridV2 />` 整頁多列行內盲打、`w3000` 位移式加解密（8 bytes 密碼 `psw`、15 bytes 一站式驗證碼 `onepassno`）、`SUPERVISOR` 保留帳號防護、民國年生日正規化、身分證與手機檢核、地址智慧快選 (`F2`) 與 DBF (`keyin.dbf`) 雙向同步。
- 📌 [wbase1050 稅務人員資料維護模組規格 (`docs/frontend/wbase/wbase1050/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1050/SPEC.md)
  - 對齊 `taxno.dbf` 7 欄位（代號、姓名、單位、電話、助理人員、住址、備註）`<FoxProGridV2 />` 行內盲打維護、住址欄 `F2` 台灣地址智慧快選、`FoxProPrintModal` 報表與 DBF (`taxno.dbf`) 雙向同步。
- 📌 [wbase1060 收費項目資料維護模組規格 (`docs/frontend/wbase/wbase1060/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1060/SPEC.md)
  - 事務所服務項目與標準收費金額設定、批量存檔、`FoxProPrintModal` 區間列印與 DBF (`recitem.dbf`) 雙向同步。
- 📌 [wbase1070 備註資料維護模組規格 (`docs/frontend/wbase/wbase1070/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1070/SPEC.md)
  - 標準憑證/收費單據備註範本維護、開窗快查、`FoxProPrintModal` 列印與 DBF (`recnote.dbf`) 雙向同步。
- 📌 [wbase1080 收費摘要資料維護模組規格 (`docs/frontend/wbase/wbase1080/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase1080/SPEC.md)
  - 常用收費摘要與明細簡稱維護、開窗快查、列印與 DBF (`recmemo.dbf`) 雙向同步。
- 📌 [wbase2010 公司基本資料維護模組規格 (`docs/frontend/wbase/wbase2010/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase2010/SPEC.md)
  - 支援上下分割 (`index.tsx`) 與左右分割 (`Wbase2010SplitPage.tsx`) 雙佈局、`<FoxProGridCard />` 瀏覽清單、6 大 Tab 多頁籤 (`F3`~`F8`) 跨頁全鍵盤順序跳欄、8 大地址欄位 `F2` 智慧快選、統編/身分證/9碼稅籍/12碼房屋稅籍/民國日期/25項限定值檢核、公司名稱自動推導組織代號與 DBF (`customer.dbf`) 雙向同步。

---

### 3. 前端營業稅發票統購模組規格 (wbase Invoice Purchase Modules)

- 📌 [wbase3010 購票地點資料維護模組規格 (`docs/frontend/wbase/wbase3010/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3010/SPEC.md)
  - 統一發票申購地點、連絡人與購買地址（支援 `F2` 台灣地址智慧快選）`<FoxProGridV2 />` 維護、`FoxProPrintModal` 列印與 DBF (`place.dbf`) 雙向同步。
- 📌 [wbase3020 發票購買申購維護與預購表列印規格 (`docs/frontend/wbase/wbase3020/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3020/SPEC.md)
  - 包含期別條件開窗 (`wbase3020_01`)、8 大發票本數整頁批次盲打 (`wbase3020_02`)、國稅局申購媒體檔輸出、發票預購表列印與 Excel 動態欄位匯出 (`wbase3020_buyinv_print`)，以及 DBF (`buyinv.dbf`) 雙向同步。
- 📌 [wbase3050 統購發票清單列印與單價設定規格 (`docs/frontend/wbase/wbase3050/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3050/SPEC.md)
  - 包含統購發票清單列印 (`wbase3050_buylist_print`，支援 A4 發票清單與中一刀發票領取簽收單 `wbase350_buyinv_list`)、8 種發票工本費單價設定 (`wbase3050_buyinv_setamt`) 與 Excel 動態欄位匯出。
- 📌 [wbase3060 統購發票字軌輸入與 Excel 匯入規格 (`docs/frontend/wbase/wbase3060/SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wbase/wbase3060/SPEC.md)
  - 包含期別排序設定與國稅局網路購買/代售點購買 Excel 批次匯入 (`wbase3060_01`)、8 大發票種類之「字軌 / 起號 / 迄號」雙層表頭 `<FoxProGridV2 />` 盲打與起迄號自動推算 (`wbase3060_02`)，以及 DBF (`buyinv.dbf`) 雙向同步。

---

### 4. 前端進銷存單據登打模組規格 (wtaxop Transaction Modules)

- 📌 [wtaxop 進貨單盲打登錄作業模組規格 (`docs/frontend/wtaxop/purchase_order_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/frontend/wtaxop/purchase_order_SPEC.md)
  - 包含 Header + Detail (`<FoxProGridBill />`) 上下結構、品號/廠商快查彈窗、連續跳欄自動增列、總金額自動計算與單據儲存。

---

### 5. 後端、資料庫與地端代理規格 (Backend, DBF Sync & LocalAgent)

- 📌 [C# ASP.NET Core API、PostgreSQL 與 VFP DBF 雙向同步規格 (`docs/backend/backend_SPEC.md`)](file:///f:/ADSProject/Wx3000/docs/backend/backend_SPEC.md)
  - 包含 C# .NET 8 服務 (`Port 5007`)、Windows Service (`Wx3000Api`)、`SystemConfigService` + `DynamicModelCacheKeyFactory` (動態磁碟機與 Schema 切換)、`DbfSyncService` (SHA256 Checksum 快照比對與 DBF 絕對權威雙寫)、`SystemParamService`、`LocalAgent` (`Port 18889`, 32-bit `DBFBridge.exe`, 64-bit `WbaseBridge.exe`) 與完整 API 路由表。
- 📌 [開發編輯與打包部署速查指南 (`BUILD_AND_DEPLOY.md`)](file:///f:/ADSProject/Wx3000/BUILD_AND_DEPLOY.md)
  - 包含 `Wx3000-Manager.bat` 互動式選單、統一 `publish/` 輸出結構、客戶端安裝/更新/診斷腳本與 GitHub Actions 自動化發佈流程。

---

## 🧪 全系統建置與驗證指令 (Build & Verification)

```powershell
# 1. 後端編譯驗證
dotnet build backend/Wx3000.Backend.csproj

# 2. 前端獨立編譯驗證
pnpm --filter frontend build

# 3. 根目錄全端並行啟動 (API + Web + LocalAgent)
pnpm dev
```
