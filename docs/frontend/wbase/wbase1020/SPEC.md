# 規格書：wbase1020 會計師/記帳士資料維護作業

> **模組代號**：`wbase1020`  
> **功能名稱**：會計師/記帳士資料維護作業 (上方 `FoxProGridCard` 瀏覽清單 + 下方即時聯動 `Wbase1020Form` + 報表列印)  
> **所屬模組**：`frontend/src/wbase/wbase1020/` & `backend/Controllers/Wbase1020Controller.cs`  
> **原始 Visual FoxPro 來源**：`SourS9BASE\LIBS\wbase.vcx` Class: `wbase1020` (對應地端 `C:\w3000\comm\cpa.dbf` ⇄ PostgreSQL `"c:/w3000/comm"."cpa"`)

---

## 1. 模組定位與職責

本模組為系統核心主檔維護作業之一，用於登錄、修改、刪除與列印事務所合作之會計師與記帳士基本資料。
具備以下功能特性：
1. **上下分割即時聯動佈局 (`index.tsx`)**：
   - **上半部 (`<FoxProGridCard />`)**：高對比瀏覽清單，支援 `↑`/`↓`/`PageUp`/`PageDown` 快速換筆與滑鼠滾輪防抖同步選取列 (`enableScrollSync`)。
   - **下半部 (`<Wbase1020Form />`)**：隨上方選取列即時同步顯示該筆會計師完整 15 個欄位資料；按 `Enter` / `F6` 進入編輯、`Ins` 進入新增。
2. **全鍵盤順序跳欄與防呆驗證 (`Wbase1020Form.tsx`)**：
   - 支援 **`Enter` / `↓` 順序下跳欄位**、`↑` 跳回上一欄位，聚焦時自動全選文字便於直接打字覆蓋。
   - **非阻斷式 Email 格式提示 (`isValidEmail`)**：若 `E-MAIL` 欄位格式非標準（如歷史舊資料填寫備註或無 `@`），於清單與表單顯示琥珀色 `⚠️ 格式` 提示徽章，但**不阻斷存檔**。
3. **列印預覽與原生 FastReport 輸出 (`wbase1020Print.tsx`)**：
   - 支援起訖代號區間篩選、瀏覽器預覽/CSV 匯出，以及透過 `LocalAgent` (`http://localhost:18889/report`) 呼叫 `wbaseRP.dll` (`waccrep3101_b`) 開啟原生報表預覽與列印。
4. **混合雲地 DBF 雙向同步 (`Wbase1020Controller.cs`)**：
   - 讀取前自動執行 `_dbfSyncService.EnsureTableSyncedAsync` 比對 `C:\w3000\comm\cpa.dbf` Checksum；新增/修改/刪除時優先寫入地端 `cpa.dbf` 再同步更新 PostgreSQL `"c:/w3000/comm"."cpa"`。

---

## 2. 檔案結構

```text
frontend/src/wbase/wbase1020/
├── index.tsx              # 主頁面進入點 (頂部工具列 + FoxProGridCard + Wbase1020Form + F2 搜尋彈窗)
├── Wbase1020Form.tsx      # 下方詳細資料表單組件 (全鍵盤順序跳欄 + Email 非阻斷格式提示)
├── wbase1020Print.tsx     # 列印區間設定、原生 DLL 報表呼叫與 CSV 輸出 Modal
└── useWbase1020.ts        # 狀態管理 Hook (CRUD、選取列同步、搜尋與確認對話框控制)

frontend/src/services/
├── wbase1020.ts           # Axios API Client 與 LocalAgent 報表呼叫
└── validation.ts          # isValidEmail 非阻斷式驗證工具

backend/
├── Controllers/
│   └── Wbase1020Controller.cs  # RESTful CRUD、Print Query 與 DbfSyncService 雙向同步
└── Models/
    └── CpaMaster.cs            # EF Core Entity (Schema: "c:/w3000/comm", Table: "cpa")
```

---

## 3. 資料庫與 DBF Schema 對照 (`c:/w3000/comm` . `cpa`)

| DBF / PG 欄位 | EF Core 屬性 (`CpaMaster`) | 前端屬性 (`CpaItem`) | 說明 |
| :--- | :--- | :--- | :--- |
| `no` | `CpaCode` (PK) | `cpaCode` | 會計師/記帳士代號 |
| `kind` | `CertType` | `certType` | 證書別 (1.會計師 2.記帳士 3.記帳及報稅代理人) |
| `name` | `CpaName` | `cpaName` | 姓名 |
| `id` | `TaxId` | `taxId` | 申報 ID (身分證統一編號) |
| `cno1` | `LicenseNo` | `licenseNo` | 證書年度或國稅別 |
| `cword` | `DocTrack` | `docTrack` | 發文字軌 |
| `cno2` | `CertNo` | `certNo` | 證書編號 |
| `tel` | `Tel` | `tel` | 電話 |
| `mobile` | `Mobile` | `mobile` | 手機 |
| `fax` | `Fax` | `fax` | 傳真 |
| `unino` | `UnifiedNo` | `unifiedNo` | 統一編號 (扣繳單位統一編號) |
| `addr` | `Address` | `address` | 事務所地址 |
| `hno1` | `GuildNo1` | `guildNo1` | 公會名稱 (登錄區域及國稅局別) |
| `hno2` | `GuildNo2` | `guildNo2` | 會員證號 (登錄字號) |
| `email` | `Email` | `email` | E-MAIL |
| `_record_number` | `RecordNumber` | - | DBF 實體記錄號 |

---

## 4. 鍵盤熱鍵對照表 (Hotkeys)

### 瀏覽模式 (`mode === 'browse'`)
- `↑` / `↓` / `PageUp` / `PageDown`：於上方 `FoxProGridCard` 上下切換選取列，下方表單即時同步預覽
- `Ins`：進入新增模式 (`startAdd`)，自動聚焦代號欄位
- `Enter` / `F6` / 雙擊列：進入編修模式 (`startEdit`)，自動聚焦下方表單第一個可編輯欄位
- `Del`：彈出刪除確認對話框（支援 `←` `→` 切換按鈕、`Enter`/`Y` 確認刪除）
- `F2`：開啟快速查詢彈窗 (`SearchModal`)
- `F7`：開啟列印設定視窗 (`Wbase1020Print`)
- `Esc`：退回 wbase 系統主選單

### 編輯/新增模式 (`mode === 'edit' | 'add'`)
- `Enter` / `↓`：依 `CPA_FIELDS_ORDERED` 順序跳至下一欄位；最後一欄 (`email`) 按 `Enter` 直接觸發儲存 (`saveForm`)
- `↑`：跳回上一欄位
- `F9` / `Ctrl+S`：立即儲存變更
- `Esc`：放棄變更並退回瀏覽模式，焦點自動回到上方清單
