import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, X, Calendar, Building2, Eye, Sun, Moon, FileText } from 'lucide-react';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  checkReceiptDate,
  fetchBillPrintRows,
  fetchOfficeInfo,
  fetchReceiptPrintRows,
  isoToRoc,
  printBillReport,
  printReceiptReport,
  rocToIso,
  todayIso,
  type FeeReceiptPrintRow,
} from '../../services/wbase2040';
import { searchCustomers } from './lookups';

export type Wbase2040RecPrintMode = 'receipt' | 'bill';

interface Wbase2040RecPrintProps {
  mode: Wbase2040RecPrintMode;
  onClose: () => void;
}

const META: Record<Wbase2040RecPrintMode, { title: string; form: string; func: string; dateLabel: string }> = {
  receipt: { title: '收費資料列印 (收據)', form: 'recpr1 → reccno.frx', func: 'wbase2040_receipt', dateLabel: '印表日期' },
  bill: { title: '請款單列印', form: 'recpr2 → recapy.frx', func: 'wbase2040_bill', dateLabel: '印製日期' },
};

type Field = 'dateFrom' | 'dateTo' | 'cnoFrom' | 'cnoTo' | 'rnoFrom' | 'rnoTo' | 'unpaidOnly' | 'ym' | 'printDate' | 'output';

const FIELDS: Record<Wbase2040RecPrintMode, Field[]> = {
  receipt: ['dateFrom', 'dateTo', 'cnoFrom', 'cnoTo', 'rnoFrom', 'rnoTo', 'unpaidOnly', 'printDate', 'output'],
  bill: ['cnoFrom', 'cnoTo', 'ym', 'printDate', 'output'],
};

const fmt = (n: number) => Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });

/**
 * F4 收據列印 (VFP recpr1.scx) / F6 請款單列印 (VFP recpr2.scx)
 * 畫面比照 wbase3020_buyinv_print：F4 預覽資料、F7 以 wbaseRP.dll 預覽或列印、Esc 離開
 */
