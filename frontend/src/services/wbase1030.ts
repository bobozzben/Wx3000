import axios from 'axios';

export interface EmpItem {
  empCode: string;
  empName: string;
  depName?: string;
  mobile?: string;
  email?: string;
  oneUserId?: string;
  onePassNo?: string;
  tel?: string;
  address?: string;
  memo?: string;
}

export type EmpPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1030';

export const fetchEmps = async (keyword?: string): Promise<EmpItem[]> => {
  const response = await axios.get<EmpItem[]>(API_BASE, {
    params: { keyword },
  });
  return response.data;
};

export const getEmpList = fetchEmps;

export const fetchEmpByCode = async (code: string): Promise<EmpItem> => {
  const response = await axios.get<EmpItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const createEmp = async (item: EmpItem): Promise<EmpItem> => {
  const response = await axios.post<EmpItem>(API_BASE, item);
  return response.data;
};

export const updateEmp = async (code: string, item: EmpItem): Promise<EmpItem> => {
  const response = await axios.put<EmpItem>(`${API_BASE}/${encodeURIComponent(code)}`, item);
  return response.data;
};

export const deleteEmp = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
}

export const fetchPrintEmps = async (query: PrintRangeQuery): Promise<EmpItem[]> => {
  const response = await axios.post<EmpItem[]>(`${API_BASE}/print`, query);
  return response.data;
};

export const printEmpList = fetchPrintEmps;
