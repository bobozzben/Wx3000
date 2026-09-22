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

export interface BuyinvPrintQueryRequest {
  period?: string;
  times?: string;
  mode?: string; // "1": 依地址縣市, "2": 依購買地點
  cityCondition?: string;
  placeCondition?: string;
  sortOrder?: string; // "1": 依統一編號, "2": 依稅籍編號
}

/**
 * 依條件從 PostgreSQL Database: a3000 schema: e3000__comm Table: 基本發票購買 取得列印資料
 */
export const queryBuyinvPrintData = async (
  req: BuyinvPrintQueryRequest
): Promise<InvoicePurchaseItem[]> => {
  try {
    const response = await axios.post<InvoicePurchaseItem[]>(`${API_BASE}/buyinv-print-query`, req);
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.error('queryBuyinvPrintData error:', err);
    return [];
  }
};

/**
 * 呼叫 localagent_koffi 裏的 wbaseRP.dll 的 waccrep3101_b 函數顯示報表預覽畫面
 */
export const callLocalagentReport = async (
  hs_chk: number = 1,
  top_mag: number = 10,
  left_mag: number = 10,
  prtIndex: number = 0,
  isPrint: number = 0,
  savePath: string = 'C:\\temp\\buyinv_print.pdf'
): Promise<{ success: boolean; message?: string; retCode?: number; error?: string }> => {
  try {
    const response = await axios.post('http://localhost:18889/api/call', {
      dll: 'wbaseRP',
      func: 'waccrep3101_b',
      args: [hs_chk, top_mag, left_mag, prtIndex, isPrint, savePath],
    });
    return response.data;
  } catch (err: any) {
    console.error('callLocalagentReport error:', err);
    return {
      success: false,
      error: err?.response?.data?.error || err?.message || '呼叫 localagent_koffi 失敗',
    };
  }
};

/**
 * 將查詢資料匯出至 EXCEL (.xlsx)
 */
export const exportToXlsx = async (
  data: InvoicePurchaseItem[],
  selectedFields: Array<{ key: string; label: string; customTitle: string }>,
  fileName: string = '預購統一發票清冊.xlsx'
): Promise<boolean> => {
  try {
    const XLSX = await import('xlsx');

    // 建立映射欄位資料
    const exportRows = data.map((item: any, index: number) => {
      const rowObj: Record<string, any> = {};
      selectedFields.forEach((field) => {
        const title = field.customTitle || field.label;
        switch (field.key) {
          case 'seq':
            rowObj[title] = index + 1;
            break;
          case 'serialNo':
            rowObj[title] = item.guid || index + 1;
            break;
          case 'companyCode':
            rowObj[title] = item.companyCode || '';
            break;
          case 'companyShortName':
            rowObj[title] = item.companyShortName || '';
            break;
          case 'unifiedNo':
            rowObj[title] = item.unifiedNo || '';
            break;
          case 'taxNo':
            rowObj[title] = item.taxNo || '';
            break;
          case 'manualTwoDup':
            rowObj[title] = item.manualTwoDup || 0;
            break;
          case 'manualTwoDupSub':
            rowObj[title] = item.manualTwoDupSub || 0;
            break;
          case 'manualThreeDup':
            rowObj[title] = item.manualThreeDup || 0;
            break;
          case 'manualThreeDupSub':
            rowObj[title] = item.manualThreeDupSub || 0;
            break;
          case 'manualSpecial':
            rowObj[title] = item.manualSpecial || 0;
            break;
          case 'cashTwoDup':
            rowObj[title] = item.cashTwoDup || 0;
            break;
          case 'cashThreeDup':
            rowObj[title] = item.cashThreeDup || 0;
            break;
          case 'cashThreeDupSub':
            rowObj[title] = item.cashThreeDupSub || 0;
            break;
          case 'city':
            rowObj[title] = item.city || '';
            break;
          case 'placeCode':
            rowObj[title] = item.placeCode || '';
            break;
          case 'empCode':
            rowObj[title] = item.empCode || '';
            break;
          case 'period':
            rowObj[title] = item.period || '';
            break;
          case 'times':
            rowObj[title] = item.times || '1';
            break;
          default:
            rowObj[title] = item[field.key] ?? '';
            break;
        }
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '預購統一發票清冊');

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('exportToXlsx error:', err);
    return false;
  }
};

