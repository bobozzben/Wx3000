# 規格書：wtaxop 進貨單盲打登錄作業模組

> **模組代號**：`wtaxop_po`  
> **功能名稱**：進貨單單據作業 (單據表頭表單 + 明細 AG Grid 全鍵盤盲打登錄)  
> **所屬模組**：`frontend/src/wtaxop/PurchaseOrder/` & `backend/Controllers/PurchaseController.cs`  
> **原始 Visual FoxPro 來源**：`SourSAXOP\LIBS\wtaxop.vcx` Class: `wtaxop_po`

---

## 1. 模組定位與職責

本模組為進銷存系統的單據登打作業雛型，專門為高熟練度打字人員設計。
進入方式：系統主選單按 `1` (營業稅申報系統，`routeTarget: 'purchase'`)，或點選頂部導覽列的「進貨單」頁籤，皆開啟 `PurchaseOrderPage`。
與 `wbase` 模組不同，本模組不讀寫 VFP DBF，資料只存於 PostgreSQL (見第 3 節)。

具備以下核心能力：
1. **上下結構 (表頭表單 + 明細 Grid)**：
   - 上半部 (`PurchaseOrderHeader.tsx`)：進貨單號、廠商代號、廠商名稱 (唯讀，自動帶出)、進貨日期。
     - 進貨單號預設為 `PI-yyyyMMdd` 加 3 位亂數，可直接修改。
     - 廠商代號按 `F2` 或點擊 `F2` 按鈕開啟「廠商主檔搜尋」(`SearchModal` + `searchVendors`)；離開欄位時以代號比對廠商，找不到時清空代號與名稱並跳出「廠商代號無效」提示。
   - 下半部 (`FoxProGridBill`)：明細列 Grid (項次、產品代號、品名、數量、單價、小計金額、備註)，初始為 15 列空白明細。
2. **無滑鼠全鍵盤連續輸入 (FoxProGridBill)**：
   - 於產品代號或品名欄按 `F4` 開啟「產品開窗搜尋」(`SearchModal` + `searchProducts`)，選取後帶入代號、品名、單價，數量為 0 時預設 1，並跳到數量欄編輯。
   - 直接輸入產品代號時以 `searchProducts` 比對完全相同的代號 (不分大小寫)，找到即帶入品名與單價；找不到時清空該列並跳出提示。
   - `Enter` / `Tab` 依序跳到下一個可編輯欄位；最後一列的最後一欄按下時自動新增下一明細列並聚焦第一欄。最後一列按 `↓` 也會新增明細列。
   - 數量或單價變更時自動計算小計 (`amount = qty × price`)，底部即時顯示總數量與總金額。
3. **存檔與其他操作**：
   - `F12` (焦點在明細 Grid 內) 或「[F12] 存檔進貨單」按鈕：廠商代號不可空白，且至少要有一筆產品代號非空白、數量大於 0 的明細；只送出有效明細並重新編排項次，總金額為有效明細小計合計。存檔成功後顯示訊息並清空表單 (`resetForm`)。
   - 「開新單據」按鈕：清空表單並產生新單號 (沒有對應熱鍵)。
   - `F9` (焦點在明細 Grid 內) 或「[F9] 查詢單據」按鈕：目前只跳出功能說明提示，尚未實作查詢。

---

## 2. 檔案結構

```text
frontend/src/wtaxop/PurchaseOrder/
├── PurchaseOrderHeader.tsx    # 單據頭部表單與廠商輸入組件 (F2 廠商開窗)
└── PurchaseOrderPage.tsx      # 進貨單頁面進入點 (整合表頭、明細 Grid、存檔與結果彈窗)

frontend/src/store/
└── usePurchaseStore.ts        # Zustand 單據狀態 Store (單號、廠商、日期、明細、resetForm)

frontend/src/services/
└── api.ts                     # 獨立 Axios 實例：searchProducts、searchVendors、savePurchaseOrder

frontend/src/components/
├── FoxProGridBill/
│   └── FoxProGridBill.tsx     # [核心組件] 單據明細 AG Grid 盲打驅動組件
└── FoxProGrid/
    ├── useFoxProKeyboard.ts   # 明細列全鍵盤 Enter 跳欄與熱鍵觸發 Hook (capture 階段)
    └── SearchModal.tsx        # 品號/廠商開窗搜尋對話框

backend/
├── Controllers/
│   ├── PurchaseController.cs  # 進貨單新增與查詢 API
│   ├── ProductsController.cs  # 產品快查 API
│   └── VendorsController.cs   # 廠商快查 API
├── DTOs/
│   └── CreatePurchaseOrderDto.cs  # 存檔 Request Body (CreatePurchaseOrderDto / CreatePurchaseLineDto)
├── Models/
│   ├── PurchaseHeader.cs      # 進貨單頭主檔 Entity
│   ├── PurchaseLine.cs        # 進貨單明細 Entity
│   ├── Product.cs             # 產品 Entity
│   └── Vendor.cs              # 廠商 Entity
```

