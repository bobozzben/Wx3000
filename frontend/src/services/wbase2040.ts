import axios from 'axios';
import { checkRocDate } from './validation';
import { callWbaseReport, type WbaseReportParams, type WbaseReportResult } from './localagent';

/**
 * 2-4 客戶收費資料輸入 (VFP FORMS\recmom.scx「客戶收費金額登錄」)
 * recmom.dbf 收費單表頭 ⇄ recmod.dbf 收費明細 (以 recordNumber = DBF RECNO 定位)
 * 後端日期一律為 "yyyy-MM-dd"，畫面以民國 "yyy/mm/dd" 顯示與輸入
 */
export interface FeeReceipt {
  rno: string;       // 單號
  recdate: string;   // 請款日 (yyyy-MM-dd)
  cno: string;       // 客戶代號
  abbr: string;      // 客戶簡稱
  isover: string;    // 已收："*" 表示明細全部已收 (整張單唯讀)
  recman: string;    // 收款人 (VFP 存人員名稱)
  amt: number;       // 已收金額
  tax: number;
  sum: number;
  notamt: number;    // 未收金額
  note: string;      // 註記
  memo?: string | null; // 收據摘要 (清單不帶)
  recordNumber: number;
}

export interface FeeReceiptLine {
  recordNumber: number;
  rno: string;
  cno: string;
  recdate: string;
  money: number;   // 收費金額
  isover: string;  // 已收 "*"
  itemno: string;  // 收費項目
  item: string;    // 項目名稱
  note: string;    // 備註
  recman: string;
}

export interface FeeReceiptDetail {
  receipt: FeeReceipt;
  lines: FeeReceiptLine[];
  warning?: string | null;
  focusRecordNumber?: number | null;
}

/** 格線用的表頭列：請款日改以民國字串編輯 */
export interface FeeReceiptRow extends Omit<FeeReceipt, 'recdate'> {
  recdate: string; // 民國 yyy/mm/dd
}

export interface FeeReceiptLineRow extends FeeReceiptLine {}

export interface FeeCustomerLookup {
  no: string;
  abbr: string;
  name: string;
  recamt: number;
  rectime: string;
}

export interface FeeReceiptBatchRequest {
  recdate: string; // yyyy-MM-dd
  month: string;
  cycle: string;
  cnoFrom: string;
  cnoTo: string;
  force?: boolean;
}

export interface FeeReceiptBatchResult {
  created: number;
  firstRno: string;
  lastRno: string;
  message: string;
}

export interface FeeReceiptPrintRow {
  no: string;
  name: string;
  abbr: string;
  addr: string;
  unino: string;
  tel: string;
  fax: string;
  linkman: string;
  linktel: string;
  bkaddr: string;
  sbkaddr: string;
  haddr: string;
  invaddr: string;
  cusmemo: string;
  rno: string;
  recdate: string;
  recman: string;
  amt: number;
  mm: string;      // 收據摘要
  mmnote: string;  // 表頭註記
  doc: string;     // 共用說明
  itemno: string;
  item: string;
  money: number;
  note: string;
}

export interface FeeStatResult {
  items: { itemno: string; item: string }[];
  rows: { cno: string; abbr: string; amounts: Record<string, number> }[];
}

export interface ReceiptPrintQuery {
  dateFrom: string;
  dateTo: string;
  cnoFrom?: string;
  cnoTo?: string;
  rnoFrom?: string;
  rnoTo?: string;
  unpaidOnly?: boolean;
}

/** F7 排序名稱，對齊 VFP mysort：tag 1..7 */
export const SORT_LABELS = ['單號大', '單號小', '客戶', '日期大', '日期小', '客戶日期', '日期客戶'];

const API_BASE = '/api/wbase2040';

// ---------------------------------------------------------------- 日期轉換

