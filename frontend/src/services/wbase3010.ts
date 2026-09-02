import axios from 'axios';

export interface TicketPlaceItem {
  placeCode: string;     // 編號 (購票地點代號)
  placeName: string;     // 購買地點
  contactPerson: string; // 連絡人
  contactTel: string;    // 連絡電話
  placeAddress: string;  // 購買地址
}

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
}

export type TicketPlacePrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase3010';

export const fetchTicketPlaces = async (keyword?: string): Promise<TicketPlaceItem[]> => {
  const response = await axios.get<TicketPlaceItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const getTicketPlaceList = fetchTicketPlaces;
export const getTicketPlaces = fetchTicketPlaces;

export const fetchTicketPlaceByCode = async (code: string): Promise<TicketPlaceItem> => {
  const response = await axios.get<TicketPlaceItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const sanitizeTicketPlace = (item: TicketPlaceItem): TicketPlaceItem => ({
  ...item,
  placeCode: (item.placeCode || '').trim().toUpperCase(),
  placeName: (item.placeName || '').trim(),
  contactPerson: (item.contactPerson || '').trim(),
  contactTel: (item.contactTel || '').trim(),
  placeAddress: (item.placeAddress || '').trim(),
});

export const createTicketPlace = async (item: TicketPlaceItem): Promise<TicketPlaceItem> => {
  const payload = sanitizeTicketPlace(item);
  const response = await axios.post<TicketPlaceItem>(API_BASE, payload);
  return response.data;
};

export const updateTicketPlace = async (
  code: string,
  item: TicketPlaceItem
): Promise<TicketPlaceItem> => {
  const payload = sanitizeTicketPlace(item);
  const response = await axios.put<TicketPlaceItem>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    payload
  );
  return response.data;
};

export const deleteTicketPlace = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveTicketPlace = async (item: TicketPlaceItem, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeTicketPlace(item);
    if (isNew) {
      await createTicketPlace(payload);
    } else {
      await updateTicketPlace(payload.placeCode, payload);
    }
    return true;
  } catch (e) {
    console.error('saveTicketPlace error:', e);
    return false;
  }
};

export const batchSaveTicketPlaces = async (items: TicketPlaceItem[]): Promise<boolean> => {
  try {
    const sanitized = items
      .filter((x) => x.placeCode && x.placeCode.trim())
      .map(sanitizeTicketPlace);
    await axios.post(`${API_BASE}/batch-save`, sanitized);
    return true;
  } catch (e) {
    console.error('batchSaveTicketPlaces error:', e);
    return false;
  }
};

export const fetchPrintTicketPlaces = async (
  query: PrintRangeQuery
): Promise<TicketPlaceItem[]> => {
  const response = await axios.post<TicketPlaceItem[]>(`${API_BASE}/print`, query);
  return Array.isArray(response.data) ? response.data : [];
};

export const printTicketPlaceList = fetchPrintTicketPlaces;
export const fetchTicketPlacePrintData = fetchPrintTicketPlaces;

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

export const triggerTicketPlaceReportDll = callWaccrep3106b;
