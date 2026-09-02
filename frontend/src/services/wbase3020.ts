import axios from 'axios';

export interface InvoicePurchaseItem {
  period: string;
  times: string;
  companyCode: string;
  companyShortName: string;
  unifiedNo: string;
  taxNo: string;
  manualTwoDup: number;
  manualTwoDupSub: number;
  manualThreeDup: number;
  manualThreeDupSub: number;
  manualSpecial: number;
  cashTwoDup: number;
  cashThreeDup: number;
  cashThreeDupSub: number;
  city?: string;
  placeCode?: string;
  empCode?: string;
  guid?: string;
}

export interface PrintRangeQuery {
  period?: string;
  times?: string;
  codeStart?: string;
  codeEnd?: string;
}

const API_BASE = '/api/wbase3020';

export const fetchInvoicePurchaseList = async (
  period: string,
  times: string,
  keyword?: string,
  inputMode?: string,
  inputCondition?: string
): Promise<InvoicePurchaseItem[]> => {
  const response = await axios.get<InvoicePurchaseItem[]>(API_BASE, {
    params: {
      period,
      times,
      keyword: keyword || '',
      inputMode: inputMode || '',
      inputCondition: inputCondition || '',
    },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const sanitizeInvoicePurchaseItem = (item: InvoicePurchaseItem): InvoicePurchaseItem => ({
  ...item,
  period: (item.period || '').trim(),
  times: (item.times || '1').replace(/[^\d]/g, '') || '1',
  companyCode: (item.companyCode || '').trim().toUpperCase(),
  companyShortName: (item.companyShortName || '').trim(),
  unifiedNo: (item.unifiedNo || '').trim(),
  taxNo: (item.taxNo || '').trim(),
  manualTwoDup: Number(item.manualTwoDup) || 0,
  manualTwoDupSub: Number(item.manualTwoDupSub) || 0,
  manualThreeDup: Number(item.manualThreeDup) || 0,
  manualThreeDupSub: Number(item.manualThreeDupSub) || 0,
  manualSpecial: Number(item.manualSpecial) || 0,
  cashTwoDup: Number(item.cashTwoDup) || 0,
  cashThreeDup: Number(item.cashThreeDup) || 0,
  cashThreeDupSub: Number(item.cashThreeDupSub) || 0,
});

export const createInvoicePurchaseItem = async (item: InvoicePurchaseItem): Promise<InvoicePurchaseItem> => {
  const payload = sanitizeInvoicePurchaseItem(item);
  const response = await axios.post<InvoicePurchaseItem>(API_BASE, payload);
  return response.data;
};

export const updateInvoicePurchaseItem = async (
  period: string,
  times: string,
  companyCode: string,
  item: InvoicePurchaseItem
): Promise<InvoicePurchaseItem> => {
  const payload = sanitizeInvoicePurchaseItem(item);
  const cleanPeriod = (period || payload.period).trim();
  const cleanTimes = (times || payload.times || '1').replace(/[^\d]/g, '') || '1';
  const cleanCode = (companyCode || payload.companyCode).trim().toUpperCase();

  // Send PUT via body API_BASE to safely support special characters like '#' in companyCode
  const response = await axios.put<InvoicePurchaseItem>(API_BASE, {
    ...payload,
    period: cleanPeriod,
    times: cleanTimes,
    companyCode: cleanCode,
  });
  return response.data;
};

export const deleteInvoicePurchaseItem = async (
  period: string,
  times: string,
  companyCode: string
): Promise<{ message: string }> => {
  const cleanTimes = (times || '1').replace(/[^\d]/g, '') || '1';
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(period)}/${encodeURIComponent(cleanTimes)}/${encodeURIComponent(companyCode)}`
  );
  return response.data;
};

export const saveInvoicePurchaseItem = async (item: InvoicePurchaseItem, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeInvoicePurchaseItem(item);
    if (isNew) {
      await createInvoicePurchaseItem(payload);
    } else {
      await updateInvoicePurchaseItem(payload.period, payload.times, payload.companyCode, payload);
    }
    return true;
  } catch (e) {
    console.error('saveInvoicePurchaseItem error:', e);
    return false;
  }
};

export const batchSaveInvoicePurchaseItems = async (items: InvoicePurchaseItem[]): Promise<boolean> => {
  try {
    const sanitized = items.map(sanitizeInvoicePurchaseItem);
    await axios.post(`${API_BASE}/batch-save`, sanitized);
    return true;
  } catch (e) {
    console.error('batchSaveInvoicePurchaseItems error:', e);
    return false;
  }
};

export const fetchPrintInvoicePurchaseList = async (
  query: PrintRangeQuery
): Promise<InvoicePurchaseItem[]> => {
  const response = await axios.post<InvoicePurchaseItem[]>(`${API_BASE}/print`, query);
  return response.data;
};
