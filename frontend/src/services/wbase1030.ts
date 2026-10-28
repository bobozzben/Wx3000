import axios from 'axios';
import { localagentApi } from './localagent';

export interface EmpItem {
  no: string;
  name: string;
  psw?: string;
  birthday?: string;
  tel?: string;
  id?: string;
  addr?: string;
  memo?: string;
  oneuserid?: string;
  onepassno?: string;
  phone?: string;
  email?: string;
  _record_number?: number;

  // 相容舊有別名 (Legacy Aliases)
  empCode?: string;
  empName?: string;
  depName?: string;
  mobile?: string;
  oneUserId?: string;
  onePassNo?: string;
  address?: string;
}

export const normalizeEmpItem = (raw: any): EmpItem => {
  if (!raw) {
    return {
      no: '',
      name: '',
      psw: '',
      birthday: '',
      tel: '',
      id: '',
      addr: '',
      memo: '',
      oneuserid: '',
      onepassno: '',
      phone: '',
      email: '',
      _record_number: 0,
      empCode: '',
      empName: '',
      depName: '',
      mobile: '',
      oneUserId: '',
      onePassNo: '',
      address: '',
    };
  }

  const no = (raw.no || raw.empCode || '').trim().toUpperCase();
  const name = (raw.name || raw.empName || '').trim();
  const psw = (raw.psw || '').trim();
  const birthday = (raw.birthday || '').trim();
  const tel = (raw.tel || '').trim();
  const id = (raw.id || '').trim();
  const addr = (raw.addr || raw.address || '').trim();
  const memo = (raw.memo || raw.depName || '').trim();
  const oneuserid = (raw.oneuserid || raw.oneUserId || '').trim();
  const onepassno = (raw.onepassno || raw.onePassNo || '').trim();
  const phone = (raw.phone || raw.mobile || '').trim();
  const email = (raw.email || '').trim();

  return {
    no,
    name,
    psw,
    birthday,
    tel,
    id,
    addr,
    memo,
    oneuserid,
    onepassno,
    phone,
    email,
    _record_number: raw._record_number || raw.recordNumber || 0,

    empCode: no,
    empName: name,
    depName: memo,
    mobile: phone,
    oneUserId: oneuserid,
    onePassNo: onepassno,
    address: addr,
  };
};

export const sanitizeEmpItemForSave = (item: EmpItem): any => {
  const norm = normalizeEmpItem(item);
  return {
    no: norm.no,
    name: norm.name,
    psw: norm.psw,
    birthday: norm.birthday,
    tel: norm.tel,
    id: norm.id,
    addr: norm.addr,
    memo: norm.memo,
    oneuserid: norm.oneuserid,
    onepassno: norm.onepassno,
    phone: norm.phone,
    email: norm.email,

    empCode: norm.no,
    empName: norm.name,
    mobile: norm.phone,
    depName: norm.memo,
    oneUserId: norm.oneuserid,
    onePassNo: norm.onepassno,
  };
};

export type EmpPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1030';

export const fetchEmps = async (keyword?: string): Promise<EmpItem[]> => {
  const response = await axios.get<any[]>(API_BASE, {
    params: { keyword },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeEmpItem) : [];
};

export const getEmpList = fetchEmps;

export const fetchEmpByCode = async (code: string): Promise<EmpItem> => {
  const response = await axios.get<any>(`${API_BASE}/${encodeURIComponent(code)}`);
  return normalizeEmpItem(response.data);
};

export const createEmp = async (item: EmpItem): Promise<EmpItem> => {
  const payload = sanitizeEmpItemForSave(item);
  const response = await axios.post<any>(API_BASE, payload);
  return normalizeEmpItem(response.data);
};

export const updateEmp = async (code: string, item: EmpItem): Promise<EmpItem> => {
  const cleanCode = (code || item.no || item.empCode || '').trim();
  const payload = sanitizeEmpItemForSave(item);
  const response = await axios.put<any>(`${API_BASE}/${encodeURIComponent(cleanCode)}`, payload);
  return normalizeEmpItem(response.data);
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
  empCodeStart?: string;
  empCodeEnd?: string;
}

export const fetchPrintEmps = async (query: PrintRangeQuery): Promise<EmpItem[]> => {
  const payload = {
    codeStart: query.codeStart || query.empCodeStart || '',
    codeEnd: query.codeEnd || query.empCodeEnd || '',
  };
  const response = await axios.post<any[]>(`${API_BASE}/print`, payload);
  return Array.isArray(response.data) ? response.data.map(normalizeEmpItem) : [];
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
  const payload = {
    dllPath: params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
    hs_chk: params.hs_chk ?? 0.125,
    top_mag: params.top_mag ?? 0.0,
    left_mag: params.left_mag ?? 0.0,
    PrtIndex: params.PrtIndex ?? 0,
    IsPrint: params.IsPrint ?? 0,
    path: params.path ?? '',
  };

  try {
    const response = await localagentApi.post('/report', payload, {
      timeout: 10000,
    });
    return response.data;
  } catch (err: any) {
    console.warn('POST /report failed, attempting fallback to POST /api/call...', err?.message);
    try {
      const fallbackRes = await localagentApi.post(
        '/api/call',
        {
          dll: 'wbaseRP',
          func: 'waccrep3101_b',
          args: [
            payload.hs_chk,
            payload.top_mag,
            payload.left_mag,
            payload.PrtIndex,
            payload.IsPrint,
            payload.path,
          ],
        },
        {
          timeout: 10000,
        }
      );
      return {
        success: fallbackRes.data?.success ?? true,
        result: String(fallbackRes.data?.retCode ?? '0'),
        raw: JSON.stringify(fallbackRes.data),
      };
    } catch (fallbackErr: any) {
      console.error('LocalAgent error:', fallbackErr);
      throw new Error(
        '無法連線至 LocalAgent 本地列印元件 (http://localhost:18889)，請確認 LocalAgent 服務已啟動。'
      );
    }
  }
};

export type Waccrep3106bParams = Waccrep3101bParams;
export const callWaccrep3106b = callWaccrep3101b;
