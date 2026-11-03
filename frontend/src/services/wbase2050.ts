import axios from 'axios';

/**
 * 2-5 總分支機構設定 (VFP base20.prg wbasemenu02cmd05 → wbase1.vcx wbase2050 / wbase2050f8)
 * 只用 customer.dbf：總機構 = tpay='1'；分支機構 = mainunino 等於總機構統編 (對應鍵是統編，不是客戶代號)
 */

/** 總機構列：mediatype / t401 為依 VFP 規則算出的值，dbMediatype / dbT401 為 DBF 原值 */
export interface HqItem {
  no: string;
  abbr: string;
  unino: string;
  tpay: string;
  tchk: string;      // 進銷項合併設定 1/2
  mediatype: string; // 進銷項媒體 (由 tchk 決定)
  t401: string;      // 申報書媒體 (固定 Y)
  tzero: string;     // 零稅率媒體 Y/N
  tflog: string;     // 固定資產退稅申報 Y/N
  tnot: string;      // 不得扣抵媒體 Y/N
  dbMediatype: string;
  dbT401: string;
  recordNumber: number;
}

export interface HqUpdate {
  tchk: string;
  tzero: string;
  tflog: string;
  tnot: string;
}

export interface Branch {
  no: string;
  abbr: string;
  unino: string;
  tpay: string;      // 彙總註記 (固定 2)
  mediatype: string; // 進銷項媒體 0~4
  t401: string;      // 申報書媒體 (固定 Y)
  tzero: string;
  tflog: string;
  tnot: string;
  mainunino: string;
  recordNumber: number;
}

/** 分公司資料維護格線的列：uid 為前端列識別；origNo 為載入時的代號 (新列為空白)，acceptedNo 為最後一次通過檢查的代號 */
export interface BranchRow extends Branch {
  uid: string;
  origNo: string;
  acceptedNo: string;
  /** 使用者已確認把掛在其他總機構下的客戶改掛到本總機構 */
  allowMove: boolean;
}

export interface BranchList {
  hq: HqItem;
  branches: Branch[];
}

export interface BranchSaveItem {
  no: string;
  origNo: string;
  mediatype: string;
  tzero: string;
  tflog: string;
  tnot: string;
  allowMove: boolean;
}

export interface BranchSaveItemResult {
  no: string;
  success: boolean;
  errorType?: string | null;
  message?: string | null;
}

export interface BranchSaveResult {
  success: boolean;
  results: BranchSaveItemResult[];
  branches: Branch[];
}

export interface CustomerPick {
  no: string;
  name: string;
  abbr: string;
  unino: string;
  tpay: string;
  mainunino: string;
  tzero: string;
  tnot: string;
  tflog: string;
}

// ---------------------------------------------------------------- 代碼 (標籤取自 VFP 畫面)

export const TCHK_MAP: Record<string, string> = {
  '1': '1.進銷項併總公司申報總繳',
  '2': '2.子公司各別申報併總公司總繳',
};

/** 分公司資料維護頂端的「進銷存合併方式」(VFP label2，文字與總機構清單的說明略有不同) */
export const TCHK_LABEL_MAP: Record<string, string> = {
  '1': '1.進銷存併總公司申報總繳',
  '2': '2.子公司各別申報併總公司總繳',
};

export const MEDIA_TYPE_MAP: Record<string, string> = {
  '0': '0.銷項',
  '1': '1.進項',
  '2': '2.進銷項',
  '3': '3.不媒體',
  '4': '4.(藍)進銷項',
};

/** 彙總註記 (VFP 客戶資料建檔 wbase2010n Label17) */
export const TPAY_MAP: Record<string, string> = {
  '0': '0.單一機構報繳',
  '1': '1.總機構彙總報繳',
  '2': '2.各單位(分支機構)分別申報',
};

/** 欄位說明列 (VFP flddesc，AfterRowColChange 依目前欄切換) */
export const FIELD_DESC: Record<string, string> = {
  tchk: '欄位說明：1.進銷項併總公司申報總繳 2.子公司各別申報併總公司總繳',
  tpay: '欄位說明：2.各單位(分支機構)分別申報',
  mediatype: '欄位說明：0.銷項 1.進項 2.進銷項 3.不媒體 4.(藍)進銷項',
  t401: '欄位說明：Y / N',
  tzero: '欄位說明：Y / N',
  tflog: '欄位說明：Y / N',
  tnot: '欄位說明：Y / N',
};

