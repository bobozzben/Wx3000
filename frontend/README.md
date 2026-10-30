# Wx3000 Frontend (React 19 + Vite + Electron)

本目錄為 `Wx3000` 系統之前端與桌面端專案，採用 **React 19 + TypeScript + Vite + Tailwind CSS (v4) + AG Grid + Zustand** 建構，並透過 **Electron** 封裝為獨立 Windows 桌面端應用程式。

---

## 📁 目錄結構 (`frontend/src/`)

- `mainmenu/`：奇勝資訊 Wx3000 系統總入口（四大系統分區、單鍵快捷導覽、線上客服與工具彈窗）
- `components/`
  - `FoxProGrid/FoxProGridV2.tsx`：多列行內盲打維護表格（預設 `minRows=0`、欄寬拖曳記憶、Big5 截斷、即時驗證、`F2` 輔助開窗按鈕、離列自動存檔）
  - `FoxProGrid/FoxProPrintModal.tsx`：全系統統一 `F7` 區間列印預覽、純淨紙張列印與 Excel 匯出母版
  - `FoxProGrid/AddressSelectModal.tsx`：台灣地址智慧快選視窗（全台縣市/鄉鎮郵遞區號/路名資料庫、門牌樓層速選鈕、半形轉全形）
  - `FoxProGrid/SearchModal.tsx`：`F2` / `F3` 大型開窗模糊快查對話框
  - `FoxProGridCard/FoxProGridCard.tsx`：主檔清單瀏覽卡片 + `useFoxProCardNavigation`（母版表單鍵盤導覽與聚焦全選打字覆蓋 Hook）
  - `FoxProGridBill/FoxProGridBill.tsx`：進銷存單據 Header + Detail 盲打表格
  - `SelectXlsxField/FormUtilSelectXlsxFieldsList.tsx`：Excel 匯出欄位與標題自訂組件
  - `WbasePageHeader.tsx`：統一模組頂部標題列與 `GRID / EDIT / ADD` 模式徽章
  - `ServerConfigModal.tsx`：後端 API 伺服器位址與資料磁碟機 (`C:`/`F:`) 設定視窗 (`Ctrl+Shift+S`)
- `wbase/`
  - `menu/`：三階手風琴全鍵盤主選單與深淺雙色主題 (`ThemeContext`)
  - `wbase1020/`：會計師/記帳士資料維護（上方 `FoxProGridCard` + 下方聯動 `Wbase1020Form`）
  - `wbase1030/`：建檔人員（員工）資料維護（12 欄位 `FoxProGridV2` + `w3000` 密碼/驗證碼加解密）
  - `wbase1050/`：稅務人員資料維護（7 欄位 `FoxProGridV2` + `F2` 地址快選）
  - `wbase1060/`：收費項目資料維護
  - `wbase1070/`：備註資料維護 (`recnote.dbf`)
  - `wbase1080/`：收費摘要資料維護 (`recmemo.dbf`)
  - `wbase2010/`：公司基本資料維護（支援上下分割與左右分割 `Wbase2010SplitPage`，6 大 Tab 跨頁跳欄）
  - `wbase3010/`：發票購買地點維護（含 `F2` 地址快選）
  - `wbase3020/`：發票預購輸入 (`wbase3020_01` / `02`) 與預購表列印 (`wbase3020_buyinv_print`)
  - `wbase3050/`：統購發票清單列印 (`wbase3050_buylist_print`) 與單價設定 (`wbase3050_buyinv_setamt`)
  - `wbase3060/`：統購發票字軌輸入 (`wbase3060_01` / `02`) 與國稅局/代售點 Excel 匯入
- `wtaxop/PurchaseOrder/`：進貨單盲打作業
- `services/`：Axios API 服務、`apiConfig.ts` (`X-Data-Drive`)、`addressService.ts` 與通用稅務/Big5 驗證及加解密工具 (`validation.ts`)

---

## 🚀 開發與打包指令

```powershell
# 1. 啟動 Vite 網頁開發伺服器 (http://localhost:5173)
pnpm dev

# 2. 型別檢查與靜態網頁打包
pnpm build

# 3. 啟動 Electron 桌面端開發熱重載
pnpm electron:dev

# 4. 快速打包 Electron 免安裝測試目錄 (輸出至 ../publish/frontend/Electron/release/win-unpacked/)
pnpm electron:pack

# 5. 打包 Electron 正式 Windows 安裝精靈與綠色版 EXE (輸出至 ../publish/frontend/Electron/release/)
pnpm electron:build
```
