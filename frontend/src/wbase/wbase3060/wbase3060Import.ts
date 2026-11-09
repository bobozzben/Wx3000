import * as XLSX from 'xlsx';
import type { ImportExcelTrackItem, TrackKind } from '../../services/wbase3060';

/**
 * 統購發票 Excel 解析 (VFP wbase.vcx wbase3022 Command2.Click [轉入])。
 * 兩種檔案都以「欄位位置」讀取，與 VFP APPEND FROM ... XL8 相同：
 *   網路購買 (tgo01.jpg)：第 1 列 B 欄事務所統編、N 欄期別 (例如 11010 = 110 年 10 月)；
 *     資料列 A 統編 B 公司名稱 C 稅籍編號，之後每 4 欄一種發票 (數量、字軌、起號、迄號)：
 *     D~G 二聯式、H~K 二聯副、L~O 三聯式、P~S 三聯副、T~W 特種、X~AA 二收銀、AB~AE 三收銀、AF~AI 三收副。
 *   代售點購買 (tgo02.jpg / tgo022.jpg)：A 期別 B 統編 C 稅籍 D 公司名稱 E 發票種類、J 購買方式 K 購買地點 L 購買日期，
 *     I 欄數量：F 字軌 G 起號 H 迄號 I 數量；F 欄數量：F 數量 G 字軌 H 起號 I 迄號。
 */

export type ImportMode = '1' | '2';
export type QtyColumn = 'I' | 'F';

export interface ImportParseOptions {
  /** 民國年 (3 碼) */
  year: string;
  /** 迄月 (2 碼) */
  endMonth: string;
  /** 購買次數 1 首次 2 追加 */
  times: string;
  mode: ImportMode;
  qtyCol: QtyColumn;
}

export interface ImportParseResult {
  /** Excel 裡的期別 (年 3 碼 + 迄月 2 碼) */
  periodCode: string;
  items: ImportExcelTrackItem[];
  /** 解析到的公司家數 (統編 + 稅籍) */
  companyCount: number;
  /** 代售點購買裡看不懂的發票種類 (已略過) */
  skippedTypes: string[];
}

/** 解析失敗時給使用者看的訊息 (與 VFP messagebox 相同字句) */
export class ImportParseError extends Error {}

export const TRACK_KINDS: TrackKind[] = ['a02', 'a02b', 'a03', 'a03b', 'spec', 'c02', 'c03', 'c03b'];

/** 網路購買每種發票的「數量」欄位 (0-based)，字軌 / 起號 / 迄號接在後面 3 欄 */
export const NETBUY_BLOCKS: { kind: TrackKind; col: number; label: string }[] = [
  { kind: 'a02', col: 3, label: '二聯式' },
  { kind: 'a02b', col: 7, label: '二聯副' },
  { kind: 'a03', col: 11, label: '三聯式' },
  { kind: 'a03b', col: 15, label: '三聯副' },
  { kind: 'spec', col: 19, label: '特種' },
  { kind: 'c02', col: 23, label: '二收銀' },
  { kind: 'c03', col: 27, label: '三收銀' },
  { kind: 'c03b', col: 31, label: '三收副' },
];

/** 代售點購買 E 欄發票種類 → 欄位 (VFP: Allt(xxls.invtype)=='二聯式' ...，特種稅 錯誤 #6147) */
export const AGENT_KIND_BY_TYPE: Record<string, TrackKind> = {
  二聯式: 'a02',
  二聯副: 'a02b',
  三聯式: 'a03',
  三聯副: 'a03b',
  二收銀: 'c02',
  三收銀: 'c03',
  三收副: 'c03b',
  特種: 'spec',
  特種稅: 'spec',
};

/** 代售點購買 J 欄「購買方式」：追加購買只取零售，首次購買不取零售 (VFP SET FILTER TO btype='零售'，前綴比對) */
export const isRetail = (buyType: string): boolean => buyType.startsWith('零售');

export const cellText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/** 統編 8 碼：Excel 以數值儲存時會掉前導 0，補回來 */
export const normalizeUnino = (value: string): string => (/^\d{1,8}$/.test(value) ? value.padStart(8, '0') : value);

/** 起迄號 8 碼：同樣補前導 0 */
export const normalizeInvoiceNo = (value: string): string => (/^\d{1,8}$/.test(value) ? value.padStart(8, '0') : value);

export const normalizeTrack = (value: string): string => value.toUpperCase();

/** VFP Val()：取開頭的數字，讀不到為 0 */
export const parseQty = (value: string): number => {
  const n = parseInt(value.replace(/,/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 讀取第一個工作表，每格轉成顯示文字 (raw:false 讓數值依儲存格格式輸出) */
export const readFirstSheetRows = async (file: File): Promise<string[][]> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ImportParseError('Excel 檔案內沒有工作表');
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: false });
  return rows.map((row) => (Array.isArray(row) ? row.map(cellText) : []));
};

/** VFP 錯誤 #6809：年度 (3 碼) 與迄月 (2 碼) 都要和 Excel 的期別相符 */
const periodMatches = (periodCode: string, opt: ImportParseOptions): boolean =>
  periodCode.length >= 5 &&
  periodCode.slice(0, 3) === opt.year.trim().padStart(3, '0') &&
  periodCode.slice(-2) === opt.endMonth.trim().padStart(2, '0');

