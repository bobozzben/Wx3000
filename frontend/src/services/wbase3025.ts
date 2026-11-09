import axios from 'axios';

/** media = 3-4-1 原媒體轉檔 (VFP wbase3025)、net = 3-4-2 網路申購轉檔 (VFP wbase3025n) */
export type MediaTransferMode = 'media' | 'net';

export interface MediaTransferRequest {
  mode: MediaTransferMode;
  /** 民國年 3 碼 */
  year: string;
  startMonth: string;
  endMonth: string;
  /** 1 依地址縣市、2 依購買地點 */
  filterBy: '1' | '2';
  city: string;
  placeNo: string;
  agentId: string;
  /** 原媒體轉檔：1 依統一編號、2 依稅籍編號 */
  sortBy: '1' | '2';
  /** 原媒體轉檔：1 PODER.DAT、2 PODER.TXT；網路申購轉檔：1 台北市、2 高雄市、3 台灣省 */
  format: '1' | '2' | '3';
  /** 原媒體轉檔：台灣省檔尾加事務所簽章框 */
  withOffice: boolean;
}

export interface MediaTransferRow {
  no: string;
  name: string;
  unino: string;
  taxno: string;
  addr: string;
  placeNo: string;
  times: string;
  a02: number;
  a02b: number;
  a03: number;
  a03b: number;
  spec: number;
  c02: number;
  c03: number;
  c03b: number;
  /** 錯誤清單裡的訊息 (客戶代號不存在 / 地址空白 / 地址不在縣市)，沒有為空 */
  error: string;
}

export interface MediaTransferResult {
  region: 'taipei' | 'kaohsiung' | 'province';
  regionName: string;
  fileName: string;
  /** 檔案內容 (Big5) 的 Base64 */
  contentBase64: string;
  byteLength: number;
  lineCount: number;
  /** true = 每列補滿 254 位元組 (VFP COPY TO ... SDF)，false = 每列 ALLTRIM (VFP FWRITE) */
  padded: boolean;
  rows: MediaTransferRow[];
  errors: string[];
  totals: Record<string, number>;
  message: string;
}

export interface MediaTransferDefaults {
  year: string;
  startMonth: string;
  endMonth: string;
  /** pub_para.buycity */
  city: string;
  officeName: string;
  officeUnino: string;
  officeTel: string;
  officeAddr: string;
  officeOwner: string;
}

export const fetchMediaTransferDefaults = async (): Promise<MediaTransferDefaults> => {
  const res = await axios.get<MediaTransferDefaults>('/api/wbase3025/defaults');
  return res.data;
};

export const runMediaTransfer = async (req: MediaTransferRequest): Promise<MediaTransferResult> => {
  const res = await axios.post<MediaTransferResult>('/api/wbase3025/transfer', req);
  return res.data;
};

const toBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** 把轉檔結果存成檔案 (瀏覽器下載，取代 VFP 的磁碟機 / 路徑) */
export const saveMediaTransferFile = (result: MediaTransferResult): void => {
  const blob = new Blob([toBytes(result.contentBase64)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** 轉檔內容 (Big5) 解成文字，給畫面預覽用 */
export const decodeMediaTransferText = (result: MediaTransferResult): string => {
  try {
    return new TextDecoder('big5').decode(toBytes(result.contentBase64));
  } catch {
    return '';
  }
};

/** 後端錯誤訊息 (400 的 message)，沒有就用 fallback */
export const describeMediaTransferError = (err: unknown, fallback = '轉檔失敗'): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
};
