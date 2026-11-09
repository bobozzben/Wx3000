import React, { useEffect, useRef, useState } from 'react';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from '../../components/SelectXlsxField';
import { exportReportToXlsx, fetchCustomers, type LabelCustomerItem } from './services/wbase5010';
import type { ConditionStatus } from './Wbase50ConditionForm';

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

const EMPTY_XLSX_CONFIG: XlsxSerializedConfig = { vFieldList: '', vCaptionList: '', vDisplayFormat: '', vColorList: '' };

/** 讀取已儲存的匯出欄位設定 (與 FoxProPrintModal 的 xlsxStorageKey 共用) */
const readXlsxConfig = (storageKey: string): XlsxSerializedConfig | null => {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? (JSON.parse(saved) as XlsxSerializedConfig) : null;
    return parsed && parsed.vFieldList ? parsed : null;
  } catch {
    return null;
  }
};

interface XlsxExportOptions<T> {
  /** 與列印預覽 (FoxProPrintModal xlsxStorageKey) 共用的設定 key */
  storageKey: string;
  fields: XlsxFieldItem[];
  /** 檔名 (不含 .xlsx)，匯出當下取值 */
  fileName: () => string;
  /** 取得要匯出的資料 */
  load: () => Promise<T[]>;
}

/**
 * 第二段的 F8 匯出 Excel (比照 wbase3020_buyinv_print)：查詢資料 → 依已儲存的欄位設定匯出；
 * 勾選「匯出 xlsx 設定」時先開 FormUtilSelectXlsxFieldsList，確定後儲存設定再匯出。
 * 設定在每次匯出時才讀 localStorage，所以在列印預覽改過的設定這裡也會用到。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWbase50XlsxExport = <T extends Record<string, any>>({ storageKey, fields, fileName, load }: XlsxExportOptions<T>) => {
  const [configure, setConfigure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ConditionStatus | null>(null);
  const [selector, setSelector] = useState<XlsxSerializedConfig | null>(null);
  const dataRef = useRef<T[]>([]);

  const write = async (selected: XlsxFieldItem[]) => {
    const active = selected.filter((f) => f.selected);
    if (active.length === 0) {
      setStatus({ type: 'error', text: '請至少選擇一個匯出欄位!' });
      return;
    }
    const name = fileName();
    const ok = await exportReportToXlsx(dataRef.current, active, name);
    setStatus(
      ok
        ? { type: 'success', text: `已匯出 ${dataRef.current.length} 筆資料：${name}.xlsx` }
        : { type: 'error', text: 'Excel 匯出失敗，請檢查瀏覽器的下載設定。' }
    );
  };

  const run = async () => {
    setBusy(true);
    setStatus({ type: 'info', text: '查詢匯出資料中…' });
    try {
      const data = await load();
      if (data.length === 0) {
        setStatus({ type: 'warning', text: '查無符合資料，沒有匯出。' });
        return;
      }
      dataRef.current = data;
      const saved = readXlsxConfig(storageKey);
      if (configure) {
        setStatus({ type: 'info', text: `共 ${data.length} 筆資料，請選擇匯出欄位。` });
        setSelector(saved ?? EMPTY_XLSX_CONFIG);
        return;
      }
      await write(parseXlsxConfigParams(fields, saved?.vFieldList, saved?.vCaptionList, saved?.vDisplayFormat, saved?.vColorList));
    } catch (err) {
      setStatus({ type: 'error', text: `查詢失敗：${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  };

  const selectorElement = selector
    ? React.createElement(FormUtilSelectXlsxFieldsList, {
        isOpen: true,
        fields,
        defaultFields: fields,
        vFieldList: selector.vFieldList,
        vCaptionList: selector.vCaptionList,
        vDisplayFormat: selector.vDisplayFormat,
        vColorList: selector.vColorList,
        onConfirm: (selected: XlsxFieldItem[], savedConfig?: XlsxSerializedConfig) => {
          if (savedConfig) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(savedConfig));
            } catch {
              // 無法儲存設定時仍照常匯出
            }
          }
          setSelector(null);
          void write(selected);
        },
        onClose: () => {
          setSelector(null);
          setStatus(null);
        },
      })
    : null;

  return { configure, setConfigure, busy, status, setStatus, run, selectorOpen: selector !== null, selectorElement };
};