const periodMismatch = (periodCode: string): ImportParseError =>
  new ImportParseError(`轉入期別:${periodCode} 與發票購買期別不符!`);

/** 財政部印刷廠發票網路購買配號明細 (VFP wbase3022 BUYPOSI=1) */
export const parseNetBuyRows = (rows: string[][], opt: ImportParseOptions): ImportParseResult => {
  const first = rows[0] ?? [];
  const periodCode = cellText(first[13]); // N 欄 = netbuy.a03begno (第 14 個欄位)
  if (!periodCode || /[^\x20-\x7e]/.test(periodCode) || !periodMatches(periodCode, opt)) throw periodMismatch(periodCode);

  const items: ImportExcelTrackItem[] = [];
  const companies = new Set<string>();
  for (const row of rows) {
    const rawUnino = cellText(row[0]);
    if (!/^\d/.test(rawUnino)) continue; // VFP: Delete All For Empty(unino) Or Not Isdigit(unino)
    const unifiedNo = normalizeUnino(rawUnino);
    if (!/^\d{8}$/.test(unifiedNo)) continue;
    const companyName = cellText(row[1]);
    const taxNo = cellText(row[2]);
    companies.add(`${unifiedNo}|${taxNo}`);
    for (const block of NETBUY_BLOCKS) {
      const quantity = parseQty(cellText(row[block.col]));
      const track = normalizeTrack(cellText(row[block.col + 1]));
      const startNo = normalizeInvoiceNo(cellText(row[block.col + 2]));
      const endNo = normalizeInvoiceNo(cellText(row[block.col + 3]));
      if (quantity === 0 && !track && !startNo && !endNo) continue;
      items.push({ unifiedNo, taxNo, companyName, buyDate: '', kind: block.kind, quantity, track, startNo, endNo });
    }
  }
  return { periodCode, items, companyCount: companies.size, skippedTypes: [] };
};

/** 代售點購買發票配號明細 (VFP wbase3022 BUYPOSI=2) */
export const parseAgentRows = (rows: string[][], opt: ImportParseOptions): ImportParseResult => {
  const endMonth = opt.endMonth.trim().padStart(2, '0');
  const wantRetail = opt.times.trim() === '2';
  const filtered = rows.filter((row) => isRetail(cellText(row[9])) === wantRetail);

  let periodCode = '';
  for (const row of filtered) {
    const p = cellText(row[0]);
    if (/^\d{5}$/.test(p)) {
      periodCode = p;
      break;
    }
  }
  if (!periodMatches(periodCode, opt)) throw periodMismatch(periodCode);

  const items: ImportExcelTrackItem[] = [];
  const companies = new Set<string>();
  const skippedTypes = new Set<string>();
  for (const row of filtered) {
    const unifiedNo = normalizeUnino(cellText(row[1]));
    if (!/^\d{8}$/.test(unifiedNo)) continue;
    if (cellText(row[0]).slice(-2) !== endMonth) continue; // VFP: 每一列也要迄月相同
    const taxNo = cellText(row[2]);
    const companyName = cellText(row[3]);
    const type = cellText(row[4]);
    const kind = AGENT_KIND_BY_TYPE[type];
    if (!kind) {
      if (type) skippedTypes.add(type);
      continue;
    }
    const [track, startNo, endNo, qty] =
      opt.qtyCol === 'F'
        ? [cellText(row[6]), cellText(row[7]), cellText(row[8]), cellText(row[5])]
        : [cellText(row[5]), cellText(row[6]), cellText(row[7]), cellText(row[8])];
    const buyDate = cellText(row[11]).slice(0, 7); // netbuy.buydate c(7)
    companies.add(`${unifiedNo}|${taxNo}|${buyDate}`);
    items.push({
      unifiedNo,
      taxNo,
      companyName,
      buyDate,
      kind,
      quantity: parseQty(qty),
      track: normalizeTrack(track),
      startNo: normalizeInvoiceNo(startNo),
      endNo: normalizeInvoiceNo(endNo),
    });
  }
  return { periodCode, items, companyCount: companies.size, skippedTypes: [...skippedTypes] };
};

export const parseImportRows = (rows: string[][], opt: ImportParseOptions): ImportParseResult =>
  opt.mode === '2' ? parseAgentRows(rows, opt) : parseNetBuyRows(rows, opt);

/** VFP wbase3022 [轉入] / F8 共同的期別檢查；回傳 null 代表通過 */
export const validatePeriodInput = (year: string, startMonth: string, endMonth: string): string | null => {
  const y = year.trim();
  const bm = startMonth.trim();
  const em = endMonth.trim();
  if (!y) return '年度不可空白!!';
  if (!bm || !em) return '月份不可空白!!';
  if (!/^\d+$/.test(y) || parseInt(y, 10) < 34) return '年度輸入不正確!!';
  const b = parseInt(bm, 10);
  const e = parseInt(em, 10);
  if (!Number.isFinite(b) || b > 12 || b < 1) return '月份輸入不正確!!';
  if (!Number.isFinite(e) || e > 12 || e < 1) return '月份輸入不正確!!';
  if (b % 2 === 0) return '請輸入奇數月份!!';
  if (e < b) return '月份區間不正確!!';
  return null;
};
