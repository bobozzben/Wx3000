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

// =========================================================================
// Office (Word)：開檔與套印都在使用者本機，由 LocalAgent 以固定範本執行
// =========================================================================

export interface OfficeStatus {
  /** LocalAgent 有回應 (含 404) */
  reachable: boolean;
  /** LocalAgent 太舊，沒有 /api/office/* 端點 */
  outdated: boolean;
  /** 本機有註冊 Word.Application */
  word: boolean;
  version?: string;
}

export interface WordResult {
  success: boolean;
  /** 開啟的範本或轉出的 .docx 完整路徑 */
  path?: string;
  error?: string;
  errorType?: string;
}

export interface WordMergeRequest {
  /** LocalAgent WORD_TEMPLATES 的範本代號 (例如 bsdesc = <drive>:\W3000\comm\wbase001.DOC) */
  template: string;
  /** 資料磁碟機代號 (getDataDrive()) */
  drive: string;
  /** 範本清單巨集 (bsdesc 為 [THINGS]) 的內容，一筆一段 */
  paragraphs: string[];
  /** 每份文件的巨集值 (鍵為不含中括號的巨集名稱)；多份時以分頁接續 */
  copies: Record<string, string>[];
}

const officeError = (err: any, action: string): WordResult => {
  if (err?.response?.status === 404) {
    return { success: false, errorType: 'OUTDATED', error: `本機 LocalAgent 版本過舊，不支援${action}，請更新 LocalAgent。` };
  }
  return {
    success: false,
    errorType: err?.response?.data?.errorType,
    error:
      err?.response?.data?.error ||
      `無法連線至 LocalAgent (http://localhost:5009)，請確認 LocalAgent 服務已啟動。`,
  };
};

/** 查詢本機是否可用 Word；連不到 LocalAgent 或 LocalAgent 太舊時 word 為 false */
export const getOfficeStatus = async (): Promise<OfficeStatus> => {
  try {
    const res = await localagentApi.get('/api/office/status', { timeout: 5000 });
    return { reachable: true, outdated: false, word: res.data?.word === true, version: res.data?.version };
  } catch (err: any) {
    const status = err?.response?.status;
    return { reachable: status !== undefined, outdated: status === 404, word: false };
  }
};

/** 以 ShellExecute 開啟範本檔給使用者編修 */
export const openWordTemplate = async (template: string, drive: string): Promise<WordResult> => {
  try {
    const res = await localagentApi.post('/api/office/word/open', { template, drive }, { timeout: 40000 });
    return res.data;
  } catch (err: any) {
    return officeError(err, '開啟 Word 範本');
  }
};

/** 以範本為底取代巨集，轉出 .docx 並開啟；Word 作業一次一份，逾時設長一些 */
export const mergeWordTemplate = async (request: WordMergeRequest): Promise<WordResult> => {
  try {
    const res = await localagentApi.post('/api/office/word/merge', request, { timeout: 150000 });
    return res.data;
  } catch (err: any) {
    return officeError(err, '轉出 Word');
  }
};

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
