# 規格書：wbase1020 會計師/記帳士資料維護作業

> **模組代號**：`wbase1020`  
> **功能名稱**：會計師/記帳士資料維護作業 (上方 `<FoxProGridCard />` 瀏覽清單 + 下方即時聯動 `<Wbase1020Form />` + 台灣地址開窗選取 + 報表列印)  
> **所屬模組**：`frontend/src/wbase/wbase1020/` & `backend/Controllers/Wbase1020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1020` (對應地端 `<Drive>:\w3000\comm\cpa.dbf` ⇄ PostgreSQL `<drive>:/w3000/comm` . `"cpa"`)

---

## 1. 模組定位與職責

本模組為系統核心主檔維護作業之一，用於登錄、修改、刪除與列印事務所合作之會計師與記帳士基本資料。
具備以下功能特性：
1. **上下分割即時聯動佈局 (`index.tsx`)**：
   - **頂部標題列 (`<WbasePageHeader />`)**：統一提供 `Ins` 新增、`F6` 修改、`Del` 刪除、`F2` 查詢、`F7` 列印與 `Esc` 離開操作按鈕。
   - **上半部 (`<FoxProGridCard />`)**：高對比瀏覽清單（含欄寬拖曳記憶 `gridId="wbase1020"`），支援 `↑`/`↓`/`PageUp`/`PageDown` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`)。
   - **下半部 (`<Wbase1020Form />`)**：隨上方選取列即時同步顯示該筆會計師完整 15 個欄位資料；按 `Enter` / `F6` 進入編輯、`Ins` 進入新增（自動以 `getNextAutoNo` 計算下一個代號）。
2. **全鍵盤順序跳欄、開窗選取與防呆驗證 (`Wbase1020Form.tsx` + `useFoxProCardNavigation`)**：
   - 支援 **`Enter` / `↓` 順序下跳欄位**、`↑` 跳回上一欄位，聚焦時自動全選文字 (`foxProFocusAndSelect`) 便於直接打字覆蓋。
   - **發文字軌開窗輔助 (`DOC_TRACK_SUGGESTIONS`)**：當證書別 (`certType`) 為 `2`（記帳士）或 `3`（記帳及報稅代理人）時，`docTrack` 欄位可按 `F2` 或點擊 `...` 開啟常用字軌選單（`台財稅登字`、`台財稅証字`、`全記登字`）。
   - **台灣地址智慧選取 (`<AddressSelectModal />`)**：於事務所地址 (`address`) 欄位按 `F2` / `F4` 或點擊 `...` 按鈕開啟縣市/鄉鎮區/路名智慧組合選取器。
   - **欄位級別檢核 (`validation.ts`)**：
     - `checkCertType`：證書別僅允許 `1`、`2`、`3` 或空白。
     - `checkTaxId`：申報 ID 身分證號檢核（支援阻斷錯誤或非阻斷警告）。
     - `checkUnifiedNo`：8 碼扣繳單位統一編號檢核。
     - `checkBig5Compatible`：檢查姓名/地址是否含 Big5 罕見字（防止寫入 VFP DBF 變 `?`）。
     - `isValidEmail`：非阻斷式 Email 格式提示徽章（`⚠️ 格式`），不阻斷舊資料存檔。
3. **列印預覽、純元素列印與原生 FastReport 輸出 (`wbase1020Print.tsx` + `<FoxProPrintModal />`)**：
   - 支援起訖代號區間篩選、瀏覽器純表格預覽列印 (`printElementById`)、動態欄位勾選 Excel 匯出 (`<FormUtilSelectXlsxFieldsList />`)，以及透過 `LocalAgent` (`http://localhost:18889/report`) 呼叫 `wbaseRP.dll` (`waccrep3101_b`) 開啟原生報表預覽與直印。
4. **混合雲地 DBF 雙向同步 (`Wbase1020Controller.cs`)**：
   - 讀取前自動執行 `_dbfSyncService.EnsureTableSyncedAsync` 比對 `<Drive>:\w3000\comm\cpa.dbf` Checksum；新增/修改/刪除時優先寫入地端 `cpa.dbf` 再同步更新 PostgreSQL `"cpa"`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1020/