---

## 3. 資料庫 Schema

以下 EF Core Entity 沒有指定 schema，不隨 `X-Data-Drive` 切換到 `<drive>:/w3000/comm`；`DbInitializer` 依 schema 建表的 SQL 也不包含這幾張表。前端 `services/api.ts` 使用獨立的 Axios 實例，請求不會帶 `X-Data-Drive`。

### `purchase_headers` (進貨單主檔，`PurchaseHeader`)
- `id` (PK, Identity)
- `bill_no` (字串，必填，唯一索引；如 `PI-20260805123`)
- `vendor_code` (字串，必填，廠商代號)
- `vendor_name` (字串，廠商名稱)
- `total` (`numeric(18,2)`，總金額)
- `created_at` (TIMESTAMP，後端以 `DateTime.UtcNow` 寫入)

### `purchase_lines` (進貨單明細，`PurchaseLine`)
- `id` (PK, Identity)
- `header_id` (FK 關聯 `purchase_headers.id`，刪除表頭時連動刪除)
- `line_no` (INT, 項次)
- `product_code` (字串，必填，品號)
- `product_name` (字串，品名)
- `qty` (`numeric(18,2)`，數量)
- `price` (`numeric(18,2)`，單價)
- `amount` (`numeric(18,2)`，金額 = 數量 × 單價，由前端計算)
- `remark` (字串，備註)

### `products` (產品，`Product`) / `vendors` (廠商，`Vendor`)
- `products`：`code` (PK)、`name`、`spec`、`price` (`numeric(18,2)`)、`stock` (`numeric(18,2)`)
- `vendors`：`code` (PK)、`name`

> 畫面上的進貨日期 (`purchaseDate`) 目前只存在前端 Store，不會送到後端，資料表也沒有對應欄位。

---

## 4. 熱鍵與導覽邏輯

| 熱鍵 / 操作 | 作用時機 | 觸發行為 (Behavior) |
| :--- | :--- | :--- |
| `F2` | 廠商代號輸入框 | 彈出廠商快查對話框，選擇後帶回代號與名稱 |
| `F2` | 明細 Grid | 進入目前儲存格編輯 |
| `F4` | 明細 Grid 的產品代號 / 品名欄 | 彈出產品快查對話框，選擇後帶回代號、品名、單價並跳到數量欄；其他欄位按 `F4` 則進入編輯 |
| `Enter` / `Tab` | 明細 Grid | 依序跳動焦點：產品代號 ➔ 品名 ➔ 數量 ➔ 單價 ➔ 備註 ➔ 下一列 (最後一列自動新增) |
| `↓` | 明細 Grid 最後一列 | 新增下一明細列並聚焦同一欄 |
| `F9` | 明細 Grid | 查詢單據 (目前只顯示提示訊息) |
| `F12` | 明細 Grid | 結束編輯、檢查單據完整性並呼叫 `POST /api/purchase` 存檔 |
| `↑` / `↓` / `Enter` / `Esc` | 快查對話框 | 選擇 / 帶回 / 關閉 (`F2` 亦可關閉) |

> 明細 Grid 底部提示列顯示的 `[F7] 列印` 目前沒有接上處理函式；本模組沒有刪除明細列的熱鍵。

### 後端 API

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| `POST` | `/api/purchase` | 以交易新增表頭與明細；單號空白或沒有明細回 400，失敗回 500；成功回 `{ success, id, billNo, message }` |
| `GET` | `/api/purchase` | 依建立時間倒序取最近 20 張單據 (含明細)；前端目前未使用 |
| `GET` | `/api/products/search?q=` | 代號或名稱包含關鍵字 (不分大小寫)，依代號排序取前 50 筆；`q` 空白時回前 50 筆 |
| `GET` | `/api/vendors/search?q=` | 同上，查詢廠商 |

---

## 5. 建置與驗證說明

```bash
# 前端專案編譯驗證
pnpm --filter frontend run build
```
