import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SearchModal } from './SearchModal';
import type { SearchItem } from './SearchModal';
import { useTheme } from '../../wbase/menu/ThemeContext';

export interface HeaderGroupDef {
  label: React.ReactNode;
  width?: string;
  className?: string;
}

export interface ColumnDefV2<T> {
  key: keyof T & string;
  label: string;
  width?: string;
  editable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  /** Set to true if this column is the table's Primary Key field */
  isPrimaryKey?: boolean;
  renderCell?: (val: any, row: T, rIdx: number) => React.ReactNode;
}

export interface FoxProGridV2Props<T extends Record<string, any>> {
  /** Source row data list */
  rows: T[];
  /** Column definitions */
  columns: ColumnDefV2<T>[];
  /** Optional top multi-level header groups */
  headerGroups?: HeaderGroupDef[];
  /** Factory function to create a new blank row */
  createEmptyRow: () => T;
  /** Row data update callback */
  onRowsChange: (newRows: T[]) => void;
  /** Row persistence callback (triggered on Enter / Tab commit) */
  onSaveRow?: (row: T, rowIndex: number) => void | Promise<void>;
  /** F7 Print preview trigger */
  onOpenPrint?: () => void;
  /** ESC Save summary & return trigger (receives hasModified boolean flag) */
  onShowSummary?: (hasModified: boolean) => void;
  /** Custom status bar left info (node or function receiving current selected row and index) */
  statusBarInfo?: React.ReactNode | ((row: T | undefined, rowIndex: number) => React.ReactNode);
  /** Callback triggered whenever active row selection changes */
  onSelectRow?: (row: T | undefined, rowIndex: number) => void;
  /** F3 Search modal query handler */
  onF3Search?: (query: string, colKey: keyof T & string) => Promise<SearchItem[]>;
  /** F3 Search modal title */
  f3SearchTitle?: string;
  /** Minimum visible rows for Excel-style view (default 15) */
  minRows?: number;
  /** Container height (default '608px') */
  height?: string;
  /** Row key getter (default relies on index) */
  getRowKey?: (row: T, index: number) => string | number;
  /** Callback on Ins key / Add Row button click */
  onInsertRow?: () => void;
  /** Callback on Del key / Delete Row button click */
  onDeleteRow?: () => void;
  /** Callback on F6 / Refresh button click */
  onRefreshData?: () => void;
  /** Callback on Esc button click */
  onExit?: () => void;
  /** Additional custom action buttons */
  customActions?: React.ReactNode;
  /** Hide [F2] edit hint badge */
  hideF2Hint?: boolean;
  /** Hide keyboard navigation hints ([F2], [F3], [Enter], [↑↓]) */
  hideKeyboardHints?: boolean;
  /** Label for Esc hint/button (default '存檔並結算' or '儲存/離開') */
  escLabel?: string;
}

