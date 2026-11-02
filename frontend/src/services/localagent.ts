import axios from 'axios';

/**
 * 專用於呼叫地端 LocalAgent (http://localhost:18889) 之獨立 Axios 實例
 * 絕不繼承 ERP 後端全域 baseURL 或 X-Data-Drive Header，杜絕跨域 CORS Preflight 攔截
 */
export const localagentApi = axios.create({
  baseURL: 'http://localhost:18889',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface WbaseReportResult {
  success: boolean;
  result?: string;
  raw?: string;
  error?: string;
  retCode?: number;
}

/**
 * wbaseRP.dll 目前只匯出 waccrep3101_b (建檔人員)、wbase320_buyinv、wbase350_buyinv_list。
 * 沒有對應函數的清冊一律回傳失敗，不可借用其他函數，否則使用者會印出別張報表
 */
export const reportFunctionMissing = (reportName: string): WbaseReportResult => ({
  success: false,
  error: `wbaseRP.dll 尚未提供「${reportName}」的報表函數，無法以 DLL 列印，請改用網頁列印。`,
});

/**
 * DLL 回傳非 0 代表報表內部發生錯誤，但 LocalAgent 只要呼叫有完成就回 success: true
 */
export const normalizeReportResult = (data: WbaseReportResult): WbaseReportResult =>
  data.success && (data.retCode ?? 0) !== 0
    ? { ...data, success: false, error: data.error || `報表函數回傳錯誤碼 ${data.retCode}` }
    : data;
