import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Folder } from 'lucide-react';
import { useTheme } from '../../wbase/menu/ThemeContext';

export interface FoxProGridCardColumn<T> {
  key: keyof T & string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (item: T, index: number, isSelected: boolean) => React.ReactNode;
}

/**
 * FoxPro 游標與輸入輔助：將元素聚焦並全選文字 (支援直接打字覆蓋 Type-over Replacement)
 */
export function foxProFocusAndSelect(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null | undefined,
  flash: boolean = true
) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {}
  if ('select' in el && typeof (el as any).select === 'function') {
    try {
      (el as HTMLInputElement | HTMLTextAreaElement).select();
    } catch {}
  }
  if (flash) {
    el.classList.add('fox-flash');
    setTimeout(() => el.classList.remove('fox-flash'), 250);
  }
}

/**
 * 檢查 textarea 游標是否位於第一行 (向上鍵換欄位防呆)
 */
export function isCursorOnFirstLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(0, el.selectionStart).includes('\n');
}

/**
 * 檢查 textarea 游標是否位於最後一行 (向下鍵換欄位防呆)
 */
export function isCursorOnLastLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(el.selectionEnd).includes('\n');
}

export interface UseFoxProCardNavigationOptions<TField extends string = string> {
  fieldOrder: TField[];
  inputRefsMap: React.MutableRefObject<Map<string, HTMLInputElement | HTMLTextAreaElement>>;
  isFieldDisabled?: (field: TField) => boolean;
  onSave?: () => void;
  onSwitchTab?: (tabIdx: number) => void;
  tabFieldsMap?: Record<number, TField[]>;
  activeTab?: number;
}

/**
 * FoxPro 盲打輸入模式 Hook (母版核心)
 * 提供標準 FoxPro Card 輸入框鍵盤導覽 (上下鍵換欄位、Enter 跳下一欄/存檔、聚焦全選打字覆蓋、跳過停用欄位)
 */
export function useFoxProCardNavigation<TField extends string = string>({
  fieldOrder,
  inputRefsMap,
  isFieldDisabled,
  onSave,
  onSwitchTab,
  tabFieldsMap,
  activeTab,
}: UseFoxProCardNavigationOptions<TField>) {
  const focusAndSelect = useCallback(
    (fid: TField) => {
      const el = inputRefsMap.current.get(fid);
      if (el) {
        foxProFocusAndSelect(el, true);
      }
    },
    [inputRefsMap]
  );

  const moveToField = useCallback(
    (currentFid: TField, direction: 'next' | 'prev') => {
      const hasTabs = Boolean(tabFieldsMap && onSwitchTab !== undefined && activeTab !== undefined);
      let fieldList: { tabIdx?: number; fid: TField }[] = [];

      if (hasTabs && tabFieldsMap) {
        Object.keys(tabFieldsMap)
          .map(Number)
          .sort((a, b) => a - b)
          .forEach((t) => {
            (tabFieldsMap[t] || []).forEach((fid) => {
              fieldList.push({ tabIdx: t, fid });
            });
          });
      } else {
        fieldList = fieldOrder.map((fid) => ({ fid }));
      }

      const currentIdx = fieldList.findIndex((item) => item.fid === currentFid);
      if (currentIdx === -1) return;

      if (direction === 'next' && currentIdx === fieldList.length - 1 && onSave) {
        onSave();
        return;
      }

      const step = direction === 'next' ? 1 : -1;
      let nextIdx = (currentIdx + step + fieldList.length) % fieldList.length;
      let iterations = 0;

      while (iterations < fieldList.length) {
        const candidate = fieldList[nextIdx];
        const el = inputRefsMap.current.get(candidate.fid);
        const disabledByFn = isFieldDisabled ? isFieldDisabled(candidate.fid) : false;
        const elDisabled = el ? (el as HTMLInputElement).disabled : false;

        if (el && !disabledByFn && !elDisabled) {
          if (candidate.tabIdx !== undefined && candidate.tabIdx !== activeTab && onSwitchTab) {
            onSwitchTab(candidate.tabIdx);
            setTimeout(() => {
              focusAndSelect(candidate.fid);
            }, 80);
          } else {
            focusAndSelect(candidate.fid);
          }
          break;
        }
        nextIdx = (nextIdx + step + fieldList.length) % fieldList.length;
        iterations++;
      }
    },
    [fieldOrder, inputRefsMap, isFieldDisabled, onSave, onSwitchTab, tabFieldsMap, activeTab, focusAndSelect]
  );

  const handleFieldKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
      fid: TField,
      onEnterCommit?: () => boolean | void
    ) => {
      const isTextArea = e.currentTarget.tagName === 'TEXTAREA';

      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (isTextArea) {
          const textarea = e.currentTarget as HTMLTextAreaElement;
          if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
            return;
          }
          if (e.key === 'ArrowDown' && !isCursorOnLastLine(textarea)) {
            return;
          }
        }

        if (e.key === 'Enter' && onEnterCommit) {
          const proceed = onEnterCommit();
          if (proceed === false) {
            e.preventDefault();
            return;
          }
        }

        e.preventDefault();
        moveToField(fid, 'next');
        return;
      }

      if (e.key === 'ArrowUp') {
        if (isTextArea) {
          const textarea = e.currentTarget as HTMLTextAreaElement;
          if (!isCursorOnFirstLine(textarea)) {
            return;
          }
        }

        e.preventDefault();
        moveToField(fid, 'prev');
        return;
      }
    },
    [moveToField]
  );

  const handleFieldFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setTimeout(() => {
      try {
        el.select();
      } catch {}
    }, 0);
  }, []);

  return {
    focusAndSelect,
    moveToField,
    handleFieldKeyDown,
    handleFieldFocus,
  };
}

