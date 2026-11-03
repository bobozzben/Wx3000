import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  checkReceiptDate,
  fetchFeeStats,
  isoToRoc,
  rocToIso,
  todayIso,
  type FeeStatResult,
} from '../../services/wbase2040';
import { searchCustomers } from './lookups';
import { KeyHintBar } from './KeyHintBar';

interface FieldDef {
  name: string;
  label: string;
  customer?: boolean;
}

const FIELDS: FieldDef[] = [
  { name: 'dateFrom', label: '日期 起:' },
  { name: 'dateTo', label: '日期 迄:' },
  { name: 'cnoFrom', label: '客戶 起:', customer: true },
  { name: 'cnoTo', label: '客戶 迄:', customer: true },
];

const fmt = (n: number) => Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });

const StatsPreview: React.FC<{ stats: FeeStatResult }> = ({ stats }) => {
  const used = stats.items.filter((it) => stats.rows.some((r) => r.amounts[it.itemno]));
  return (
    <table className="w-full border-collapse text-sm text-black">
      <thead>
        <tr className="border-y-2 border-black">
          <th className="px-2 py-1 text-left">公司代號</th>
          <th className="px-2 py-1 text-left">公司簡稱</th>
          {used.map((it) => (
            <th key={it.itemno} className="px-2 py-1 text-right">{it.item}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.rows.map((r) => (
          <tr key={r.cno} className="border-b border-gray-400">
            <td className="px-2 py-1">{r.cno}</td>
            <td className="px-2 py-1">{r.abbr}</td>
            {used.map((it) => (
              <td key={it.itemno} className="px-2 py-1 text-right font-mono">{r.amounts[it.itemno] ? fmt(r.amounts[it.itemno]) : ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** VFP recpr3：A 欄公司代號、B 欄公司簡稱、之後每個收費項目一欄，第一列為日期範圍 */
const exportStats = (stats: FeeStatResult, range: string) => {
  const header = ['公司代號', '公司簡稱', ...stats.items.map((it) => it.item)];
  const body = stats.rows.map((r) => [r.cno, r.abbr, ...stats.items.map((it) => r.amounts[it.itemno] || 0)]);
  const sheet = XLSX.utils.aoa_to_sheet([['日期範圍:', range], header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '收費統計表');
  XLSX.writeFile(book, `收費統計表_${todayIso().replace(/-/g, '')}.xlsx`);
};

/** F9 收費統計表 (VFP recpr3.scx)：客戶 × 收費項目金額，Enter 查詢、F7 轉出 Excel */
export const Wbase2040Print: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isDark } = useTheme();
  const today = isoToRoc(todayIso());
  const [form, setForm] = useState<Record<string, string>>({ dateFrom: today, dateTo: today, cnoFrom: '', cnoTo: '' });
  const [stats, setStats] = useState<FeeStatResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setTimeout(() => refs.current.dateFrom?.focus(), 50);
  }, []);

  const dateOf = (name: string, label: string): string | null => {
    const check = checkReceiptDate(form[name], label);
    const iso = check.valid ? rocToIso(form[name]) : null;
    if (!iso) {
      setMessage(check.message || `${label}格式錯誤`);
      refs.current[name]?.focus();
    }
    return iso;
  };

  const query = async (): Promise<FeeStatResult | null> => {
    setMessage('');
    const d1 = dateOf('dateFrom', '起始日期');
    const d2 = d1 && dateOf('dateTo', '結束日期');
    if (!d1 || !d2) return null;
    setBusy(true);
    try {
      const data = await fetchFeeStats(d1, d2, form.cnoFrom, form.cnoTo);
      setStats(data);
      if (data.rows.length === 0) setMessage('無任何資料!');
      return data;
    } catch (err) {
      setMessage(apiErrorMessage(err, '查詢失敗'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  // F7：依目前條件查詢後轉出 Excel
  const runExport = async () => {
    const data = await query();
    if (data && data.rows.length > 0) exportStats(data, `${form.dateFrom}~${form.dateTo}`);
  };

  useEffect(() => {
    if (picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        runExport();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const focusNext = (name: string, dir: 1 | -1) => {
    const idx = FIELDS.findIndex((f) => f.name === name) + dir;
    if (idx >= 0 && idx < FIELDS.length) refs.current[FIELDS[idx].name]?.focus();
    else if (idx >= FIELDS.length) query();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        className={`flex h-full max-h-[860px] w-full max-w-6xl flex-col overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`px-4 py-2 text-lg font-bold text-white ${isDark ? 'bg-slate-900' : 'bg-blue-900'}`}>收費統計表 (Excel 輸出)</div>
        <div className={`grid grid-cols-1 gap-2 border-b p-3 sm:grid-cols-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {FIELDS.map((f) => (
            <label key={f.name} className="flex items-center gap-2">
              <span className="w-24 text-right font-bold">{f.label}</span>
              <input
                ref={(el) => {
                  refs.current[f.name] = el;
                }}
                value={form[f.name]}
                maxLength={f.customer ? 8 : undefined}
                placeholder={f.customer ? 'F2 開窗' : 'yyy/mm/dd'}
                onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusNext(f.name, 1);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusNext(f.name, -1);
                  } else if (e.key === 'F2' && f.customer) {
                    e.preventDefault();
                    setPicker(f.name);
                  }
                }}
                className={`w-40 rounded border-2 px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-slate-900 border-slate-600 text-yellow-200' : 'bg-white border-slate-400 focus:bg-yellow-50'
                }`}
              />
            </label>
          ))}
        </div>
        {(message || busy) && (
          <div className={`px-4 py-1 text-sm font-bold ${busy ? 'text-blue-600' : 'text-red-600'}`}>{busy ? '查詢中…' : message}</div>
        )}
        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-3">
          <div className="mx-auto max-w-4xl bg-white p-4">
            {stats ? <StatsPreview stats={stats} /> : <p className="py-8 text-center text-gray-500">輸入條件後按 Enter 查詢，F7 轉出 Excel</p>}
          </div>
        </div>
        <KeyHintBar
          keys={[
            { key: 'Enter', label: '查詢', onClick: () => query() },
            { key: 'F7', label: '轉出 Excel', onClick: () => runExport() },
            { key: 'Esc', label: '離開', onClick: onClose, danger: true },
          ]}
        />
      </div>
      <SearchModal
        isOpen={picker !== null}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => {
          const name = picker!;
          setForm((s) => ({ ...s, [name]: item.code }));
          setPicker(null);
          setTimeout(() => focusNext(name, 1), 50);
        }}
        onClose={() => {
          const name = picker!;
          setPicker(null);
          setTimeout(() => refs.current[name]?.focus(), 50);
        }}
      />
    </div>
  );
};
