import React, { useEffect, useRef, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import type { CarbonCustomer } from '../../services/wbase5070';

interface Wbase5070RangeModalProps {
  customers: CarbonCustomer[];
  /** F8 確定：起始、結束客戶代號 (已轉大寫、去空白；空白表示不限) */
  onConfirm: (startNo: string, endNo: string) => void;
  onCancel: () => void;
}

/**
 * 客戶區間 (VFP wbase4001：起始客戶、結束客戶，InputMask "!!!!!!!!")。
 * F8 確定後由呼叫端把代號在區間內的客戶設為選擇 (VFP REPL ALL mselect WITH "→" FOR no>=sno AND no<=eno)。
 * Enter 下一欄 (最後一欄到確定鈕)、↑ 上一欄、F2 開客戶選單帶回代號 (VFP 沒有，依專案 UX 規則補上)、F8 確定、Esc 放棄
 */
export const Wbase5070RangeModal: React.FC<Wbase5070RangeModalProps> = ({ customers, onConfirm, onCancel }) => {
  const { isDark } = useTheme();
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [searchFor, setSearchFor] = useState<'start' | 'end' | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  const confirm = () => onConfirm(startNo.trim().toUpperCase(), endNo.trim().toUpperCase());

  // F8 / Esc 由視窗本身處理 (capture 階段，避免底下的格線收到)；客戶選單開啟時交給選單
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  useEffect(() => {
    if (searchFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        confirmRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (/^F([1-9]|1[0-2])$/.test(e.key) && e.key !== 'F2') {
        e.preventDefault();
        e.stopPropagation();
      } else if ((e.target as HTMLElement | null)?.tagName !== 'INPUT') {
        // 焦點在按鈕上：不讓底下的格線收到方向鍵；不 preventDefault，Enter / Space 仍會按下按鈕、Tab 仍會換焦點
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [searchFor, onCancel]);

  const fieldKeyDown = (field: 'start' | 'end') => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (field === 'start') endRef.current?.focus();
      else okRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (field === 'end') startRef.current?.focus();
    } else if (e.key === 'F2') {
      e.preventDefault();
      setSearchFor(field);
    }
  };

  const closeSearch = () => {
    const target = searchFor;
    setSearchFor(null);
    setTimeout(() => (target === 'end' ? endRef : startRef).current?.focus(), 0);
  };

  const inputClass = `w-full rounded border-2 px-3 font-mono text-base uppercase focus:outline-none ${
    isDark
      ? 'bg-slate-950 border-slate-600 text-yellow-300 focus:border-yellow-400'
      : 'bg-white border-blue-300 text-blue-900 focus:border-yellow-500 focus:bg-yellow-50'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full max-w-sm overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
        }`}
        style={{ fontFamily: 'Consolas, Monaco, monospace' }}
      >
        <div className={`flex items-center gap-2 px-4 py-3 text-white ${isDark ? 'bg-slate-950' : 'bg-blue-900'}`}>
          <ListChecks className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-bold">客戶區間</h3>
        </div>
        <div className="space-y-3 p-5 text-base">
          <label className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-bold">起始客戶</span>
            <input
              ref={startRef}
              value={startNo}
              maxLength={8}
              autoComplete="off"
              placeholder="空白=第一筆"
              onChange={(e) => setStartNo(e.target.value.toUpperCase())}
              onFocus={(e) => e.target.select()}
              onKeyDown={fieldKeyDown('start')}
              className={inputClass}
              style={{ height: 38 }}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-bold">結束客戶</span>
            <input
              ref={endRef}
              value={endNo}
              maxLength={8}
              autoComplete="off"
              placeholder="空白=最後一筆"
              onChange={(e) => setEndNo(e.target.value.toUpperCase())}
              onFocus={(e) => e.target.select()}
              onKeyDown={fieldKeyDown('end')}
              className={inputClass}
              style={{ height: 38 }}
            />
          </label>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>代號欄按 F2 開客戶選單；區間內的客戶全部設為選擇，區間外不變。</p>
        </div>
        <div className={`flex justify-end gap-3 border-t px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
          <button
            ref={okRef}
            type="button"
            onClick={confirm}
            className="rounded bg-blue-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-yellow-400"
          >
            F8 確定
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-red-400 px-4 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-yellow-400 dark:hover:bg-red-950"
          >
            Esc 放棄
          </button>
        </div>
      </div>

      <SearchModal
        isOpen={searchFor !== null}
        title="客戶基本資料選單"
        onSearch={async (query: string): Promise<SearchItem[]> => {
          const kw = query.trim().toLowerCase();
          return customers
            .filter((c) => !kw || c.no.toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw))
            .map((c) => ({ code: c.no, name: c.name }));
        }}
        onSelect={(item) => {
          if (searchFor === 'end') setEndNo(item.code.toUpperCase());
          else setStartNo(item.code.toUpperCase());
          closeSearch();
        }}
        onClose={closeSearch}
      />
    </div>
  );
};
