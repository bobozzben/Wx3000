import { useEffect, useState } from 'react';
import { fetchCustomers, type LabelCustomerItem } from './services/wbase5010';

/**
 * 5-1 ~ 5-5 共用：第一段選擇客戶的資料與第二段列印條件的欄位檢核。
 */

/**
 * 選擇客戶的兩種畫面：
 * - `select`：VFP wbase4000 報表列印多家選單 (5-1、5-3 ~ 5-5)，以 `selected` 表示選擇
 * - `copies`：VFP wbase201201 報表列印多家選單 (標籤用，5-2)，以 `prn` 列印份數表示，份數大於 0 即為選擇
 */
export type CustomerSelectMode = 'select' | 'copies';

/** 份數 (FoxProGridV2 編輯後會是字串)，限 0~99 (VFP InputMask "99") */
export const toCopies = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(99, Math.floor(n)) : 0;
};

/** 是否已選擇 (copies 模式看份數) */
export const isCustomerChosen = (row: LabelCustomerItem, mode: CustomerSelectMode) =>
  mode === 'copies' ? toCopies(row.prn) > 0 : row.selected;

/**
 * 載入客戶清單：排除代號空白，依代號排序 (VFP 以 tag no 複製 tmpcust)，全部未選擇、份數 0。
 */
export const useWbase50Customers = () => {
  const [rows, setRows] = useState<LabelCustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCustomers()
      .then((list) => {
        if (cancelled) return;
        if (!Array.isArray(list)) throw new Error('客戶資料格式不正確');
        const sorted = list
          .filter((c) => c.no && c.no.trim() !== '')
          .map((c) => ({ ...c, selected: false, prn: 0 }))
          .sort((a, b) => (a.no < b.no ? -1 : a.no > b.no ? 1 : 0));
        setRows(sorted);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '讀取客戶資料失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, setRows, loading, error };
};

/** 今天的民國年 3 碼 (VFP year100(year(date())-1911, 3)) */
export const currentRocYear = (): string => String(new Date().getFullYear() - 1911).padStart(3, '0');

type Values = Record<string, string | number>;

/** 年度不可空白 */
export const requireYear = (v: string): string | null => (v.trim() === '' ? '年度不可空白!' : null);

const monthOf = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s.trim()) : NaN);

/**
 * 月份 1~12 (VFP smonth.Valid / emonth.Valid)。VFP 的檢核寫成 !(value>=1 OR value<=12)，實際上不會擋任何值；
 * 這裡照訊息原意限制 1~12 (與 wbase5070 相同)
 */
export const validMonth = (v: string): string | null => {
  const m = monthOf(v);
  return m >= 1 && m <= 12 ? null : '請輸入1至12 月份!';
};

/** 結束月份：1~12 且不小於起始月份 */
export const validEndMonth =
  (startKey: string) =>
  (v: string, values: Values): string | null =>
    validMonth(v) ?? (monthOf(v) < monthOf(String(values[startKey] ?? '')) ? '結束月份比起始月份小!' : null);

/** 起訖代號：終止不可小於起始 (兩者都有值時) */
export const validEndCode =
  (startKey: string, message: string) =>
  (v: string, values: Values): string | null => {
    const start = String(values[startKey] ?? '').trim();
    const end = v.trim();
    return start && end && end < start ? message : null;
  };
