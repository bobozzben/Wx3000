import axios from 'axios';

/**
 * 2-2 客戶資料匯出 / 2-3 客戶資料匯入 (VFP base20.prg wbasemenu02cmd02 → wbase2020、wbasemenu02cmd03 → wbase2030)
 * 檔案是與 VFP 互通的 custbak.dbf：匯出由瀏覽器下載，匯入由使用者上傳。
 * 勾選狀態只存在前端 state，送出時只傳勾選的代號，不讀也不寫 customer.sel。
 * 轉檔列印密碼只在後端比對，每個寫檔或讀檔的請求都要再帶一次。
 */
const API_BASE = '/api/wbase2030';

export interface CustbakCustomer {
  no: string;
  name: string;
  unino: string;
  selected: boolean; // 查詢結果的計算欄位，一律 false
}

export interface CustbakExportResult {
  fileName: string;
  count: number;
  missing: string[]; // 勾選了但地端資料檔已找不到的代號
  content: string;   // custbak.dbf (Base64)
}

export interface CustbakPreviewRow {
  no: string;
  name: string;
  unino: string;
  exists: boolean; // true：匯入時整筆覆蓋；false：新增
}

export interface CustbakPreview {
  importId: string;
  rows: CustbakPreviewRow[];
  missingFields: string[]; // 來源檔缺少、匯入後會被清空的 customer 欄位
  extraFields: string[];   // 來源檔多出、匯入時忽略的欄位
}

export interface CustbakImportResult {
  inserted: number;
  updated: number;
  failed: { no: string; reason: string }[];
  synced: boolean;
}

/** 從 axios 錯誤取出後端訊息 */
export const apiErrorMessage = (err: any, fallback = '操作失敗'): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

export const verifyTransferPassword = async (password: string): Promise<boolean> =>
  (await axios.post<{ ok: boolean }>(`${API_BASE}/verify-password`, { password })).data.ok;

export const fetchCustbakCustomers = async (): Promise<CustbakCustomer[]> =>
  (await axios.get<CustbakCustomer[]>(`${API_BASE}/customers`)).data;

export const exportCustbak = async (password: string, nos: string[]): Promise<CustbakExportResult> =>
  (await axios.post<CustbakExportResult>(`${API_BASE}/export`, { password, nos })).data;

export const previewCustbak = async (password: string, file: File): Promise<CustbakPreview> => {
  const form = new FormData();
  form.append('password', password);
  form.append('file', file);
  return (await axios.post<CustbakPreview>(`${API_BASE}/import/preview`, form)).data;
};

export const importCustbak = async (password: string, importId: string, nos: string[]): Promise<CustbakImportResult> =>
  (await axios.post<CustbakImportResult>(`${API_BASE}/import`, { password, importId, nos })).data;

/** 離開 2-3 時清除後端暫存的上傳檔；失敗不影響操作 (後端也會清掉超過一天的暫存檔) */
export const discardCustbakImport = (importId: string): void => {
  axios.delete(`${API_BASE}/import/${encodeURIComponent(importId)}`).catch(() => {});
};

/** 以瀏覽器下載儲存檔案 (Electron 會跳出另存新檔對話框) */
export const saveBase64File = (fileName: string, base64: string): void => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
