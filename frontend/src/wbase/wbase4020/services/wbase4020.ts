import { api } from '../../../services/api';
import { checkBig5Compatible, truncateBig5 } from '../../../services/validation';

export { checkBig5Compatible, truncateBig5 };

// ============================================================================
// Interfaces
// ============================================================================

export interface CustomerTaxItem {
  no: string;
  abbr: string;
  name: string;
  bydno: string;
  bycno: string;
  bybkdno: string;
  bybkcno: string;
  sadno: string;
  sacno: string;
  sabkdno: string;
  sabkcno: string;
  casaccno: string;
  mediatype: string;
  t401: string;
  fileno: string;
  tpay: string;
  mainunino: string;
  monthv: string;
  serial?: number;
  recordNumber?: number;
  _record_number?: number;
}

export interface CustomerVoucherItem {
  no: string;
  abbr: string;
  name: string;
  monthv: string;
  mediatype: string;
  trantype: string;
  trankind: string;
  trandate: number;
  trantypeb: string;
  trankindb: string;
  trandateb: number;
  fileno: string;
  tpay: string;
  serial?: number;
  recordNumber?: number;
  _record_number?: number;
}

export interface AccParaTax {
  bydno: string;
  bycno: string;
  bybkdno: string;
  bybkcno: string;
  sadno: string;
  sacno: string;
  sabkdno: string;
  sabkcno: string;
  casaccno: string;
}

export interface AccParaVoucher {
  smMonthv: string;
  smMedia: string;
  smType: string;
  smKind: string;
  smDate: number;
  smTypeb: string;
  smKindb: string;
  smDateb: number;
}

export interface AccStItem {
  no: string;
  name: string;
  stock: string;
  acctype: string;
  serial?: number;
  recordNumber?: number;
  _record_number?: number;
}

export interface DescripItem {
  accno: string;
  descrip: string;
  serial?: number;
  recordNumber?: number;
  _record_number?: number;
}

export interface PubParaItem {
  qqsel: string;
}

export interface AccountOption {
  accno: string;
  accname: string;
  dept?: string;
  taxcode?: string;
}

// ============================================================================
// Code Maps & Labels (對齊 FoxPro 原生規格)
// ============================================================================

export const MEDIA_TYPE_MAP: Record<string, string> = {
  '0': '0.銷項',
  '1': '1.進項',
  '2': '2.進銷項',
  '3': '3.不媒體',
  '4': '4.(藍)進銷項',
};

export const TPAY_MAP: Record<string, string> = {
  '0': '0.無總繳',
  '1': '1.總機構總繳',
  '2': '2.分支機構由總機構總繳',
};

export const MONTHV_MAP: Record<string, string> = {
  '0': '0.每期',
  '1': '1.每月',
};

export const TRAN_TYPE_MAP: Record<string, string> = {
  '1': '1.逐筆',
  '2': '2.同一天合併',
  '3': '3.多天合併',
  '4': '4.逐筆切傳票(分開)',
  '5': '5.多天逐筆',
  '6': '6.單筆',
  '9': '9.不轉檔',
};

export const TRAN_KIND_MAP: Record<string, string> = {
  '1': '1.多種科目',
  '2': '2.單一科目',
};

export const STOCK_MODE_MAP: Record<string, string> = {
  'A': 'A.由進銷存檔計算',
  'B': 'B.自行輸入期末金額',
  'C': 'C.自行輸入期末傳票',
};

export const ACCTYPE_MAP: Record<string, string> = {
  'A': 'A.標準會計',
  'B': 'B.非歷年制',
  'C': 'C.營造業',
  'D': 'D.建設業',
};

export const QQSEL_MAP: Record<string, string> = {
  '0': '0.開窗選單模式',
  '1': '1.自行輸入代號模式',
};

// ============================================================================
// API Calls
// ============================================================================

// 4-2 營業稅設定
export const fetchCustomerTaxList = async (keyword?: string): Promise<CustomerTaxItem[]> => {
  const params = keyword ? { keyword } : {};
  const res = await api.get<CustomerTaxItem[]>('/api/wbase4020/taxop', { params });
  return res.data;
};

