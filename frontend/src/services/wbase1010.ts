import axios from 'axios';
import { callWbaseListReport, type WbaseReportParams, type WbaseReportResult } from './localagent';
import { isTwBusinessId } from './validation';

/**
 * 1-1 事務所資料維護 (VFP wbase1010)
 * 預設事務所資料：base.dbf 鍵值 (000A 名稱、000B 統編、000C 英文名、0001 地址、0002 電話、0003 傳真、0004 負責人、0005 電子郵件、0006 聯絡人)
 * 加上 pub_para.dbf 的數位憑證公用目錄
 */
export interface OfficeInfo {
  name: string;
  taxNo: string;
  engName: string;
  addr: string;
  tel: string;
  fax: string;
  boss: string;
  email: string;
  contact: string;
  pubImgPath: string;
}

export const EMPTY_OFFICE: OfficeInfo = {
  name: '',
  taxNo: '',
  engName: '',
  addr: '',
  tel: '',
  fax: '',
  boss: '',
  email: '',
  contact: '',
  pubImgPath: '',
};

/**
 * 事務所資料檔 cstore.dbf 一列 (VFP wbase1010f4)
 * _key 只存在前端，用來在非同步存檔期間找回同一列；origNo 為已存檔的統號 (空白代表尚未新增到 DBF)
 */
export interface CstoreItem {
  _key: string;
  origNo: string;
  recordNumber: number;
  serial: number;
  no: string;
  name: string;
  tel: string;
  fax: string;
  addr: string;
  hname: string;
  linkman: string;
  email: string;
  engname: string;
}

/** cstore.dbf 欄寬 (Big5 位元組)，同 VFP 表格的 InputMask */
export const CSTORE_BYTES = {
  no: 8,
  name: 60,
  tel: 12,
  fax: 12,
  addr: 60,
  hname: 10,
  linkman: 10,
  email: 60,
  engname: 60,
} as const;

/** 預設事務所資料可輸入欄位的長度 (VFP wbase1010 各 TextBox 的 InputMask；地址為 base.data 欄寬) */
export const OFFICE_BYTES = {
  tel: 15,
  fax: 15,
  addr: 100,
  boss: 10,
  contact: 10,
  email: 30,
  pubImgPath: 150,
} as const;

let keySeq = 0;
export const newCstoreKey = (): string => `cstore_${Date.now()}_${++keySeq}`;

const API_BASE = '/api/wbase1010';

export const apiErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const toOffice = (raw: any): OfficeInfo => ({
  name: raw?.name ?? '',
  taxNo: raw?.taxNo ?? '',
  engName: raw?.engName ?? '',
  addr: raw?.addr ?? '',
  tel: raw?.tel ?? '',
  fax: raw?.fax ?? '',
  boss: raw?.boss ?? '',
  email: raw?.email ?? '',
  contact: raw?.contact ?? '',
  pubImgPath: raw?.pubImgPath ?? '',
});

const toCstore = (raw: any, key?: string): CstoreItem => ({
  _key: key ?? newCstoreKey(),
  origNo: raw?.no ?? '',
  recordNumber: Number(raw?.recordNumber) || 0,
  serial: Number(raw?.serial) || 0,
  no: raw?.no ?? '',
  name: raw?.name ?? '',
  tel: raw?.tel ?? '',
  fax: raw?.fax ?? '',
  addr: raw?.addr ?? '',
  hname: raw?.hname ?? '',
  linkman: raw?.linkman ?? '',
  email: raw?.email ?? '',
  engname: raw?.engname ?? '',
});

export const fetchOffice = async (): Promise<OfficeInfo> => {
  const res = await axios.get(`${API_BASE}/office`);
  return toOffice(res.data);
};

export const saveOffice = async (office: OfficeInfo): Promise<OfficeInfo> => {
  const res = await axios.put(`${API_BASE}/office`, office);
  return toOffice(res.data);
};

export const fetchCstoreList = async (): Promise<CstoreItem[]> => {
  const res = await axios.get<any[]>(`${API_BASE}/cstore`);
  return Array.isArray(res.data) ? res.data.map((r) => toCstore(r)) : [];
};

