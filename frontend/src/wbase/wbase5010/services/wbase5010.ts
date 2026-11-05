import axios from 'axios';
import type { XlsxFieldItem } from '../../../components/SelectXlsxField';
import type { WordMergeRequest } from '../../../services/localagent';
import type { OfficeInfo } from '../../../services/wbase1010';

const API_BASE = '/api/wbase5010';

export interface CustomerPrintItem {
  no: string;
  abbr: string;
  name: string;
  unino: string;
  taxno: string;
  hname: string;
  linkman: string;
  tel: string;
  mobile: string;
  fax: string;
  addr: string;
  invaddr: string;
  email: string;
  keyin: string;
  keyinna: string;
  orga: string;
  organame: string;
  pno: string;
  pnostd: string;
  offno: string;
  offno1: string;
  cpano: string;
  capital: number | null;
  serial: number | null;
  recordNumber: number | null;
  selected?: boolean;
}

export interface LabelCustomerItem {
  no: string;
  abbr: string;
  name: string;
  unino: string;
  hname: string;
  linkman: string;
  tel: string;
  addr: string;
  invaddr: string;
  prn: number;
  selected: boolean;
  recordNumber?: number | null;
}

export interface KeyinStatsItem {
  custNo: string;
  custName: string;
  unino: string;
  taxno: string;
  keyin: string;
  keyinna: string;
  tel: string;
  addr: string;
  pno: string;
}

export interface BusinessStatusItem {
  no: string;
  name: string;
  unino: string;
  taxno: string;
  hname: string;
  tel: string;
  addr: string;
  pno: string;
  capital: number | null;
  startMonth: string;
  endMonth: string;
}

export interface FinanceStatusItem {
  no: string;
  name: string;
  unino: string;
  taxno: string;
  capital: number | null;
  hname: string;
  tel: string;
  addr: string;
  pno: string;
  year: string;
}

export interface BsdescItem {
  seq: number;
  no: string;
  desc: string;
  sel: string;
  serial: number;
  recordNumber?: number | null;
}

export interface CustomerPrintQueryParams {
  startNo?: string;
  endNo?: string;
  reportType?: number; // 1: 基本資料, 2: 詳細資料
  addrType?: number;   // 1: 公司地址, 2: 聯絡地址, 3: 公司與聯絡地址
  groupType?: number;  // 1: 依客戶編號, 2: 依登打人員
  orderType?: number;  // 1: 客戶編號, 2: 統一編號, 3: 稅籍編號
  selectedNos?: string[];
}

export interface LabelPrintQueryParams {
  startNo?: string;
  endNo?: string;
  labelType?: number;     // 1: 磁片標籤, 2: 郵遞標籤
  layoutType?: number;    // 1: 橫式, 2: 直式
  addrType?: number;      // 1: 公司地址, 2: 聯絡地址
  recipientType?: number; // 1: 負責人, 2: 聯絡人
  copies?: number;
  startRow?: number;
  isA4?: boolean;
  isKaohsiungFormat?: boolean;
  items?: LabelCustomerItem[];
}

export interface KeyinStatsQueryParams {
  year?: string;
  startNo?: string;
  endNo?: string;
  startKeyin?: string;
  endKeyin?: string;
}

export interface BusinessStatusQueryParams {
  year?: string;
  startMonth?: string;
  endMonth?: string;
  startNo?: string;
  endNo?: string;
}

export interface FinanceStatusQueryParams {
  year?: string;
  startNo?: string;
  endNo?: string;
}

export interface BsdescBatchUpdatePayload {
  rpdate?: string;
  comphidno?: string;
  endyear?: string;
  items: BsdescItem[];
}

// =========================================================================
// API Services
// =========================================================================

export const fetchCustomers = async (keyword?: string): Promise<LabelCustomerItem[]> => {
  const resp = await axios.get<LabelCustomerItem[]>(`${API_BASE}/customers`, {
    params: { keyword: keyword || undefined },
  });
  return resp.data;
};

export const queryCustomerPrintData = async (
  query: CustomerPrintQueryParams
): Promise<CustomerPrintItem[]> => {
  const resp = await axios.post<CustomerPrintItem[]>(`${API_BASE}/print/customer-data`, query);
  return resp.data;
};

export const generateLabels = async (
  query: LabelPrintQueryParams
): Promise<LabelCustomerItem[]> => {
  const resp = await axios.post<LabelCustomerItem[]>(`${API_BASE}/print/labels`, query);
  return resp.data;
};

export const queryKeyinStats = async (
  query: KeyinStatsQueryParams
): Promise<KeyinStatsItem[]> => {
  const resp = await axios.post<KeyinStatsItem[]>(`${API_BASE}/print/keyin-stats`, query);
  return resp.data;
};

