import axios from 'axios';

/**
 * recitem.dbf 3 個欄位名稱與抬頭定義:
 * "項目,項目名稱,收費金額"
 * "itemno,item,amt"
 */
export interface FeeItem {
  itemno: string;   // 項目
  item: string;     // 項目名稱
  amt: number;      // 收費金額
  _record_number?: number;
  guid?: string;

  // 相容舊有別名 (Legacy Aliases)
  feeCode?: string; // 項目代號
  feeName?: string; // 項目名稱
  price?: number;   // 收費金額
}

export const normalizeFeeItem = (raw: any): FeeItem => {
  if (!raw) {
    return {
      itemno: '',
      item: '',
      amt: 0,
      feeCode: '',
      feeName: '',
      price: 0,
    };
  }

  const itemno = (raw.itemno || raw.feeCode || '').trim().toUpperCase();
  const item = (raw.item || raw.feeName || '').trim();
  const amtVal = raw.amt !== undefined ? raw.amt : raw.price;
  const amt = typeof amtVal === 'number' ? (isNaN(amtVal) ? 0 : amtVal) : Number(amtVal) || 0;

  return {
    itemno,
    item,
    amt,
    _record_number: raw._record_number || raw.recordNumber || 0,
    guid: raw.guid || '',

    feeCode: itemno,
    feeName: item,
    price: amt,
  };
};

export const sanitizeFeeItemForSave = (item: FeeItem): any => {
  const norm = normalizeFeeItem(item);
  return {
    itemno: norm.itemno,
    item: norm.item,
    amt: norm.amt,

    feeCode: norm.itemno,
    feeName: norm.item,
    price: norm.amt,
    guid: norm.guid,
  };
};

export const sanitizeFeeItem = sanitizeFeeItemForSave;

export type FeeItemPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1060';

export const fetchFeeItems = async (keyword?: string): Promise<FeeItem[]> => {
  const response = await axios.get<any[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeFeeItem) : [];
};

export const getFeeItemList = fetchFeeItems;
export const getFeeItems = fetchFeeItems;

export const fetchFeeItemByCode = async (code: string): Promise<FeeItem> => {
  const response = await axios.get<any>(`${API_BASE}/${encodeURIComponent(code)}`);
  return normalizeFeeItem(response.data);
};

export const createFeeItem = async (item: FeeItem): Promise<FeeItem> => {
  const payload = sanitizeFeeItemForSave(item);
  const response = await axios.post<any>(API_BASE, payload);
  return normalizeFeeItem(response.data);
};

export const updateFeeItem = async (
  code: string,
  item: FeeItem
): Promise<FeeItem> => {
  const cleanCode = (code || item.itemno || item.feeCode || '').trim();
  const payload = sanitizeFeeItemForSave(item);
  const response = await axios.put<any>(
    `${API_BASE}/${encodeURIComponent(cleanCode)}`,
    payload
  );
  return normalizeFeeItem(response.data);
};

export const deleteFeeItem = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveFeeItem = async (item: FeeItem, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeFeeItemForSave(item);
    if (isNew) {
      await createFeeItem(payload);
    } else {
      await updateFeeItem(payload.itemno, payload);
    }
    return true;
  } catch (e) {
    console.error('saveFeeItem error:', e);
    return false;
  }
};

export const batchSaveFeeItems = async (items: FeeItem[]): Promise<boolean> => {
  try {
    const payloads = items.map(sanitizeFeeItemForSave);
    await axios.post(`${API_BASE}/batch-save`, payloads);
    return true;
  } catch (e) {
    console.error('batchSaveFeeItems error:', e);
    return false;
  }
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
  itemnoStart?: string;
  itemnoEnd?: string;
}

export const fetchPrintFeeItems = async (
  query: PrintRangeQuery
): Promise<FeeItem[]> => {
  const response = await axios.post<any[]>(`${API_BASE}/print`, query);
  return Array.isArray(response.data) ? response.data.map(normalizeFeeItem) : [];
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
