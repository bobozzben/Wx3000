import axios from 'axios';

export interface InvoiceTrackRecord {
  period: string;
  times: string;
  companyCode: string;
  companyShortName?: string;
  companyName?: string;
  unifiedNo?: string;
  taxNo?: string;
  companyAddr?: string;

  // 各類發票本數
  manualTwoDup: number;      // 二聯(手)
  manualTwoDupSub: number;   // 二聯副(手)
  manualThreeDup: number;    // 三聯(手)
  manualThreeDupSub: number; // 三聯副(手)
  manualSpecial: number;     // 特種
  cashTwoDup: number;        // 收銀二聯
  cashThreeDup: number;      // 收銀三聯
  cashThreeDupSub: number;   // 收銀三聯副

  // 各類字軌與起迄號
  manualTwoTrack?: string;
  manualTwoStartNo?: string;
  manualTwoEndNo?: string;

  manualTwoSubTrack?: string;
  manualTwoSubStartNo?: string;
  manualTwoSubEndNo?: string;

  manualThreeTrack?: string;
  manualThreeStartNo?: string;
  manualThreeEndNo?: string;

  manualThreeSubTrack?: string;
  manualThreeSubStartNo?: string;
  manualThreeSubEndNo?: string;

  specialTrack?: string;
  specialStartNo?: string;
  specialEndNo?: string;

  cashTwoTrack?: string;
  cashTwoStartNo?: string;
  cashTwoEndNo?: string;

  cashThreeTrack?: string;
  cashThreeStartNo?: string;
  cashThreeEndNo?: string;

  cashThreeSubTrack?: string;
  cashThreeSubStartNo?: string;
  cashThreeSubEndNo?: string;
}

export interface UpdateTrackItem {
  period: string;
  times: string;
  companyCode: string;

  manualTwoTrack?: string;
  manualTwoStartNo?: string;
  manualTwoEndNo?: string;

  manualTwoSubTrack?: string;
  manualTwoSubStartNo?: string;
  manualTwoSubEndNo?: string;

  manualThreeTrack?: string;
  manualThreeStartNo?: string;
  manualThreeEndNo?: string;

  manualThreeSubTrack?: string;
  manualThreeSubStartNo?: string;
  manualThreeSubEndNo?: string;

  specialTrack?: string;
  specialStartNo?: string;
  specialEndNo?: string;

  cashTwoTrack?: string;
  cashTwoStartNo?: string;
  cashTwoEndNo?: string;

  cashThreeTrack?: string;
  cashThreeStartNo?: string;
  cashThreeEndNo?: string;

  cashThreeSubTrack?: string;
  cashThreeSubStartNo?: string;
  cashThreeSubEndNo?: string;
}

/** buyinv 的 8 種發票 (本數欄位名；字軌 / 起號 / 迄號為 {kind}beg / {kind}begno / {kind}endno) */
export type TrackKind = 'a02' | 'a02b' | 'a03' | 'a03b' | 'spec' | 'c02' | 'c03' | 'c03b';

/** 前端解析 Excel 後的一筆「公司 × 發票種類」資料 (VFP wbase3022 轉入時 netbuy.dbf 的一個欄位群) */
export interface ImportExcelTrackItem {
  unifiedNo: string;
  taxNo: string;
  companyName: string;
  /** 購買日期 (代售點 Excel L 欄，7 碼；網路購買為空) */
  buyDate: string;
  kind: TrackKind;
  quantity: number;
  track: string;
  startNo: string;
  endNo: string;
}

export interface ImportUnmatchedItem {
  unifiedNo: string;
  taxNo: string;
  companyName: string;
}

export interface ImportExcelTrackResult {
  success: boolean;
  period: string;
  times: string;
  sourceType: string;
  totalItems: number;
  /** 對應到的公司家數 */
  companies: number;
  /** 對應到的購買紀錄筆數 (追加購買同一家不同購買日期算不同筆) */
  rows: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  /** 找不到客戶資料、沒有轉入的統編 */
  unmatched: ImportUnmatchedItem[];
  message: string;
}

export type DocImageName = 'tgo01' | 'tgo02' | 'tgo022';

/**
 * 查詢統購發票字軌資料
 */
export async function getInvoiceTracks(
  period: string,
  times: string,
  sortOrder: '1' | '2' | '3' = '1',
  keyword: string = ''
): Promise<InvoiceTrackRecord[]> {
  const response = await axios.get('/api/wbase3060', {
    params: {
      period,
      times,
      sortOrder,
      keyword: keyword.trim() || undefined,
    },
  });
  return response.data;
}

/**
 * 批次儲存/更新字軌資料
 */
export async function updateInvoiceTracksBatch(
  updates: UpdateTrackItem[]
): Promise<{ success: boolean; updated: number }> {
  const response = await axios.put('/api/wbase3060/batch', updates);
  return response.data;
}

/**
 * 轉入 Excel 解析後的統購字軌資料 (VFP wbase3022 [轉入])
 */
export async function importExcelTracks(
  period: string,
  times: string,
  sourceType: '1' | '2',
  items: ImportExcelTrackItem[]
): Promise<ImportExcelTrackResult> {
  const response = await axios.post<ImportExcelTrackResult>('/api/wbase3060/import-track', {
    period,
    times,
    sourceType,
    items,
  });
  return response.data;
}

/**
 * 取得格式預覽圖檔 (<磁碟機>:\W3000\doc\tgo01.jpg 等)，回傳可放進 <img> 的 object URL；用完請 URL.revokeObjectURL
 */
export async function fetchDocImage(name: DocImageName): Promise<string> {
  const response = await axios.get<Blob>(`/api/wbase3060/doc-image/${name}`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}

/** axios 以 blob 讀取時，錯誤內容也是 blob，要再讀成文字才拿得到後端的 message */
export async function readBlobErrorMessage(err: unknown, fallback: string): Promise<string> {
  const data = axios.isAxiosError(err) ? err.response?.data : undefined;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      /* 不是 JSON */
    }
  } else if (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }
  return fallback;
}

/**
 * 清除當前期別字軌資料
 */
export async function clearInvoiceTracks(
  period: string,
  times: string
): Promise<{ success: boolean; cleared: number; message: string }> {
  const response = await axios.post('/api/wbase3060/clear', {
    period,
    times,
  });
  return response.data;
}
