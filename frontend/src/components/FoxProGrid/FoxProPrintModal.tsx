import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Printer, FileSpreadsheet, X } from 'lucide-react';
import { useTheme } from '../../wbase/menu/ThemeContext';
import { printElement } from '../../utils/printUtil';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from '../SelectXlsxField';

export { type XlsxFieldItem, type XlsxSerializedConfig } from '../SelectXlsxField';

export interface FoxProPrintColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (val: any, row: T, idx: number) => React.ReactNode;
}

export interface FoxProPrintModalProps<T extends Record<string, any>> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  reportTitle: string;
  reportSubtitle?: string;

  // Filter range inputs
  startCodeLabel?: string;
  startCodePlaceholder?: string;
  startCodeValue: string;
  onStartCodeChange: (val: string) => void;

  endCodeLabel?: string;
  endCodePlaceholder?: string;
  endCodeValue: string;
  onEndCodeChange: (val: string) => void;

  onSearch: () => void | Promise<void>;

  // Data & Table definitions
  data: T[];
  columns: FoxProPrintColumn<T>[];
  getRowKey?: (row: T, idx: number) => string | number;
  loading?: boolean;
  hasSearched?: boolean;
  emptyText?: string;

  // XLSX Export configuration
  enableXlsxExport?: boolean;
  xlsxFields?: XlsxFieldItem[];
  xlsxStorageKey?: string;
  xlsxFileName?: string;
  onExportXlsx?: (data: T[], selectedFields: XlsxFieldItem[]) => Promise<boolean> | boolean;

  // Actions
  extraActions?: React.ReactNode;

  // Modal sizing
  maxWidth?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl';
}

/**
 * FoxProPrintModal (統一列印母版組件)
 * 標準化全系統 F7/F8 列印預覽視窗、網頁直接列印與 Excel (.xlsx) 動態欄位自訂匯出功能。
 * 遵循 FoxPro 高對比視覺標準，並保證列印時排除輸入框、按鈕與遮罩。
 */