export function FoxProGridV2<T extends Record<string, any>>({
  rows,
  columns,
  headerGroups,
  createEmptyRow,
  onRowsChange,
  onSaveRow,
  onOpenPrint,
  onShowSummary,
  statusBarInfo,
  onSelectRow,
  onF3Search,
  f3SearchTitle = '資料搜尋 [F3]',
  minRows = 15,
  height,
  getRowKey,
  onInsertRow,
  onDeleteRow,
  onRefreshData,
  onExit,
  customActions,
  hideF2Hint = true,
  hideKeyboardHints = true,
  escLabel = '儲存/離開',
}: FoxProGridV2Props<T>) {
  const { isDark } = useTheme();
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [hasModified, setHasModified] = useState<boolean>(false);

  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchTargetColKey, setSearchTargetColKey] = useState<keyof T & string>(
    columns[0]?.key || ('' as any)
  );

  const [pkErrorAlert, setPkErrorAlert] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const createEmptyRowRef = useRef(createEmptyRow);
  useEffect(() => {
    createEmptyRowRef.current = createEmptyRow;
  }, [createEmptyRow]);

  // Pad display rows up to minRows (15 rows) for seamless Excel experience
  const displayRows = useMemo(() => {
    if (rows.length >= minRows) return rows;
    const padded = [...rows];
    while (padded.length < minRows) {
      padded.push(createEmptyRowRef.current());
    }
    return padded;
  }, [rows, minRows]);

  const currentSelectedRow = displayRows[selectedCell.r];

  const onSelectRowRef = useRef(onSelectRow);
  useEffect(() => {
    onSelectRowRef.current = onSelectRow;
  }, [onSelectRow]);

  useEffect(() => {
    if (onSelectRowRef.current) {
      const selectedRow = displayRows[selectedCell.r];
      onSelectRowRef.current(selectedRow, selectedCell.r);
    }
  }, [selectedCell.r, rows]);

  const evaluatedStatusBarInfo = useMemo(() => {
    if (typeof statusBarInfo === 'function') {
      return statusBarInfo(currentSelectedRow, selectedCell.r);
    }
    return statusBarInfo;
  }, [statusBarInfo, currentSelectedRow, selectedCell.r]);

  // Primary Key existence check helper for Grid Editing
  const checkPrimaryKeyDuplicate = useCallback(
    (r: number, c: number, value: string): boolean => {
      const col = columns[c];
      if (!col || !col.isPrimaryKey) return false; // Non-primary key fields don't check!

      const val = value.trim().toUpperCase();
      if (!val) return false;

      // Check if value already exists in displayRows (excluding current row r)
      const isDuplicate = displayRows.some((row, idx) => {
        if (idx === r) return false;
        const existingVal = String(row[col.key] || '').trim().toUpperCase();
        return existingVal === val;
      });

      if (isDuplicate) {
        setPkErrorAlert({
          open: true,
          message: `⚠️ 主鍵欄位「${col.label}」資料 "${value.trim()}" 已存在於系統，請重新輸入！`,
        });
        return true;
      }

      return false;
    },
    [columns, displayRows]
  );

  // Helper to commit edits with Primary Key validation
  const commitEdit = useCallback(
    (r: number, c: number, value: string): boolean => {
      const col = columns[c];
      if (!col) return false;

      // Primary Key duplicate check before commit!
      if (col.isPrimaryKey) {
        if (checkPrimaryKeyDuplicate(r, c, value)) {
          setIsEditing(true);
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 50);
          return false; // REJECT COMMIT
        }
      }

      const colKey = col.key;
      const updated = [...displayRows];
      const targetRow = { ...updated[r], [colKey]: value };
      updated[r] = targetRow;
      onRowsChange(updated);
      setHasModified(true);
      if (onSaveRow) {
        onSaveRow(targetRow, r);
      }
      return true;
    },
    [columns, displayRows, onRowsChange, onSaveRow, checkPrimaryKeyDuplicate]
  );

  // Helper to move cell focus
  const moveCell = useCallback(
    (r: number, c: number, dr: number, dc: number = 0) => {
      let nr = r + dr;
      let nc = c + dc;

      if (nc >= columns.length) {
        nc = 0;
        nr += 1;
      } else if (nc < 0) {
        nc = columns.length - 1;
        nr -= 1;
      }

      if (nr >= displayRows.length) {
        const newRows = [...displayRows, createEmptyRow()];
        onRowsChange(newRows);
        // Ensure index moves forward
        nr = displayRows.length;
        nc = 0;
      } else if (nr < 0) {
        nr = 0;
      }

      setSelectedCell({ r: nr, c: nc });
      setIsEditing(false);
    },
    [columns.length, displayRows, createEmptyRow, onRowsChange]
  );

  // Auto-focus input when editing starts and place cursor at the end (prevents character selection overwrite)
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Keyboard navigation & shortcut event listener (FoxPro 100% style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        searchModalOpen ||
        (target && target.tagName === 'INPUT' && target !== inputRef.current)
      ) {
        return;
      }

      const { r, c } = selectedCell;
      const col = columns[c];

      // ESC: Save & Show Summary or direct exit
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) {
          setIsEditing(false);
          return;
        }
        if (onShowSummary) {
          onShowSummary(hasModified);
        }
        return;
      }

      // F7: Print
      if (e.key === 'F7') {
        e.preventDefault();
        if (onOpenPrint) onOpenPrint();
        return;
      }

      // F3: Search Modal
      if (e.key === 'F3') {
        e.preventDefault();
        if (col && onF3Search) {
          setSearchTargetColKey(col.key);
          setSearchModalOpen(true);
        }
        return;
      }

      // F2: Start Editing
      if (e.key === 'F2') {
        e.preventDefault();
        if (col && col.editable !== false) {
          if (!isEditing) {
            setEditValue(String(displayRows[r]?.[col.key] ?? ''));
            setIsEditing(true);
          } else {
            commitEdit(r, c, editValue);
            setIsEditing(false);
          }
        }
        return;
      }

      // If cell is in Editing state
      if (isEditing) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            moveCell(r, c, 0, 1);
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            moveCell(r, c, -1, 0);
          }
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            moveCell(r, c, 1, 0);
          }
          return;
        }
        return;
      }

      // Navigation mode (isEditing === false)
      if (!isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (col && col.editable !== false) {
            setEditValue(String(displayRows[r]?.[col.key] ?? ''));
            setIsEditing(true);
          }
          return;
        }

        if (e.key === 'Tab') {
          e.preventDefault();
          moveCell(r, c, 0, e.shiftKey ? -1 : 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveCell(r, c, -1, 0);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveCell(r, c, 1, 0);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          moveCell(r, c, 0, -1);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          moveCell(r, c, 0, 1);
          return;
        }

        // Direct typing trigger
        if (
          /^[a-zA-Z0-9\u4e00-\u9fa5\-]$/.test(e.key) &&
          col.editable !== false &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey
        ) {
          e.preventDefault();
          setEditValue(e.key);
          setIsEditing(true);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCell,
    isEditing,
    editValue,
    hasModified,
    displayRows,
    columns,
    searchModalOpen,
    commitEdit,
    moveCell,
    createEmptyRow,
    onRowsChange,
    onF3Search,
    onOpenPrint,
    onShowSummary,
  ]);

  const handleModalSelect = (item: SearchItem) => {
    const { r, c } = selectedCell;
    const updated = [...displayRows];
    const targetRow = {
      ...updated[r],
      [searchTargetColKey]: item.code,
      ...(item.name ? ({ empName: item.name } as any) : {}),
    };
    updated[r] = targetRow;
    onRowsChange(updated);
    setHasModified(true);
    if (onSaveRow) {
      onSaveRow(targetRow, r);
    }
    setSearchModalOpen(false);
    moveCell(r, c, 0, 1);
  };

  const handleF3Query = async (query: string): Promise<SearchItem[]> => {
    if (onF3Search) {
      return onF3Search(query, searchTargetColKey);
    }
    return [];
  };

  return (
    <div ref={gridContainerRef} className="flex-1 min-h-0 flex flex-col w-full h-full font-mono outline-none">
      {/* Excel 15-Row Grid Container */}
      <div
        style={height ? { height } : undefined}
        className={`w-full border-2 rounded shadow-md overflow-hidden flex flex-col select-none transition-colors ${
          height ? '' : 'flex-1 min-h-0'
        } ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-blue-900'
        }`}
      >
        {/* Grouped Header Row */}
        {headerGroups && headerGroups.length > 0 && (
          <div
            className={`flex text-xs font-bold tracking-wider h-[30px] shrink-0 border-b transition-colors ${
              isDark ? 'bg-slate-950/90 text-slate-200 border-slate-800' : 'bg-[#0f2557] text-blue-100 border-blue-900'
            }`}
          >
            {headerGroups.map((grp, gIdx) => (
              <div
                key={gIdx}
                style={{ width: grp.width }}
                className={`h-full flex items-center justify-center border-r last:border-r-0 shrink-0 ${
                  grp.className || ''
                }`}
              >
                {grp.label}
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div
          className={`flex text-sm font-bold tracking-wider h-[38px] shrink-0 border-b transition-colors ${
            isDark ? 'bg-slate-950 text-yellow-300 border-slate-800' : 'bg-[#1e3a8a] text-white border-blue-900'
          }`}
        >
          <div
            className={`w-[50px] h-full flex items-center justify-center border-r shrink-0 ${
              isDark ? 'border-slate-800' : 'border-blue-800'
            }`}
          >
            項次
          </div>
          {columns.map((col) => (
            <div
              key={col.key}
              style={{
                width: col.width || '150px',
                flex: col.width === '1fr' ? 1 : undefined,
              }}
              className={`h-full flex items-center px-3 border-r last:border-r-0 shrink-0 font-bold ${
                isDark ? 'border-slate-800' : 'border-blue-800'
              } ${
                col.align === 'center'
                  ? 'justify-center'
                  : col.align === 'right'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Rows Body */}
        <div className={`flex-1 min-h-0 overflow-y-auto ${isDark ? 'bg-slate-900' : 'bg-[#f8fafc]'}`}>
          {displayRows.map((row, rIdx) => {
            const isRowSelected = selectedCell.r === rIdx;
            const isEven = rIdx % 2 === 1;
            const rawKey = getRowKey ? getRowKey(row, rIdx) : '';
            const rowKey = rawKey ? `${rawKey}_row_${rIdx}` : `row_${rIdx}`;

            return (
              <div
                key={rowKey}
                className={`flex border-b h-[38px] items-center text-sm transition-colors ${
                  isDark ? 'border-slate-800/80' : 'border-gray-200'
                } ${
                  isDark
                    ? isEven
                      ? 'bg-slate-800/60 text-white'
                      : 'bg-slate-900 text-white'
                    : isEven
                    ? 'bg-[#ffecd9] text-slate-800'
                    : 'bg-white text-slate-800'
                } ${
                  isRowSelected
                    ? isDark
                      ? 'bg-blue-950/90 text-white font-semibold'
                      : 'bg-blue-100/60 font-medium'
                    : ''
                }`}
              >
                {/* Index Cell */}
                <div
                  className={`w-[50px] h-full flex items-center justify-center border-r font-bold shrink-0 ${
                    isDark
                      ? 'border-slate-800 text-yellow-400 bg-slate-950'
                      : 'border-gray-200 text-gray-500 bg-gray-50'
                  }`}
                >
                  {String(rIdx + 1).padStart(2, '0')}
                </div>

                {/* Data Cells */}
                {columns.map((col, cIdx) => {
                  const isCellFocused = selectedCell.r === rIdx && selectedCell.c === cIdx;
                  const cellVal = row[col.key] ?? '';

                  return (
                    <div
                      key={col.key}
                      style={{
                        width: col.width || '150px',
                        flex: col.width === '1fr' ? 1 : undefined,
                      }}
                      onClick={() => {
                        if (isEditing && (selectedCell.r !== rIdx || selectedCell.c !== cIdx)) {
                          const success = commitEdit(selectedCell.r, selectedCell.c, editValue);
                          if (!success) return; // Block cell switch on duplicate PK!
                        }
                        setSelectedCell({ r: rIdx, c: cIdx });
                        setIsEditing(false);
                      }}
                      onDoubleClick={() => {
                        if (col.editable !== false) {
                          setEditValue(String(cellVal));
                          setIsEditing(true);
                        }
                      }}
                      className={`h-full border-r flex items-center px-3 cursor-cell overflow-hidden shrink-0 relative ${
                        isDark ? 'border-slate-800 text-white' : 'border-gray-200 text-slate-800'
                      } ${
                        isCellFocused
                          ? isDark
                            ? 'border-2 border-yellow-400 bg-yellow-950/90 font-bold text-white shadow-inner z-10'
                            : 'border-2 border-[#eab308] bg-[#fef9c3] font-bold text-black shadow-inner z-10'
                          : ''
                      } ${
                        isDark && col.className
                          ? col.className.replace(/text-(black|blue-\d+|gray-\d+|slate-\d+)/g, 'text-white')
                          : col.className || ''
                      }`}
                    >
                      {isCellFocused && isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            if (isEditing) {
                              commitEdit(selectedCell.r, selectedCell.c, editValue);
                            }
                          }}
                          className={`w-full h-full bg-transparent outline-none border-none font-mono text-sm font-bold p-0 ${
                            isDark ? 'text-white' : 'text-black'
                          }`}
                        />
                      ) : col.renderCell ? (
                        col.renderCell(cellVal, row, rIdx)
                      ) : (
                        <span className="truncate">{cellVal}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* StatusBar */}
      <div
        className={`mt-2 shrink-0 flex flex-wrap items-center justify-between px-4 py-2.5 rounded font-bold text-sm border-t-2 shadow gap-2 transition-colors ${
          isDark
            ? 'bg-slate-950 text-slate-100 border-yellow-500'
            : 'bg-blue-950 text-white border-yellow-500'
        }`}
      >
        <div className="flex items-center space-x-6">
          <span className="text-yellow-400 font-bold">
            總筆數: <span className="text-white font-mono text-base">{rows.length}</span> 筆
          </span>
          <span className="text-yellow-400 font-bold">
            目前位置:{' '}
            <span className="text-white font-mono">
              第 {selectedCell.r + 1} 列 / 第 {selectedCell.c + 1} 欄
            </span>
          </span>
          {evaluatedStatusBarInfo && <span className="text-gray-300 text-xs">{evaluatedStatusBarInfo}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-normal">
          {/* Action buttons if callbacks provided */}
          {onInsertRow && (
            <button
              type="button"
              onClick={onInsertRow}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
            >
              <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">Ins</span>
              <span>新增</span>
            </button>
          )}

          {onDeleteRow && (
            <button
              type="button"
              onClick={onDeleteRow}
              disabled={rows.length === 0}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">Del</span>
              <span>刪除</span>
            </button>
          )}

          {onRefreshData && (
            <button
              type="button"
              onClick={onRefreshData}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
            >
              <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F6</span>
              <span>查詢</span>
            </button>
          )}

          {onOpenPrint && (
            <button
              type="button"
              onClick={onOpenPrint}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
            >
              <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F7</span>
              <span>列印</span>
            </button>
          )}

          {customActions}

          {/* Keyboard hints */}
          {!hideKeyboardHints && (
            <>
              {!hideF2Hint && (
                <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-300 font-bold">
                  [F2] 編輯
                </span>
              )}
              {onF3Search && (
                <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-cyan-300 font-bold">
                  [F3] 查詢開窗
                </span>
              )}
              <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-white font-bold">
                [Enter] 下一格
              </span>
              <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-gray-200 font-bold">
                [↑↓] 換列/底端新增
              </span>
            </>
          )}

          {/* Esc Button / Tag */}
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center space-x-1 px-3 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded shadow-md border border-emerald-700 transition cursor-pointer"
            >
              <span className="bg-emerald-800 text-white text-[10px] px-1 rounded font-mono">Esc</span>
              <span>{escLabel}</span>
            </button>
          ) : (
            <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-400 font-bold">
              [ESC] {escLabel}
            </span>
          )}
        </div>
      </div>

      {/* Search Modal */}
      {onF3Search && (
        <SearchModal
          isOpen={searchModalOpen}
          title={f3SearchTitle}
          onSearch={handleF3Query}
          onSelect={handleModalSelect}
          onClose={() => setSearchModalOpen(false)}
        />
      )}

      {/* Primary Key Duplicate Alert Modal */}
      {pkErrorAlert.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`border-4 rounded-lg p-6 max-w-md text-center font-mono shadow-2xl transition-colors ${
              isDark
                ? 'bg-slate-900 border-red-500 text-white'
                : 'bg-red-950 border-yellow-400 text-white'
            }`}
          >
            <h4 className="text-xl font-bold text-yellow-300 mb-3">主鍵資料重複提示</h4>
            <p className="text-base font-semibold mb-6">{pkErrorAlert.message}</p>
            <button
              type="button"
              onClick={() => {
                setPkErrorAlert({ open: false, message: '' });
                setIsEditing(true);
                setTimeout(() => {
                  inputRef.current?.focus();
                  inputRef.current?.select();
                }, 50);
              }}
              className="bg-yellow-400 text-black px-6 py-2 rounded font-bold text-base hover:bg-yellow-300 transition cursor-pointer"
            >
              確定 (Enter / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
