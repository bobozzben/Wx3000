import React, { useEffect, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Moon, Printer, Sun, Users, X, type LucideIcon } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

/** VFP optiongroup：←/→ (或數字鍵) 換選項 */
export interface OptionFieldDef {
  kind: 'options';
  key: string;
  label: string;
  options: { value: number; label: string }[];
}

/** VFP textbox：Enter 離開時檢核，錯誤就留在原欄 */
export interface TextFieldDef {
  kind: 'text';
  key: string;
  label: string;
  maxLength: number;
  /** 只收數字 */
  digits?: boolean;
  /** 轉大寫 */
  uppercase?: boolean;
  placeholder?: string;
  /** 欄位寬度 (Tailwind class)，預設 w-20 */
  widthClass?: string;
  /** 輸入框前、後的文字 (例如「年」「月」「~」) */
  prefix?: string;
  suffix?: string;
  /** 回傳錯誤訊息或 null；F7 / F8 時也會檢查 */
  validate?: (value: string, values: ConditionValues) => string | null;
  /** F2 開選單 (由頁面開 SearchModal，選到後自行 onChange) */
  onF2?: () => void;
}

export type ConditionFieldDef = OptionFieldDef | TextFieldDef;
export type ConditionValues = Record<string, string | number>;

/** 一張條件卡片：標題、圖示與卡片內的欄位 (選項欄一張卡片一個；文字欄可以多個排成一列) */
export interface ConditionSection {
  title: string;
  icon: LucideIcon;
  fields: ConditionFieldDef[];
  /** 卡片右側的標籤 (例如「115年03-12月」) */
  badge?: string;
}

/** 下方訊息列 */
export interface ConditionStatus {
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

interface Wbase50ConditionFormProps {
  /** 視窗標題 (VFP 表單 Caption) */
  title: string;
  /** 標題下方的小字 (VFP 表單類別) */
  formCode: string;
  sections: ConditionSection[];
  values: ConditionValues;
  onChange: (values: ConditionValues) => void;
  /** 選擇客戶的家數 (第一段結果) */
  chosenCount: number;
  /** 補充說明 (例如 5-2 的總份數) */
  chosenNote?: string;
  /** 子視窗 (列印預覽、F2 選單、匯出欄位設定) 開啟或查詢中時設為 false，不處理按鍵、按鈕停用 */
  active: boolean;
  /** F7 鈕文字，預設「F7. 列印預覽」 */
  printLabel?: string;
  /** F7：欄位都通過檢核後呼叫 */
  onPrint: () => void;
  /** F8 匯出 Excel (有傳才顯示「F8. 匯出」與「匯出 xlsx 設定」) */
  onExport?: () => void;
  exportLabel?: string;
  /** 「匯出 xlsx 設定」勾選狀態 */
  exportConfigure?: boolean;
  onExportConfigureChange?: (value: boolean) => void;
  /** Esc 放棄：回主選單 */
  onCancel: () => void;
  /** 下方訊息列 */
  status?: ConditionStatus | null;
  /** 焦點要回到的欄位 (F2 選單關閉後)；每次設定新物件才會觸發 */
  focusRequest?: { key: string } | null;
}

const fieldValidate = (f: ConditionFieldDef, values: ConditionValues): string | null =>
  f.kind === 'text' && f.validate ? f.validate(String(values[f.key] ?? ''), values) : null;

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

/**
 * 第二段「列印條件」(VFP _form_print 系列表單：wbase2011、wbase2012、wbase5030、wbase5040、wbase5050)，
 * 版面比照 wbase3020_buyinv_print：漸層標題列、條件卡片、選項方塊、匯出 xlsx 設定、訊息列與下方按鍵列。
 * Enter / ↓ 下一欄 (最後到「匯出 xlsx 設定」或「F7」鈕)、↑ 上一欄、選項欄 ←/→/Space 或數字鍵換選項、
 * 文字欄 F2 開選單、F7 列印預覽、F8 匯出 Excel、Esc 放棄 (回主選單)
 */
export const Wbase50ConditionForm: React.FC<Wbase50ConditionFormProps> = ({
  title,
  formCode,
  sections,
  values,
  onChange,
  chosenCount,
  chosenNote,
  active,
  printLabel = 'F7. 列印預覽',
  onPrint,
  onExport,
  exportLabel = 'F8. 匯出',
  exportConfigure = false,
  onExportConfigureChange,
  onCancel,
  status,
  focusRequest,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const fields = sections.flatMap((s) => s.fields);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const configRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (fields.length > 0) refs.current[fields[0].key]?.focus();
    // 只在開啟時聚焦第一欄
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    const t = setTimeout(() => refs.current[focusRequest.key]?.focus(), 0);
    return () => clearTimeout(t);
  }, [focusRequest]);

