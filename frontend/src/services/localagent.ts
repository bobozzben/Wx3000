import axios from 'axios';

/**
 * 專用於呼叫地端 LocalAgent (http://localhost:5009) 之獨立 Axios 實例
 * 絕不繼承 ERP 後端全域 baseURL 或 X-Data-Drive Header，杜絕跨域 CORS Preflight 攔截
 */
export const localagentApi = axios.create({
  baseURL: 'http://localhost:5009',
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
 * DLL 回傳非 0 代表報表內部發生錯誤，但 LocalAgent 只要呼叫有完成就回 success: true
 */
export const normalizeReportResult = (data: WbaseReportResult): WbaseReportResult =>
  data.success && (data.retCode ?? 0) !== 0
    ? { ...data, success: false, error: data.error || `報表函數回傳錯誤碼 ${data.retCode}` }
    : data;

export interface WbaseReportParams {
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number; // 0: 預覽, 1: 直接送預設印表機
}

/**
 * 主檔清冊共用呼叫：資料由 LocalAgent 寫入 JSON 暫存檔後交給 wbaseRP.dll。
 * 函數必須登記在 localagent/dlls.json。不重試，避免連線逾時時重複出紙
 */
export const callWbaseListReport = async (
  func: string,
  rows: unknown[],
  params: WbaseReportParams = {}
): Promise<WbaseReportResult> => callWbaseReport(func, rows, params);

/**
 * 同 callWbaseListReport，但 jsonData 可為物件 (例如單據報表的 { officeName, printDate, data: [...] })
 */
export const callWbaseReport = async (
  func: string,
  rows: unknown,
  params: WbaseReportParams = {}
): Promise<WbaseReportResult> => {
  try {
    const response = await localagentApi.post(
      '/report',
      {
        func,
        hs_chk: params.hs_chk ?? 0.125,
        top_mag: params.top_mag ?? 0,
        left_mag: params.left_mag ?? 0,
        PrtIndex: params.PrtIndex ?? 0,
        IsPrint: params.IsPrint ?? 0,
        jsonData: rows,
      },
      { timeout: 60000 }
    );
    return normalizeReportResult(response.data);
  } catch (err: any) {
    console.error('LocalAgent error:', err);
    return {
      success: false,
      error:
        err?.response?.data?.error ||
        '無法連線至 LocalAgent 本地列印元件 (http://localhost:5009)，請確認 LocalAgent 服務已啟動。',
    };
  }
};