const savePayload = (row: CstoreItem) => ({
  origNo: row.origNo,
  recordNumber: row.recordNumber,
  no: row.no.trim(),
  name: row.name,
  tel: row.tel,
  fax: row.fax,
  addr: row.addr,
  hname: row.hname,
  linkman: row.linkman,
  email: row.email,
  engname: row.engname,
});

/** 新增 (origNo 空白) 或修改 cstore 一列；回傳伺服器上的整列 (保留同一個 _key) */
export const saveCstore = async (row: CstoreItem): Promise<CstoreItem> => {
  const payload = savePayload(row);
  const res = row.origNo
    ? await axios.put(`${API_BASE}/cstore`, payload)
    : await axios.post(`${API_BASE}/cstore`, payload);
  return toCstore(res.data?.row, row._key);
};

/** 刪除 cstore 一列；回傳重編序號失敗時的提示 */
export const deleteCstore = async (row: CstoreItem): Promise<string | null> => {
  const res = await axios.delete(`${API_BASE}/cstore/${encodeURIComponent(row.origNo)}`, {
    params: { recno: row.recordNumber },
  });
  return res.data?.warning ?? null;
};

export interface CstorePrintFilter {
  noStart: string;
  noEnd: string;
}

export const fetchCstorePrintList = async (filter: CstorePrintFilter): Promise<CstoreItem[]> => {
  const res = await axios.post<any[]>(`${API_BASE}/cstore/print`, filter);
  return Array.isArray(res.data) ? res.data.map((r) => toCstore(r)) : [];
};

/**
 * 統號檢查 (VFP Text1.LostFocus 呼叫 w3000func.prg buynochk，不通過就不寫入)：
 * 8 碼數字且通過統編檢查碼 (採 112 年起的新制，涵蓋舊制)
 */
export const checkCstoreNo = (no: string): string | null => {
  const s = no.trim();
  if (!s) return '統號不可空白';
  if (!/^\d{8}$/.test(s)) return '統號須為 8 碼數字的統一編號';
  if (!isTwBusinessId(s)) return `統號 ${s} 統一編號輸入錯誤`;
  return null;
};

/** 今天的民國日期 yyy/mm/dd (VFP SET DATE TAIWAN 的 DTOC(DATE())) */
export const rocToday = (): string => {
  const d = new Date();
  const y = String(d.getFullYear() - 1911).padStart(3, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

/**
 * 事務所資料報表 (VFP REPORTS\base111.frx)：LocalAgent 寫 JSON 暫存檔後呼叫 wbaseRP.dll 的 wbase1010_cstore_list
 */
export const callWbase1010Report = (rows: CstoreItem[], params?: WbaseReportParams): Promise<WbaseReportResult> =>
  callWbaseListReport(
    'wbase1010_cstore_list',
    rows.map((r) => ({
      no: r.no,
      name: r.name,
      tel: r.tel,
      fax: r.fax,
      hname: r.hname,
      linkman: r.linkman,
      addr: r.addr,
    })),
    params
  );

export interface CstoreXlsxField {
  key: string;
  label: string;
  customTitle: string;
}

/**
 * 匯出 Excel (VFP wbase1010f41.requeryother)：第 1 列「事務所資料表」、第 2 列製表日期、第 3 列欄位標題，之後為資料
 */
export const exportCstoreXlsx = async (
  rows: CstoreItem[],
  fields: CstoreXlsxField[],
  fileName: string
): Promise<boolean> => {
  try {
    const XLSX = await import('xlsx');
    const header = fields.map((f) => f.customTitle || f.label);
    const body = rows.map((r) => fields.map((f) => String((r as unknown as Record<string, unknown>)[f.key] ?? '')));
    const sheet = XLSX.utils.aoa_to_sheet([['事務所資料表'], [`製表日期: ${rocToday()}`], header, ...body]);
    const lastCol = Math.max(0, fields.length - 1);
    sheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(1, lastCol) } },
    ];
    sheet['!cols'] = fields.map((f, c) => {
      const widest = Math.max(
        ...[header[c], ...body.map((b) => b[c])].map((text) =>
          [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)
        )
      );
      return { wch: Math.min(Math.max(widest + 2, f.key === 'no' ? 10 : 8), 70) };
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '事務所資料表');
    XLSX.writeFile(book, fileName);
    return true;
  } catch (err) {
    console.error('exportCstoreXlsx error:', err);
    return false;
  }
};