export function FoxProPrintModal<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  subtitle = '選擇列印範圍區間並進行預覽',
  reportTitle,
  reportSubtitle,
  startCodeLabel = '起始編號：',
  startCodePlaceholder = '留空代表從頭',
  startCodeValue,
  onStartCodeChange,
  endCodeLabel = '結束編號：',
  endCodePlaceholder = '留空代表至尾',
  endCodeValue,
  onEndCodeChange,
  onSearch,
  data,
  columns,
  getRowKey,
  loading = false,
  hasSearched = true,
  emptyText = '⚠️ 該區間內查無符合資料',
  enableXlsxExport = true,
  xlsxFields,
  xlsxStorageKey,
  xlsxFileName,
  onExportXlsx,
  extraActions,
  maxWidth = 'max-w-4xl',
}: FoxProPrintModalProps<T>) {
  const { isDark } = useTheme();
  const printContentRef = useRef<HTMLDivElement>(null);

  // 匯出 xlsx 設定勾選狀態
  const [exportXlsxConfig, setExportXlsxConfig] = useState(false);
  const [isXlsxModalOpen, setIsXlsxModalOpen] = useState(false);

  // 儲存金鑰 (若未傳入則以 reportTitle 作為辨識)
  const storageKey = useMemo(
    () => xlsxStorageKey || `${reportTitle}_xlsx_export_config`,
    [xlsxStorageKey, reportTitle]
  );

  // 候選全量 XLSX 匯出欄位清單 (若未明確傳入則自動從 columns 轉換)
  const defaultCandidateFields: XlsxFieldItem[] = useMemo(() => {
    if (xlsxFields && xlsxFields.length > 0) return xlsxFields;
    return columns.map((col) => ({
      key: col.key,
      label: col.label,
      customTitle: col.label,
      selected: true,
    }));
  }, [xlsxFields, columns]);

  // 讀取 localStorage 內已儲存之欄位自訂格式
  const [xlsxConfig, setXlsxConfig] = useState<XlsxSerializedConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.vFieldList) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved xlsx config from localStorage:', e);
    }
    return {
      vFieldList: '',
      vCaptionList: '',
      vDisplayFormat: '',
      vColorList: '',
    };
  });

  // 當 storageKey 變更時重新讀取 localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.vFieldList) {
          setXlsxConfig(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to reload xlsx config from localStorage:', e);
    }
    setXlsxConfig({
      vFieldList: '',
      vCaptionList: '',
      vDisplayFormat: '',
      vColorList: '',
    });
  }, [storageKey]);

  // 執行真正的 XLSX 匯出邏輯
  const executeExportExcel = async (selectedFields: XlsxFieldItem[]) => {
    const activeFields = selectedFields.filter((f) => f.selected);
    if (activeFields.length === 0) {
      alert('⚠️ 請至少選擇一個匯出欄位！');
      return;
    }
    if (!data || data.length === 0) {
      alert('⚠️ 目前查無資料可供匯出！');
      return;
    }

    if (onExportXlsx) {
      await onExportXlsx(data, activeFields);
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const exportRows = data.map((item, idx) => {
        const rowObj: Record<string, any> = {};
        activeFields.forEach((field) => {
          const title = field.customTitle || field.label;
          let val = (item as any)[field.key];
          if (field.key === 'seq' || field.key === '_seq' || field.key === 'index') {
            val = idx + 1;
          } else if (val === undefined || val === null || val === '') {
            // 欄位別名自動相容
            if (field.key === 'no') val = (item as any).empCode ?? '';
            else if (field.key === 'name') val = (item as any).empName ?? '';
            else if (field.key === 'phone') val = (item as any).mobile ?? '';
            else if (field.key === 'addr') val = (item as any).address ?? '';
            else if (field.key === 'memo') val = (item as any).depName ?? '';
          }
          rowObj[title] = val !== undefined && val !== null ? val : '';
        });
        return rowObj;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '清冊資料');

      const downloadFileName = `${xlsxFileName || reportTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, downloadFileName);
    } catch (err) {
      console.error('Failed to export xlsx:', err);
      alert('❌ EXCEL 匯出失敗，請檢查權限或瀏覽器設定。');
    }
  };

  // 按下「匯出 Excel」之處理
  const handleExportXlsxClick = () => {
    if (!data || data.length === 0) {
      alert('⚠️ 目前查無資料可供匯出！');
      return;
    }

    if (exportXlsxConfig) {
      // 勾選匯出設定時，彈出 FormUtilSelectXlsxFieldsList
      setIsXlsxModalOpen(true);
    } else {
      // 未勾選時，直接以預設或上次已儲存的設定輸出
      const configured = parseXlsxConfigParams(
        defaultCandidateFields,
        xlsxConfig.vFieldList,
        xlsxConfig.vCaptionList,
        xlsxConfig.vDisplayFormat,
        xlsxConfig.vColorList
      );
      executeExportExcel(configured);
    }
  };

  // 欄位選擇彈窗確認回傳
  const handleConfirmXlsxFields = (
    updatedFields: XlsxFieldItem[],
    savedConfig?: XlsxSerializedConfig
  ) => {
    if (savedConfig) {
      setXlsxConfig(savedConfig);
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedConfig));
      } catch (e) {
        console.warn('Failed to save xlsx export config to localStorage:', e);
      }
    }
    setIsXlsxModalOpen(false);
    executeExportExcel(updatedFields);
  };

  // 網頁直接列印
  const handleWebPrint = () => {
    if (printContentRef.current) {
      printElement(printContentRef.current, reportTitle);
    } else {
      window.print();
    }
  };

  // 表單搜尋送出
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  // 全域快速鍵監聽 (Esc, F7, F8)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 若開窗選擇欄位進行中，交由子視窗處理快速鍵
      if (isXlsxModalOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (data.length > 0) {
          handleWebPrint();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (enableXlsxExport && data.length > 0) {
          handleExportXlsxClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isXlsxModalOpen, data.length, enableXlsxExport, onClose, handleExportXlsxClick, handleWebPrint]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono print:static print:inset-auto print:p-0 print:bg-transparent print:block print:w-full">
      <div
        className={`border-4 rounded-lg p-6 ${maxWidth} w-full shadow-2xl flex flex-col max-h-[90vh] transition-colors print:border-none print:shadow-none print:p-0 print:max-w-none print:max-h-none print:w-full print:block ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-800'
        }`}
      >
        {/* Header - 列印時隱藏 */}
        <div
          className={`flex items-center justify-between pb-4 border-b transition-colors print:hidden ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-400 text-black rounded font-bold">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-yellow-300' : 'text-blue-900'}`}>
                {title}
              </h2>
              {subtitle && (
                <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-500'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-gray-300 hover:text-white cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Area - 列印時隱藏 */}
        <form
          onSubmit={handleSubmit}
          className={`py-3.5 border-b grid grid-cols-1 md:grid-cols-3 gap-3 items-end transition-colors print:hidden ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-yellow-400' : 'text-blue-900'}`}>
              {startCodeLabel}
            </label>
            <input
              type="text"
              value={startCodeValue}
              onChange={(e) => onStartCodeChange(e.target.value)}
              placeholder={startCodePlaceholder}
              className={`w-full px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-yellow-400' : 'text-blue-900'}`}>
              {endCodeLabel}
            </label>
            <input
              type="text"
              value={endCodeValue}
              onChange={(e) => onEndCodeChange(e.target.value)}
              placeholder={endCodePlaceholder}
              className={`w-full px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-800 hover:bg-blue-700 text-white font-bold py-1.5 rounded border border-blue-600 text-sm transition cursor-pointer disabled:opacity-50"
            >
              {loading ? '載入中...' : '搜尋清冊資料'}
            </button>
          </div>
        </form>

        {/* Print Preview Content */}
        <div className="flex-1 overflow-y-auto py-4 font-mono print:overflow-visible print:p-0 print:py-0">
          {!hasSearched ? (
            <div className={`p-12 text-center font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              請輸入區間條件後按「搜尋清冊資料」進行列印預覽
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-red-400 font-bold">
              {emptyText}
            </div>
          ) : (
            <div
              ref={printContentRef}
              className="bg-white text-black p-6 rounded shadow w-full mx-auto print:max-w-none print:shadow-none print:p-0 print:w-full"
            >
              {/* Report Header */}
              <div className="text-center mb-6 pb-2 border-b-2 border-black">
                <h1 className="text-2xl font-black tracking-widest">{reportTitle}</h1>
                <p className="text-xs text-gray-600 mt-1">
                  {reportSubtitle || `列印日期: ${new Date().toLocaleDateString('zh-TW')}`}
                </p>
              </div>

              {/* Report Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={`p-2 font-bold ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rIdx) => {
                    const rowKey = getRowKey ? getRowKey(row, rIdx) : rIdx;
                    return (
                      <tr key={rowKey} className="border-b border-gray-300">
                        {columns.map((col) => {
                          const val = row[col.key];
                          return (
                            <td
                              key={col.key}
                              className={`p-2 ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              } ${col.className || ''}`}
                            >
                              {col.render ? col.render(val, row, rIdx) : (val ?? '-')}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Report Footer */}
              <div className="mt-6 pt-2 border-t border-black flex justify-between text-xs text-gray-700">
                <span>總計筆數: {data.length} 筆</span>
                <span>頁碼: 1 / 1</span>
              </div>
            </div>
          )}
        </div>

        {/* Checkbox Card for XLSX Export (移至下方按鈕的上面) */}
        {enableXlsxExport && (
          <div className="pt-2 pb-2 print:hidden">
            <div
              onClick={() => setExportXlsxConfig(!exportXlsxConfig)}
              className={`p-2 sm:p-2.5 rounded-xl border-2 cursor-pointer flex items-center space-x-3 transition-all ${
                exportXlsxConfig
                  ? isDark
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                  : isDark
                  ? 'bg-slate-900/40 border-slate-700/60 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={exportXlsxConfig}
                onChange={(e) => setExportXlsxConfig(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 focus:ring-emerald-400 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex-1 flex flex-wrap items-center gap-x-2">
                <span className="font-extrabold text-xs sm:text-sm">匯出 xlsx 設定</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  (勾選此項時，按下「匯出 Excel」將彈出 FormUtilSelectXlsxFieldsList 選擇要匯出的欄位)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions - 列印時隱藏操作按鈕 */}
        <div
          className={`pt-4 border-t flex justify-between items-center transition-colors print:hidden ${
            isDark ? 'border-slate-700 text-gray-400' : 'border-slate-200 text-gray-600'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs">
            <span>[Esc] 關閉預覽</span>
            <span className="text-gray-400">|</span>
            <span>[F7] 網頁列印</span>
            {enableXlsxExport && (
              <>
                <span className="text-gray-400">|</span>
                <span>[F8] 匯出 Excel</span>
              </>
            )}
          </div>
          <div className="flex space-x-3 items-center">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 font-bold rounded text-sm transition cursor-pointer ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'
              }`}
            >
              取消
            </button>

            {extraActions}

            <button
              type="button"
              onClick={handleWebPrint}
              disabled={data.length === 0}
              className={`flex items-center space-x-1.5 px-4 py-1.5 font-bold rounded text-sm border transition disabled:opacity-50 cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-slate-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>網頁直接列印 [F7]</span>
            </button>

            {enableXlsxExport && (
              <button
                type="button"
                onClick={handleExportXlsxClick}
                disabled={data.length === 0}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-sm border border-emerald-500 transition disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>匯出 Excel [F8]</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shared XLSX Field Selection Modal (FormUtilSelectXlsxFieldsList) */}
      {enableXlsxExport && (
        <FormUtilSelectXlsxFieldsList
          isOpen={isXlsxModalOpen}
          title={`選擇匯出欄位 - ${reportTitle}`}
          fields={defaultCandidateFields}
          defaultFields={defaultCandidateFields}
          vFieldList={xlsxConfig.vFieldList}
          vCaptionList={xlsxConfig.vCaptionList}
          vDisplayFormat={xlsxConfig.vDisplayFormat}
          vColorList={xlsxConfig.vColorList}
          onConfirm={handleConfirmXlsxFields}
          onClose={() => setIsXlsxModalOpen(false)}
        />
      )}
    </div>
  );
}
