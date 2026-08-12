import axios from 'axios';

export interface TaxOfficerItem {
  taxCode: string;
  taxName: string;
  taxBureau?: string;
  unit?: string;
  tel?: string;
  ext?: string;
  fax?: string;
  mobile?: string;
  email?: string;
  memo?: string;
}

export type TaxOfficerPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1050';

export const fetchTaxOfficers = async (keyword?: string): Promise<TaxOfficerItem[]> => {
  const response = await axios.get<TaxOfficerItem[]>(API_BASE, {
    params: { keyword },
  });
  return response.data;
};

export const getTaxOfficerList = fetchTaxOfficers;

export const fetchTaxOfficerByCode = async (code: string): Promise<TaxOfficerItem> => {
  const response = await axios.get<TaxOfficerItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const createTaxOfficer = async (item: TaxOfficerItem): Promise<TaxOfficerItem> => {
  const response = await axios.post<TaxOfficerItem>(API_BASE, item);
  return response.data;
};

export const updateTaxOfficer = async (
  code: string,
  item: TaxOfficerItem
): Promise<TaxOfficerItem> => {
  const response = await axios.put<TaxOfficerItem>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    item
  );
  return response.data;
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
}

export const fetchPrintTaxOfficers = async (
  query: PrintRangeQuery
): Promise<TaxOfficerItem[]> => {
  const response = await axios.post<TaxOfficerItem[]>(`${API_BASE}/print`, query);
  return response.data;
};

export const printTaxOfficerList = fetchPrintTaxOfficers;

export interface Waccrep3105bParams {
  dllPath?: string;
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number;
  path?: string;
}

export const callWaccrep3105b = async (
  params: Waccrep3105bParams = {}
): Promise<{ success: boolean; result: string; raw?: string; error?: string }> => {
  const response = await axios.post(
    'http://localhost:18889/report',
    {
      dllPath: params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
      hs_chk: params.hs_chk ?? 0.125,
      top_mag: params.top_mag ?? 0.0,
      left_mag: params.left_mag ?? 0.0,
      PrtIndex: params.PrtIndex ?? 0,
      IsPrint: params.IsPrint ?? 0,
      path: params.path ?? '',
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};
