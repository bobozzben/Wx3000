import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  FileSpreadsheet,
  Check,
  Edit3,
} from 'lucide-react';
import { useTheme } from '../../wbase/menu/ThemeContext';

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

  const selectedCount = fields.filter((f) => f.selected).length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 font-sans select-none backdrop-blur-md animate-in fade-in duration-200 ${
        isDark ? 'bg-slate-950/80' : 'bg-slate-900/40'
      }`}
    >
      <div
        className={`border-2 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100 shadow-slate-950/50'
            : 'bg-white border-slate-300 text-slate-900 shadow-slate-400/30'
        }`}
      >
        {/* Header Banner */}
        <div
          className={`relative overflow-hidden px-4 py-2.5 text-white shrink-0 ${
            isDark
              ? 'bg-gradient-to-r from-[#1e3a8a] via-indigo-950 to-slate-900 border-b border-indigo-900/50'
              : 'bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb]'
          }`}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-white/15 backdrop-blur-md rounded-lg border border-white/20 shadow-inner">
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black tracking-wide drop-shadow-sm flex items-center gap-2">
                  <span>{title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-black shadow-xs">
                    {selectedCount} / {fields.length}
                  </span>
                </h1>
                <p className="text-[11px] text-blue-100 font-mono font-bold">
                  [Space] 切換選取 | [Up/Down] 上下移動焦點 | [F12] 調整順序
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
              title="關閉 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div
          className={`flex-1 overflow-y-auto p-2 sm:p-3 ${
            isDark ? 'bg-slate-950/60' : 'bg-slate-50/70'
          }`}
        >
          <div
            className={`rounded-xl border overflow-hidden shadow-xs ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={`font-black uppercase tracking-wider border-b ${
                    isDark
                      ? 'bg-slate-800/90 text-indigo-300 border-slate-700'
                      : 'bg-indigo-50 text-indigo-950 border-indigo-200'
                  }`}
                >
                  <th
                    className={`py-1.5 px-2.5 w-16 text-center border-r ${
                      isDark ? 'border-slate-700' : 'border-indigo-200'
                    }`}
                  >
                    選擇
                  </th>
                  <th
                    className={`py-1.5 px-2.5 w-60 border-r ${
                      isDark ? 'border-slate-700' : 'border-indigo-200'
                    }`}
                  >
                    欄位名稱
                  </th>
                  <th className="py-1.5 px-2.5">自訂匯出標題</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y font-mono ${
                  isDark ? 'divide-slate-800' : 'divide-slate-200'
                }`}
              >
                {fields.map((item, idx) => {
                  const isSelectedRow = idx === selectedIndex;
                  return (
                    <tr
                      key={item.key || idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`cursor-pointer transition-all duration-150 ${
                        isSelectedRow
                          ? isDark
                            ? 'bg-amber-500/20 text-white font-bold ring-2 ring-amber-400 ring-inset'
                            : 'bg-amber-100/90 text-slate-950 font-bold ring-2 ring-amber-500 ring-inset'
                          : item.selected
                          ? isDark
                            ? 'bg-indigo-950/40 hover:bg-indigo-900/40 text-slate-100'
                            : 'bg-indigo-50/70 hover:bg-indigo-100/80 text-slate-900'
                          : isDark
                          ? 'hover:bg-slate-800/60 text-slate-400'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {/* Selection Visual Indicator (Compact Box) */}
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(idx);
                        }}
                        className={`py-1 px-2 text-center border-r ${
                          isDark ? 'border-slate-800' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          {isSelectedRow && (
                            <span className="text-amber-400 text-[11px] font-black animate-pulse">▶</span>
                          )}
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shadow-2xs ${
                              item.selected
                                ? 'bg-emerald-600 border border-emerald-500 text-white shadow-emerald-900/30'
                                : isDark
                                ? 'bg-slate-800 border border-slate-700 text-slate-500'
                                : 'bg-slate-100 border border-slate-300 text-slate-400'
                            }`}
                          >
                            {item.selected ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <span className="text-[9px] font-mono font-bold opacity-30">✕</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Field Name */}
                      <td
                        className={`py-1 px-2.5 font-bold tracking-wide border-r ${
                          isDark ? 'border-slate-800' : 'border-slate-200'
                        }`}
                      >
                        {item.label}
                      </td>

                      {/* Custom Title Editable Column */}
                      <td className="py-0.5 px-2">
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
                            className={`w-full px-2 py-0.5 text-xs font-bold rounded-md border outline-none shadow-2xs transition-all ${
                              isDark
                                ? 'bg-slate-900 border-amber-400 text-amber-300 focus:ring-1 focus:ring-amber-400'
                                : 'bg-white border-amber-500 text-slate-900 focus:ring-1 focus:ring-amber-500'
                            }`}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingTitleIndex(idx)}
                            className={`px-2 py-0.5 rounded-md flex items-center justify-between transition-colors min-h-[26px] group ${
                              item.customTitle
                                ? isDark
                                  ? 'hover:bg-slate-800/80 text-indigo-300'
                                  : 'hover:bg-slate-200/80 text-indigo-950 font-bold'
                                : 'text-slate-400 italic text-[11px]'
                            }`}
                          >
                            <span>{item.customTitle || '點擊編輯標題...'}</span>
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Toolbar & Action Bar (Uniform Height h-8) */}
        <div
          className={`px-3 py-2 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {/* Order UP/DOWN Action Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => moveUp(selectedIndex)}
              title="向上移動欄位順序 [Up]"
              className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-xs active:scale-95 cursor-pointer flex items-center gap-1 text-xs"
            >
              <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">上移</span>
            </button>
            <button
              type="button"
              onClick={() => moveDown(selectedIndex)}
              title="向下移動欄位順序 [Down / F12]"
              className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-xs active:scale-95 cursor-pointer flex items-center gap-1 text-xs"
            >
              <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">下移</span>
            </button>
          </div>

          {/* Quick Action Hotkeys Bar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                F3
              </span>
              <span>全選</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                F4
              </span>
              <span>全不選</span>
            </button>

            <button
              type="button"
              onClick={handleSearchPrompt}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                F7
              </span>
              <span>搜尋</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                F8
              </span>
              <span>預設值</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSelect(selectedIndex)}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                Space
              </span>
              <span>選擇</span>
            </button>

            <button
              type="button"
              onClick={() => moveDown(selectedIndex)}
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <span className="bg-amber-400 text-slate-950 font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                F12
              </span>
              <span>順序</span>
            </button>
          </div>

          {/* Confirm & Exit Action Buttons */}
          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={handleConfirm}
              className="h-8 px-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-lg shadow-sm border border-emerald-600 transition-all hover:scale-102 active:scale-98 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>F9. 確定變更</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`h-8 px-3 rounded-lg font-bold text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              <span>Esc. 放棄離開</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