  const focusField = (key: string) => setTimeout(() => refs.current[key]?.focus(), 0);

  /** 依序檢核欄位，錯誤時停在該欄；全部通過回傳 true */
  const validateAll = () => {
    for (const f of fields) {
      const message = fieldValidate(f, values);
      if (message) {
        setError({ key: f.key, message });
        focusField(f.key);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const print = () => {
    if (validateAll()) onPrint();
  };
  const exportXlsx = () => {
    if (onExport && validateAll()) onExport();
  };

  const actionsRef = useRef({ print, exportXlsx, cancel: onCancel });
  actionsRef.current = { print, exportXlsx, cancel: onCancel };
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current.print();
      } else if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current.exportXlsx();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current.cancel();
      } else if (FUNCTION_KEY.test(e.key) && e.key !== 'F2') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  /** 最後一欄之後：有匯出設定就到勾選框，否則到 F7 鈕 */
  const focusAfterFields = () => (onExport && configRef.current ? configRef.current : printRef.current)?.focus();
  const moveNext = (idx: number) => {
    if (idx < fields.length - 1) refs.current[fields[idx + 1].key]?.focus();
    else focusAfterFields();
  };
  const movePrev = (idx: number) => {
    if (idx > 0) refs.current[fields[idx - 1].key]?.focus();
  };

  const setValue = (key: string, value: string | number) => onChange({ ...values, [key]: value });

  const onOptionKeyDown = (idx: number, f: OptionFieldDef) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pos = f.options.findIndex((o) => o.value === values[f.key]);
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveNext(idx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      movePrev(idx);
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      setValue(f.key, f.options[(pos + 1 + f.options.length) % f.options.length].value);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setValue(f.key, f.options[(pos - 1 + f.options.length) % f.options.length].value);
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= f.options.length) {
      e.preventDefault();
      setValue(f.key, f.options[Number(e.key) - 1].value);
    }
  };

