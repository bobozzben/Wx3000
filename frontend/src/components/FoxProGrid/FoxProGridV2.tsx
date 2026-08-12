import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SearchModal } from './SearchModal';
import type { SearchItem } from './SearchModal';

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
  /** Custom status bar left info */
  statusBarInfo?: React.ReactNode;
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
}

export function FoxProGridV2<T extends Record<string, any>>({
  rows,
  columns,
  createEmptyRow,
  onRowsChange,
  onSaveRow,
  onOpenPrint,
  onShowSummary,
  statusBarInfo,
  onF3Search,
  f3SearchTitle = '資料搜尋 [F3]',
  minRows = 15,
  height = '608px',
  getRowKey,
}: FoxProGridV2Props<T>) {
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

  // Pad display rows up to minRows (15 rows) for seamless Excel experience
  const displayRows = useMemo(() => {
    if (rows.length >= minRows) return rows;
    const padded = [...rows];
    while (padded.length < minRows) {
      padded.push(createEmptyRow());
    }
    return padded;
  }, [rows, minRows, createEmptyRow]);

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
    (r: number, c: number, deltaC: number) => {
      let nextR = r;
      let nextC = c + deltaC;

      if (nextC >= columns.length) {
        nextC = 0;
        nextR += 1;
      } else if (nextC < 0) {
        nextC = columns.length - 1;
        nextR -= 1;
      }

      if (nextR >= displayRows.length) {
        const newRow = createEmptyRow();
        const updated = [...displayRows, newRow];
        onRowsChange(updated);
        nextR = displayRows.length;
        nextC = 0;
      } else if (nextR < 0) {
        nextR = 0;
        nextC = 0;
      }

      setSelectedCell({ r: nextR, c: nextC });
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
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (searchModalOpen && (activeTag === 'input' || activeTag === 'textarea')) {
        return;
      }

      const { r, c } = selectedCell;
      const col = columns[c];
      if (!col) return;

      // F2: Start Editing
      if (e.key === 'F2') {
        e.preventDefault();
        if (col.editable !== false) {
          const val = displayRows[r]?.[col.key] || '';
          setEditValue(String(val));
          setIsEditing(true);
        }
        return;
      }

      // F3: Search Modal
      if (e.key === 'F3') {
        e.preventDefault();
        if (onF3Search) {
          setSearchTargetColKey(col.key);
          setSearchModalOpen(true);
        }
        return;
      }

      // F7: Print
      if (e.key === 'F7') {
        e.preventDefault();
        if (onOpenPrint) onOpenPrint();
        return;
      }

      // ESC: Save & Show Summary or direct exit
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isEditing) {
          setIsEditing(false);
        } else if (onShowSummary) {
          onShowSummary(hasModified);
        }
        return;
      }

      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            moveCell(r, c, 1);
          }
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            moveCell(r, c, e.shiftKey ? -1 : 1);
          }
          return;
        }
      } else {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = displayRows[r]?.[col.key] || '';
          setEditValue(String(val));
          setIsEditing(true);
          return;
        }

        if (e.key === 'Tab') {
          e.preventDefault();
          moveCell(r, c, e.shiftKey ? -1 : 1);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (r > 0) setSelectedCell({ r: r - 1, c });
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (r < displayRows.length - 1) {
            setSelectedCell({ r: r + 1, c });
          } else {
            const newRow = createEmptyRow();
            onRowsChange([...displayRows, newRow]);
            setSelectedCell({ r: r + 1, c });
          }
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          moveCell(r, c, -1);
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          moveCell(r, c, 1);
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
    moveCell(r, c, 1);
  };

  const handleF3Query = async (query: string): Promise<SearchItem[]> => {
    if (onF3Search) {
      return onF3Search(query, searchTargetColKey);
    }
    return [];
  };

  return (
    <div ref={gridContainerRef} className="flex flex-col w-full h-full font-mono outline-none">
      {/* Excel 15-Row Grid Container */}
      <div
        style={{ height }}
        className="w-full bg-white border-2 border-blue-900 rounded shadow-md overflow-hidden flex flex-col select-none"
      >
        {/* Header */}
        <div className="bg-[#1e3a8a] text-white flex text-sm font-bold tracking-wider h-[38px] shrink-0 border-b border-blue-900">
          <div className="w-[50px] h-full flex items-center justify-center border-r border-blue-800 shrink-0">
            項次
          </div>
          {columns.map((col) => (
            <div
              key={col.key}
              style={{
                width: col.width || '150px',
                flex: col.width === '1fr' ? 1 : undefined,
              }}
              className={`h-full flex items-center px-3 border-r border-blue-800 last:border-r-0 shrink-0 font-bold ${
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
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {displayRows.map((row, rIdx) => {
            const isRowSelected = selectedCell.r === rIdx;
            const isEven = rIdx % 2 === 1;
            const rawKey = getRowKey ? getRowKey(row, rIdx) : '';
            const rowKey = rawKey ? `${rawKey}_row_${rIdx}` : `row_${rIdx}`;

            return (
              <div
                key={rowKey}
                className={`flex border-b border-gray-200 h-[38px] items-center text-sm transition-colors ${
                  isEven ? 'bg-[#ffecd9]' : 'bg-white'
                } ${isRowSelected ? 'bg-blue-100/60' : ''}`}
              >
                {/* Index Cell */}
                <div className="w-[50px] h-full flex items-center justify-center border-r border-gray-200 text-gray-500 font-bold bg-gray-50 shrink-0">
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
                      className={`h-full border-r border-gray-200 flex items-center px-3 cursor-cell overflow-hidden shrink-0 relative ${
                        isCellFocused
                          ? 'border-2 border-[#eab308] bg-[#fef9c3] font-bold text-black shadow-inner z-10'
                          : ''
                      } ${col.className || ''}`}
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
                          className="w-full h-full bg-transparent outline-none border-none font-mono text-sm font-bold text-black p-0"
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
      <div className="mt-2 flex flex-wrap items-center justify-between bg-blue-950 text-white px-4 py-2.5 rounded font-bold text-sm border-t-2 border-yellow-500 shadow gap-2">
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
          {statusBarInfo && <span className="text-gray-300 text-xs">{statusBarInfo}</span>}
        </div>
        <div className="flex flex-wrap items-center space-x-3 text-xs font-normal text-gray-300">
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-300 font-bold">
            [F2] 編輯
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-cyan-300 font-bold">
            [F3] 查詢開窗
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-green-300 font-bold">
            [F7] 列印
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-400 font-bold">
            [ESC] 存檔並結算
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-white font-bold">
            [Enter] 下一格
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-gray-200 font-bold">
            [↑↓] 換列/底端新增
          </span>
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
          <div className="bg-red-950 border-4 border-yellow-400 text-white p-6 rounded-lg shadow-2xl max-w-md text-center font-mono">
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
