import React from 'react';
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

export interface FoxProGridCardProps<T extends Record<string, any>> {
  /** Card header title */
  title: string;
  /** Custom icon displayed before the title */
  icon?: React.ReactNode;
  /** Total count badge displayed in the title bar */
  totalCount?: number;
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
}

export function FoxProGridCard<T extends Record<string, any>>({
  title,
  icon,
  totalCount,
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
}: FoxProGridCardProps<T>) {
  const { isDark } = useTheme();
  const scrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
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

  // Generate dynamic grid-template-columns if gridColsLayout is not explicitly specified
  const computedGridCols = gridColsLayout
    ? gridColsLayout
    : `grid-cols-1 md:grid-cols-[${columns.map((c) => c.width || '1fr').join('_')}]`;

  const count = totalCount !== undefined ? totalCount : data.length;

  return (
    <div
      className={`rounded-[12px] border overflow-hidden transition-colors flex flex-col w-full h-full min-h-0 flex-1 ${
        isDark
          ? 'bg-slate-800 border-slate-700/80 shadow-md'
          : 'bg-white border-2 border-blue-900 shadow-md'
      }`}
    >
      {/* Card Title Bar */}
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
          <span
            className={`ml-2 text-[11px] font-normal px-2 py-0.5 rounded-full ${
              isDark
                ? 'bg-slate-700 text-slate-300'
                : 'bg-blue-900 text-yellow-300 border border-blue-700 font-bold'
            }`}
          >
            {count} 筆
          </span>
        </div>
        {shortcutHint && (
          <div className={`text-[11px] hidden md:block ${isDark ? 'text-slate-500' : 'text-blue-200'}`}>
            {shortcutHint}
          </div>
        )}
      </div>

      {/* Grid Header */}
      <div
        className={`text-[11px] font-bold uppercase tracking-wider hidden md:grid ${computedGridCols} h-8 items-center px-1 border-b shrink-0 transition-colors ${
          isDark
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-400'
            : 'bg-[#1e3a8a] border-blue-900 text-white'
        }`}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-3 ${
              col.align === 'center'
                ? 'text-center'
                : col.align === 'right'
                ? 'text-right'
                : 'text-left'
            } ${col.className || ''}`}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Grid Rows Body */}
      <div
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        className={`relative outline-none flex-1 min-h-0 ${maxHeight} overflow-auto divide-y focus:ring-2 focus:ring-blue-500/20 focus:ring-inset ${
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
  );
}