├── index.tsx              # 主頁面進入點 (WbasePageHeader + FoxProGridCard + Wbase1020Form + F2 SearchModal)
├── Wbase1020Form.tsx      # 下方詳細資料表單組件 (useFoxProCardNavigation + AddressSelectModal + 字軌 F2 開窗)
├── wbase1020Print.tsx     # FoxProPrintModal 列印區間設定、原生 DLL 報表呼叫與動態欄位 Excel 匯出
└── useWbase1020.ts        # 狀態管理 Hook (CRUD、自動編號 getNextAutoNo、選取列同步、搜尋與確認對話框)

frontend/src/services/
├── wbase1020.ts           # Axios API Client 與 LocalAgent 報表呼叫
├── addressService.ts      # 台灣地址解析與路名檢索服務
└── validation.ts          # checkCertType, checkTaxId, checkUnifiedNo, checkBig5Compatible, isValidEmail

backend/
├── Controllers/
│   └── Wbase1020Controller.cs  # RESTful CRUD、Print Query 與 DbfSyncService 雙向同步
└── Models/
    └── CpaMaster.cs            # EF Core Entity (Table: "cpa", 動態對應當前資料磁碟 Schema)
```

---

## 3. 資料庫與 DBF Schema 對照 (`<drive>:/w3000/comm` . `cpa`)

| DBF / PG 欄位 | EF Core 屬性 (`CpaMaster`) | 前端屬性 (`CpaItem`) | 長度限制 (Bytes) | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| `no` | `CpaCode` (PK) | `cpaCode` | `4` | 會計師/記帳士代號 |
| `kind` | `CertType` | `certType` | `1` | 證書別 (`1`.會計師 `2`.記帳士 `3`.記帳及報稅代理人) |
| `name` | `CpaName` | `cpaName` | `12` | 姓名 |
| `id` | `TaxId` | `taxId` | `10` | 申報 ID (身分證統一編號) |
| `cno1` | `LicenseNo` | `licenseNo` | `6` | 證書年度或國稅別 |
| `cword` | `DocTrack` | `docTrack` | `10` | 發文字軌 (`certType` 為 `2`/`3` 時可按 `F2` 開窗選取) |
| `cno2` | `CertNo` | `certNo` | `6` | 證書編號 |
| `tel` | `Tel` | `tel` | `15` | 電話 |
| `mobile` | `Mobile` | `mobile` | `15` | 手機 |
| `fax` | `Fax` | `fax` | `15` | 傳真 |
| `unino` | `UnifiedNo` | `unifiedNo` | `8` | 統一編號 (扣繳單位統一編號) |
| `addr` | `Address` | `address` | `50` | 事務所地址 (支援 `F2`/`F4` 台灣地址選取器) |
| `hno1` | `GuildNo1` | `guildNo1` | `16` | 登錄區域及國稅局別 (公會名稱) |
| `hno2` | `GuildNo2` | `guildNo2` | `16` | 登錄字號 (會員證號) |
| `email` | `Email` | `email` | `60` | E-MAIL |
| `_record_number` | `RecordNumber` | - | - | DBF 實體記錄號 |

---

## 4. 鍵盤熱鍵對照表 (Hotkeys)

### 瀏覽模式 (`mode === 'browse'`)
- `↑` / `↓` / `PageUp` / `PageDown`：於上方 `FoxProGridCard` 上下切換選取列，下方表單即時同步預覽
- `Ins`：進入新增模式 (`startAdd`)，自動填入下一個可用代號並聚焦姓名欄位
- `Enter` / `F6` / 雙擊列：進入編修模式 (`startEdit`)，自動聚焦下方表單第一個可編輯欄位
- `Del`：彈出刪除確認對話框（支援 `←` `→` 切換按鈕、`Enter`/`Y` 確認刪除）
- `F2`：開啟快速查詢彈窗 (`SearchModal`)
- `F7`：開啟列印設定視窗 (`Wbase1020Print`)
- `Esc`：退回 wbase 系統主選單

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter` / `↓`：依 `CPA_FIELDS_ORDERED` 順序跳至下一欄位（自動跳過唯讀/停用欄位）；最後一欄 (`email`) 按 `Enter` 直接觸發儲存 (`saveForm`)
- `↑`：跳回上一欄位
- `F2` / `F4`：於 `docTrack` 開啟字軌選單，或於 `address` 開啟 `<AddressSelectModal />` 台灣地址選取器
- `F9` / `Ctrl+S`：立即儲存變更
- `Esc`：放棄變更並退回瀏覽模式，焦點自動回到上方清單
