# Wx3000 Frontend (React 19 + Vite + Electron)

本目錄為 `Wx3000` 系統之前端與桌面端專案，採用 **React 19 + TypeScript + Vite + Tailwind CSS + AG Grid + Zustand** 建構，並透過 **Electron** 封裝為獨立 Windows 桌面端應用程式。

---

## 📁 目錄結構 (`frontend/src/`)

- `components/`
  - `FoxProGrid/FoxProGridV2.tsx`：多列試算表行內盲打維護表格（支援雙層表頭、直接打字覆蓋、底端自動增列、即時存檔）
  - `FoxProGrid/SearchModal.tsx`：F2 / F3 大型開窗模糊快查對話框
  - `FoxProGridCard/FoxProGridCard.tsx`：主檔清單瀏覽卡片（支援滾輪防抖同步游標、上下鍵換筆連動下方表單）
  - `FoxProGridBill/FoxProGridBill.tsx`：進銷存單據 Header + Detail 盲打表格
  - `SelectXlsxField/FormUtilSelectXlsxFieldsList.tsx`：Excel 匯出欄位與標題自訂組件
  - `ServerConfigModal.tsx`：後端 API 伺服器位址設定視窗
- `wbase/`
  - `menu/`：三階手風琴全鍵盤主選單與深淺雙色主題 (`ThemeContext`)
  - `wbase1020/`：會計師/記帳士資料維護（上方 `FoxProGridCard` + 下方聯動 `Wbase1020Form`）
  - `wbase1030/`：建檔人員（員工）資料維護
  - `wbase1050/`：稅務人員資料維護
  - `wbase1060/`：收費項目資料維護
  - `wbase1070/`：備註資料維護
  - `wbase1080/`：收費摘要資料維護
  - `wbase2010/`：公司基本資料維護（支援上下分割與左右分割 `Wbase2010SplitPage`，6 大 Tab 跨頁跳欄）
  - `wbase3010/`：發票購買地點維護
  - `wbase3020/`：發票預購輸入 (`wbase3020_01` / `02`) 與預購表列印 (`wbase3020_buyinv_print`)
  - `wbase3050/`：統購發票清單列印 (`wbase3050_buylist_print`) 與單價設定 (`wbase3050_buyinv_setamt`)
  - `wbase3060/`：統購發票字軌輸入 (`wbase3060_01` / `02`) 與國稅局/代售點 Excel 匯入
- `wtaxop/PurchaseOrder/`：進貨單盲打作業
- `services/`：Axios API 服務、系統參數服務 (`systemParamService.ts`) 與通用驗證工具 (`validation.ts`)

---

## 🚀 開發與打包指令

```powershell
# 1. 啟動 Vite 網頁開發伺服器 (http://localhost:5173)
pnpm dev

# 2. 型別檢查與靜態網頁打包 (產出至 dist/)
pnpm build

# 3. 啟動 Electron 桌面端開發熱重載
pnpm electron:dev

# 4. 快速打包 Electron 免安裝測試目錄 (release/win-unpacked/)
pnpm electron:pack

# 5. 打包 Electron 正式 Windows 安裝精靈與綠色版 EXE (release/)
pnpm electron:build
```
