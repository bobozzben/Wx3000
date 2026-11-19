# Wx3000 Frontend (React 19 + Vite + Electron)

本目錄為 `Wx3000` 系統之前端與桌面端專案，採用 **React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid + Zustand** 建構，並透過 **Electron** 封裝為獨立 Windows 桌面端應用程式。開發時 Vite (`:5173`) 會把 `/api`、`/health`、`/swagger` 代理到後端 `http://127.0.0.1:5007`。

---

## 📁 目錄結構 (`frontend/src/`)

- `mainmenu/`：奇勝資訊 Wx3000 系統總入口（四大系統分區、單鍵快捷導覽、線上客服與工具彈窗）
- `components/`
  - `FoxProGrid/FoxProGridV2.tsx`：多列行內盲打維護表格（預設 `minRows=0`、欄寬拖曳記憶、Big5 截斷、即時驗證、`F2` 輔助開窗按鈕、離列自動存檔）
  - `FoxProGrid/FoxProPrintModal.tsx`：`F7` 區間列印預覽、純淨紙張列印與 Excel 匯出母版（1030、1050、1060、1070、3010、5-2 使用）
  - `FoxProGrid/FoxProPrintModalv2.tsx`、`FoxProGrid/FoxProRangePrintConditionModal.tsx`：列印條件視窗母版（卡片式條件 / 起訖代號區間；`F7` 確定、`F8` 匯出 Excel、`Esc` 離開），F8 匯出用 `useFoxProPrintXlsxExport`
  - `ReportPreview/ReportPreviewModal.tsx`：共用報表預覽（瀏覽器內排版分頁、列印設定側邊欄、預覽編修、雙擊報表追追追；`F7` / `Ctrl+P` 直接送印：Electron 走 `electronAPI.printHtml`，瀏覽器走 LocalAgent `/api/print/direct`；匯出 PDF / JPG / Word `.doc`）（1020、3025、4010、5-1、5-3 ~ 5-5 使用）
  - `FoxProGrid/AddressSelectModal.tsx`：台灣地址智慧快選視窗（全台縣市/鄉鎮郵遞區號/路名資料庫、門牌樓層速選鈕、半形轉全形）
  - `FoxProGrid/SearchModal.tsx`：`F2` / `F3` 大型開窗模糊快查對話框
  - `FoxProGridCard/FoxProGridCard.tsx`：主檔清單瀏覽卡片 + `useFoxProCardNavigation`（母版表單鍵盤導覽與聚焦全選打字覆蓋 Hook）
  - `FoxProGridBill/FoxProGridBill.tsx`：進銷存單據 Header + Detail 盲打表格
  - `SelectXlsxField/FormUtilSelectXlsxFieldsList.tsx`：Excel 匯出欄位與標題自訂組件
  - `WbasePageHeader.tsx`：統一模組頂部標題列與 `GRID / EDIT / ADD` 模式徽章
  - `ServerConfigModal.tsx`：後端 API 伺服器位址與資料磁碟機 (`C:`/`F:`) 設定視窗 (`Ctrl+Shift+S`)
