/**
 * 本機時區的今天日期 `yyyy-MM-dd` (給匯出檔名用)。
 * 不可用 `new Date().toISOString()`：那是 UTC，台灣時間 08:00 前會變成前一天。
 */
export const localDateStamp = (date: Date = new Date()): string => {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
};
