import axios from 'axios';

export interface FeeSummary {
  seq?: number;
  summaryCode: string;   // 編號 / 摘要代號
  summaryName: string;   // 說明 / 摘要說明
  content: string;       // 摘要 / 摘要內容
  guid?: string;         // guid
}

export type FeeSummaryPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1080';

export const fetchFeeSummaries = async (keyword?: string): Promise<FeeSummary[]> => {
  const response = await axios.get<FeeSummary[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const getFeeSummaryList = fetchFeeSummaries;
export const getFeeSummaries = fetchFeeSummaries;

export const fetchFeeSummaryByCode = async (code: string): Promise<FeeSummary> => {
  const response = await axios.get<FeeSummary>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const sanitizeFeeSummary = (item: FeeSummary): FeeSummary => ({
  ...item,
  summaryCode: (item.summaryCode || '').trim().toUpperCase(),
  summaryName: (item.summaryName || '').trim(),
  content: (item.content || '').trim(),
});

export const createFeeSummary = async (item: FeeSummary): Promise<FeeSummary> => {
  const payload = sanitizeFeeSummary(item);
  const response = await axios.post<FeeSummary>(API_BASE, payload);
  return response.data;
};

export const updateFeeSummary = async (
  code: string,
  item: FeeSummary
): Promise<FeeSummary> => {
  const payload = sanitizeFeeSummary(item);
  const response = await axios.put<FeeSummary>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    payload
  );
  return response.data;
};

export const deleteFeeSummary = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveFeeSummary = async (item: FeeSummary, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeFeeSummary(item);
    if (isNew) {
      await createFeeSummary(payload);
    } else {
      await updateFeeSummary(payload.summaryCode, payload);
    }
    return true;
  } catch (e) {
    console.error('saveFeeSummary error:', e);
    return false;
  }
};

export const batchSaveFeeSummaries = async (items: FeeSummary[]): Promise<boolean> => {
  try {
    const payloads = items.map(sanitizeFeeSummary);
    await axios.post(`${API_BASE}/batch-save`, payloads);
    return true;
  } catch (e) {
    console.error('batchSaveFeeSummaries error:', e);
    return false;
  }
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
}

export const fetchPrintFeeSummaries = async (
  query: PrintRangeQuery
): Promise<FeeSummary[]> => {
  const response = await axios.post<FeeSummary[]>(`${API_BASE}/print`, query);
  return response.data;
};

export const printFeeSummaryList = fetchPrintFeeSummaries;

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