export const FOXPRO_CARD_STYLES = `
  .fox-flash {
    background-color: #fef08a !important;
    color: #0f172a !important;
    box-shadow: 0 0 0 2px #facc15 !important;
    transition: background-color 0.15s ease-in-out;
  }
`;

export interface FoxProGridCardProps<T extends Record<string, any>> {
  /** Card header title */
  title: string;
  /** Custom icon displayed before the title */
  icon?: React.ReactNode;
  /** Total count badge displayed in the title bar (when showCountInHeader is true) */
  totalCount?: number;
  /** Whether to show record count badge in header (default false: 抬頭不顯示筆數) */
  showCountInHeader?: boolean;
  /** Shortcut or status hint text displayed on the right of the title bar */
  shortcutHint?: React.ReactNode;
  /** Data list */
  data: T[];
  /** Column definitions */
  columns: FoxProGridCardColumn<T>[];
  /** CSS Grid columns class for header and rows (e.g. 'grid-cols-1 md:grid-cols-[90px_1fr_130px_90px_140px_70px]') */
  gridColsLayout?: string;
  /** Currently selected row index */
  selectedIndex?: number;
  /** Callback on row click */
  onSelectRow?: (item: T, index: number) => void;
  /** Callback on row double click */
  onDoubleClickRow?: (item: T, index: number) => void;
  /** Keyboard event handler on grid container */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Container ref for auto focus and scrolling */
  gridContainerRef?: React.RefObject<HTMLDivElement>;
  /** Max height for grid scroll container */
  maxHeight?: string;
  /** Loading status */
  loading?: boolean;
  /** Empty state message */
  emptyText?: string;
  /** Unique key extractor for row mapping */
  getItemKey?: (item: T, index: number) => string | number;
  /** Optional custom row renderer */
  renderRow?: (item: T, index: number, isSelected: boolean, isEven: boolean) => React.ReactNode;
  /** Whether to sync active row selection on grid scroll (default true) */
  enableScrollSync?: boolean;
  /** Whether to merge title bar into column header (default true) */
  mergeHeader?: boolean;
  /** Unique Grid ID or Storage Key for persisting resized column widths in LocalStorage */
  gridId?: string;
  storageKey?: string;
}

const parseColWidth = (w?: string): number | undefined => {
  if (!w || w.includes('fr') || w.includes('%')) return undefined;
  const val = parseFloat(w);
  return isNaN(val) ? undefined : val;
};

