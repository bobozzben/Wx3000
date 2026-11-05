import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

/** 畫面上的條件 (輸入中的字串)；送出前由 parseCondition 轉成數字 */
export interface ConditionInput {
  year: string;
  smonth: string;
  emonth: string;
}

type FieldKey = keyof ConditionInput;

const FIELDS: { key: FieldKey; label: string; maxLength: number }[] = [
  { key: 'year', label: '資料年度：', maxLength: 3 },
  { key: 'smonth', label: '營業起始月份：', maxLength: 2 },
  { key: 'emonth', label: '結束月份：', maxLength: 2 },
];

/**
 * 欄位檢核 (VFP smonth.Valid / emonth.Valid / f8.Click)，回傳錯誤訊息或 null。
 * VFP 的月份檢核寫成 !(value>=1 OR value<=12)，實際上不會擋任何值；這裡照訊息原意限制 1~12
 */
const validateField = (key: FieldKey, v: ConditionInput): string | null => {
  const month = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s.trim()) : NaN);
  if (key === 'year') return v.year.trim() === '' ? '年度不可空白!' : null;
  const m = month(v[key]);
  if (!(m >= 1 && m <= 12)) return '請輸入1至12 月份!';
  if (key === 'emonth' && m < month(v.smonth)) return '結束月份比起始月份小!';
  return null;
};

interface Wbase5070ConditionProps {
  value: ConditionInput;
  onChange: (value: ConditionInput) => void;
  selectedCount: number;
  /** 密碼、進度或訊息視窗開啟時設為 false，不處理 F8 / Esc */
  active: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 碳健檢企業名單匯出功能 (VFP wbase5070)：資料年度、營業起始月份、結束月份。
 * Enter / ↓ 下一欄 (最後一欄到「F8 確定」鈕)、↑ 上一欄、F8 確定、Esc 放棄 (回主選單)
 */
export const Wbase5070Condition: React.FC<Wbase5070ConditionProps> = ({ value, onChange, selectedCount, active, onConfirm, onCancel }) => {
  const { isDark } = useTheme();
  const refs = useRef<Record<FieldKey, HTMLInputElement | null>>({ year: null, smonth: null, emonth: null });
  const okRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<{ key: FieldKey; message: string } | null>(null);

  useEffect(() => {
    refs.current.year?.focus();
  }, []);

  const focusField = (key: FieldKey) => setTimeout(() => refs.current[key]?.focus(), 0);

  /** F8：依序檢核三個欄位，錯誤時停在該欄 */
  const confirm = () => {
    for (const f of FIELDS) {
      const message = validateField(f.key, value);
      if (message) {
        setError({ key: f.key, message });
        focusField(f.key);
        return;
      }
    }
    setError(null);
    onConfirm();
  };

  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        confirmRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (/^F([1-9]|1[0-2])$/.test(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, onCancel]);

  const onFieldKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = FIELDS[idx].key;
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      // 年度在 F8 才檢查 (VFP 同)；月份離開時檢查，錯誤就留在原欄
      const message = key === 'year' ? null : validateField(key, value);
      if (message) {
        setError({ key, message });
        e.currentTarget.select(); // 留在原欄，直接打字即覆蓋 (VFP 數字欄是覆寫輸入)
        return;
      }
      setError(null);
      if (idx < FIELDS.length - 1) refs.current[FIELDS[idx + 1].key]?.focus();
      else okRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) refs.current[FIELDS[idx - 1].key]?.focus();
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4 flex items-start justify-center" style={{ fontFamily: 'Consolas, Monaco, monospace' }}>
      <div
        className={`mt-6 w-full max-w-md overflow-hidden rounded-lg border-2 shadow-xl ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`flex items-center gap-2 px-4 py-3 text-white ${isDark ? 'bg-slate-950' : 'bg-blue-900'}`}>
          <FileSpreadsheet className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-bold">碳健檢企業名單匯出功能</h3>
        </div>

        <div className={`m-4 space-y-3 rounded border p-5 text-base ${isDark ? 'border-sky-700 bg-slate-950/50' : 'border-[#0080ff] bg-[#f4faff]'}`}>
          {FIELDS.map((f, idx) => (
            <label key={f.key} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-right font-bold">{f.label}</span>
              <input
                ref={(el) => {
                  refs.current[f.key] = el;
                }}
                value={value[f.key]}
                maxLength={f.maxLength}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value.replace(/\D/g, '') })}
                onFocus={(e) => e.target.select()}
                onKeyDown={onFieldKeyDown(idx)}
                className={`w-20 rounded border-2 px-2 text-center font-mono text-base focus:outline-none ${
                  error?.key === f.key
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : isDark
                      ? 'bg-slate-950 border-slate-600 text-yellow-300 focus:border-yellow-400'
                      : 'bg-white border-blue-300 text-blue-700 focus:border-yellow-500 focus:bg-yellow-50'
                }`}
                style={{ height: 38 }}
              />
            </label>
          ))}
          <p className={`pt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            已選擇 <span className="font-bold text-red-600">{selectedCount}</span> 家客戶
          </p>
          {error && <p className="text-sm font-bold text-red-600">{error.message}</p>}
        </div>

        <div className={`flex justify-center gap-4 border-t px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
          <button
            ref={okRef}
            type="button"
            onClick={confirm}
            disabled={!active}
            className="w-28 rounded bg-blue-800 py-1.5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-60"
          >
            F8 確定
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={!active}
            className="w-28 rounded border border-red-400 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-60 dark:hover:bg-red-950"
          >
            Esc 放棄
          </button>
        </div>
      </div>
    </div>
  );
};
