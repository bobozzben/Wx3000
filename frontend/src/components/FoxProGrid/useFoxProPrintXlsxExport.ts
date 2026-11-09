import React, { useRef, useState } from 'react';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from '../SelectXlsxField';
import type { PrintConditionStatus } from './FoxProPrintModalv2';

const EMPTY_XLSX_CONFIG: XlsxSerializedConfig = { vFieldList: '', vCaptionList: '', vDisplayFormat: '', vColorList: '' };

/** 讀取已儲存的匯出欄位設定 (與 FoxProPrintModal 的 xlsxStorageKey 共用格式) */
const readXlsxConfig = (storageKey: string): XlsxSerializedConfig | null => {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? (JSON.parse(saved) as XlsxSerializedConfig) : null;
    return parsed && parsed.vFieldList ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * 依欄位設定把資料寫成 xlsx 並下載：只輸出 `selected` 的欄位，欄名用 `customTitle` (無則 `label`)，
 * `seq` 欄輸出序號。回傳是否成功。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exportFieldsToXlsx = async <T extends Record<string, any>>(
  data: T[],
  fields: XlsxFieldItem[],
  fileName: string,
  sheetName = '報表'
): Promise<boolean> => {
  try {
    const active = fields.filter((f) => f.selected);
    if (data.length === 0 || active.length === 0) return false;
    const rows = data.map((item, index) => {
      const row: Record<string, unknown> = {};
      active.forEach((f) => {
        const title = f.customTitle || f.label;
        const val = f.key === 'seq' ? index + 1 : item[f.key];
        row[title] = val !== null && val !== undefined ? val : '';
      });
      return row;
    });
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
    return true;
  } catch (err) {
    console.error('exportFieldsToXlsx 失敗:', err);
    return false;
  }
};

export interface FoxProPrintXlsxExportOptions<T> {
  /** 欄位設定的 localStorage key；與列印預覽 (FoxProPrintModal xlsxStorageKey) 用同一個即可共用設定 */
  storageKey: string;
  /** 候選匯出欄位 (沒有儲存設定時以各欄的 selected 為預設) */
  fields: XlsxFieldItem[];
  /** 檔名 (不含 .xlsx)，匯出當下取值 */
  fileName: () => string;
  /** 取得要匯出的資料 (查詢失敗時 throw，訊息會顯示在訊息列) */
  load: () => Promise<T[]>;
  /** 寫檔方式，預設 exportFieldsToXlsx */
  write?: (data: T[], fields: XlsxFieldItem[], fileName: string) => Promise<boolean> | boolean;
}

/**
 * FoxProPrintModalv2 的 F8 匯出 (比照 wbase3020_buyinv_print)：查詢資料 → 依已儲存的欄位設定匯出；
 * `configure` (「匯出 xlsx 設定」) 為 true 時先開 FormUtilSelectXlsxFieldsList，確定後儲存設定再匯出。
 * 設定在每次匯出時才讀 localStorage，所以在列印預覽改過的設定這裡也會用到。
 *
 * 用法：把 `configure`、`setConfigure`、`status`、`run` 接到 FoxProPrintModalv2，
 * `busy || selectorOpen` 時把 `active` 設為 false，並在畫面上放 `selectorElement`。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFoxProPrintXlsxExport = <T extends Record<string, any>>({
  storageKey,
  fields,
  fileName,
  load,
  write = exportFieldsToXlsx,
}: FoxProPrintXlsxExportOptions<T>) => {
  const [configure, setConfigure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PrintConditionStatus | null>(null);
  const [selector, setSelector] = useState<XlsxSerializedConfig | null>(null);
  const dataRef = useRef<T[]>([]);

  const writeFile = async (selected: XlsxFieldItem[]) => {
    const active = selected.filter((f) => f.selected);
    if (active.length === 0) {
      setStatus({ type: 'error', text: '請至少選擇一個匯出欄位!' });
      return;
    }
    const name = fileName();
    const ok = await write(dataRef.current, active, name);
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
      await writeFile(parseXlsxConfigParams(fields, saved?.vFieldList, saved?.vCaptionList, saved?.vDisplayFormat, saved?.vColorList));
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
          void writeFile(selected);
        },
        onClose: () => {
          setSelector(null);
          setStatus(null);
        },
      })
    : null;

  return { configure, setConfigure, busy, status, setStatus, run, selectorOpen: selector !== null, selectorElement };
};
