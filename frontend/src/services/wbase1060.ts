import axios from 'axios';

export interface FeeItem {
  feeCode: string;   // 項目 (項目代號)
  feeName: string;   // 項目名稱
  price: number;     // 收費金額
  guid?: string;     // guid
}

export type FeeItemPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1060';

export const fetchFeeItems = async (keyword?: string): Promise<FeeItem[]> => {
  const response = await axios.get<FeeItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const getFeeItemList = fetchFeeItems;
export const getFeeItems = fetchFeeItems;

export const fetchFeeItemByCode = async (code: string): Promise<FeeItem> => {
  const response = await axios.get<FeeItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const sanitizeFeeItem = (item: FeeItem): FeeItem => ({
  ...item,
  feeCode: (item.feeCode || '').trim().toUpperCase(),
  feeName: (item.feeName || '').trim(),
  price: typeof item.price === 'number' ? (isNaN(item.price) ? 0 : item.price) : Number(item.price) || 0,
});

export const createFeeItem = async (item: FeeItem): Promise<FeeItem> => {
  const payload = sanitizeFeeItem(item);
  const response = await axios.post<FeeItem>(API_BASE, payload);
  return response.data;
};

export const updateFeeItem = async (
  code: string,
  item: FeeItem
): Promise<FeeItem> => {
  const payload = sanitizeFeeItem(item);
  const response = await axios.put<FeeItem>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    payload
  );
  return response.data;
};

export const deleteFeeItem = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveFeeItem = async (item: FeeItem, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeFeeItem(item);
    if (isNew) {
      await createFeeItem(payload);
    } else {
      await updateFeeItem(payload.feeCode, payload);
    }
    return true;
  } catch (e) {
    console.error('saveFeeItem error:', e);
    return false;
  }
};

export const batchSaveFeeItems = async (items: FeeItem[]): Promise<boolean> => {
  try {
    await axios.post(`${API_BASE}/batch-save`, items);
    return true;
  } catch (e) {
    console.error('batchSaveFeeItems error:', e);
    return false;
  }
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
}

export const fetchPrintFeeItems = async (
  query: PrintRangeQuery
): Promise<FeeItem[]> => {
  const response = await axios.post<FeeItem[]>(`${API_BASE}/print`, query);
  return response.data;
};

export const printFeeItemList = fetchPrintFeeItems;
export const fetchFeePrintData = fetchPrintFeeItems;

export interface Waccrep3106bParams {
  dllPath?: string;
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number;
  path?: string;
}

export const callWaccrep3106b = async (
  params: Waccrep3106bParams = {}
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

export const triggerFeeReportDll = callWaccrep3106b;
