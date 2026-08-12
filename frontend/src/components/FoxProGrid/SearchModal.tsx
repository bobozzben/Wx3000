import React, { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

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
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl border-2 border-blue-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-blue-900 px-4 py-3 text-white">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-yellow-400" />
            <h3 className="font-bold text-lg tracking-wide">{title} [F4開窗搜尋]</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-blue-800 text-gray-200 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="請輸入關鍵字搜尋 (代號或名稱)... [↑/↓選擇 Enter確定 Esc關閉]"
              className="w-full rounded border-2 border-blue-600 px-4 py-2 text-lg font-mono focus:border-yellow-500 focus:outline-none bg-yellow-50"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 font-mono">
          {loading ? (
            <div className="p-6 text-center text-gray-500 font-bold">載入中...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-red-500 font-bold">查無相符資料！</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-200 text-gray-700 text-sm">
                  <th className="p-2 border">代號</th>
                  <th className="p-2 border">名稱</th>
                  {items[0]?.spec !== undefined && <th className="p-2 border">規格</th>}
                  {items[0]?.price !== undefined && <th className="p-2 border text-right">單價</th>}
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
                      className={`cursor-pointer transition ${isSelected
                          ? 'bg-yellow-300 text-black font-bold border-2 border-yellow-600'
                          : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-[#ffecd9]'
                        }`}
                    >
                      <td className="p-2 border font-bold text-blue-900">{item.code}</td>
                      <td className="p-2 border">{item.name}</td>
                      {item.spec !== undefined && <td className="p-2 border text-gray-600">{item.spec}</td>}
                      {item.price !== undefined && (
                        <td className="p-2 border text-right font-semibold text-emerald-700">
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
        <div className="bg-gray-100 px-4 py-2 text-xs font-mono text-gray-600 flex justify-between border-t">
          <span>[↑/↓] 上下選擇</span>
          <span>[Enter] 選擇並帶回</span>
          <span>[Esc/F4] 離開關閉</span>
        </div>
      </div>
    </div>
  );
};