/** "2025-03-12" → "114/03/12" */
export const isoToRoc = (iso?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${String(Number(m[1]) - 1911).padStart(3, '0')}/${m[2]}/${m[3]}`;
};

/** 民國 (或西元) 日期字串 → "yyyy-MM-dd"；不合法回傳 null */
export const rocToIso = (roc?: string | null): string | null => {
  const check = checkRocDate(roc);
  if (!check.valid || !check.normalized) return null;
  const [y, m, d] = check.normalized.split('/').map(Number);
  return `${y + 1911}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/** 檢查請款日輸入 (不允許空白，訊息改為請款日) */
export const checkReceiptDate = (val: string, label = '請款日'): { valid: boolean; message: string; normalized?: string } => {
  if (!val.trim()) return { valid: false, message: `${label}不可空白` };
  const check = checkRocDate(val);
  if (!check.valid) return { valid: false, message: check.message.replace('生日日期', label).replace('生日', label) };
  return { valid: true, message: '', normalized: check.normalized };
};

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const toReceiptRow = (r: FeeReceipt): FeeReceiptRow => ({ ...r, recdate: isoToRoc(r.recdate) });

/** 從 axios 錯誤取出後端訊息 */
export const apiErrorMessage = (err: any, fallback = '操作失敗'): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

// ---------------------------------------------------------------- 表頭

export const fetchReceipts = async (sort: number): Promise<FeeReceipt[]> => {
  const res = await axios.get<FeeReceipt[]>(API_BASE, { params: { sort } });
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchReceiptDetail = async (rno: string): Promise<FeeReceiptDetail> =>
  (await axios.get<FeeReceiptDetail>(`${API_BASE}/${encodeURIComponent(rno)}`)).data;

export const createReceipt = async (): Promise<FeeReceiptDetail> =>
  (await axios.post<FeeReceiptDetail>(API_BASE)).data;

export interface FeeReceiptUpdate {
  recdate?: string; // yyyy-MM-dd
  cno?: string;
  recman?: string;
  note?: string;
  memo?: string;
}

export const updateReceipt = async (rno: string, patch: FeeReceiptUpdate): Promise<FeeReceiptDetail> =>
  (await axios.put<FeeReceiptDetail>(`${API_BASE}/${encodeURIComponent(rno)}`, patch)).data;

export const renameReceipt = async (rno: string, newRno: string): Promise<FeeReceiptDetail> =>
  (await axios.put<FeeReceiptDetail>(`${API_BASE}/${encodeURIComponent(rno)}/rename`, { newRno })).data;

export const deleteReceipt = async (rno: string): Promise<void> => {
  await axios.delete(`${API_BASE}/${encodeURIComponent(rno)}`);
};

// ---------------------------------------------------------------- 明細

const linePath = (rno: string, recno?: number) =>
  `${API_BASE}/${encodeURIComponent(rno)}/lines${recno !== undefined ? `/${recno}` : ''}`;

export const createReceiptLine = async (rno: string): Promise<FeeReceiptDetail> =>
  (await axios.post<FeeReceiptDetail>(linePath(rno))).data;

export interface FeeReceiptLineUpdate {
  itemno?: string;
  item?: string;
  money?: number;
  note?: string;
}

export const updateReceiptLine = async (rno: string, recno: number, patch: FeeReceiptLineUpdate): Promise<FeeReceiptDetail> =>
  (await axios.put<FeeReceiptDetail>(linePath(rno, recno), patch)).data;

export const toggleReceiptLinePaid = async (rno: string, recno: number): Promise<FeeReceiptDetail> =>
  (await axios.post<FeeReceiptDetail>(`${linePath(rno, recno)}/toggle-paid`)).data;

export const deleteReceiptLine = async (rno: string, recno: number): Promise<FeeReceiptDetail> =>
  (await axios.delete<FeeReceiptDetail>(linePath(rno, recno))).data;

export const recalcReceipt = async (rno: string): Promise<FeeReceiptDetail> =>
  (await axios.post<FeeReceiptDetail>(`${API_BASE}/${encodeURIComponent(rno)}/recalc`)).data;

// ---------------------------------------------------------------- 共用說明、批次、查詢

export const fetchSharedMemo = async (): Promise<string> =>
  (await axios.get<{ memo: string }>(`${API_BASE}/shared-memo`)).data.memo || '';

export const saveSharedMemo = async (memo: string): Promise<void> => {
  await axios.put(`${API_BASE}/shared-memo`, { memo });
};

export const batchCreateReceipts = async (req: FeeReceiptBatchRequest): Promise<FeeReceiptBatchResult> =>
  (await axios.post<FeeReceiptBatchResult>(`${API_BASE}/batch`, req)).data;

export const fetchCustomerLookup = async (keyword?: string): Promise<FeeCustomerLookup[]> => {
  const res = await axios.get<FeeCustomerLookup[]>(`${API_BASE}/lookup/customers`, { params: { keyword: keyword || '' } });
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchReceiptPrintRows = async (q: ReceiptPrintQuery): Promise<FeeReceiptPrintRow[]> =>
  (await axios.get<FeeReceiptPrintRow[]>(`${API_BASE}/print/receipts`, { params: q })).data;

export const fetchBillPrintRows = async (year: number, month: number, cnoFrom?: string, cnoTo?: string): Promise<FeeReceiptPrintRow[]> =>
  (await axios.get<FeeReceiptPrintRow[]>(`${API_BASE}/print/bill`, { params: { year, month, cnoFrom, cnoTo } })).data;

export const fetchFeeStats = async (dateFrom: string, dateTo: string, cnoFrom?: string, cnoTo?: string): Promise<FeeStatResult> =>
  (await axios.get<FeeStatResult>(`${API_BASE}/stats`, { params: { dateFrom, dateTo, cnoFrom, cnoTo } })).data;

// ---------------------------------------------------------------- DLL 報表 (wbaseRP.dll)

/** 事務所資料 (base.dbf)，印在收據與請款單頁首 */
export interface FeeOfficeInfo {
  name: string;
  taxNo: string;
  addr: string;
  tel: string;
  fax: string;
  boss: string;
}

export const fetchOfficeInfo = async (): Promise<FeeOfficeInfo> =>
  (await axios.get<FeeOfficeInfo>(`${API_BASE}/office`)).data;

/** wbase2040_receipt / wbase2040_bill 的 JSON 暫存檔：根物件帶事務所資料，data 為資料列 (欄位名同範本 MTable 欄位) */
const reportRoot = (office: FeeOfficeInfo, printDateRoc: string, data: Record<string, unknown>[]) => ({
  officeName: office.name,
  officeTaxNo: office.taxNo,
  officeAddr: office.addr,
  officeTel: office.tel,
  printDate: printDateRoc,
  data,
});

/** F4 收據列印 (VFP reccno.frx)：每張收費單一頁，資料列依單號排序 */
export const printReceiptReport = (
  rows: FeeReceiptPrintRow[],
  office: FeeOfficeInfo,
  printDateRoc: string,
  params: WbaseReportParams
): Promise<WbaseReportResult> =>
  callWbaseReport(
    'wbase2040_receipt',
    reportRoot(
      office,
      printDateRoc,
      rows.map((r) => ({
        單號: r.rno,
        請款日: isoToRoc(r.recdate),
        客戶編號: r.no,
        客戶名稱: r.name,
        客戶地址: r.addr,
        項目代號: r.itemno,
        項目名稱: r.item,
        金額: Number(r.money) || 0,
        備註: r.note,
        收據摘要: r.mm,
        共用說明: r.doc,
      }))
    ),
    params
  );

/** F6 請款單 (VFP recapy.frx)：每位客戶一頁，前期未收以「yyy年mm月 應收款:」一列表示 */
export const printBillReport = (
  rows: FeeReceiptPrintRow[],
  office: FeeOfficeInfo,
  printDateRoc: string,
  params: WbaseReportParams
): Promise<WbaseReportResult> =>
  callWbaseReport(
    'wbase2040_bill',
    reportRoot(
      office,
      printDateRoc,
      rows.map((r) => ({
        客戶編號: r.no,
        客戶名稱: r.name,
        客戶地址: r.addr,
        聯絡人: r.linkman,
        電話: r.tel,
        傳真: r.fax,
        單號: r.rno,
        日期: isoToRoc(r.recdate),
        項目名稱: r.item,
        金額: Number(r.money) || 0,
        備註: r.note,
        共用說明: r.doc,
      }))
    ),
    params
  );
