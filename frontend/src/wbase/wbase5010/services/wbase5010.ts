import axios from 'axios';
import type { XlsxFieldItem } from '../../../components/SelectXlsxField';

const API_BASE = '/api/wbase5010';

export interface CustomerPrintItem {
  no: string;
  abbr: string;
  name: string;
  unino: string;
  taxno: string;
  hname: string;
  linkman: string;
  tel: string;
  mobile: string;
  fax: string;
  addr: string;
  invaddr: string;
  email: string;
  keyin: string;
  keyinna: string;
  orga: string;
  organame: string;
  pno: string;
  pnostd: string;
  offno: string;
  offno1: string;
  cpano: string;
  capital: number | null;
  serial: number | null;
  recordNumber: number | null;
  selected?: boolean;
}

export interface LabelCustomerItem {
  no: string;
  abbr: string;
  name: string;
  unino: string;
  hname: string;
  linkman: string;
  tel: string;
  addr: string;
  invaddr: string;
  prn: number;
  selected: boolean;
  recordNumber?: number | null;
}

export interface KeyinStatsItem {
  custNo: string;
  custName: string;
  unino: string;
  taxno: string;
  keyin: string;
  keyinna: string;
  tel: string;
  addr: string;
  pno: string;
}

export interface BusinessStatusItem {
  no: string;
  name: string;
  unino: string;
  taxno: string;
  hname: string;
  tel: string;
  addr: string;
  pno: string;
  capital: number | null;
  startMonth: string;
  endMonth: string;
}

export interface FinanceStatusItem {
  no: string;
  name: string;
  unino: string;
  taxno: string;
  capital: number | null;
  hname: string;
  tel: string;
  addr: string;
  pno: string;
  year: string;
}

export interface BsdescItem {
  seq: number;
  no: string;
  desc: string;
  sel: string;
  serial: number;
  recordNumber?: number | null;
}

export interface CustomerPrintQueryParams {
  startNo?: string;
  endNo?: string;
  reportType?: number; // 1: 基本資料, 2: 詳細資料
  addrType?: number;   // 1: 公司地址, 2: 聯絡地址, 3: 公司與聯絡地址
  groupType?: number;  // 1: 依客戶編號, 2: 依登打人員
  orderType?: number;  // 1: 客戶編號, 2: 統一編號, 3: 稅籍編號
  selectedNos?: string[];
}

export interface LabelPrintQueryParams {
  startNo?: string;
  endNo?: string;
  labelType?: number;     // 1: 磁片標籤, 2: 郵遞標籤
  layoutType?: number;    // 1: 橫式, 2: 直式
  addrType?: number;      // 1: 公司地址, 2: 聯絡地址
  recipientType?: number; // 1: 負責人, 2: 聯絡人
  copies?: number;
  startRow?: number;
  isA4?: boolean;
  isKaohsiungFormat?: boolean;
  items?: LabelCustomerItem[];
}

export interface KeyinStatsQueryParams {
  year?: string;
  startNo?: string;
  endNo?: string;
  startKeyin?: string;
  endKeyin?: string;
}

export interface BusinessStatusQueryParams {
  year?: string;
  startMonth?: string;
  endMonth?: string;
  startNo?: string;
  endNo?: string;
}

export interface FinanceStatusQueryParams {
  year?: string;
  startNo?: string;
  endNo?: string;
}

export interface BsdescBatchUpdatePayload {
  rpdate?: string;
  comphidno?: string;
  endyear?: string;
  items: BsdescItem[];
}

// =========================================================================
// API Services
// =========================================================================

export const fetchCustomers = async (keyword?: string): Promise<LabelCustomerItem[]> => {
  const resp = await axios.get<LabelCustomerItem[]>(`${API_BASE}/customers`, {
    params: { keyword: keyword || undefined },
  });
  return resp.data;
};

export const queryCustomerPrintData = async (
  query: CustomerPrintQueryParams
): Promise<CustomerPrintItem[]> => {
  const resp = await axios.post<CustomerPrintItem[]>(`${API_BASE}/print/customer-data`, query);
  return resp.data;
};

export const generateLabels = async (
  query: LabelPrintQueryParams
): Promise<LabelCustomerItem[]> => {
  const resp = await axios.post<LabelCustomerItem[]>(`${API_BASE}/print/labels`, query);
  return resp.data;
};

export const queryKeyinStats = async (
  query: KeyinStatsQueryParams
): Promise<KeyinStatsItem[]> => {
  const resp = await axios.post<KeyinStatsItem[]>(`${API_BASE}/print/keyin-stats`, query);
  return resp.data;
};

export const queryBusinessStatus = async (
  query: BusinessStatusQueryParams
): Promise<BusinessStatusItem[]> => {
  const resp = await axios.post<BusinessStatusItem[]>(`${API_BASE}/print/business-status`, query);
  return resp.data;
};

export const queryFinanceStatus = async (
  query: FinanceStatusQueryParams
): Promise<FinanceStatusItem[]> => {
  const resp = await axios.post<FinanceStatusItem[]>(`${API_BASE}/print/finance-status`, query);
  return resp.data;
};

export const fetchBsdescList = async (): Promise<BsdescItem[]> => {
  const resp = await axios.get<BsdescItem[]>(`${API_BASE}/bsdesc`);
  return resp.data;
};

export const createBsdesc = async (item: Partial<BsdescItem>): Promise<{ success: boolean; seq: number }> => {
  const resp = await axios.post<{ success: boolean; seq: number }>(`${API_BASE}/bsdesc`, item);
  return resp.data;
};

export const updateBsdesc = async (seq: number, item: Partial<BsdescItem>): Promise<{ success: boolean }> => {
  const resp = await axios.put<{ success: boolean }>(`${API_BASE}/bsdesc/${seq}`, item);
  return resp.data;
};

export const deleteBsdesc = async (seq: number): Promise<{ success: boolean }> => {
  const resp = await axios.delete<{ success: boolean }>(`${API_BASE}/bsdesc/${seq}`);
  return resp.data;
};

export const batchSaveBsdesc = async (payload: BsdescBatchUpdatePayload): Promise<{ success: boolean }> => {
  const resp = await axios.put<{ success: boolean }>(`${API_BASE}/bsdesc/batch`, payload);
  return resp.data;
};

// =========================================================================
// 通用動態 Excel 匯出輔助函式
// =========================================================================

export const exportReportToXlsx = async <T extends Record<string, any>>(
  data: T[],
  selectedFields: XlsxFieldItem[],
  fileName: string,
  sheetName: string = '報表'
): Promise<boolean> => {
  try {
    if (!data || data.length === 0) return false;

    const activeFields = selectedFields.filter(f => f.selected);
    if (activeFields.length === 0) return false;

    const exportRows = data.map((item, index) => {
      const rowObj: Record<string, any> = {};
      activeFields.forEach(field => {
        const title = field.customTitle || field.label;
        if (field.key === 'seq') {
          rowObj[title] = index + 1;
        } else {
          const val = item[field.key];
          rowObj[title] = val !== null && val !== undefined ? val : '';
        }
      });
      return rowObj;
    });

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(wb, finalFileName);
    return true;
  } catch (err) {
    console.error('exportReportToXlsx 失敗:', err);
    return false;
  }
};
