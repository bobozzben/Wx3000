import axios from 'axios';

const API_BASE = '/api/wbase1020';

export interface CpaItem {
  cpaCode: string;
  cpaName: string;
  licenseNo: string;
  officeName: string;
  tel: string;
  fax: string;
  address: string;
  memo: string;
  updatedAt?: string;
}

export interface CpaFormInput {
  cpaCode: string;
  cpaName: string;
  licenseNo: string;
  officeName: string;
  tel: string;
  fax: string;
  address: string;
  memo: string;
}

export interface CpaPrintFilter {
  cpaCodeStart: string;
  cpaCodeEnd: string;
}

export const getCpaList = async (keyword?: string): Promise<CpaItem[]> => {
  const res = await axios.get<CpaItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(res.data) ? res.data : [];
};

export const getCpaDetail = async (code: string): Promise<CpaItem> => {
  const res = await axios.get<CpaItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return res.data;
};

export const createCpa = async (input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.post<CpaItem>(API_BASE, input);
  return res.data;
};

export const updateCpa = async (code: string, input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.put<CpaItem>(`${API_BASE}/${encodeURIComponent(code)}`, input);
  return res.data;
};

export const deleteCpa = async (code: string): Promise<void> => {
  await axios.delete(`${API_BASE}/${encodeURIComponent(code)}`);
};

export const printCpaList = async (filter: CpaPrintFilter): Promise<CpaItem[]> => {
  const res = await axios.post<CpaItem[]>(`${API_BASE}/print`, filter);
  return res.data;
};
