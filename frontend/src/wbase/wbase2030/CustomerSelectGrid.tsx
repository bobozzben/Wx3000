import React, { useEffect, useRef } from 'react';
import { useTheme } from '../menu/ThemeContext';

export interface SelectColumn<T> {
  key: keyof T & string;
  label: string;
  width: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

interface CustomerSelectGridProps<T> {
  rows: T[];
  columns: SelectColumn<T>[];
  isSelected: (row: T) => boolean;
  cursor: number;
  onCursorChange: (index: number) => void;
  /** Space 或雙擊：切換該列勾選 */
  onToggle: (index: number) => void;
  /** 子視窗開啟時設為 false，格線不處理按鍵 */
  active: boolean;
  emptyText?: string;
}

const ROW_HEIGHT = 38;

/**
 * 唯讀複選清單 (VFP wbase2020 / wbase2030 的 Grid1：複選欄顯示 "=>")。
 * 不用 FoxProGridV2：它是行內編輯格線，Ins / 末格 Enter 會新增空白列，也無法由外部移動游標 (F6 指定、F9 查詢要定位)。
 * 按鍵：↑↓ 換列、PgUp/PgDn 換頁、Ctrl+Home/End 或 Ctrl+PgUp/PgDn 首末筆、Space 切換勾選並移到下一列 (到底停在末筆)
 */
export function CustomerSelectGrid<T>({
  rows,
  columns,
  isSelected,
  cursor,
  onCursorChange,
  onToggle,
  active,
  emptyText = '查無資料',
}: CustomerSelectGridProps<T>) {
  const { isDark } = useTheme();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rowEl = bodyRef.current?.children[cursor] as HTMLElement | undefined;
    rowEl?.scrollIntoView({ block: 'nearest' });
  }, [cursor, rows.length]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (rows.length === 0) return;
      const last = rows.length - 1;
      const page = Math.max(1, Math.floor((bodyRef.current?.clientHeight || ROW_HEIGHT * 10) / ROW_HEIGHT));
      const moves: Record<string, () => number> = {
        ArrowDown: () => Math.min(last, cursor + 1),
        ArrowUp: () => Math.max(0, cursor - 1),
        PageDown: () => (e.ctrlKey ? last : Math.min(last, cursor + page)),
        PageUp: () => (e.ctrlKey ? 0 : Math.max(0, cursor - page)),
        Home: () => (e.ctrlKey ? 0 : cursor),
        End: () => (e.ctrlKey ? last : cursor),
      };
      if (e.key === ' ') {
        e.preventDefault();
        onToggle(cursor);
        onCursorChange(Math.min(last, cursor + 1));
        return;
      }
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      onCursorChange(move());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, rows.length, cursor, onCursorChange, onToggle]);

  const cellAlign = (align?: string) => (align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start');

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col w-full border-2 rounded shadow-md overflow-hidden select-none font-mono text-base ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-blue-900'
      }`}
      style={{ fontFamily: 'Consolas, Monaco, monospace' }}
    >
      <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
        <div className="min-w-full w-max flex-1 min-h-0 flex flex-col">
          <div className={`flex shrink-0 font-bold text-white ${isDark ? 'bg-slate-950' : 'bg-[#1e3a8a]'}`} style={{ height: ROW_HEIGHT }}>
            <div className="flex items-center justify-center border-r border-blue-700 shrink-0" style={{ width: 80 }}>
              複選
            </div>
            {columns.map((col) => (
              <div key={col.key} className={`flex items-center px-3 border-r border-blue-700 shrink-0 ${cellAlign(col.align)}`} style={{ width: col.width }}>
                {col.label}
              </div>
            ))}
          </div>

          <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto">
            {rows.map((row, idx) => {
              const isCursor = idx === cursor;
              const selected = isSelected(row);
              return (
                <div
                  key={idx}
                  onClick={() => onCursorChange(idx)}
                  onDoubleClick={() => onToggle(idx)}
                  className={`flex border-b cursor-default ${isDark ? 'border-slate-800' : 'border-gray-200'} ${
                    isCursor
                      ? isDark
                        ? 'outline outline-2 -outline-offset-2 outline-yellow-400 bg-yellow-950/90 font-bold text-white'
                        : 'outline outline-2 -outline-offset-2 outline-[#eab308] bg-[#fef9c3] font-bold text-slate-900'
                      : isDark
                        ? idx % 2 === 0 ? 'bg-slate-900 text-slate-200' : 'bg-slate-800/60 text-slate-200'
                        : idx % 2 === 0 ? 'bg-white text-slate-800' : 'bg-[#ffecd9] text-slate-800'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex items-center justify-center shrink-0 font-black text-red-600" style={{ width: 80 }}>
                    {selected ? '=>' : ''}
                  </div>
                  {columns.map((col) => (
                    <div key={col.key} className={`flex items-center px-3 overflow-hidden whitespace-nowrap shrink-0 ${cellAlign(col.align)}`} style={{ width: col.width }}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </div>
                  ))}
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className={`p-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{emptyText}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
