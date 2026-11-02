import axios from 'axios';
import { callWbaseListReport, type WbaseReportParams, type WbaseReportResult } from './localagent';

/**
 * taxno.dbf 7 個欄位名稱與抬頭定義:
 * "代號,姓名,單位,電話,助理人員,住址,備註"
 * "no,name,department,tel,helpman,addr,memo"
 */
export interface TaxOfficerItem {
  no: string;
  name: string;
  department?: string;
  tel?: string;
  helpman?: string;
  addr?: string;
  memo?: string;
  _record_number?: number;

  // 相容舊有別名 (Legacy Aliases)
  taxCode?: string;
  taxName?: string;
  taxBureau?: string;
  unit?: string;
  address?: string;
  ext?: string;
  fax?: string;
  mobile?: string;
  email?: string;
}

export const normalizeTaxOfficerItem = (raw: any): TaxOfficerItem => {
  if (!raw) {
    return {
      no: '',
      name: '',
      department: '',
      tel: '',
      helpman: '',
      addr: '',
      memo: '',
      _record_number: 0,
      taxCode: '',
      taxName: '',
      taxBureau: '',
      unit: '',
      address: '',
    };
  }

  const no = (raw.no || raw.taxCode || '').trim().toUpperCase();
  const name = (raw.name || raw.taxName || '').trim();
  const department = (raw.department || raw.unit || '').trim();
  const tel = (raw.tel || '').trim();
  const helpman = (raw.helpman || raw.taxBureau || '').trim();
  const addr = (raw.addr || raw.address || '').trim();
  const memo = (raw.memo || '').trim();

  return {
    no,
    name,
    department,
    tel,
    helpman,
    addr,
    memo,
    _record_number: raw._record_number || raw.recordNumber || 0,

    taxCode: no,
    taxName: name,
    taxBureau: helpman,
    unit: department,
    address: addr,
    ext: (raw.ext || '').trim(),
    fax: (raw.fax || '').trim(),
    mobile: (raw.mobile || '').trim(),
    email: (raw.email || '').trim(),
  };
};

export const sanitizeTaxOfficerItemForSave = (item: TaxOfficerItem): any => {
  const norm = normalizeTaxOfficerItem(item);
  return {
    no: norm.no,
    name: norm.name,
    department: norm.department,
    tel: norm.tel,
    helpman: norm.helpman,
    addr: norm.addr,
    memo: norm.memo,

    taxCode: norm.no,
    taxName: norm.name,
    taxBureau: norm.helpman,
    unit: norm.department,
    address: norm.addr,
  };
};

export type TaxOfficerPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1050';

export const fetchTaxOfficers = async (keyword?: string): Promise<TaxOfficerItem[]> => {
  const response = await axios.get<any[]>(API_BASE, {
    params: { keyword },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeTaxOfficerItem) : [];
};

export const getTaxOfficerList = fetchTaxOfficers;

export const fetchTaxOfficerByCode = async (code: string): Promise<TaxOfficerItem> => {
  const response = await axios.get<any>(`${API_BASE}/${encodeURIComponent(code)}`);
  return normalizeTaxOfficerItem(response.data);
};

export const createTaxOfficer = async (item: TaxOfficerItem): Promise<TaxOfficerItem> => {
  const payload = sanitizeTaxOfficerItemForSave(item);
  const response = await axios.post<any>(API_BASE, payload);
  return normalizeTaxOfficerItem(response.data);
};

export const updateTaxOfficer = async (
  code: string,
  item: TaxOfficerItem
): Promise<TaxOfficerItem> => {
  const cleanCode = (code || item.no || item.taxCode || '').trim();
  const payload = sanitizeTaxOfficerItemForSave(item);
  const response = await axios.put<any>(
    `${API_BASE}/${encodeURIComponent(cleanCode)}`,
    payload
  );
  return normalizeTaxOfficerItem(response.data);
};

export const deleteTaxOfficer = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
  taxCodeStart?: string;
  taxCodeEnd?: string;
}

export const fetchPrintTaxOfficers = async (
  query: PrintRangeQuery
): Promise<TaxOfficerItem[]> => {
  const response = await axios.post<any[]>(`${API_BASE}/print`, query);
  return Array.isArray(response.data) ? response.data.map(normalizeTaxOfficerItem) : [];
};

export const printTaxOfficerList = fetchPrintTaxOfficers;

export const callWbase1050Report = (
  rows: TaxOfficerItem[],
  params?: WbaseReportParams
): Promise<WbaseReportResult> =>
  callWbaseListReport(
    'wbase1050_taxno_list',
    rows.map((r) => ({ no: r.no, name: r.name, department: r.department, tel: r.tel, helpman: r.helpman, addr: r.addr, memo: r.memo })),
    params
  );