/** 總機構的進銷項媒體：2.子公司各別申報 → 3.不媒體，其他 (含空白) → 2.進銷項 (VFP base20.prg:462) */
export const hqMediatype = (tchk: string): string => (tchk === '2' ? '3' : '2');

/** 新分支的進銷項媒體與總機構相反：總機構 1.併總公司申報 → 3.不媒體，2.各別申報 → 2.進銷項 (VFP insert.Click) */
export const newBranchMediatype = (hqTchk: string): string => (hqTchk === '1' ? '3' : '2');

/** 總機構在離開畫面時要回寫：DBF 原值不符合「t401=Y、mediatype 由 tchk 決定」(VFP 關閉畫面時整批回寫) */
export const needsNormalize = (hq: HqItem): boolean => hq.dbMediatype !== hq.mediatype || hq.dbT401 !== hq.t401;

let uidSeq = 0;
export const toBranchRow = (b: Branch): BranchRow => ({
  ...b,
  uid: `b${++uidSeq}`,
  origNo: b.no,
  acceptedNo: b.no,
  allowMove: false,
});

export const newBranchRow = (hq: HqItem): BranchRow => ({
  uid: `b${++uidSeq}`,
  no: '',
  abbr: '',
  unino: '',
  tpay: '2',
  mediatype: newBranchMediatype(hq.tchk),
  t401: 'Y',
  tzero: '',
  tflog: '',
  tnot: '',
  mainunino: hq.unino,
  recordNumber: 0,
  origNo: '',
  acceptedNo: '',
  allowMove: false,
});

export const duplicateMessage = (code: string): string => `客戶代號 "${code}" 已重複，請重新輸入！`;

export type BranchCodeCheck =
  | { kind: 'ok'; customer: CustomerPick }
  | { kind: 'move'; customer: CustomerPick }
  | { kind: 'block'; message: string };

/**
 * 分支客戶代號檢查 (VFP 找不到就靜默忽略，其他都不檢查)：完全比對客戶代號；
 * 總機構本身與其他總機構 (tpay='1') 阻擋；已掛在其他總機構下的客戶要先確認才改掛
 */
export const checkBranchCode = (code: string, hq: HqItem, customers: CustomerPick[]): BranchCodeCheck => {
  const customer = customers.find((c) => c.no === code);
  if (!customer) return { kind: 'block', message: '查無此客戶代號' };
  if (customer.no === hq.no) return { kind: 'block', message: '不可將總機構本身設為分支機構' };
  if (customer.tpay === '1') return { kind: 'block', message: '該客戶為總機構，請先至客戶資料建檔修改彙總註記' };
  if (customer.mainunino && customer.mainunino !== hq.unino) return { kind: 'move', customer };
  return { kind: 'ok', customer };
};

/** 從 axios 錯誤取出後端訊息 */
export const apiErrorMessage = (err: any, fallback = '操作失敗'): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

// ---------------------------------------------------------------- API (預設 axios：全域攔截器會帶上 X-Data-Drive)

const API_BASE = '/api/wbase2050';
const hqPath = (no: string) => `${API_BASE}/headquarters/${encodeURIComponent(no)}`;

export const fetchHeadquarters = async (): Promise<HqItem[]> => {
  const res = await axios.get<HqItem[]>(`${API_BASE}/headquarters`);
  return Array.isArray(res.data) ? res.data : [];
};

export const updateHeadquarter = async (no: string, patch: HqUpdate): Promise<HqItem> =>
  (await axios.put<HqItem>(hqPath(no), patch)).data;

export const fetchBranches = async (hqNo: string): Promise<BranchList> =>
  (await axios.get<BranchList>(`${hqPath(hqNo)}/branches`)).data;

export const saveBranches = async (hqNo: string, branches: BranchSaveItem[]): Promise<BranchSaveResult> =>
  (await axios.put<BranchSaveResult>(`${hqPath(hqNo)}/branches`, { branches })).data;

export const deleteBranch = async (hqNo: string, branchNo: string): Promise<void> => {
  await axios.delete(`${hqPath(hqNo)}/branches/${encodeURIComponent(branchNo)}`);
};

export const fetchCustomers = async (keyword?: string): Promise<CustomerPick[]> => {
  const res = await axios.get<CustomerPick[]>(`${API_BASE}/customers`, { params: { keyword: keyword || '' } });
  return Array.isArray(res.data) ? res.data : [];
};
