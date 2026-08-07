import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/wbase1020`
  : 'http://localhost:5007/api/wbase1020';

const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return '/api/wbase1020';
  }
  return API_BASE;
};

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
  const res = await axios.get<CpaItem[]>(getApiUrl(), {
    params: { keyword: keyword || '' },
  });
  return res.data;
};

export const getCpaDetail = async (code: string): Promise<CpaItem> => {
  const res = await axios.get<CpaItem>(`${getApiUrl()}/${encodeURIComponent(code)}`);
  return res.data;
};

export const createCpa = async (input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.post<CpaItem>(getApiUrl(), input);
  return res.data;
};

export const updateCpa = async (code: string, input: CpaFormInput): Promise<CpaItem> => {
  const res = await axios.put<CpaItem>(`${getApiUrl()}/${encodeURIComponent(code)}`, input);
  return res.data;
};

export const deleteCpa = async (code: string): Promise<void> => {
  await axios.delete(`${getApiUrl()}/${encodeURIComponent(code)}`);
};

export const printCpaList = async (filter: CpaPrintFilter): Promise<CpaItem[]> => {
  const res = await axios.post<CpaItem[]>(`${getApiUrl()}/print`, filter);
  return res.data;
};
