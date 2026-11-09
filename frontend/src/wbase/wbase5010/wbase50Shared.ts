import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { PrintConditionSummary } from '../../components/FoxProGrid/FoxProPrintModalv2';
import { fetchCustomers, type LabelCustomerItem } from './services/wbase5010';

/**
 * 5-1 ~ 5-5 共用：第一段選擇客戶的資料。第二段列印條件用 components/FoxProGrid 的 FoxProPrintModalv2
 * (檢核在 foxProPrintValidators.ts、F8 匯出在 useFoxProPrintXlsxExport.ts)。
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

/** FoxProPrintModalv2 的摘要卡片「列印對象：已選擇 n 家客戶」 */
export const chosenSummary = (count: number, note?: string): PrintConditionSummary => ({
  title: '列印對象',
  icon: Users,
  value: `已選擇 ${count} 家客戶`,
  note,
});