export const Wbase2040RecPrint: React.FC<Wbase2040RecPrintProps> = ({ mode, onClose }) => {
  const { isDark, toggleTheme } = useTheme();
  const meta = META[mode];
  const today = isoToRoc(todayIso());
  const [form, setForm] = useState<Record<Field, string>>({
    dateFrom: today,
    dateTo: today,
    cnoFrom: '',
    cnoTo: '',
    rnoFrom: '',
    rnoTo: '',
    unpaidOnly: '',
    ym: today.slice(0, 6),
    printDate: today,
    output: '0', // 0: 預覽列印, 1: 立即列印 (VFP op1)
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<FeeReceiptPrintRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [picker, setPicker] = useState<'cnoFrom' | 'cnoTo' | null>(null);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const fields = FIELDS[mode];

  const focusField = (f: Field) =>
    setTimeout(() => {
      const el = refs.current[f];
      el?.focus();
      if (el && el.type !== 'checkbox' && el.type !== 'radio') el.select();
    }, 50);

  useEffect(() => {
    focusField(fields[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const set = (f: Field, v: string) => setForm((s) => ({ ...s, [f]: v }));

  const next = (f: Field) => {
    const idx = fields.indexOf(f);
    if (idx < fields.length - 1) focusField(fields[idx + 1]);
  };

  const dateIso = (f: Field, label: string): string | null => {
    const check = checkReceiptDate(form[f], label);
    const iso = check.valid ? rocToIso(form[f]) : null;
    if (!iso) {
      setStatus(`⚠️ ${check.message || `${label}格式錯誤`}`);
      focusField(f);
    }
    return iso;
  };

  /** 依條件向後端查詢列印資料 (條件錯誤時回傳 null) */
  const queryData = useCallback(async (): Promise<FeeReceiptPrintRow[] | null> => {
    setBusy(true);
    setStatus('正在查詢收費資料...');
    try {
      let data: FeeReceiptPrintRow[];
      if (mode === 'receipt') {
        const d1 = dateIso('dateFrom', '起始日期');
        const d2 = d1 && dateIso('dateTo', '結束日期');
        if (!d1 || !d2) return null;
        data = await fetchReceiptPrintRows({
          dateFrom: d1,
          dateTo: d2,
          cnoFrom: form.cnoFrom.trim().toUpperCase(),
          cnoTo: form.cnoTo.trim().toUpperCase(),
          rnoFrom: form.rnoFrom.trim(),
          rnoTo: form.rnoTo.trim(),
          unpaidOnly: form.unpaidOnly === '1',
        });
      } else {
        const m = /^(\d{2,3})\/?(\d{1,2})$/.exec(form.ym.trim());
        if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
          setStatus('⚠️ 帳款年月格式錯誤，例如 115/03');
          focusField('ym');
          return null;
        }
        data = await fetchBillPrintRows(Number(m[1]), Number(m[2]), form.cnoFrom.trim().toUpperCase(), form.cnoTo.trim().toUpperCase());
      }
      setRows(data);
      setStatus(data.length ? `資料查詢完成，共 ${data.length} 筆明細。` : '無任何資料!');
      return data;
    } catch (err) {
      setStatus(`⚠️ ${apiErrorMessage(err, '查詢失敗')}`);
      return null;
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode]);

  // F4 預覽資料 (除錯用)
  const handlePreviewData = useCallback(async () => {
    const data = await queryData();
    if (data) setPreviewOpen(true);
  }, [queryData]);

  // F7 列印：查詢 → 寫 JSON 暫存檔 → wbaseRP.dll 預覽或列印
  const handlePrint = useCallback(async () => {
    if (busy) return;
    const data = await queryData();
    if (!data) return;
    if (data.length === 0) {
      alert('⚠️ 無任何資料!');
      return;
    }
    const printDate = form.printDate.trim() ? checkReceiptDate(form.printDate, meta.dateLabel) : { valid: true, message: '', normalized: '' };
    if (!printDate.valid) {
      setStatus(`⚠️ ${printDate.message}`);
      focusField('printDate');
      return;
    }
    setBusy(true);
    setStatus(`正在透過 LocalAgent 產生 JSON 暫存檔並呼叫 ${meta.func} 報表...`);
    try {
      const office = await fetchOfficeInfo();
      const params = { top_mag: 0, left_mag: 0, PrtIndex: 0, IsPrint: Number(form.output) };
      const res =
        mode === 'receipt'
          ? await printReceiptReport(data, office, printDate.normalized || '', params)
          : await printBillReport(data, office, printDate.normalized || '', params);
      if (res.success) {
        setStatus(`🎉 報表已送出 (wbaseRP.dll -> ${meta.func}，回傳碼: ${res.retCode ?? 0})`);
      } else {
        setStatus(`⚠️ 報表呼叫失敗: ${res.error || 'LocalAgent 服務未啟動'}`);
        alert(`[F7.列印失敗]\nLocalAgent 報表呼叫未成功：\n${res.error || '請確認本機 LocalAgent (http://localhost:5009) 服務已啟動'}`);
      }
    } catch (err) {
      setStatus(`⚠️ ${apiErrorMessage(err, '讀取事務所資料失敗')}`);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, queryData, form, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picker) return;
      if (previewOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setPreviewOpen(false);
        }
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        handlePreviewData();
      } else if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picker, previewOpen, handlePreviewData, handlePrint, onClose]);

  const inputCls = `px-2.5 py-1.5 border-2 rounded-xl font-black text-sm sm:text-base transition focus:outline-none ${
    isDark
      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-200'
  }`;
  const cardCls = `rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs ${
    isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90 shadow-slate-100'
  }`;
  const labelCls = isDark ? 'text-slate-300' : 'text-slate-600';

  const textInput = (f: Field, width: string, opts: { maxLength?: number; placeholder?: string; f2?: boolean } = {}) => (
    <input
      ref={(el) => {
        refs.current[f] = el;
      }}
      type="text"
      value={form[f]}
      maxLength={opts.maxLength}
      placeholder={opts.placeholder}
      onChange={(e) => set(f, e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          next(f);
        } else if (e.key === 'F2' && opts.f2) {
          e.preventDefault();
          setPicker(f as 'cnoFrom' | 'cnoTo');
        }
      }}
      className={`${width} ${inputCls}`}
    />
  );

  const cardTitle = (icon: React.ReactNode, title: string, hint?: string) => (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
        {icon}
        <span className={isDark ? 'text-white' : 'text-slate-800'}>{title}</span>
      </div>
      {hint && (
        <span className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
          {hint}
        </span>
      )}
    </div>
  );

  const footerButton = (key: string, label: string, onClick: () => void, tone: 'primary' | 'plain' | 'danger') => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy && tone !== 'danger'}
      className={`flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl font-black text-sm transition border disabled:opacity-50 ${
        tone === 'primary'
          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
          : tone === 'danger'
            ? isDark
              ? 'bg-slate-800 hover:bg-red-950 text-red-300 border-red-800'
              : 'bg-white hover:bg-red-50 text-red-600 border-red-300'
            : isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
              : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
      }`}
    >
      <span>
        {key}. {label}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden">
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors duration-300 max-h-[92vh] ${
          isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
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
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">{meta.title}</h2>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">F7 列印</span>
              </div>
              <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">{meta.form} → wbaseRP.dll {meta.func}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              tabIndex={-1}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-200" />}
              <span>{isDark ? '淺色' : '深色'}</span>
            </button>
            <button onClick={onClose} tabIndex={-1} className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
          {mode === 'receipt' && (
            <div className={cardCls}>
              {cardTitle(<Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />, '請款日期', '[Enter] 下一欄')}
              <div className="flex flex-wrap items-center gap-2 font-bold">
                {textInput('dateFrom', 'w-32', { placeholder: 'yyy/mm/dd' })}
                <span className={labelCls}>~</span>
                {textInput('dateTo', 'w-32', { placeholder: 'yyy/mm/dd' })}
              </div>
            </div>
          )}

          <div className={cardCls}>
            {cardTitle(<Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />, '客戶區間', '[F2] 開窗')}
            <div className="flex flex-wrap items-center gap-2 font-bold">
              {textInput('cnoFrom', 'w-36', { maxLength: 8, placeholder: '空白=不限', f2: true })}
              <span className={labelCls}>~</span>
              {textInput('cnoTo', 'w-36', { maxLength: 8, placeholder: '空白=不限', f2: true })}
            </div>
          </div>

          {mode === 'receipt' ? (
            <div className={cardCls}>
              {cardTitle(<FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />, '單號區間')}
              <div className="flex flex-wrap items-center gap-2 font-bold">
                {textInput('rnoFrom', 'w-36', { maxLength: 10, placeholder: '空白=不限' })}
                <span className={labelCls}>~</span>
                {textInput('rnoTo', 'w-36', { maxLength: 10, placeholder: '空白=不限' })}
                <label className="ml-2 flex items-center gap-2 cursor-pointer">
                  <input
                    ref={(el) => {
                      refs.current.unpaidOnly = el;
                    }}
                    type="checkbox"
                    checked={form.unpaidOnly === '1'}
                    onChange={(e) => set('unpaidOnly', e.target.checked ? '1' : '')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        next('unpaidOnly');
                      }
                    }}
                    className="h-5 w-5 accent-indigo-600 focus:ring-2 focus:ring-amber-400"
                  />
                  <span>只印未收</span>
                </label>
              </div>
            </div>
          ) : (
            <div className={cardCls}>
              {cardTitle(<Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />, '帳款年月', '該月(含)以前未收清的收費單')}
              <div className="flex flex-wrap items-center gap-2 font-bold">{textInput('ym', 'w-28', { placeholder: 'yyy/mm' })}</div>
            </div>
          )}

          <div className={cardCls}>
            {cardTitle(<Printer className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />, '列印設定')}
            <div className="flex flex-wrap items-center gap-3 font-bold">
              <span className={labelCls}>{meta.dateLabel}</span>
              {textInput('printDate', 'w-32', { placeholder: 'yyy/mm/dd' })}
              {(['0', '1'] as const).map((v, i) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    ref={
                      i === 0
                        ? (el) => {
                            refs.current.output = el;
                          }
                        : undefined
                    }
                    type="radio"
                    name="wbase2040-output"
                    checked={form.output === v}
                    onChange={() => set('output', v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePrint();
                      }
                    }}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>{v === '0' ? '預覽列印' : '立即列印'}</span>
                </label>
              ))}
            </div>
          </div>

          {status && (
            <div
              className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-bold border ${
                isDark ? 'bg-slate-800 border-slate-700 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {busy ? '⏳ ' : ''}
              {status}
            </div>
          )}
        </div>

        <div className={`px-3.5 py-3 sm:px-4 border-t flex flex-wrap justify-end gap-2 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
          {footerButton('F4', '預覽資料', handlePreviewData, 'plain')}
          {footerButton('F7', '列印', handlePrint, 'primary')}
          {footerButton('Esc', '離開', onClose, 'danger')}
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <div
            className={`w-full max-w-5xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-700 text-white">
              <div className="flex items-center gap-2 font-black">
                <Eye className="w-4 h-4" />
                F4. 報表資料預覽 (共 {rows.length} 筆明細)
              </div>
              <button onClick={() => setPreviewOpen(false)} className="text-xs font-bold px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25">
                關閉預覽 (Esc)
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className={isDark ? 'bg-slate-800' : 'bg-slate-100'}>
                  <tr>
                    {['客戶編號', '客戶名稱', '單號', mode === 'receipt' ? '請款日' : '日期', '項目名稱', '金額', '備註'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-black whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 ? (isDark ? 'bg-slate-800/50' : 'bg-slate-50') : ''}>
                      <td className="px-2 py-1 whitespace-nowrap">{r.no}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.rno}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{isoToRoc(r.recdate)}</td>
                      <td className="px-2 py-1">{r.item}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt(r.money)}</td>
                      <td className="px-2 py-1">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <SearchModal
        isOpen={picker !== null}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => {
          const f = picker!;
          set(f, item.code);
          setPicker(null);
          next(f);
        }}
        onClose={() => {
          const f = picker!;
          setPicker(null);
          focusField(f);
        }}
      />
    </div>
  );
};