export function FoxProGridCard<T extends Record<string, any>>({
  title,
  icon,
  totalCount,
  showCountInHeader = false,
  shortcutHint = '↑↓ 換筆 · Enter / F6 編修 · F2 查詢',
  data,
  columns,
  gridColsLayout,
  selectedIndex,
  onSelectRow,
  onDoubleClickRow,
  onKeyDown,
  gridContainerRef,
  maxHeight = 'max-h-[260px] md:max-h-[300px]',
  loading = false,
  emptyText = '查無資料',
  getItemKey,
  renderRow,
  enableScrollSync = true,
  mergeHeader = true,
  gridId,
  storageKey,
}: FoxProGridCardProps<T>) {
  const { isDark } = useTheme();
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. 欄寬自訂與持久化儲存 Key (LocalStorage)
  const effectiveStorageKey = useMemo(() => {
    const key = gridId || storageKey;
    if (key) return `wx3000_gridcard_col_widths_${key}`;
    const colSignature = columns.map((c) => String(c.key)).join('_');
    return `wx3000_gridcard_col_widths_${colSignature}`;
  }, [gridId, storageKey, columns]);

  // 2. 載入持久化自訂欄寬 (若無則使用欄位定義之預設寬度)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(effectiveStorageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    const initial: Record<string, number> = {};
    columns.forEach((col) => {
      const parsed = parseColWidth(col.width);
      if (parsed) {
        initial[col.key] = parsed;
      }
    });
    return initial;
  });

  // 當 Key 或欄位結構改變時同步載入
  useEffect(() => {
    try {
      const stored = localStorage.getItem(effectiveStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setColWidths((prev) => ({ ...prev, ...parsed }));
        return;
      }
    } catch {
      // ignore
    }
    const initial: Record<string, number> = {};
    columns.forEach((col) => {
      const parsed = parseColWidth(col.width);
      if (parsed) {
        initial[col.key] = parsed;
      }
    });
    setColWidths((prev) => ({ ...initial, ...prev }));
  }, [effectiveStorageKey]);

  // 3. 滑鼠拖曳欄寬處理 (Mouse Drag Column Resizing)
  const resizingRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string, defaultWidthStr?: string) => {
      e.preventDefault();
      e.stopPropagation();

      const parentHeader = (e.currentTarget as HTMLElement).parentElement;
      const currentActualWidth = parentHeader
        ? Math.round(parentHeader.getBoundingClientRect().width)
        : colWidths[colKey] || parseColWidth(defaultWidthStr) || 120;

      resizingRef.current = {
        colKey,
        startX: e.clientX,
        startWidth: currentActualWidth,
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = moveEvent.clientX - resizingRef.current.startX;
        const newWidth = Math.max(40, Math.round(resizingRef.current.startWidth + delta));

        setColWidths((prev) => ({
          ...prev,
          [resizingRef.current!.colKey]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        setColWidths((latestWidths) => {
          try {
            localStorage.setItem(effectiveStorageKey, JSON.stringify(latestWidths));
          } catch (err) {
            console.warn('Failed to save colWidths to localStorage:', err);
          }
          return latestWidths;
        });

        resizingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [effectiveStorageKey, colWidths]
  );

  const handleResetColWidth = useCallback(
    (colKey: string) => {
      setColWidths((prev) => {
        const next = { ...prev };
        delete next[colKey];
        try {
          localStorage.setItem(effectiveStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [effectiveStorageKey]
  );

  // Clean up timer and cursor on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Smooth debounced scroll sync when user pauses scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onSelectRow || !enableScrollSync || data.length === 0) return;
    const container = e.currentTarget;

    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = setTimeout(() => {
      const containerRect = container.getBoundingClientRect();

      // Check if current selected item is still visible inside container viewport
      if (selectedIndex !== undefined && selectedIndex >= 0) {
        const curEl = document.getElementById(`row-${selectedIndex}`);
        if (curEl) {
          const curRect = curEl.getBoundingClientRect();
          // If current selected row is visible within viewport bounds, keep it selected!
          if (curRect.top >= containerRect.top - 8 && curRect.bottom <= containerRect.bottom + 8) {
            return;
          }
        }
      }

      const children = Array.from(container.children) as HTMLElement[];
      let topVisibleIdx = -1;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.id && child.id.startsWith('row-')) {
          const rowIdx = parseInt(child.id.replace('row-', ''), 10);
          const childRect = child.getBoundingClientRect();
          // Find first row that has at least 16px visible in container top viewport
          if (childRect.bottom >= containerRect.top + 16) {
            topVisibleIdx = rowIdx;
            break;
          }
        }
      }

      if (topVisibleIdx >= 0 && topVisibleIdx < data.length && topVisibleIdx !== selectedIndex) {
        onSelectRow(data[topVisibleIdx], topVisibleIdx);
      }
    }, 150);
  };

  // Generate dynamic grid-template-columns inline style
  const gridStyle: React.CSSProperties | undefined = useMemo(() => {
    const hasCustomWidths = Object.keys(colWidths).length > 0;
    if (gridColsLayout && !hasCustomWidths) return undefined;

    return {
      gridTemplateColumns: columns
        .map((c) => {
          const customW = colWidths[c.key];
          if (customW) return `${customW}px`;
          return c.width || '1fr';
        })
        .join(' '),
    };
  }, [gridColsLayout, columns, colWidths]);

  const computedGridCols = gridColsLayout && Object.keys(colWidths).length === 0
    ? gridColsLayout
    : '';

  const count = totalCount !== undefined ? totalCount : data.length;

  return (
    <div
      className={`rounded-[12px] border overflow-hidden transition-colors flex flex-col w-full h-full min-h-0 flex-1 print:border-none print:shadow-none print:h-auto print:overflow-visible ${
        isDark
          ? 'bg-slate-800 border-slate-700/80 shadow-md'
          : 'bg-white border-2 border-blue-900 shadow-md'
      }`}
    >
      <style>{FOXPRO_CARD_STYLES}</style>
      {/* Optional Separate Card Title Bar (Only when mergeHeader is explicitly false) */}
      {!mergeHeader && (
        <div
          className={`h-10 px-4 flex items-center justify-between border-b shrink-0 transition-colors ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-slate-200'
              : 'bg-[#1e3a8a] border-blue-800 text-white'
          }`}
        >
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            {icon || <Folder size={14} className={isDark ? 'text-slate-400' : 'text-yellow-400'} />}
            <span>{title}</span>
            {showCountInHeader && (
              <span
                className={`ml-2 text-[11px] font-normal px-2 py-0.5 rounded-full ${
                  isDark
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-blue-900 text-yellow-300 border border-blue-700 font-bold'
                }`}
              >
                {count} 筆
              </span>
            )}
          </div>
          {shortcutHint && (
            <div className={`text-[11px] hidden md:block ${isDark ? 'text-slate-500' : 'text-blue-200'}`}>
              {shortcutHint}
            </div>
          )}
        </div>
      )}

      {/* Horizontal Scroll Wrapper (Locks Header & Rows together) */}
      <div className="overflow-x-auto overflow-y-hidden flex-1 min-h-0 flex flex-col print:overflow-visible print:w-full">
        <div className="min-w-full w-max flex-1 min-h-0 flex flex-col print:w-full">
          {/* Mobile Header Bar (Only visible on small screens < md when mergeHeader is true) */}
          {mergeHeader && (
            <div
              className={`md:hidden flex items-center justify-between px-3 h-8 text-xs font-bold shrink-0 border-b ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-yellow-300'
                  : 'bg-[#1e3a8a] border-blue-900 text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                {icon || <Folder size={13} className={isDark ? 'text-yellow-400' : 'text-yellow-300'} />}
                <span className="truncate">{title}</span>
              </div>
              {showCountInHeader && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                    isDark
                      ? 'bg-slate-800 text-yellow-300 border border-slate-700'
                      : 'bg-blue-950 text-yellow-300 border border-blue-700 font-bold'
                  }`}
                >
                  {count} 筆
                </span>
              )}
            </div>
          )}

          {/* Grid Header (Fixed / Sticky at top, NEVER scrolls with rows) */}
          <div
            style={gridStyle}
            className={`text-xs font-bold uppercase tracking-wider hidden md:grid ${computedGridCols} h-9 items-center px-1 border-b shrink-0 sticky top-0 z-20 transition-colors ${
              isDark
                ? 'bg-slate-950 border-slate-700/80 text-yellow-300'
                : 'bg-[#1e3a8a] border-blue-900 text-white shadow-xs'
            }`}
          >
            {columns.map((col, cIdx) => {
              const isFirst = cIdx === 0;
              const isSecond = cIdx === 1;
              return (
                <div
                  key={col.key}
                  className={`px-3 h-full flex items-center relative group/col select-none ${
                    col.align === 'center'
                      ? 'justify-center'
                      : col.align === 'right'
                      ? 'justify-end'
                      : 'justify-start'
                  } ${col.className || ''}`}
                >
                  {mergeHeader && isFirst && (
                    <span className="mr-1.5 shrink-0">
                      {icon || <Folder size={13} className={isDark ? 'text-yellow-400' : 'text-yellow-300'} />}
                    </span>
                  )}
                  <span className="truncate pr-1">{col.label}</span>
                  {showCountInHeader && mergeHeader && isSecond && count !== undefined && (
                    <span
                      className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                        isDark
                          ? 'bg-slate-800 text-yellow-300 border border-slate-700'
                          : 'bg-blue-950 text-yellow-300 border border-blue-700 font-bold'
                      }`}
                    >
                      {count} 筆
                    </span>
                  )}
                  {mergeHeader && isSecond && shortcutHint && (
                    <span
                      className={`ml-auto text-[11px] font-normal hidden xl:inline truncate opacity-75 ${
                        isDark ? 'text-slate-400' : 'text-blue-200'
                      }`}
                    >
                      {shortcutHint}
                    </span>
                  )}

                  {/* 拖曳調整欄寬把手 (Column Resizer Handle) */}
                  <div
                    title="拖曳以調整欄寬，雙擊重置預設寬度"
                    onMouseDown={(e) => handleResizeStart(e, col.key, col.width)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleResetColWidth(col.key);
                    }}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none flex items-center justify-center hover:bg-blue-400/40 active:bg-yellow-400/60 z-20 group print:hidden"
                  >
                    <div className="w-[1.5px] h-3.5 bg-slate-400/50 group-hover:bg-yellow-400 group-hover:h-full transition-all" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid Rows Body (Only this scrolls vertically) */}
          <div
            ref={gridContainerRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onScroll={handleScroll}
            className={`relative outline-none flex-1 min-h-0 ${maxHeight} overflow-y-auto divide-y focus:ring-2 focus:ring-blue-500/20 focus:ring-inset print:overflow-visible print:h-auto ${
              isDark ? 'divide-slate-700/50 bg-slate-900' : 'divide-gray-200 bg-[#f8fafc]'
            }`}
            aria-label={`${title} Grid`}
          >
            {data.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const isEven = idx % 2 === 1;
              const rowKey = getItemKey ? getItemKey(item, idx) : item.code || item.id || idx;

              if (renderRow) {
                return (
                  <React.Fragment key={rowKey}>
                    {renderRow(item, idx, isSelected, isEven)}
                  </React.Fragment>
                );
              }

              return (
                <div
                  key={rowKey}
                  id={`row-${idx}`}
                  onClick={() => onSelectRow && onSelectRow(item, idx)}
                  onDoubleClick={() => onDoubleClickRow && onDoubleClickRow(item, idx)}
                  style={gridStyle}
                  className={`grid ${computedGridCols} h-auto md:h-8 items-center text-[13px] cursor-pointer transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-950/60 border-l-[3px] border-l-blue-500 font-medium text-blue-200'
                        : 'bg-blue-100/80 border-l-[3px] border-l-blue-600 font-medium text-blue-900'
                      : isDark
                      ? isEven
                        ? 'bg-slate-800/60 border-l-[3px] border-l-transparent hover:bg-slate-700/50 text-slate-300'
                        : 'bg-slate-900 border-l-[3px] border-l-transparent hover:bg-slate-700/50 text-slate-300'
                      : isEven
                      ? 'bg-[#ffecd9] border-l-[3px] border-l-transparent hover:bg-amber-100/80 text-slate-800'
                      : 'bg-white border-l-[3px] border-l-transparent hover:bg-blue-50/80 text-slate-800'
                  }`}
                >
                  {columns.map((col) => {
                    const val = item[col.key] ?? '-';
                    return (
                      <div
                        key={col.key}
                        className={`px-3 py-1 md:py-0 truncate flex items-center gap-2 ${
                          col.align === 'center'
                            ? 'justify-center'
                            : col.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        } ${
                          isDark ? 'text-slate-300' : 'text-slate-800'
                        } ${col.className || ''}`}
                      >
                        <span className={`md:hidden text-[10px] w-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {col.label}
                        </span>
                        {col.render ? col.render(item, idx, isSelected) : <span className="truncate">{val}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {data.length === 0 && (
              <div className={`p-8 text-center text-[13px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {loading ? '資料載入中...' : emptyText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
