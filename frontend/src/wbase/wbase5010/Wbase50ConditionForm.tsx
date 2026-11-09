import React, { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';
import { KeyHintBar } from '../wbase2040/KeyHintBar';

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
  /** 欄位寬度 (Tailwind class)，預設 w-24 */
  widthClass?: string;
  /** 回傳錯誤訊息或 null；F7 時也會檢查 */
  validate?: (value: string, values: ConditionValues) => string | null;
  /** F2 開選單 (由頁面開 SearchModal，選到後自行 onChange) */
  onF2?: () => void;
}

export type ConditionFieldDef = OptionFieldDef | TextFieldDef;
export type ConditionValues = Record<string, string | number>;

interface Wbase50ConditionFormProps {
  /** 視窗標題 (VFP 表單 Caption) */
  title: string;
  fields: ConditionFieldDef[];
  values: ConditionValues;
  onChange: (values: ConditionValues) => void;
  /** 選擇客戶的家數 (第一段結果) */
  chosenCount: number;
  /** 補充說明 (例如 5-2 的總份數) */
  chosenNote?: string;
  /** 子視窗 (列印預覽、F2 選單) 開啟時設為 false，不處理 F7 / Esc */
  active: boolean;
  /** 列印鈕文字，預設「F7 列印」 */
  printLabel?: string;
  /** F7：欄位都通過檢核後呼叫 */
  onPrint: () => void;
  /** Esc 放棄：回主選單 */
  onCancel: () => void;
  /** 焦點要回到的欄位 (F2 選單關閉後)；每次設定新物件才會觸發 */
  focusRequest?: { key: string } | null;
}

const fieldValidate = (f: ConditionFieldDef, values: ConditionValues): string | null =>
  f.kind === 'text' && f.validate ? f.validate(String(values[f.key] ?? ''), values) : null;

/**
 * 第二段「列印條件」(VFP _form_print 系列表單：wbase2011、wbase2012、wbase5030、wbase5040、wbase5050)。
 * Enter / ↓ 下一欄 (最後一欄到「F7 列印」鈕，再按 Enter 等於 F7)、↑ 上一欄、選項欄 ←/→ 或數字鍵換選項、
 * 文字欄 F2 開選單、F7 列印、Esc 放棄 (回主選單)
 */
export const Wbase50ConditionForm: React.FC<Wbase50ConditionFormProps> = ({
  title,
  fields,
  values,
  onChange,
  chosenCount,
  chosenNote,
  active,
  printLabel = 'F7 列印',
  onPrint,
  onCancel,
  focusRequest,
}) => {
  const { isDark } = useTheme();
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const okRef = useRef<HTMLButtonElement>(null);
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

  /** F7：依序檢核欄位，錯誤時停在該欄 */
  const print = () => {
    for (const f of fields) {
      const message = fieldValidate(f, values);
      if (message) {
        setError({ key: f.key, message });
        focusField(f.key);
        return;
      }
    }
    setError(null);
    onPrint();
  };

  const printRef = useRef(print);
  printRef.current = print;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        printRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
      } else if (/^F([1-9]|1[0-2])$/.test(e.key) && e.key !== 'F2') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  const moveNext = (idx: number) => {
    if (idx < fields.length - 1) refs.current[fields[idx + 1].key]?.focus();
    else okRef.current?.focus();
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

  const focusRing = isDark ? 'focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400' : 'focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400';

  return (
    <>
    <div className="flex-1 min-h-0 overflow-auto p-4 flex items-start justify-center" style={{ fontFamily: 'Consolas, Monaco, monospace' }}>
      <div
        className={`mt-6 w-full max-w-2xl overflow-hidden rounded-lg border-2 shadow-xl ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`flex items-center gap-2 px-4 py-3 text-white ${isDark ? 'bg-slate-950' : 'bg-blue-900'}`}>
          <Printer className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>

        <div className={`m-4 space-y-3 rounded border p-5 text-base ${isDark ? 'border-sky-700 bg-slate-950/50' : 'border-[#0080ff] bg-[#f4faff]'}`}>
          {fields.map((f, idx) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-right font-bold">{f.label}</span>
              {f.kind === 'options' ? (
                <div
                  ref={(el) => {
                    refs.current[f.key] = el;
                  }}
                  role="radiogroup"
                  aria-label={f.label}
                  tabIndex={0}
                  onKeyDown={onOptionKeyDown(idx, f)}
                  className={`flex flex-wrap items-center gap-1 rounded border-2 px-1 py-1 outline-none ${
                    isDark ? 'border-slate-700 focus:border-yellow-400' : 'border-transparent focus:border-yellow-500 focus:bg-yellow-50'
                  }`}
                >
                  {f.options.map((o, oi) => {
                    const checked = values[f.key] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setValue(f.key, o.value);
                          refs.current[f.key]?.focus();
                        }}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-bold transition ${
                          checked
                            ? 'bg-blue-800 text-white'
                            : isDark
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-700 hover:bg-blue-100'
                        }`}
                      >
                        <span className={`text-[10px] ${checked ? 'text-yellow-300' : 'opacity-60'}`}>{oi + 1}</span>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => {
                      refs.current[f.key] = el;
                    }}
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
                    className={`${f.widthClass ?? 'w-24'} rounded border-2 px-2 font-mono text-base outline-none ${
                      f.uppercase ? 'uppercase' : ''
                    } ${
                      error?.key === f.key
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : isDark
                          ? `bg-slate-950 border-slate-600 text-yellow-300 ${focusRing}`
                          : `bg-white border-blue-300 text-blue-700 focus:bg-yellow-50 ${focusRing}`
                    }`}
                    style={{ height: 38 }}
                  />
                  {f.onF2 && <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>F2 選單</span>}
                </div>
              )}
            </div>
          ))}

          <p className={`pt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            已選擇 <span className="font-bold text-red-600">{chosenCount}</span> 家客戶{chosenNote ? `，${chosenNote}` : ''}
          </p>
          {error && <p className="text-sm font-bold text-red-600">{error.message}</p>}
        </div>

        <div className={`flex justify-center gap-4 border-t px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
          <button
            ref={okRef}
            type="button"
            onClick={print}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                movePrev(fields.length);
              }
            }}
            disabled={!active}
            className="w-32 rounded bg-blue-800 py-1.5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-60"
          >
            {printLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={!active}
            className="w-32 rounded border border-red-400 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-60 dark:hover:bg-red-950"
          >
            Esc 放棄
          </button>
        </div>
      </div>
    </div>
    <KeyHintBar
      keys={[
        { key: 'Enter', label: '下一欄' },
        { key: '←→', label: '換選項' },
        { key: 'F7', label: printLabel.replace(/^F7\s*/, ''), onClick: () => active && print() },
        { key: 'Esc', label: '放棄', onClick: () => active && onCancel(), danger: true },
      ]}
    />
    </>
  );
};