export const updateCustomerTax = async (no: string, item: CustomerTaxItem): Promise<void> => {
  await api.put(`/api/wbase4020/taxop/${encodeURIComponent(no)}`, item);
};

export const applyDefaultTaxAccounts = async (no: string): Promise<CustomerTaxItem> => {
  const res = await api.post(`/api/wbase4020/taxop/apply-default/${encodeURIComponent(no)}`);
  return res.data;
};

export const fetchAccParaTaxAccounts = async (): Promise<AccParaTax> => {
  const res = await api.get<AccParaTax>('/api/wbase4020/accpara/tax-accounts');
  return res.data;
};

export const updateAccParaTaxAccounts = async (data: AccParaTax): Promise<void> => {
  await api.put('/api/wbase4020/accpara/tax-accounts', data);
};

// 4-3 營業稅傳票轉檔設定
export const fetchCustomerVoucherList = async (keyword?: string): Promise<CustomerVoucherItem[]> => {
  const params = keyword ? { keyword } : {};
  const res = await api.get<CustomerVoucherItem[]>('/api/wbase4020/voucher', { params });
  return res.data;
};

export const updateCustomerVoucher = async (no: string, item: CustomerVoucherItem): Promise<void> => {
  await api.put(`/api/wbase4020/voucher/${encodeURIComponent(no)}`, item);
};

export const applyDefaultVoucherParams = async (no: string): Promise<CustomerVoucherItem> => {
  const res = await api.post(`/api/wbase4020/voucher/apply-default/${encodeURIComponent(no)}`);
  return res.data;
};

export const fetchAccParaVoucherParams = async (): Promise<AccParaVoucher> => {
  const res = await api.get<AccParaVoucher>('/api/wbase4020/accpara/voucher-params');
  return res.data;
};

export const updateAccParaVoucherParams = async (data: AccParaVoucher): Promise<void> => {
  await api.put('/api/wbase4020/accpara/voucher-params', data);
};

// 4-4 期末存貨計算方式 / 進銷存方式設定
export const fetchStockModeList = async (keyword?: string): Promise<AccStItem[]> => {
  const params = keyword ? { keyword } : {};
  const res = await api.get<AccStItem[]>('/api/wbase4020/stock-mode', { params });
  return res.data;
};

export const updateStockMode = async (no: string, item: AccStItem): Promise<void> => {
  await api.put(`/api/wbase4020/stock-mode/${encodeURIComponent(no)}`, item);
};

// 4-5 共用會計科目摘要
export const fetchDescripAccounts = async (keyword?: string): Promise<AccountOption[]> => {
  const params = keyword ? { keyword } : {};
  const res = await api.get<AccountOption[]>('/api/wbase4020/descrip/accounts', { params });
  return res.data;
};

export const fetchDescripList = async (accno?: string): Promise<DescripItem[]> => {
  const params = accno ? { accno } : {};
  const res = await api.get<DescripItem[]>('/api/wbase4020/descrip', { params });
  return res.data;
};

export const createDescrip = async (item: Partial<DescripItem>): Promise<DescripItem> => {
  const res = await api.post<DescripItem>('/api/wbase4020/descrip', item);
  return res.data;
};

export const updateDescrip = async (recno: number, item: Partial<DescripItem>): Promise<void> => {
  await api.put(`/api/wbase4020/descrip/${recno}`, item);
};

export const deleteDescrip = async (recno: number): Promise<void> => {
  await api.delete(`/api/wbase4020/descrip/${recno}`);
};

export const swapDescripOrder = async (
  recno1: number,
  serial1: number,
  recno2: number,
  serial2: number
): Promise<void> => {
  await api.post('/api/wbase4020/descrip/swap-order', {
    recno1,
    serial1,
    recno2,
    serial2,
  });
};

// 4-6 共用參數設定
export const fetchPubPara = async (): Promise<PubParaItem> => {
  const res = await api.get<PubParaItem>('/api/wbase4020/pub-para');
  return res.data;
};

export const updatePubPara = async (data: PubParaItem): Promise<void> => {
  await api.put('/api/wbase4020/pub-para', data);
};
