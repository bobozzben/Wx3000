import React, { useEffect, useRef, useState } from 'react';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  batchCreateReceipts,
  checkReceiptDate,
  isoToRoc,
  rocToIso,
  todayIso,
  type FeeReceiptBatchResult,
} from '../../services/wbase2040';
import { searchCustomers } from './lookups';
import { KeyHintBar } from './KeyHintBar';

interface Wbase2040BatchModalProps {
  onDone: (result: FeeReceiptBatchResult) => void;
  onClose: () => void;
}

type Field = 'cnoFrom' | 'cnoTo' | 'recdate' | 'month' | 'cycle';
const FIELDS: Field[] = ['cnoFrom', 'cnoTo', 'recdate', 'month', 'cycle'];

/**
 * 批次產生帳款收據 (VFP rec_all.scx)：
 * 對設定記帳費 (customer.recamt > 0) 的客戶，各產生一張收費單與一筆明細 (第一個收費項目)
 */
export const Wbase2040BatchModal: React.FC<Wbase2040BatchModalProps> = ({ onDone, onClose }) => {
  const { isDark } = useTheme();
  const [form, setForm] = useState<Record<Field, string>>({
    cnoFrom: '',
    cnoTo: '',
    recdate: isoToRoc(todayIso()),
    month: '',
    cycle: '',
  });
  const [picker, setPicker] = useState<'cnoFrom' | 'cnoTo' | null>(null);
  const [message, setMessage] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

  useEffect(() => {
    setTimeout(() => refs.current.cnoFrom?.focus(), 50);
  }, []);

  const run = async (force: boolean) => {
    if (busy) return;
    if (!form.month.trim()) {
      setMessage('請輸入月份資料!');
      refs.current.month?.focus();
      return;
    }
    const dateCheck = checkReceiptDate(form.recdate, '帳款日期');
    const iso = dateCheck.valid ? rocToIso(form.recdate) : null;
    if (!iso) {
      setMessage(dateCheck.message || '帳款日期格式錯誤');
      refs.current.recdate?.focus();
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await batchCreateReceipts({
        recdate: iso,
        month: form.month.trim(),
        cycle: form.cycle.trim(),
        cnoFrom: form.cnoFrom.trim().toUpperCase(),
        cnoTo: form.cnoTo.trim().toUpperCase(),
        force,
      });
      setConfirmText('');
      onDone(result);
    } catch (err: any) {
      if (err?.response?.status === 409 && err.response.data?.needConfirm) {
        setConfirmText(err.response.data.message);
      } else {
        setMessage(apiErrorMessage(err, '批次產生收據失敗'));
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (confirmText) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') run(true);
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') setConfirmText('');
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        run(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const focusNext = (field: Field, dir: 1 | -1) => {
    const idx = FIELDS.indexOf(field) + dir;
    if (idx >= 0 && idx < FIELDS.length) refs.current[FIELDS[idx]]?.focus();
  };

  const input = (field: Field, label: string, opts: { width?: string; maxLength?: number; f2?: boolean; hint?: string } = {}) => (
    <label className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-right font-bold">{label}</span>
      <input
        ref={(el) => {
          refs.current[field] = el;
        }}
        value={form[field]}
        maxLength={opts.maxLength}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusNext(field, 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusNext(field, -1);
          } else if (e.key === 'F2' && opts.f2) {
            e.preventDefault();
            setPicker(field as 'cnoFrom' | 'cnoTo');
          }
        }}
        className={`${opts.width || 'w-40'} rounded border-2 px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
          isDark ? 'bg-slate-900 border-slate-600 text-yellow-200' : 'bg-white border-slate-400 focus:bg-yellow-50'
        }`}
      />
      {opts.hint && <span className="text-xs opacity-70">{opts.hint}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        className={`flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`px-4 py-2 text-lg font-bold text-white ${isDark ? 'bg-slate-900' : 'bg-blue-900'}`}>批次產生帳款收據</div>
        <div className="space-y-3 p-4">
          {input('cnoFrom', '客戶 起:', { maxLength: 8, f2: true, hint: 'F2 開窗' })}
          {input('cnoTo', '客戶 迄:', { maxLength: 8, f2: true, hint: '有填迄才限制客戶區間' })}
          {input('recdate', '帳款日期:', { width: 'w-32', hint: '民國 yyy/mm/dd' })}
          {input('month', '帳款月份:', { width: 'w-32', maxLength: 10, hint: '必填，放在項目名稱前，例如「3」' })}
          {input('cycle', '帳款週期:', { width: 'w-16', maxLength: 1, hint: '空白表示只要有設定記帳費金額 都產生該日期收據' })}
          {message && <p className="font-bold text-red-600">{message}</p>}
          {confirmText && (
            <div className="rounded border-2 border-amber-500 bg-amber-50 p-3 font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {confirmText} <span className="ml-1 font-mono">(Y/N)</span>
            </div>
          )}
          {busy && <p className="font-bold text-blue-600">產生中，請稍候…</p>}
        </div>
        <KeyHintBar
          keys={[
            { key: 'F7', label: '產生收據', onClick: () => run(false) },
            { key: 'Esc', label: '離開', onClick: onClose, danger: true },
          ]}
        />
      </div>
      <SearchModal
        isOpen={picker !== null}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => {
          const field = picker!;
          setForm((f) => ({ ...f, [field]: item.code }));
          setPicker(null);
          setTimeout(() => focusNext(field, 1), 50);
        }}
        onClose={() => {
          const field = picker!;
          setPicker(null);
          setTimeout(() => refs.current[field]?.focus(), 50);
        }}
      />
    </div>
  );
};
