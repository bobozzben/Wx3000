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

export interface Waccrep3101bParams {
  dllPath?: string;
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number;
  path?: string;
}

export const callWaccrep3101b = async (
  params: Waccrep3101bParams = {}
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

