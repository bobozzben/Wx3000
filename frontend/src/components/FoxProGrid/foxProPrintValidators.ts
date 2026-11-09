import type { PrintConditionValues } from './FoxProPrintModalv2';

/**
 * FoxProPrintModalv2 文字欄常用的檢核與預設值 (PrintTextFieldDef.validate)。
 */

/** 今天的民國年 3 碼 (VFP year100(year(date())-1911, 3)) */
export const currentRocYear = (): string => String(new Date().getFullYear() - 1911).padStart(3, '0');

/** 年度不可空白 */
export const requireYear = (v: string): string | null => (v.trim() === '' ? '年度不可空白!' : null);

const monthOf = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s.trim()) : NaN);

/**
 * 月份 1~12。VFP 常見的 smonth.Valid / emonth.Valid 寫成 !(value>=1 OR value<=12)，實際上不會擋任何值；
 * 這裡照訊息原意限制 1~12
 */
export const validMonth = (v: string): string | null => {
  const m = monthOf(v);
  return m >= 1 && m <= 12 ? null : '請輸入1至12 月份!';
};

/** 民國年度不可空白且不可小於 34 (VFP CompareYear100(yy, "<", 34)：年度輸入不正確) */
export const validRocYear = (v: string): string | null => {
  const t = v.trim();
  if (t === '') return '年度不可空白!';
  return /^\d{1,3}$/.test(t) && Number(t) >= 34 ? null : '年度輸入不正確!';
};

/** 起始月份須為奇數 (統購發票以雙月為一期，VFP「請輸入奇數月份!!」) */
export const oddStartMonth = (v: string): string | null => {
  const m = monthOf(v);
  if (!(m >= 1 && m <= 12)) return '請輸入1至12 月份!';
  return m % 2 === 1 ? null : '請輸入奇數月份!';
};

/** 結束月份：1~12 且不小於起始月份 (`startKey` 為起始月份欄位的 key) */
export const validEndMonth =
  (startKey: string) =>
  (v: string, values: PrintConditionValues): string | null =>
    validMonth(v) ?? (monthOf(v) < monthOf(String(values[startKey] ?? '')) ? '結束月份比起始月份小!' : null);

/** 起訖代號：終止不可小於起始 (兩者都有值時) */
export const validEndCode =
  (startKey: string, message: string) =>
  (v: string, values: PrintConditionValues): string | null => {
    const start = String(values[startKey] ?? '').trim();
    const end = v.trim();
    return start && end && end < start ? message : null;
  };