export const queryBusinessStatus = async (
  query: BusinessStatusQueryParams
): Promise<BusinessStatusItem[]> => {
  const resp = await axios.post<BusinessStatusItem[]>(`${API_BASE}/print/business-status`, query);
  return resp.data;
};

export const queryFinanceStatus = async (
  query: FinanceStatusQueryParams
): Promise<FinanceStatusItem[]> => {
  const resp = await axios.post<FinanceStatusItem[]>(`${API_BASE}/print/finance-status`, query);
  return resp.data;
};

export const fetchBsdescList = async (): Promise<BsdescItem[]> => {
  const resp = await axios.get<BsdescItem[]>(`${API_BASE}/bsdesc`);
  return resp.data;
};

export const createBsdesc = async (item: Partial<BsdescItem>): Promise<{ success: boolean; seq: number }> => {
  const resp = await axios.post<{ success: boolean; seq: number }>(`${API_BASE}/bsdesc`, item);
  return resp.data;
};

export const updateBsdesc = async (seq: number, item: Partial<BsdescItem>): Promise<{ success: boolean }> => {
  const resp = await axios.put<{ success: boolean }>(`${API_BASE}/bsdesc/${seq}`, item);
  return resp.data;
};

export const deleteBsdesc = async (seq: number): Promise<{ success: boolean }> => {
  const resp = await axios.delete<{ success: boolean }>(`${API_BASE}/bsdesc/${seq}`);
  return resp.data;
};

export const batchSaveBsdesc = async (payload: BsdescBatchUpdatePayload): Promise<{ success: boolean }> => {
  const resp = await axios.put<{ success: boolean }>(`${API_BASE}/bsdesc/batch`, payload);
  return resp.data;
};

// =========================================================================
// 5-6 委任書 Word 套印 (VFP wbs_rep2.F7 → gutil.prg Pap1 / decode_Pa1)
// =========================================================================

/** LocalAgent 的範本代號：<資料磁碟機>:\W3000\comm\wbase001.DOC */
export const BSDESC_WORD_TEMPLATE = 'bsdesc';

/**
 * wbase001.DOC 的巨集 (不含清單巨集 [THINGS]) 與抓不到資料時的假字串。
 * 委任人 (客戶) 的欄位在 VFP 來自 F7 先勾選的客戶 (wbase4000)，網頁版沒有這一步，一律用假字串。
 */
export const BSDESC_MACRO_LABELS: Record<string, string> = {
  NAME: '委任人名稱',
  HNAME: '委任人負責人',
  HIDNO: '委任人負責人身分證號',
  UNINO: '委任人統一編號',
  ADDR: '委任人地址',
  TEL: '委任人電話',
  COMPHNAME: '受委任人姓名',
  COMPHIDNO: '受委任人身分證字號',
  COMPNAME: '事務所名稱',
  COMPUNINO: '事務所統一編號',
  COMPADDR: '事務所地址',
  COMPTEL: '事務所電話',
  BKCNO1: '記帳士證書字號',
  BKCNO2: '台財證字號',
  BKCNO3: '國稅登字號',
  CNO2: '稅務代理人證號',
  RPDATE: '委任日期',
  ENGNAME: '委任人英文名稱',
  MEMO: '備註',
  MEMO01: '備註一',
  MEMO02: '備註二',
  MEMO03: '備註三',
  CAPITAL: '資本額',
  CAPITALBIG5: '資本額大寫',
  RECAMT: '記帳費',
  RECAMTBIG5: '記帳費大寫',
};

export const bsdescPlaceholder = (macro: string): string => `【${BSDESC_MACRO_LABELS[macro] ?? macro}】`;

const CHN_DIGITS = '○一二三四五六七八九';

/** VFP chin_chk(數字字串, '', .T.)：阿拉伯數字轉國字 (短式，例如 1→一、10→十、12→十二、20→二十、31→三十一) */
export const chinChkShort = (value: string): string => {
  const units = ['仟', '佰', '十', ''];
  const src = value.trim();
  let s = value.slice(0, 4).padStart(4, ' ');
  for (let i = 3; i >= 0 && s[i] === '0'; i--) s = `${s.slice(0, i)} ${s.slice(i + 1)}`;
  for (let i = s.indexOf('00'); i !== -1; i = s.indexOf('00')) s = `${s.slice(0, i)} ${s.slice(i + 1)}`;
  let out = '';
  for (let i = 0; i < 4; i++) {
    if (s[i] === ' ') continue;
    const d = Number(s[i]);
    out += (CHN_DIGITS[d] ?? '') + (d !== 0 ? units[i] : '');
  }
  const n = Number(src);
  return n >= 10 && n <= 19 ? out.slice(1) : out;
};

/**
 * VFP w_chin_date(委任日期)：PaserDate 拆年月日 → year100(年, 3) 民國年三碼 (兩碼且 0~33 視為 100 年後) → cyear 逐字轉國字；
 * 月、日以 chin_chk 轉國字。例如 "115/01/01" → "一一五 年 一 月 一 日 "、"09/12/31" → "一○九 年 十二 月 三十一 日 "
 */