  const onTextKeyDown = (idx: number, f: TextFieldDef) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const message = fieldValidate(f, values);
      if (message) {
        setError({ key: f.key, message });
        e.currentTarget.select(); // 留在原欄，直接打字即覆蓋
        return;
      }
      setError(null);
      moveNext(idx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      movePrev(idx);
    } else if (e.key === 'F2' && f.onF2) {
      e.preventDefault();
      f.onF2();
    }
  };

  const cardClass = `rounded-2xl p-3.5 sm:p-4 border shadow-xs transition-colors focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/40 ${
    isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90 shadow-slate-100'
  }`;
  const pillClass = `text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${
    isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
  }`;
  const mutedText = isDark ? 'text-slate-300' : 'text-slate-600';
  const gridCols = (n: number) => (n >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2');

  const renderOption = (f: OptionFieldDef, idx: number) => (
    <div
      key={f.key}
      ref={(el) => {
        refs.current[f.key] = el;
      }}
      role="radiogroup"
      aria-label={f.label}
      tabIndex={0}
      onKeyDown={onOptionKeyDown(idx, f)}
      className={`grid grid-cols-1 ${gridCols(f.options.length)} gap-2.5 rounded-xl outline-none`}
    >
      {f.options.map((o, oi) => {
        const checked = values[f.key] === o.value;
        return (
          <div
            key={o.value}
            role="radio"
            aria-checked={checked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setValue(f.key, o.value);
              refs.current[f.key]?.focus();
            }}
            className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all ${
              checked
                ? isDark
                  ? 'bg-indigo-950/70 border-indigo-500 text-white font-black shadow-md'
                  : 'bg-indigo-600 border-indigo-600 text-white font-black shadow-md shadow-indigo-600/20'
                : isDark
                  ? 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="font-extrabold text-xs sm:text-sm">
              {oi + 1}. {o.label}
            </span>
            {checked && <Check className="w-4 h-4 stroke-[3]" />}
          </div>
        );
      })}
    </div>
  );

  const renderText = (f: TextFieldDef, idx: number) => (
    <React.Fragment key={f.key}>
      {f.prefix && <span className={`font-bold ${mutedText}`}>{f.prefix}</span>}
      <input
        ref={(el) => {
          refs.current[f.key] = el;
        }}
        aria-label={f.label}
        value={String(values[f.key] ?? '')}
        maxLength={f.maxLength}
        inputMode={f.digits ? 'numeric' : undefined}
        autoComplete="off"
        placeholder={f.placeholder}
        onChange={(e) => {
          let v = e.target.value;
          if (f.digits) v = v.replace(/\D/g, '');
          if (f.uppercase) v = v.toUpperCase();
          setValue(f.key, v);
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={onTextKeyDown(idx, f)}
        className={`${f.widthClass ?? 'w-20'} px-2.5 border-2 rounded-xl text-center font-black text-base transition outline-none ${
          f.uppercase ? 'uppercase' : ''
        } ${
          error?.key === f.key
            ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-300'
            : isDark
              ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
              : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
        }`}
        style={{ height: 38 }}
      />
      {f.suffix && <span className={`font-bold ${mutedText}`}>{f.suffix}</span>}
    </React.Fragment>
  );

  const sectionHint = (s: ConditionSection) => {
    if (s.fields.some((f) => f.kind === 'options')) return '[←/→] 切換';
    if (s.fields.some((f) => f.kind === 'text' && f.onF2)) return '[F2] 選單 / [Enter] 下一欄';
    return '[Enter] 下一欄';
  };

  // 訊息列：欄位錯誤優先
  const banner: ConditionStatus | null = error ? { type: 'error', text: error.message } : (status ?? null);
  const bannerClass: Record<ConditionStatus['type'], string> = {
    info: isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900',
    success: isDark ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: isDark ? 'bg-amber-950/70 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900',
    error: isDark ? 'bg-red-950/70 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 flex items-start justify-center font-mono select-none">
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors ${
          isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
        {/* 漸層標題列 */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between transition-colors ${
            isDark
              ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800'
              : 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">{title}</h2>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">Enter/F7 列印</span>
              </div>
              <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">{formCode}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleTheme}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition"
              title={isDark ? '切換至淺色主題' : '切換至深色主題'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-200" />}
              <span>{isDark ? '淺色' : '深色'}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => active && onCancel()}
              className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition"
              title="Esc 離開"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5">
          {/* 列印對象 (第一段選擇的客戶) */}
          <div className={`${cardClass} flex items-center justify-between gap-2.5 flex-wrap`}>
            <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
              <span className={isDark ? 'text-white' : 'text-slate-800'}>列印對象</span>
            </div>
            <div className="flex items-center gap-2">
              {chosenNote && <span className={pillClass}>{chosenNote}</span>}
              <span className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-md shadow-indigo-600/20 tracking-wider">
                已選擇 {chosenCount} 家客戶
              </span>
            </div>
          </div>

          {/* 條件卡片 */}
          {sections.map((s) => {
            const Icon = s.icon;
            const hasOptions = s.fields.some((f) => f.kind === 'options');
            return (
              <div key={s.title} className={`${cardClass} space-y-2.5`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                    <span className={isDark ? 'text-white' : 'text-slate-800'}>{s.title}</span>
                  </div>
                  <span className={pillClass}>{sectionHint(s)}</span>
                </div>
                {hasOptions ? (
                  s.fields.map((f) => (f.kind === 'options' ? renderOption(f, fields.indexOf(f)) : null))
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-2.5">
                    <div className="flex items-center flex-wrap gap-1.5 text-sm sm:text-base">
                      {s.fields.map((f) => (f.kind === 'text' ? renderText(f, fields.indexOf(f)) : null))}
                    </div>
                    {s.badge && (
                      <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-md shadow-indigo-600/20 tracking-wider">
                        {s.badge}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 匯出 xlsx 設定 */}
          {onExport && (
            <label
              className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center space-x-3 transition-all focus-within:ring-2 focus-within:ring-amber-400 ${
                exportConfigure
                  ? isDark
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                  : isDark
                    ? 'bg-slate-900/40 border-slate-700/60 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <input
                ref={configRef}
                type="checkbox"
                checked={exportConfigure}
                onChange={(e) => onExportConfigureChange?.(e.target.checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    printRef.current?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    movePrev(fields.length);
                  }
                }}
                className="w-4 h-4 sm:w-5 sm:h-5 accent-emerald-600 rounded cursor-pointer focus:outline-none"
              />
              <div className="flex-1">
                <span className="font-extrabold text-xs sm:text-sm">匯出 xlsx 設定</span>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  (勾選時按 F8 匯出會先開啟欄位選擇視窗；設定與列印預覽的匯出共用)
                </p>
              </div>
            </label>
          )}

          {/* 訊息列 */}
          {banner && (
            <div className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold text-center border shadow-xs ${bannerClass[banner.type]}`}>
              {banner.text}
            </div>
          )}
        </div>

        {/* 下方按鍵列 */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-end gap-2.5 border-t transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/90'
          }`}
        >
          <button
            ref={printRef}
            type="button"
            onClick={print}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (onExport) configRef.current?.focus();
                else movePrev(fields.length);
              }
            }}
            disabled={!active}
            className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>{printLabel}</span>
          </button>
          {onExport && (
            <button
              type="button"
              onClick={exportXlsx}
              disabled={!active}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>{exportLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={!active}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl border-2 transition active:scale-95 shadow-xs disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm font-bold ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            <X className="w-4 h-4 text-red-500 stroke-[3]" />
            <span>Esc. 離開</span>
          </button>
        </div>
      </div>
    </div>
  );
};
