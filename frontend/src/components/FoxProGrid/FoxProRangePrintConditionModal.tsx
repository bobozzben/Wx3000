import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Filter, Moon, Printer, RotateCcw, Sun, X } from 'lucide-react';
import { useTheme } from '../../wbase/menu/ThemeContext';

export type FoxProRangeFieldKey = 'start' | 'end';

export interface FoxProRangePrintConditionValues {
  start: string;
  end: string;
}

export interface FoxProRangePrintConditionStatus {
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface FoxProRangePrintConditionModalProps {
  /** 視窗主標題 */
  title: string;
  /** 標題下方副標 / 程式代號說明 */
  subtitle?: string;
  /** 標題右側徽章 (預設「F7 列印條件」) */
  badge?: string;
  /** 區間卡片標題 (預設「列印編號區間」) */
  sectionTitle?: string;
  /** 區間卡片副標題 */
  sectionDescription?: string;
  /** 起始欄位標題與提示 */
  startLabel?: string;
  startHint?: string;
  startPlaceholder?: string;
  startEmptyHelper?: string;
  /** 起始值對應說明文字 (例如帶出名稱) */
  startDescription?: string;
  /** 結束欄位標題與提示 */
  endLabel?: string;
  endHint?: string;
  endPlaceholder?: string;
  endEmptyHelper?: string;
  /** 結束值對應說明文字 (例如帶出名稱) */
  endDescription?: string;
  /** 欄位最大長度 (預設 10) */
  maxLength?: number;
  /** 是否自動轉大寫 (預設 true) */
  uppercase?: boolean;
  /** 是否僅允許數字 (預設 false) */
  digitsOnly?: boolean;
  /** 範圍摘要前置標籤 (預設「列印範圍：」) */
  rangeSummaryLabel?: string;
  /** 起訖皆空白時顯示之範圍名稱 (預設「全部資料」) */
  allRangeText?: string;
  /** 符合筆數標籤文字 (例如「目前清冊符合：12 筆」) */
  matchedCountText?: string | null;
  /** 額外自訂條件內容區 (插槽) */
  extraContent?: React.ReactNode;
  /** 區間值狀態 */
  values: FoxProRangePrintConditionValues;
  onChange: (next: FoxProRangePrintConditionValues) => void;
  /** 子視窗 (SearchModal / 預覽 / Excel 欄位設定) 開啟或忙碌時設為 false 以停用熱鍵與按鈕 */
  active: boolean;
  isSubmitting: boolean;
  isExportBusy?: boolean;
  /** 是否顯示「匯出 xlsx 設定」與 [F8] 匯出按鈕 (預設當有傳入 onExport 時顯示) */
  showExportOption?: boolean;
  exportConfigure?: boolean;
  onExportConfigureChange?: (checked: boolean) => void;
  status?: FoxProRangePrintConditionStatus | null;
  focusRequest?: { key: FoxProRangeFieldKey } | null;
  /** 有傳入時在輸入框內右側顯示藍色 F2 按鈕並回應 F2 快捷鍵 */
  onOpenF2?: (target: FoxProRangeFieldKey) => void;
  f2Tooltip?: string;
  confirmLabel?: string;
  exportLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onExport?: () => void;
  onCancel: () => void;
  /** 是否以 Modal 遮罩覆蓋呈現 (預設 true) */
  overlay?: boolean;
  fieldIdPrefix?: string;
}

const normalizeRangeValue = (value: string, uppercase: boolean): string => {
  const trimmed = value.trim();
  return uppercase ? trimmed.toUpperCase() : trimmed;
};

/**
 * 共用區間型列印條件母版 (FoxProRangePrintConditionModal)
 * 封裝起始/結束編號雙欄區間輸入、輸入框內右側 F2 開窗查詢按鈕、「匯出 xlsx 設定」勾選、
 * 淺/深色雙主題與完整 FoxPro 鍵盤盲打導覽 (Enter/↓/↑/F2/F7/F8/Esc)。
 */
export const FoxProRangePrintConditionModal: React.FC<FoxProRangePrintConditionModalProps> = ({
  title,
  subtitle,
  badge = 'F7 列印條件',
  sectionTitle = '列印編號區間',
  sectionDescription = '可輸入起始與結束代號，或點擊輸入框右側 F2 開窗選取',
  startLabel = '起始編號',
  startHint = '空白從頭',
  startPlaceholder = '例如：01',
  startEmptyHelper = '未輸入（由第一筆開始）',
  startDescription,
  endLabel = '結束編號',
  endHint = '空白至尾',
  endPlaceholder = '例如：99',
  endEmptyHelper = '未輸入（列印至最後一筆）',
  endDescription,
  maxLength = 10,
  uppercase = true,
  digitsOnly = false,
  rangeSummaryLabel = '列印範圍：',
  allRangeText = '全部資料',
  matchedCountText,
  extraContent,
  values,
  onChange,
  active,
  isSubmitting,
  isExportBusy = false,
  showExportOption,
  exportConfigure = false,
  onExportConfigureChange,
  status = null,
  focusRequest = null,
  onOpenF2,
  f2Tooltip = '按 F2 或點此開啟搜尋清單',
  confirmLabel = '確定 [F7]',
  exportLabel = '匯出 Excel [F8]',
  cancelLabel = '離開 [Esc]',
  onConfirm,
  onExport,
  onCancel,
  overlay = true,
  fieldIdPrefix = 'foxpro-range-print',
}) => {
  const { isDark, toggleTheme } = useTheme();
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const exportConfigRef = useRef<HTMLInputElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const [validationError, setValidationError] = useState<{ key: FoxProRangeFieldKey; text: string } | null>(null);

  const hasExportSection = Boolean(onExport) && (showExportOption ?? true);
  const startNorm = normalizeRangeValue(values.start, uppercase);
  const endNorm = normalizeRangeValue(values.end, uppercase);

  const rangeValidationMsg = useMemo(() => {
    if (startNorm && endNorm && startNorm > endNorm) {
      return `${endLabel}不可小於${startLabel}`;
    }
    return null;
  }, [startNorm, endNorm, startLabel, endLabel]);

  const focusField = useCallback((key: FoxProRangeFieldKey) => {
    const el = key === 'start' ? startInputRef.current : endInputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      focusField('start');
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusField]);

  useEffect(() => {
    if (!focusRequest || !active) return;
    const timer = window.setTimeout(() => {
      focusField(focusRequest.key);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusRequest, active, focusField]);

  const isBusy = isSubmitting || isExportBusy;

  const triggerConfirm = useCallback(() => {
    if (!active || isBusy) return;
    if (rangeValidationMsg) {
      setValidationError({ key: 'end', text: rangeValidationMsg });
      focusField('end');
      return;
    }
    setValidationError(null);
    onConfirm();
  }, [active, isBusy, rangeValidationMsg, focusField, onConfirm]);

  const triggerExport = useCallback(() => {
    if (!active || isBusy || !onExport) return;
    if (rangeValidationMsg) {
      setValidationError({ key: 'end', text: rangeValidationMsg });
      focusField('end');
      return;
    }
    setValidationError(null);
    onExport();
  }, [active, isBusy, rangeValidationMsg, focusField, onExport]);

  // Capture 階段全域熱鍵：F7 確定列印、F8 匯出 Excel、Esc 離開
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        triggerConfirm();
      } else if (e.key === 'F8' && hasExportSection) {
        e.preventDefault();
        e.stopPropagation();
        triggerExport();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, hasExportSection, triggerConfirm, triggerExport, onCancel]);

  const handleFieldChange = (key: FoxProRangeFieldKey, rawValue: string) => {
    let nextValue = rawValue;
    if (digitsOnly) nextValue = nextValue.replace(/\D/g, '');
    if (uppercase) nextValue = nextValue.toUpperCase();
    setValidationError(null);
    onChange({
      ...values,
      [key]: nextValue,
    });
  };

  const handleFieldKeyDown = (key: FoxProRangeFieldKey) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!active) return;
    if (e.key === 'F2' && onOpenF2) {
      e.preventDefault();
      e.stopPropagation();
      onOpenF2(key);
      return;
    }
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (key === 'start') {
        focusField('end');
      } else if (rangeValidationMsg) {
        setValidationError({ key: 'end', text: rangeValidationMsg });
      } else {
        setValidationError(null);
        if (hasExportSection && onExportConfigureChange && exportConfigRef.current) {
          exportConfigRef.current.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }
      return;
    }
    if (e.key === 'ArrowUp' && key === 'end') {
      e.preventDefault();
      focusField('start');
    }
  };

  const handleClearRange = () => {
    setValidationError(null);
    onChange({ start: '', end: '' });
    focusField('start');
  };

  const hasAnyFilter = Boolean(startNorm || endNorm);

  const activeBanner: FoxProRangePrintConditionStatus | null = validationError
    ? { type: 'error', text: validationError.text }
    : rangeValidationMsg
      ? { type: 'error', text: rangeValidationMsg }
      : status;

  const renderRangeField = (
    key: FoxProRangeFieldKey,
    label: string,
    hint: string,
    placeholder: string,
    emptyHelper: string,
    description: string | undefined,
    normValue: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const hasError = validationError?.key === key || (key === 'end' && Boolean(rangeValidationMsg));
    const inputId = `${fieldIdPrefix}-${key}`;
    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={inputId} className={`text-sm font-bold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {label}
          </label>
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {hint}
          </span>
        </div>

        <div className="relative flex items-center">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={values[key]}
            maxLength={maxLength}
            inputMode={digitsOnly ? 'numeric' : undefined}
            autoComplete="off"
            placeholder={placeholder}
            disabled={!active || isBusy}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleFieldKeyDown(key)}
            className={`w-full h-11 rounded-lg border-[1.5px] pl-3 ${onOpenF2 ? 'pr-14' : 'pr-3'} text-base font-mono font-bold ${
              uppercase ? 'uppercase' : ''
            } tracking-wider transition outline-none shadow-2xs ${
              hasError
                ? isDark
                  ? 'bg-red-950/50 border-red-500 text-red-200 focus:ring-2 focus:ring-red-500/40'
                  : 'bg-red-50/70 border-red-500 text-red-800 focus:ring-2 focus:ring-red-400/40'
                : isDark
                  ? 'bg-slate-950 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-yellow-400/50'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
            }`}
          />
          {onOpenF2 && (
            <button
              type="button"
              tabIndex={-1}
              disabled={!active || isBusy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onOpenF2(key)}
              title={f2Tooltip}
              className="absolute right-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold rounded-md shadow-xs transition cursor-pointer flex items-center justify-center"
            >
              F2
            </button>
          )}
        </div>

        <div className="min-h-[18px] px-0.5 flex items-center text-xs truncate">
          {!normValue ? (
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{emptyHelper}</span>
          ) : description ? (
            <span className={`font-semibold truncate ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{description}</span>
          ) : (
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>將篩選代號：{normValue}</span>
          )}
        </div>
      </div>
    );
  };

  const dialog = (
    <div
      className={`w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-colors ${
        overlay ? 'max-h-[92vh]' : ''
      } ${isDark ? 'bg-slate-900 text-white border-slate-700/80' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
    >
      {/* 頂部標題列 */}
      <div
        className={`px-5 py-3.5 flex items-center justify-between transition-colors ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800'
            : 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-wide text-white">{title}</h2>
              {badge && (
                <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleTheme}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition cursor-pointer"
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-100" />}
            <span>{isDark ? '淺色' : '深色'}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => active && onCancel()}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/85 hover:text-white transition cursor-pointer"
            title="Esc 離開"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 內容區 */}
      <div className={`p-4 sm:p-5 space-y-3.5 ${overlay ? 'overflow-y-auto flex-1' : ''}`}>
        <div
          className={`rounded-xl p-4 sm:p-5 border shadow-xs space-y-4 transition-colors ${
            isDark ? 'bg-slate-800/85 border-slate-700' : 'bg-white border-slate-200/90'
          }`}
        >
          {/* 卡片標題與清除條件 */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-950/70 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h3 className={`text-sm sm:text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {sectionTitle}
                </h3>
                {sectionDescription && (
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sectionDescription}</p>
                )}
              </div>
            </div>

            {hasAnyFilter && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearRange}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>重設全部</span>
              </button>
            )}
          </div>

          {/* 起始 / 結束編號雙欄區間輸入 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-start">
            {renderRangeField(
              'start',
              startLabel,
              startHint,
              startPlaceholder,
              startEmptyHelper,
              startDescription,
              startNorm,
              startInputRef
            )}

            <div className="hidden sm:flex flex-col items-center pt-7">
              <span className="h-11 inline-flex items-center justify-center px-1.5 text-lg font-black text-slate-400">
                ～
              </span>
            </div>

            {renderRangeField(
              'end',
              endLabel,
              endHint,
              endPlaceholder,
              endEmptyHelper,
              endDescription,
              endNorm,
              endInputRef
            )}
          </div>

          {/* 區間摘要列 */}
          <div
            className={`rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border ${
              isDark
                ? 'bg-slate-900/70 border-slate-700/80 text-slate-300'
                : 'bg-blue-50/70 border-blue-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{rangeSummaryLabel}</span>
              <span className={`font-mono font-extrabold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                {hasAnyFilter ? `${startNorm || '起'} ～ ${endNorm || '迄'}` : allRangeText}
              </span>
            </div>

            {matchedCountText && (
              <span
                className={`px-2 py-0.5 rounded-md font-bold ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-blue-700 border border-blue-200/80'
                }`}
              >
                {matchedCountText}
              </span>
            )}
          </div>
        </div>

        {/* 呼叫端自訂延伸條件 */}
        {extraContent}

        {/* 匯出 xlsx 設定勾選區 */}
        {hasExportSection && onExportConfigureChange && (
          <label
            className={`p-3 sm:p-3.5 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-amber-400 ${
              exportConfigure
                ? isDark
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                  : 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-2xs'
                : isDark
                  ? 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <input
              ref={exportConfigRef}
              type="checkbox"
              checked={exportConfigure}
              disabled={!active || isBusy}
              onChange={(e) => onExportConfigureChange(e.target.checked)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  confirmBtnRef.current?.focus();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusField('end');
                }
              }}
              className="w-4 h-4 sm:w-5 sm:h-5 accent-emerald-600 rounded cursor-pointer focus:outline-none shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs sm:text-sm">匯出 xlsx 設定</span>
                {exportConfigure && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white">已勾選</span>
                )}
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                勾選此項時，按下 [F8 匯出 Excel] 將開啟欄位挑選視窗；未勾選則依上次設定直接匯出
              </p>
            </div>
          </label>
        )}

        {/* 狀態 / 錯誤訊息列 */}
        {activeBanner && (
          <div
            className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-center border shadow-2xs ${
              activeBanner.type === 'error'
                ? isDark
                  ? 'bg-red-950/70 border-red-800 text-red-200'
                  : 'bg-red-50 border-red-200 text-red-700'
                : activeBanner.type === 'success'
                  ? isDark
                    ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : activeBanner.type === 'warning'
                    ? isDark
                      ? 'bg-amber-950/70 border-amber-800 text-amber-200'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                    : isDark
                      ? 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}
          >
            {activeBanner.text}
          </div>
        )}
      </div>

      {/* 下方操作列 */}
      <div
        className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-t transition-colors ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/90 border-slate-200'
        }`}
      >
        <div className={`text-[11px] font-mono hidden sm:flex items-center gap-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>[Enter] 下一欄</span>
          {onOpenF2 && <span>[F2] 查詢</span>}
          <span>[F7] 列印</span>
          {hasExportSection && <span>[F8] 匯出</span>}
          <span>[Esc] 離開</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button
            ref={confirmBtnRef}
            type="button"
            disabled={!active || isBusy}
            onClick={triggerConfirm}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (hasExportSection && onExportConfigureChange && exportConfigRef.current) {
                  exportConfigRef.current.focus();
                } else {
                  focusField('end');
                }
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>{isSubmitting ? '查詢中...' : confirmLabel}</span>
          </button>

          {hasExportSection && (
            <button
              type="button"
              disabled={!active || isBusy}
              onClick={triggerExport}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>{isExportBusy ? '匯出中...' : exportLabel}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!active}
            onClick={onCancel}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 transition active:scale-95 shadow-2xs disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm font-bold cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <X className="w-4 h-4 text-red-500 stroke-[3]" />
            <span>{cancelLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return overlay ? (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4 select-none overflow-hidden">
      {dialog}
    </div>
  ) : (
    <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 flex items-start justify-center select-none">{dialog}</div>
  );
};

export default FoxProRangePrintConditionModal;