export const rocDateToChinese = (rpdate: string): string => {
  const str = rpdate.trim();
  let yy: string;
  let mm: string;
  let dd: string;
  const parts = str.split('/');
  if (parts.length === 3) {
    [yy, mm, dd] = parts;
  } else {
    const digits = str.replace(/\//g, '');
    yy = digits.slice(0, Math.max(digits.length - 4, 0));
    mm = digits.slice(-4, -2);
    dd = digits.slice(-2);
  }
  yy = yy.trim();
  let year = '';
  if (yy) {
    let n = parseInt(yy, 10) || 0;
    if (yy.length <= 2 && n >= 0 && n <= 33) n += 100;
    year = `000${n}`.slice(-3).split('').map(ch => CHN_DIGITS[Number(ch)] ?? '').join('');
  }
  const num = (v: string) => String(parseInt(v, 10) || 0);
  return `${year} 年 ${chinChkShort(num(mm))} 月 ${chinChkShort(num(dd))} 日 `;
};

/**
 * F7 要列印的條文 (Word 的 [THINGS] 與網頁預覽共用)：指標 (sel) 不是空白的條文，依 seq 排序。
 * 同 VFP wbs_rep2.F7 的 SCAN FOR !EMPTY(sel) (bsdesc 以 seq 索引)。
 */
export const selectBsdescForPrint = (rows: BsdescItem[]): BsdescItem[] =>
  rows.filter(r => (r.sel ?? '').trim() !== '').sort((a, b) => a.seq - b.seq);

export interface BsdescWordInput {
  rows: BsdescItem[];
  rpdate: string;
  comphidno: string;
  /** GET /api/wbase1010/office 的結果；讀取失敗時傳 null，事務所欄位改用假字串 */
  office: OfficeInfo | null;
  drive: string;
}

/**
 * 組出 LocalAgent /api/office/word/merge 的內容。
 * - [THINGS]：selectBsdescForPrint 選出的條文 (與網頁預覽相同)，每筆 desc 去頭尾空白後一段 (同 VFP tmpdesc，但不截成 254 bytes)。
 * - 事務所 (受委任人) 欄位取 base.dbf：000A 名稱、000B 統編、0001 地址、0002 電話、0004 負責人 (VFP m.compname 等)。
 * - 負責人證號、委任日期取畫面表頭。其餘抓不到的資料 (含空白) 用假字串，方便在 Word 裡看出要補的地方。
 */
export const buildBsdescWordRequest = ({ rows, rpdate, comphidno, office, drive }: BsdescWordInput): WordMergeRequest => {
  const paragraphs = selectBsdescForPrint(rows).map(r => (r.desc ?? '').trim());

  // decode_Pa1 以 ALLTRIM 取值；[RPDATE] 照 w_chin_date 原樣 (結尾有一個空白)
  const known: Record<string, string> = {
    COMPHNAME: (office?.boss ?? '').trim(),
    COMPHIDNO: comphidno.trim(),
    COMPNAME: (office?.name ?? '').trim(),
    COMPUNINO: (office?.taxNo ?? '').trim(),
    COMPADDR: (office?.addr ?? '').trim(),
    COMPTEL: (office?.tel ?? '').trim(),
    RPDATE: rpdate.trim() ? rocDateToChinese(rpdate) : '',
  };
  const macros: Record<string, string> = {};
  for (const macro of Object.keys(BSDESC_MACRO_LABELS)) {
    macros[macro] = known[macro]?.trim() ? known[macro] : bsdescPlaceholder(macro);
  }
  return { template: BSDESC_WORD_TEMPLATE, drive, paragraphs, copies: [macros] };
};

// =========================================================================
// 通用動態 Excel 匯出輔助函式
// =========================================================================

export const exportReportToXlsx = async <T extends Record<string, any>>(
  data: T[],
  selectedFields: XlsxFieldItem[],
  fileName: string,
  sheetName: string = '報表'
): Promise<boolean> => {
  try {
    if (!data || data.length === 0) return false;

    const activeFields = selectedFields.filter(f => f.selected);
    if (activeFields.length === 0) return false;

    const exportRows = data.map((item, index) => {
      const rowObj: Record<string, any> = {};
      activeFields.forEach(field => {
        const title = field.customTitle || field.label;
        if (field.key === 'seq') {
          rowObj[title] = index + 1;
        } else {
          const val = item[field.key];
          rowObj[title] = val !== null && val !== undefined ? val : '';
        }
      });
      return rowObj;
    });

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(wb, finalFileName);
    return true;
  } catch (err) {
    console.error('exportReportToXlsx 失敗:', err);
    return false;
  }
};
