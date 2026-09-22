import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useTheme } from '../wbase/menu/ThemeContext';

export interface XlsxFieldItem {
  key: string;
  label: string;
  customTitle: string;
  selected: boolean;
}

interface FormUtilSelectXlsxFieldsListProps {
  isOpen: boolean;
  title?: string;
  fields: XlsxFieldItem[];
  defaultFields?: XlsxFieldItem[];
  onConfirm: (selectedFields: XlsxFieldItem[]) => void;
  onClose: () => void;
}

export const FormUtilSelectXlsxFieldsList: React.FC<FormUtilSelectXlsxFieldsListProps> = ({
  isOpen,
  title = '選擇匯出欄位 (FormUtilSelectXlsxFieldsList)',
  fields: initialFields,
  defaultFields,
  onConfirm,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [fields, setFields] = useState<XlsxFieldItem[]>(initialFields);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [editingTitleIndex, setEditingTitleIndex] = useState<number | null>(null);

  // Synchronize when initialFields changes
  useEffect(() => {
    if (initialFields && initialFields.length > 0) {
      setFields(initialFields.map((f) => ({ ...f })));
      setSelectedIndex(0);
    }
  }, [initialFields, isOpen]);

  // Toggle selection (Y/N)
  const toggleSelect = useCallback((idx: number) => {
    setFields((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
    );
  }, []);

  // Select all (F3)
  const handleSelectAll = useCallback(() => {
    setFields((prev) => prev.map((item) => ({ ...item, selected: true })));
  }, []);

  // Deselect all (F4)
  const handleDeselectAll = useCallback(() => {
    setFields((prev) => prev.map((item) => ({ ...item, selected: false })));
  }, []);

  // Reset to default (F8)
  const handleResetDefaults = useCallback(() => {
    const base = defaultFields || initialFields;
    setFields(base.map((f) => ({ ...f })));
  }, [defaultFields, initialFields]);

  // Move row UP
  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    });
    setSelectedIndex(idx - 1);
  }, []);

  // Move row DOWN
  const moveDown = useCallback((idx: number) => {
    setFields((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    });
    setSelectedIndex((prev) => (prev < fields.length - 1 ? prev + 1 : prev));
  }, [fields.length]);

  // Filter search (F7)
  const handleSearchPrompt = useCallback(() => {
    const q = window.prompt('請輸入關鍵字搜尋欄位：', filterQuery);
    if (q !== null) {
      setFilterQuery(q);
      if (q.trim()) {
        const foundIdx = fields.findIndex(
          (f) =>
            f.label.toLowerCase().includes(q.toLowerCase()) ||
            f.customTitle.toLowerCase().includes(q.toLowerCase())
        );
        if (foundIdx !== -1) {
          setSelectedIndex(foundIdx);
        }
      }
    }
  }, [filterQuery, fields]);

  // Confirm changes (F9)
  const handleConfirm = useCallback(() => {
    onConfirm(fields);
  }, [fields, onConfirm]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTitleIndex !== null) return; // Allow typing in title input

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(fields.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          toggleSelect(selectedIndex);
          break;
        case 'F3':
          e.preventDefault();
          handleSelectAll();
          break;
        case 'F4':
          e.preventDefault();
          handleDeselectAll();
          break;
        case 'F7':
          e.preventDefault();
          handleSearchPrompt();
          break;
        case 'F8':
          e.preventDefault();
          handleResetDefaults();
          break;
        case 'F9':
          e.preventDefault();
          handleConfirm();
          break;
        case 'F12':
          e.preventDefault();
          moveDown(selectedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    selectedIndex,
    fields.length,
    editingTitleIndex,
    toggleSelect,
    handleSelectAll,
    handleDeselectAll,
    handleSearchPrompt,
    handleResetDefaults,
    handleConfirm,
    moveDown,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono select-none">
      <div
        className={`border-4 rounded-lg shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-white'
            : 'bg-slate-100 border-blue-900 text-slate-900'
        }`}
      >
        {/* Window Bar */}
        <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold border-b border-slate-700">
          <span>{title}</span>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-slate-700 rounded text-gray-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Purple Banner */}
        <div className="bg-purple-700 text-white text-center py-2 font-black tracking-widest text-lg shadow-inner">
          選擇匯出欄位
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-2 bg-white text-black">
          <table className="w-full text-left border-collapse border border-gray-400 text-sm">
            <thead>
              <tr className="bg-gray-200 border-b-2 border-gray-500 font-bold text-slate-800">
                <th className="p-2 border-r border-gray-400 w-16 text-center">選擇</th>
                <th className="p-2 border-r border-gray-400 w-64">欄名</th>
                <th className="p-2">自訂標題</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((item, idx) => {
                const isSelectedRow = idx === selectedIndex;
                return (
                  <tr
                    key={item.key || idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${
                      isSelectedRow
                        ? 'bg-blue-100 text-blue-950 font-bold border-2 border-amber-500'
                        : item.selected
                        ? 'bg-amber-50/60 hover:bg-amber-100/80'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {/* Selection Column Y/N */}
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(idx);
                      }}
                      className="p-2 border-r border-gray-300 text-center font-bold"
                    >
                      <span className="flex items-center justify-center space-x-1">
                        {isSelectedRow && <span className="text-blue-700 text-xs font-black">▶</span>}
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            item.selected
                              ? 'bg-emerald-600 text-white font-extrabold'
                              : 'bg-gray-300 text-gray-700'
                          }`}
                        >
                          {item.selected ? 'Y' : 'N'}
                        </span>
                      </span>
                    </td>

                    {/* Field Name */}
                    <td className="p-2 border-r border-gray-300 font-semibold">{item.label}</td>

                    {/* Custom Title Editable */}
                    <td className="p-1">
                      {editingTitleIndex === idx ? (
                        <input
                          type="text"
                          value={item.customTitle}
                          autoFocus
                          onChange={(e) => {
                            const val = e.target.value;
                            setFields((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, customTitle: val } : f))
                            );
                          }}
                          onBlur={() => setEditingTitleIndex(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingTitleIndex(null);
                          }}
                          className="w-full px-2 py-1 text-sm bg-yellow-100 text-black border-2 border-amber-500 rounded focus:outline-none"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingTitleIndex(idx)}
                          className="px-2 py-1 rounded hover:bg-yellow-100 hover:border hover:border-amber-400 min-h-[28px] flex items-center"
                        >
                          {item.customTitle || <span className="text-gray-400 text-xs">點擊編輯標題</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Toolbar & Action Hotkeys (Matching Image 2) */}
        <div className="bg-sky-200 border-t-2 border-blue-400 p-3 flex flex-wrap items-center justify-between gap-2 shadow-inner">
          {/* Left Arrow Controls (UP / DOWN) */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => moveUp(selectedIndex)}
              title="向上移動欄位 [Up]"
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white transition active:scale-95"
            >
              <ChevronUp className="w-6 h-6 stroke-[3]" />
            </button>
            <button
              onClick={() => moveDown(selectedIndex)}
              title="向下移動欄位 [Down / F12]"
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white transition active:scale-95"
            >
              <ChevronDown className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          {/* Center Hotkeys */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold">
                F3
              </span>
              <span>全選</span>
            </button>

            <button
              onClick={handleDeselectAll}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold">
                F4
              </span>
              <span>全不選</span>
            </button>

            <button
              onClick={handleSearchPrompt}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold">
                F7
              </span>
              <span>查詢</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold">
                F8
              </span>
              <span>預設值</span>
            </button>

            <button
              onClick={() => toggleSelect(selectedIndex)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold italic">
                Space
              </span>
              <span>選擇</span>
            </button>

            <button
              onClick={() => moveDown(selectedIndex)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 rounded shadow-xs"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-extrabold">
                F12
              </span>
              <span>方向</span>
              <span className="bg-red-600 text-white rounded-xs px-1 text-xs font-bold">➔</span>
            </button>
          </div>

          {/* Right Confirm & Cancel */}
          <div className="flex items-center space-x-2 text-xs font-bold">
            <button
              onClick={handleConfirm}
              className="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-amber-50 text-blue-950 border-2 border-amber-400 rounded shadow-md font-extrabold"
            >
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-xs font-black">
                F9
              </span>
              <span className="text-blue-900">確定變更</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-md font-bold"
            >
              <span className="italic text-yellow-300 font-extrabold text-xs">Esc</span>
              <span>放棄離開</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