- `wbase/`
  - `menu/`：三階手風琴全鍵盤主選單與深淺雙色主題 (`ThemeContext`)；選單項目定義在 `menuConfig.ts`，**還要在 `wbaseMainPage.tsx` 的 `handleSelectAction` 與 render 分支註冊**，否則點選只會跳出「目前此模組正在移植建置中」
  - `wbase1010/`：1-1 事務所基本資料（`base` / `pub_para` 單筆表單）與 `F4` 事務所資料 `cstore` 多筆維護、列印 DLL `wbase1010_cstore_list`
  - `wbase1020/`：會計師/記帳士資料維護（上方 `FoxProGridCard` + 下方聯動 `Wbase1020Form`；`F7` 區間條件 + `ReportPreviewModal`）
  - `wbase1030/`：建檔人員（員工）資料維護（12 欄位 `FoxProGridV2` + `w3000` 密碼/驗證碼加解密）
  - `wbase1050/`：稅務人員資料維護（7 欄位 `FoxProGridV2` + `F2` 地址快選）
  - `wbase1060/`：收費項目資料維護
  - `wbase1070/`：備註資料維護 (`recnote.dbf`)
  - `wbase1080/`：收費摘要資料維護 (`recmemo.dbf`)
  - `wbase2010/`：客戶資料建檔（支援上下分割與左右分割 `Wbase2010SplitPage`，6 大 Tab 跨頁跳欄）
  - `wbase2030/`：2-2 客戶資料匯出 (`Wbase2020Export`) / 2-3 客戶資料匯入 (`Wbase2030Import`)，進入前檢查轉檔列印密碼，檔案為與 VFP 互通的 `custbak.dbf`
  - `wbase2040/`：客戶收費資料輸入（`recmom`/`recmod` 收費單 + Space 明細、`F4` 收據與 `F6` 請款單 DLL 報表 `wbase2040_rec_print`、`F9` 收費統計表 Excel）
  - `wbase2050/`：總分支機構設定（總機構清單 + `F8` 分公司資料維護 `Wbase2050F8Form`）
  - `wbase3010/`：發票購買地點維護（含 `F2` 地址快選）
  - `wbase3020/`：發票預購輸入 (`wbase3020_01` / `02`) 與預購表列印 (`wbase3020_buyinv_print`，選單 3-3)
  - `wbase3025/`：3-4-1 原媒體轉檔 / 3-4-2 網路申購轉檔（`FoxProPrintModalv2` 條件、`F7` `ReportPreviewModal` 預覽、`F8` 下載台北市 / 高雄市 / 台灣省格式 Big5 檔）
  - `wbase3050/`：統購發票清單列印 (`wbase3050_buylist_print`) 與單價設定 (`wbase3050_buyinv_setamt`)
  - `wbase3060/`：統購發票字軌輸入 (`wbase3060_01` / `02`) 與國稅局/代售點 Excel 匯入
  - `wbase4010/`：4-1 標準會計科目維護（選單 `wbase4011`~`4016` 對應 6 種科目表 `xmaster`~`xmaster6`；`F4`/`F7` 區間條件 + `ReportPreviewModal`）
  - `wbase4020/`：4-2~4-6 營業稅設定、傳票轉檔設定、進銷存方式設定、共用科目摘要、共用參數設定（依選單顯示單一畫面、不顯示頁籤，service 在 `wbase4020/services/`）
  - `wbase5010/`：5-1~5-6 客戶資料列印、郵寄標籤、登打統計表、營業狀況表、財務狀況參考表、委任書輸入（依選單顯示單一畫面、不顯示頁籤；5-1 ~ 5-5 先選客戶再輸入列印條件，service 在 `wbase5010/services/`）
  - `wbase5070/`：5-7 碳健檢企業名單匯出（勾選客戶、轉檔列印密碼、加總各客戶 `t403` 銷售額後匯出 Excel）
- `wtaxop/PurchaseOrder/`：進貨單盲打作業
- `services/`：Axios API 服務 (`wbaseXXXX.ts`)、`apiConfig.ts` (`X-Data-Drive`)、`localagent.ts` (LocalAgent `http://localhost:5009`：報表 DLL、Word 套印、印表機清單與直接列印)、`addressService.ts` 與通用稅務/Big5 驗證及加解密工具 (`validation.ts`)
- `store/`：Zustand 狀態管理；`utils/printUtil.ts`：純淨紙張列印；`data/`：台灣縣市鄉鎮郵遞區號與路名資料

---

## 🚀 開發與打包指令

```powershell
# 1. 啟動 Vite 網頁開發伺服器 (http://localhost:5173)
pnpm dev

# 2. 型別檢查與靜態網頁打包 (tsc -b + vite build)
pnpm build

# 3. 靜態檢查 (oxlint)
pnpm lint

# 4. 啟動 Electron 桌面端開發熱重載
pnpm electron:dev

# 5. 快速打包 Electron 免安裝測試目錄 (輸出至 ../publish/frontend/Electron/release/win-unpacked/)
pnpm electron:pack

# 6. 打包 Electron 正式 Windows 安裝精靈與綠色版 EXE (輸出至 ../publish/frontend/Electron/release/)
pnpm electron:build
```
