import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check } from 'lucide-react';
import type { AccountOption } from './services/wbase4020';
import { fetchDescripAccounts } from './services/wbase4020';

interface AccountSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (accno: string, accname: string) => void;
  title?: string;
}

export const AccountSearchModal: React.FC<AccountSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = '會計科目快速查詢 (F2)',
}) => {
  const [keyword, setKeyword] = useState('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKeyword('');
      setSelectedIndex(0);
      setLoading(true);
      fetchDescripAccounts()
        .then((data) => {
          setAccounts(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filtered = accounts.filter(
    (a) =>
      a.accno.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      a.accname.toLowerCase().includes(keyword.trim().toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [keyword]);

  // 使用 capture 階段攔截 Escape 鍵，確保絕不穿透至父視窗或全域監聽器
  useEffect(() => {
    if (!isOpen) return;

    const handleCaptureKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleCaptureKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, { capture: true });
    };
  }, [isOpen, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      scrollIntoView(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      scrollIntoView(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].accno, filtered[selectedIndex].accname);
        onClose();
      }
    }
  };

  const scrollIntoView = (idx: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.acc-item');
    if (items[idx]) {
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-2 font-bold font-mono">
            <Search className="w-5 h-5 text-amber-300" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-800 rounded text-slate-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="輸入科目代號或名稱快速搜尋... (↑/↓ 導覽，Enter 選取，Esc 離開)"
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-base font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-mono">載入會計科目中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono">
              查無符合條件的會計科目「{keyword}」
            </div>
          ) : (
            <table className="w-full text-left font-mono text-sm border-collapse">
              <thead>
                <tr className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                  <th className="py-1.5 px-3 w-28">科目代號</th>
                  <th className="py-1.5 px-3">科目名稱</th>
                  <th className="py-1.5 px-3 w-20 text-center">明細</th>
                  <th className="py-1.5 px-3 w-16 text-center">計稅</th>
                  <th className="py-1.5 px-3 w-16 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={item.accno}
                      onClick={() => {
                        onSelect(item.accno, item.accname);
                        onClose();
                      }}
                      className={`acc-item cursor-pointer border-b border-slate-200 dark:border-slate-800 transition-colors ${
                        isSelected
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <td className="py-1.5 px-3 font-mono font-bold tracking-wider">
                        {item.accno}
                      </td>
                      <td className="py-1.5 px-3">{item.accname}</td>
                      <td className="py-1.5 px-3 text-center">{item.dept || '-'}</td>
                      <td className="py-1.5 px-3 text-center">{item.taxcode || '-'}</td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          type="button"
                          className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-sans"
                        >
                          選擇
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
          <div>共 {filtered.length} 筆科目</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (filtered[selectedIndex]) {
                  onSelect(filtered[selectedIndex].accno, filtered[selectedIndex].accname);
                  onClose();
                }
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              確定 [Enter]
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-slate-200 font-bold rounded"
            >
              取消 [Esc]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
