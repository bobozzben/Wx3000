import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Copy, CheckSquare, Square } from 'lucide-react';
import type { AccountItem } from '../../services/wbase4010';
import { getDeptDescription } from '../../services/wbase4010';
import { useTheme } from '../menu/ThemeContext';

interface Wbase4010BatchCopyModalProps {
  isOpen: boolean;
  refAccounts: AccountItem[];
  existingAccnos: Set<string>;
  modeTitle: string;
  onClose: () => void;
  onConfirm: (selectedAccnos: string[]) => Promise<void>;
}

export const Wbase4010BatchCopyModal: React.FC<Wbase4010BatchCopyModalProps> = ({
  isOpen,
  refAccounts,
  existingAccnos,
  modeTitle,
  onClose,
  onConfirm,
}) => {
  const { isDark } = useTheme();
  const [selectedAccnos, setSelectedAccnos] = useState<Set<string>>(new Set());
  const [filterQuery, setFilterQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 篩選未存在的標準科目
  const filteredList = refAccounts.filter((a) => {
    const code = a.accno?.trim() || '';
    const name = a.accname?.trim() || '';
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedAccnos(new Set());
      setFilterQuery('');
      setFocusedIndex(0);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // 鍵盤導覽 (Space: 勾選/取消, Enter: 確認, Esc: 離開, Up/Down: 移動)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredList.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        // Space 鍵切換選取狀態
        if (filteredList[focusedIndex]) {
          e.preventDefault();
          const target = (filteredList[focusedIndex].accno || '').trim();
          setSelectedAccnos((prev) => {
            const next = new Set(prev);
            if (next.has(target)) {
              next.delete(target);
            } else {
              next.add(target);
            }
            return next;
          });
        }
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredList, focusedIndex]);

  const toggleSelect = (accno: string) => {
    setSelectedAccnos((prev) => {
      const next = new Set(prev);
      if (next.has(accno)) {
        next.delete(accno);
      } else {
        next.add(accno);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedAccnos.size === filteredList.length) {
      setSelectedAccnos(new Set());
    } else {
      const next = new Set<string>();
      filteredList.forEach((a) => {
        const c = (a.accno || '').trim();
        if (c) next.add(c);
      });
      setSelectedAccnos(next);
    }
  };

  const handleSubmit = async () => {
    if (selectedAccnos.size === 0) {
      alert('請先勾選欲複製的會計科目！');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(Array.from(selectedAccnos));
      onClose();
    } catch (err: any) {
      alert(`複製失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        ref={containerRef}
        className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded shadow-2xl border ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-900 text-white font-bold select-none">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-yellow-400" />
            <span className="text-base tracking-wide">
              [F3 複製] 批次新增標準會計科目 (來源: {modeTitle})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-blue-800 text-white/80 hover:text-white transition-colors"
            title="關閉 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Toolbar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-950">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder="搜尋科目代號或名稱 (快速篩選)..."
              className={`w-full pl-8 pr-3 py-1.5 text-sm font-mono rounded border outline-hidden ${
                isDark
                  ? 'bg-slate-900 border-slate-700 focus:border-yellow-400 text-white'
                  : 'bg-white border-slate-300 focus:border-blue-600 text-slate-900'
              }`}
            />
          </div>
          <button
            onClick={handleSelectAll}
            type="button"
            className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            {selectedAccnos.size === filteredList.length && filteredList.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            全選 / 全消
          </button>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            已選: <strong className="text-blue-600 dark:text-yellow-400">{selectedAccnos.size}</strong> / {filteredList.length} 筆
          </span>
        </div>

        {/* Account Table */}
        <div ref={listRef} className="flex-1 min-h-[350px] max-h-[50vh] overflow-y-auto font-mono text-sm">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700 select-none">
              <tr>
                <th className="w-12 px-2 py-2 text-center">選取</th>
                <th className="w-28 px-3 py-2 text-left">科目代號</th>
                <th className="px-3 py-2 text-left">科目名稱</th>
                <th className="w-28 px-3 py-2 text-left">明細類別</th>
                <th className="w-16 px-3 py-2 text-center">稅額</th>
                <th className="w-24 px-3 py-2 text-center">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 italic">
                    無符合條件之標準總帳科目
                  </td>
                </tr>
              ) : (
                filteredList.map((acc, idx) => {
                  const code = (acc.accno || '').trim();
                  const name = (acc.accname || '').trim();
                  const dept = (acc.dept || '').trim();
                  const tax = (acc.taxcode || '').trim();
                  const isAlreadyExist = existingAccnos.has(code);
                  const isChecked = selectedAccnos.has(code);
                  const isFocused = idx === focusedIndex;

                  return (
                    <tr
                      key={code || idx}
                      onClick={() => !isAlreadyExist && toggleSelect(code)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        isAlreadyExist
                          ? 'opacity-40 bg-slate-100 dark:bg-slate-950 cursor-not-allowed'
                          : isChecked
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                          : isFocused
                          ? 'bg-yellow-50 dark:bg-yellow-950/30'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAlreadyExist}
                          onChange={() => !isAlreadyExist && toggleSelect(code)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-yellow-400 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-1.5 font-bold tracking-wider">{code}</td>
                      <td className="px-3 py-1.5">{name}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">
                        {getDeptDescription(dept)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-bold text-amber-600 dark:text-amber-400">
                        {tax === '*' ? '*' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs">
                        {isAlreadyExist ? (
                          <span className="text-slate-400">已存在</span>
                        ) : isChecked ? (
                          <span className="text-blue-600 dark:text-yellow-400 font-bold">複製</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-100 dark:bg-slate-950 select-none">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              Space
            </kbd>
            <span>切換選取</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              ↑↓
            </kbd>
            <span>上下移動</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              Ctrl+Enter
            </kbd>
            <span>確定複製</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              取消 (Esc)
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedAccnos.size === 0}
              type="button"
              className="px-5 py-1.5 text-sm font-bold rounded bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 text-white shadow transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? '複製中...' : `確定複製 (${selectedAccnos.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

