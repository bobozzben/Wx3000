import axios from 'axios';
import { callWbaseListReport, type WbaseReportParams, type WbaseReportResult } from './localagent';

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

export const callWbase1080Report = (
  rows: FeeSummary[],
  params?: WbaseReportParams
): Promise<WbaseReportResult> =>
  callWbaseListReport(
    'wbase1080_feesummary_list',
    rows.map((r) => ({ summaryCode: r.summaryCode, summaryName: r.summaryName, content: r.content })),
    params
  );
