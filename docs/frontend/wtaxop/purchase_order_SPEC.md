# 規格書：wtaxop 進貨單盲打登錄作業模組

> **模組代號**：`wtaxop_po`  
> **功能名稱**：進貨單單據作業 (Header + Detail 雙 AG Grid 全鍵盤盲打登錄)  
> **所屬模組**：`frontend/src/wtaxop/PurchaseOrder/` & `backend/Controllers/PurchaseController.cs`  
> **原始 Visual FoxPro 來源**：`SourSAXOP\LIBS\wtaxop.vcx` Class: `wtaxop_po`

---

## 1. 模組定位與職責

本模組為進銷存系統的核心單據登打作業，專門為高熟練度打字人員設計。
具備以下核心能力：
1. **雙 Grid 上下結構 (Header + Line Items Grid)**：
   - 上半部：單據主檔資訊 (單號、日期、廠商代號、廠商名稱、備註)。
   - 下半部：明細列 Grid (品號、品名、規格、數量、單價、小計)。
2. **無滑鼠全鍵盤連續輸入 (FoxProGridBill)**：
   - 於明細列輸入品號時，輸入 `?` 或按 `F3` 自動跳出產品快查 Pop-up modal。
   - `Enter` 鍵於最後一個欄位 (單價/金額) 按下時，自動新增下一明細列並將焦點移至新品號欄。
   - 支援自動計算小計 (Subtotal) 與總金額 (Total Amount)。
3. **熱鍵快速操作**：
   - `F2`：開立新單據
   - `F3`：品號/廠商快查彈窗
   - `F8`：刪除當前明細列
   - `F9` 或 `Ctrl+S`：儲存單據
   - `F12`：整張單據列印/列印預覽

---

## 2. 檔案結構

```text
frontend/src/wtaxop/PurchaseOrder/
├── PurchaseOrderHeader.tsx    # 單據頭部表單與廠商輸入組件
├── PurchaseOrderPage.tsx      # 進貨單頁面進入點 (整合 Header & 明細 Grid)
└── usePurchaseStore.ts        # Zustand 單據狀態 Store (Header, Lines, 計算邏輯)

frontend/src/components/FoxProGridBill/
├── FoxProGridBill.tsx         # [核心組件] 單據 Header+Detail 雙 AG Grid 盲打驅動組件
├── useFoxProBillKeyboard.ts   # 明細列全鍵盤 Enter 跳欄與熱鍵觸發 Hook
└── SearchModal.tsx            # 品號/廠商開窗搜尋對話框

backend/
├── Controllers/
│   ├── PurchaseController.cs  # 進貨單 CRUD API
│   ├── ProductsController.cs  # 產品快查 API
│   └── VendorsController.cs   # 廠商快查 API
├── Models/
│   ├── PurchaseHeader.cs      # 進貨單頭主檔 Entity
│   ├── PurchaseLine.cs        # 進貨單明細 Entity
│   ├── Product.cs             # 產品 Entity
│   └── Vendor.cs              # 廠商 Entity
```

---

## 3. 資料庫 Schema

### `purchase_headers` (進貨單主檔)
- `id` (PK, AutoIncrement)
- `doc_no` (VARCHAR, 唯一單號, 如 `PO20260805001`)
- `doc_date` (DATE, 單據日期)
- `vendor_code` (VARCHAR, 廠商代號)
- `vendor_name` (VARCHAR, 廠商名稱)
- `total_amount` (DECIMAL, 總金額)
- `memo` (TEXT, 備註)
- `created_at` (TIMESTAMP)

### `purchase_lines` (進貨單明細)
- `id` (PK, AutoIncrement)
- `header_id` (FK 關聯 `purchase_headers.id`)
- `line_no` (INT, 項次)
- `product_code` (VARCHAR, 品號)
- `product_name` (VARCHAR, 品名)
- `spec` (VARCHAR, 規格)
- `quantity` (DECIMAL, 數量)
- `unit_price` (DECIMAL, 單價)
- `amount` (DECIMAL, 金額 = 數量 × 單價)

---

## 4. 熱鍵與導覽邏輯

| 熱鍵 / 操作 | 作用時機 | 觸發行為 (Behavior) |
| :--- | :--- | :--- |
| `F2` | 全域 | 清空表單，初始化開立一張全新進貨單據 |
| `F3` / `?` | 品號/廠商輸入框 | 彈出快查對話框，選擇後自動帶回代號與名稱 |
| `Enter` | 明細列欄位 | 依序跳動焦點：品號 ➔ 數量 ➔ 單價 ➔ 自動新增下一列 |
| `F8` / `Delete` | 明細列 Grid | 刪除當前選取之明細列並重新計算總金額 |
| `F9` / `Ctrl+S` | 全域 | 檢查單據完整性並發送 API 儲存至後端資料庫 |

---

## 5. 建置與驗證說明

```bash
# 前端專案編譯驗證
pnpm --filter frontend run build
```
