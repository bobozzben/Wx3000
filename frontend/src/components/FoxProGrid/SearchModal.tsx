import React, { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../wbase/menu/ThemeContext';

export interface SearchItem {
  code: string;
  name: string;
  spec?: string;
  price?: number;
}

interface SearchModalProps {
  isOpen: boolean;
  title: string;
  onSearch: (query: string) => Promise<SearchItem[]>;
  onSelect: (item: SearchItem) => void;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  title,
  onSearch,
  onSelect,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      fetchResults('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const fetchResults = async (q: string) => {
    setLoading(true);
    try {
      const res = await onSearch(q);
      setItems(res);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    fetchResults(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && items[selectedIndex]) {
        onSelect(items[selectedIndex]);
      }
    } else if (e.key === 'Escape' || e.key === 'F2') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`w-full max-w-2xl overflow-hidden rounded-lg shadow-2xl border-2 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 text-white transition-colors ${
            isDark ? 'bg-slate-950 border-b border-slate-800' : 'bg-blue-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-yellow-400" />
            <h3 className="font-bold text-lg tracking-wide">{title} [F4開窗搜尋]</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-slate-800 text-gray-200 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className={`p-4 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="請輸入關鍵字搜尋 (代號或名稱)... [↑/↓選擇 Enter確定 Esc關閉]"
              className={`w-full rounded border-2 px-4 py-2 text-lg font-mono focus:outline-none ${
                isDark
                  ? 'bg-slate-900 border-blue-500 text-yellow-300 placeholder-slate-500 focus:border-yellow-400'
                  : 'bg-yellow-50 border-blue-600 text-slate-900 focus:border-yellow-500'
              }`}
            />
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 font-mono">
          {loading ? (
            <div className={`p-6 text-center font-bold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              載入中...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-red-500 font-bold">查無相符資料！</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-200 text-gray-700'}`}>
                  <th className={`p-2 border ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>代號</th>
                  <th className={`p-2 border ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>名稱</th>
                  {items[0]?.spec !== undefined && (
                    <th className={`p-2 border ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>規格</th>
                  )}
                  {items[0]?.price !== undefined && (
                    <th className={`p-2 border text-right ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
                      單價
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={item.code}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? isDark
                            ? 'bg-yellow-400/20 text-yellow-300 font-bold border-2 border-yellow-500'
                            : 'bg-yellow-300 text-black font-bold border-2 border-yellow-600'
                          : isDark
                          ? idx % 2 === 0
                            ? 'bg-slate-900 text-slate-200'
                            : 'bg-slate-800/60 text-slate-200'
                          : idx % 2 === 0
                          ? 'bg-white text-slate-800'
                          : 'bg-[#ffecd9] text-slate-800'
                      }`}
                    >
                      <td
                        className={`p-2 border font-bold ${
                          isDark
                            ? 'border-slate-800 text-yellow-400'
                            : 'border-slate-200 text-blue-900'
                        }`}
                      >
                        {item.code}
                      </td>
                      <td className={`p-2 border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        {item.name}
                      </td>
                      {item.spec !== undefined && (
                        <td
                          className={`p-2 border ${
                            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-gray-600'
                          }`}
                        >
                          {item.spec}
                        </td>
                      )}
                      {item.price !== undefined && (
                        <td
                          className={`p-2 border text-right font-semibold ${
                            isDark ? 'border-slate-800 text-emerald-400' : 'border-slate-200 text-emerald-700'
                          }`}
                        >
                          ${item.price.toLocaleString()}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div
          className={`px-4 py-2 text-xs font-mono flex justify-between border-t transition-colors ${
            isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-gray-100 border-gray-200 text-gray-600'
          }`}
        >
          <span>[↑/↓] 上下選擇</span>
          <span>[Enter] 選擇並帶回</span>
          <span>[Esc/F4] 離開關閉</span>
        </div>
      </div>
    </div>
  );
};
