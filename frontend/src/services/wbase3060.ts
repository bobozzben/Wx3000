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

export interface ImportExcelTrackItem {
  unifiedNo?: string;
  taxNo?: string;
  companyCode?: string;
  invoiceType?: string;
  track?: string;
  startNo?: string;
  endNo?: string;
  quantity?: number;
}

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
 * 匯入 Excel 解析資料
 */
export async function importExcelTracks(
  period: string,
  times: string,
  sourceType: string,
  items: ImportExcelTrackItem[]
): Promise<{ success: boolean; totalItems: number; matched: number; unmatched: number; message: string }> {
  const response = await axios.post('/api/wbase3060/import-track', {
    period,
    times,
    sourceType,
    items,
  });
  return response.data;
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
