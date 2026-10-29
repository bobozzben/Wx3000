import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SearchModal } from './SearchModal';
import type { SearchItem } from './SearchModal';
import { useTheme } from '../../wbase/menu/ThemeContext';
import { truncateBig5 } from '../../services/validation';
import { AlertCircle, XCircle } from 'lucide-react';

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
  /** Automatically convert input to uppercase (InputMask !) */
  uppercase?: boolean;
  /** Only allow digits 0-9 (InputMask 9) */
  digitOnly?: boolean;
  /** Maximum bytes allowed (Big5 byte limit) */
  maxBytes?: number;
  /** Maximum text character length */
  maxLength?: number;
  /** Custom column validation */
  validate?: (
    val: string,
    row: T,
    rowIndex: number,
    allRows: T[]
  ) => { valid: boolean; message: string; isWarning?: boolean };
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
  /** Minimum visible rows for grid (default 0: 只顯示實際筆數，對齊 FoxPro GRID 物件模式) */
  minRows?: number;
  /** Container height (default '608px') */
  height?: string;
  /** Row key getter (default relies on index) */
  getRowKey?: (row: T, index: number) => string | number;
  /** Callback on Ins key / Add Row button click */
  onInsertRow?: () => void;
  /** Callback on Del key / Delete Row button click */
  onDeleteRow?: (row?: T, rowIndex?: number) => void;
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
  /** Unique Grid ID or Storage Key for persisting resized column widths in LocalStorage */
  gridId?: string;
  storageKey?: string;
  /** Whether to show row index / 項次 column (default false) */
  showRowIndex?: boolean;
}

const parseColWidth = (w?: string): number | undefined => {
  if (!w || w.includes('fr') || w.includes('%')) return undefined;
  const val = parseFloat(w);
  return isNaN(val) ? undefined : val;
};

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
  minRows = 0,
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
  gridId,
  storageKey,
  showRowIndex = false,
}: FoxProGridV2Props<T>) {
  const { isDark } = useTheme();

  // 欄寬自訂與持久化儲存 Key (LocalStorage)
  const effectiveStorageKey = useMemo(() => {
    const key = gridId || storageKey;
    if (key) return `wx3000_grid_col_widths_${key}`;
    const colSignature = columns.map((c) => String(c.key)).join('_');
    return `wx3000_grid_col_widths_${colSignature}`;
  }, [gridId, storageKey, columns]);

  // 載入持久化自訂欄寬 (若無則使用欄位定義之預設寬度)
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

  // 取得特定欄位當前寬度物件樣式
  const getColWidthStyle = useCallback(
    (col: ColumnDefV2<T>): React.CSSProperties => {
      const customWidth = colWidths[col.key];
      if (customWidth) {
        return {
          width: `${customWidth}px`,
          minWidth: `${customWidth}px`,
          maxWidth: `${customWidth}px`,
          flexShrink: 0,
        };
      }
      if (col.width === '1fr') {
        return {
          width: undefined,
          minWidth: '180px',
          flex: 1,
        };
      }
      const defaultW = col.width || '150px';
      return {
        width: defaultW,
        minWidth: defaultW,
        flexShrink: 0,
      };
    },
    [colWidths]
  );

  const getColCurrentWidth = useCallback(
    (col: ColumnDefV2<T>): number => {
      if (colWidths[col.key]) return colWidths[col.key];
      const parsed = parseColWidth(col.width);
      if (parsed) return parsed;
      return 150;
    },
    [colWidths]
  );

  // 滑鼠拖曳欄寬處理 (Mouse Drag Column Resizing)
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = currentWidth;
      let lastWidth = currentWidth;
      let animId: number | null = null;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(40, Math.round(startWidth + delta));
        lastWidth = newWidth;

        if (animId !== null) {
          cancelAnimationFrame(animId);
        }
        animId = requestAnimationFrame(() => {
          setColWidths((prev) => ({
            ...prev,
            [colKey]: newWidth,
          }));
        });
      };

      const handleMouseUp = () => {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        setColWidths((prev) => {
          const latest = { ...prev, [colKey]: lastWidth };
          try {
            localStorage.setItem(effectiveStorageKey, JSON.stringify(latest));
          } catch {
            // ignore
          }
          return latest;
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [effectiveStorageKey]
  );
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [hasModified, setHasModified] = useState<boolean>(false);

  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchTargetColKey, setSearchTargetColKey] = useState<keyof T & string>(
    columns[0]?.key || ('' as any)
  );

  // 右下角提示訊息狀態 (對齊 FoxPro 盲打風格)
  const [toastAlert, setToastAlert] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success';
  } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastAlert({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastAlert(null);
    }, 4000);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const createEmptyRowRef = useRef(createEmptyRow);
  useEffect(() => {
    createEmptyRowRef.current = createEmptyRow;
  }, [createEmptyRow]);

  // Auto scroll table body to keep active cell in visible vertical and horizontal range
  useEffect(() => {
    if (tableBodyRef.current) {
      const rowEl = tableBodyRef.current.children[selectedCell.r] as HTMLElement | undefined;
      if (rowEl) {
        rowEl.scrollIntoView({ block: 'nearest' });
        const cellChildIndex = showRowIndex ? selectedCell.c + 1 : selectedCell.c;
        const cellEl = rowEl.children[cellChildIndex] as HTMLElement | undefined;
        if (cellEl) {
          cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }, [selectedCell.r, selectedCell.c, showRowIndex]);

  // Only pad display rows if minRows > 0; default minRows = 0 shows only actual rows (FoxPro Grid style)
  const displayRows = useMemo(() => {
    if (minRows <= 0 || rows.length >= minRows) return rows;
    const padded = [...rows];
    while (padded.length < minRows) {
      padded.push(createEmptyRowRef.current());
    }
    return padded;
  }, [rows, minRows]);

  // Adjust selected row index if rows shrink
  useEffect(() => {
    if (displayRows.length > 0 && selectedCell.r >= displayRows.length) {
      setSelectedCell((prev) => ({ ...prev, r: displayRows.length - 1 }));
    }
  }, [displayRows.length, selectedCell.r]);

  // 主鍵欄位索引 (Primary Key Column Index)
  const pkColIndex = useMemo(() => {
    return columns.findIndex((col) => col.isPrimaryKey);
  }, [columns]);

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

  // Primary Key existence & duplicate check helper for Grid Editing
  const checkPrimaryKey = useCallback(
    (r: number, c: number, value: string): { valid: boolean; message: string } => {
      const col = columns[c];
      if (!col || !col.isPrimaryKey) return { valid: true, message: '' };

      const val = value.trim().toUpperCase();
      if (!val) {
        return {
          valid: false,
          message: `主鍵「${col.label}」不可空白！請輸入編號。`,
        };
      }

      // Check if value already exists in displayRows (excluding current row r)
      const isDuplicate = displayRows.some((row, idx) => {
        if (idx === r) return false;
        const existingVal = String(row[col.key] || '').trim().toUpperCase();
        return existingVal === val;
      });

      if (isDuplicate) {
        return {
          valid: false,
          message: `主鍵「${col.label}」編號 "${val}" 已重複，請重新輸入！`,
        };
      }

      return { valid: true, message: '' };
    },
    [columns, displayRows]
  );

  // Helper to commit edits with Primary Key and column validation
  const commitEdit = useCallback(
    (r: number, c: number, value: string): boolean => {
      const col = columns[c];
      if (!col) return false;

      let processedVal = value;
      if (col.uppercase) {
        processedVal = processedVal.toUpperCase();
      }
      if (col.digitOnly) {
        processedVal = processedVal.replace(/\D/g, '');
      }
      if (col.maxBytes && col.maxBytes > 0) {
        processedVal = truncateBig5(processedVal, col.maxBytes);
      }

      // 1. Primary Key blank & duplicate check before commit!
      if (col.isPrimaryKey) {
        const pkCheck = checkPrimaryKey(r, c, processedVal);
        if (!pkCheck.valid) {
          showToast(pkCheck.message, 'error');
          setSelectedCell({ r, c });
          setIsEditing(true);
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 50);
          return false; // REJECT COMMIT & DO NOT SAVE
        }
      } else {
        // If editing a non-PK column, verify that current row's PK is not blank
        if (pkColIndex !== -1) {
          const currentPkVal = String(displayRows[r]?.[columns[pkColIndex].key] || '').trim();
          if (!currentPkVal) {
            showToast(`主鍵「${columns[pkColIndex].label}」不可空白！請輸入編號。`, 'error');
            setSelectedCell({ r, c: pkColIndex });
            setIsEditing(true);
            setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            }, 50);
            return false; // REJECT COMMIT & FORCE BACK TO PK COLUMN
          }
        }
      }

      // 2. Custom column validation
      if (col.validate) {
        const valRes = col.validate(processedVal, displayRows[r], r, displayRows);
        if (!valRes.valid) {
          if (valRes.isWarning) {
            // Warning: show prompt toast, but allow commit!
            showToast(valRes.message, 'warning');
          } else {
            // Blocking error: reject commit and keep focus!
            showToast(valRes.message, 'error');
            setSelectedCell({ r, c });
            setIsEditing(true);
            setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            }, 50);
            return false;
          }
        }
      }

      const colKey = col.key;
      const updated = [...displayRows];
      const targetRow = { ...updated[r], [colKey]: processedVal };
      updated[r] = targetRow;
      onRowsChange(updated);
      setHasModified(true);
      if (onSaveRow) {
        onSaveRow(targetRow, r);
      }
      return true;
    },
    [columns, displayRows, onRowsChange, onSaveRow, checkPrimaryKey, showToast, pkColIndex]
  );

  // 新增列處理 (Insert Row: 驗證當前列主鍵後新增，並直接聚焦第一欄進入編輯)
  const isAddingRowRef = useRef(false);
  const handleInsertRow = useCallback(() => {
    // 檢查當前列的主鍵是否已填且無重複
    if (displayRows.length > 0 && pkColIndex !== -1) {
      const curPkCol = columns[pkColIndex];
      const curPkVal = (isEditing && selectedCell.c === pkColIndex
        ? editValue
        : String(displayRows[selectedCell.r]?.[curPkCol.key] || '')
      ).trim().toUpperCase();

      if (!curPkVal) {
        showToast(`主鍵「${curPkCol.label}」不可空白！請先輸入編號。`, 'error');
        setSelectedCell({ r: selectedCell.r, c: pkColIndex });
        setIsEditing(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
        return;
      }

      const isDup = displayRows.some((row, idx) => {
        if (idx === selectedCell.r) return false;
        return String(row[curPkCol.key] || '').trim().toUpperCase() === curPkVal;
      });
      if (isDup) {
        showToast(`主鍵「${curPkCol.label}」編號 "${curPkVal}" 已重複，請重新輸入！`, 'error');
        setSelectedCell({ r: selectedCell.r, c: pkColIndex });
        setIsEditing(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
        return;
      }
    }

    if (isEditing) {
      const ok = commitEdit(selectedCell.r, selectedCell.c, editValue);
      if (!ok) return;
    }

    isAddingRowRef.current = true;
    if (onInsertRow) {
      onInsertRow();
    } else {
      const newRows = [...displayRows, createEmptyRow()];
      onRowsChange(newRows);
      const newRowIdx = newRows.length - 1;
      const initialCol = pkColIndex >= 0 ? pkColIndex : 0;
      setSelectedCell({ r: newRowIdx, c: initialCol });
      setEditValue('');
      setIsEditing(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 60);
    }
  }, [
    displayRows,
    pkColIndex,
    columns,
    isEditing,
    selectedCell,
    editValue,
    commitEdit,
    showToast,
    onInsertRow,
    createEmptyRow,
    onRowsChange,
  ]);

  // 當新增列時，游標自動聚焦至新列的第一欄 (column 0) 並進入編輯模式
  const prevRowsLengthRef = useRef(rows.length);
  useEffect(() => {
    if (rows.length > prevRowsLengthRef.current) {
      if (isAddingRowRef.current) {
        isAddingRowRef.current = false;
        const newRowIdx = rows.length - 1;
        const initialCol = pkColIndex >= 0 ? pkColIndex : 0;
        setSelectedCell({ r: newRowIdx, c: initialCol });
        setEditValue('');
        setIsEditing(true);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 60);
      }
    }
    prevRowsLengthRef.current = rows.length;
  }, [rows.length, pkColIndex]);

  // Helper to move cell focus
  const moveCell = useCallback(
    (r: number, c: number, dr: number, dc: number = 0) => {
      if (displayRows.length === 0) return;

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
        // Last cell advance (e.g. Enter or Tab on the last column of the last row) appends a new row (FoxPro Grid style)
        if (dc > 0) {
          handleInsertRow();
          return;
        } else {
          // ArrowDown at bottom stops at last row without appending blank rows
          nr = Math.max(0, displayRows.length - 1);
        }
      } else if (nr < 0) {
        nr = 0;
      }

      setSelectedCell({ r: nr, c: nc });
      setIsEditing(false);
    },
    [columns.length, displayRows.length, handleInsertRow]
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

      // Ins: Insert Row (FoxPro 樣式: 聚焦第1欄進入編輯)
      if (e.key === 'Insert') {
        e.preventDefault();
        handleInsertRow();
        return;
      }

      // 若查無資料，其他儲存格導覽鍵直接略過
      if (displayRows.length === 0) {
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
        if (e.key === 'PageUp') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            const containerHeight = tableBodyRef.current?.clientHeight || 0;
            const pageSize = containerHeight > 0 ? Math.max(1, Math.floor(containerHeight / 38)) : 10;
            const nr = Math.max(0, r - pageSize);
            setSelectedCell({ r: nr, c });
            setIsEditing(false);
          }
          return;
        }
        if (e.key === 'PageDown') {
          e.preventDefault();
          const success = commitEdit(r, c, editValue);
          if (success) {
            const containerHeight = tableBodyRef.current?.clientHeight || 0;
            const pageSize = containerHeight > 0 ? Math.max(1, Math.floor(containerHeight / 38)) : 10;
            const nr = Math.min(displayRows.length - 1, r + pageSize);
            setSelectedCell({ r: Math.max(0, nr), c });
            setIsEditing(false);
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

        // 當目前列主鍵空白時，阻止移動離開主鍵欄位，並提示警示
        if (
          pkColIndex !== -1 &&
          (e.key === 'Tab' ||
            e.key === 'ArrowUp' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'PageUp' ||
            e.key === 'PageDown')
        ) {
          const curPkVal = String(displayRows[r]?.[columns[pkColIndex].key] || '').trim();
          if (!curPkVal) {
            e.preventDefault();
            showToast(`主鍵「${columns[pkColIndex].label}」不可空白！請輸入編號。`, 'error');
            setSelectedCell({ r, c: pkColIndex });
            setIsEditing(true);
            setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            }, 50);
            return;
          }
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

        if (e.key === 'PageUp') {
          e.preventDefault();
          const containerHeight = tableBodyRef.current?.clientHeight || 0;
          const pageSize = containerHeight > 0 ? Math.max(1, Math.floor(containerHeight / 38)) : 10;
          const nr = Math.max(0, r - pageSize);
          setSelectedCell({ r: nr, c });
          return;
        }
        if (e.key === 'PageDown') {
          e.preventDefault();
          const containerHeight = tableBodyRef.current?.clientHeight || 0;
          const pageSize = containerHeight > 0 ? Math.max(1, Math.floor(containerHeight / 38)) : 10;
          const nr = Math.min(displayRows.length - 1, r + pageSize);
          setSelectedCell({ r: Math.max(0, nr), c });
          return;
        }

        if (e.key === 'Home') {
          e.preventDefault();
          setSelectedCell({ r: e.ctrlKey ? 0 : r, c: 0 });
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          setSelectedCell({
            r: e.ctrlKey ? Math.max(0, displayRows.length - 1) : r,
            c: columns.length - 1,
          });
          return;
        }

        if (e.key === 'Delete') {
          e.preventDefault();
          if (onDeleteRow) {
            onDeleteRow(currentSelectedRow, r);
          }
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
          if (pkColIndex !== -1 && c !== pkColIndex) {
            const curPkVal = String(displayRows[r]?.[columns[pkColIndex].key] || '').trim();
            if (!curPkVal) {
              e.preventDefault();
              showToast(`主鍵「${columns[pkColIndex].label}」不可空白！請先輸入編號。`, 'error');
              setSelectedCell({ r, c: pkColIndex });
              setIsEditing(true);
              return;
            }
          }
          if (col.digitOnly && !/^\d$/.test(e.key)) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          const initKey = col.uppercase ? e.key.toUpperCase() : e.key;
          setEditValue(initKey);
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
    handleInsertRow,
    pkColIndex,
    showToast,
    onF3Search,
    onOpenPrint,
    onShowSummary,
    onDeleteRow,
    currentSelectedRow,
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
    <div ref={gridContainerRef} className="flex-1 min-h-0 flex flex-col w-full h-full font-mono outline-none print:h-auto print:overflow-visible">
      {/* Excel 15-Row Grid Container */}
      <div
        style={height ? { height } : undefined}
        className={`w-full border-2 rounded shadow-md overflow-hidden flex flex-col select-none transition-colors print:border-none print:shadow-none print:h-auto print:overflow-visible ${
          height ? '' : 'flex-1 min-h-0'
        } ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-blue-900'
        }`}
      >
        {/* Horizontal Scroll Wrapper (Locks HeaderGroups, Header & Rows together) */}
        <div className="overflow-x-auto flex-1 min-h-0 flex flex-col print:overflow-visible print:w-full">
          <div className="min-w-full w-max flex-1 min-h-0 flex flex-col print:w-full">
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
              {showRowIndex && (
                <div
                  className={`w-[50px] h-full flex items-center justify-center border-r shrink-0 ${
                    isDark ? 'border-slate-800' : 'border-blue-800'
                  }`}
                >
                  項次
                </div>
              )}
              {columns.map((col) => {
                const currentWidth = getColCurrentWidth(col);
                return (
                  <div
                    key={col.key}
                    style={getColWidthStyle(col)}
                    className={`h-full flex items-center px-3 border-r last:border-r-0 shrink-0 font-bold relative group/col select-none ${
                      isDark ? 'border-slate-800' : 'border-blue-800'
                    } ${
                      col.align === 'center'
                        ? 'justify-center'
                        : col.align === 'right'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <span className="truncate pr-1">{col.label}</span>

                    {/* 拖曳調整欄寬把手 (Column Resizer Handle) */}
                    <div
                      title="拖曳以調整欄寬，雙擊重置預設寬度"
                      onMouseDown={(e) => handleResizeStart(e, col.key, currentWidth)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const defW = parseColWidth(col.width) || 130;
                        setColWidths((prev) => {
                          const next = { ...prev, [col.key]: defW };
                          try {
                            localStorage.setItem(effectiveStorageKey, JSON.stringify(next));
                          } catch {}
                          return next;
                        });
                      }}
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none flex items-center justify-center hover:bg-blue-400/40 active:bg-yellow-400/60 z-20 group print:hidden"
                    >
                      <div className="w-[1.5px] h-3.5 bg-white/30 group-hover:bg-yellow-300 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows Body */}
            <div ref={tableBodyRef} className={`flex-1 min-h-0 overflow-y-auto print:overflow-visible print:h-auto ${isDark ? 'bg-slate-900' : 'bg-[#f8fafc]'}`}>
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
                    {showRowIndex && (
                      <div
                        className={`w-[50px] h-full flex items-center justify-center border-r font-bold shrink-0 ${
                          isDark
                            ? 'border-slate-800 text-yellow-400 bg-slate-950'
                            : 'border-gray-200 text-gray-500 bg-gray-50'
                        }`}
                      >
                        {String(rIdx + 1).padStart(2, '0')}
                      </div>
                    )}

                    {/* Data Cells */}
                    {columns.map((col, cIdx) => {
                      const isCellFocused = selectedCell.r === rIdx && selectedCell.c === cIdx;
                      const cellVal = row[col.key] ?? '';

                      return (
                        <div
                          key={col.key}
                          style={getColWidthStyle(col)}
                          onClick={() => {
                            if (isEditing && (selectedCell.r !== rIdx || selectedCell.c !== cIdx)) {
                              const success = commitEdit(selectedCell.r, selectedCell.c, editValue);
                              if (!success) return; // Block cell switch on invalid PK!
                            }
                            if (selectedCell.r !== rIdx && pkColIndex !== -1) {
                              const curPkVal = String(displayRows[selectedCell.r]?.[columns[pkColIndex].key] || '').trim();
                              if (!curPkVal) {
                                showToast(`主鍵「${columns[pkColIndex].label}」不可空白！請輸入編號。`, 'error');
                                setSelectedCell({ r: selectedCell.r, c: pkColIndex });
                                setIsEditing(true);
                                setTimeout(() => {
                                  inputRef.current?.focus();
                                  inputRef.current?.select();
                                }, 50);
                                return;
                              }
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
                                ? 'border-2 border-yellow-400 bg-yellow-950/90 font-bold !text-white shadow-inner z-10 print:border-none print:shadow-none print:bg-transparent print:!text-black'
                                : 'border-2 border-[#eab308] bg-[#fef9c3] font-bold !text-slate-900 shadow-inner z-10 print:border-none print:shadow-none print:bg-transparent print:!text-black'
                              : ''
                          } ${
                            isDark
                              ? col.className
                                ? col.className.replace(/text-(black|blue-\d+|gray-\d+|slate-\d+)/g, 'text-sky-200')
                                : col.isPrimaryKey
                                ? 'text-sky-300 font-bold'
                                : ''
                              : col.className
                              ? col.className
                                  .replace(/text-(yellow|amber)-\d+/g, 'text-blue-900')
                                  .replace(/dark:text-(yellow|amber)-\d+/g, '')
                              : col.isPrimaryKey
                              ? 'text-blue-900 font-bold'
                              : ''
                          }`}
                        >
                          {isCellFocused && isEditing ? (
                            <>
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                maxLength={col.maxLength}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (col.uppercase) val = val.toUpperCase();
                                  if (col.digitOnly) val = val.replace(/\D/g, '');
                                  setEditValue(val);
                                }}
                                onBlur={() => {
                                  if (isEditing) {
                                    commitEdit(selectedCell.r, selectedCell.c, editValue);
                                  }
                                }}
                                className={`w-full h-full bg-transparent outline-none border-none font-mono text-sm font-bold p-0 print:hidden ${
                                  isDark ? 'text-white' : 'text-black'
                                }`}
                              />
                              <span className="hidden print:inline font-mono text-sm font-bold">{editValue}</span>
                            </>
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
              {displayRows.length === 0 && (
                <div className={`p-8 text-center text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  查無資料 (可按{' '}
                  <kbd
                    onClick={handleInsertRow}
                    className="px-1.5 py-0.5 rounded bg-yellow-400 text-blue-950 font-bold text-xs cursor-pointer hover:bg-yellow-300"
                  >
                    Ins
                  </kbd>{' '}
                  鍵新增第一筆資料)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* StatusBar (列印時隱藏狀態列與操作按鈕) */}
      <div
        className={`mt-1.5 sm:mt-2 shrink-0 flex flex-wrap items-center justify-between px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded font-bold text-xs sm:text-sm border-t-2 shadow gap-1.5 sm:gap-2 transition-colors print:hidden ${
          isDark
            ? 'bg-slate-950 text-slate-100 border-yellow-500'
            : 'bg-blue-950 text-white border-yellow-500'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-yellow-400 font-bold whitespace-nowrap">
            總筆數: <span className="text-white font-mono text-sm sm:text-base">{rows.length}</span> 筆
          </span>
          <span className="text-yellow-400 font-bold whitespace-nowrap">
            目前位置:{' '}
            <span className="text-white font-mono">
              第 {displayRows.length === 0 ? 0 : selectedCell.r + 1} 列 / 第 {columns.length === 0 ? 0 : selectedCell.c + 1} 欄
            </span>
          </span>
          {evaluatedStatusBarInfo && <span className="text-gray-300 text-xs hidden sm:inline">{evaluatedStatusBarInfo}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-normal">
          {/* Action buttons if callbacks provided */}
          {onInsertRow && (
            <button
              type="button"
              onClick={handleInsertRow}
              className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
            >
              <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">Ins</span>
              <span>新增</span>
            </button>
          )}

          {onDeleteRow && (
            <button
              type="button"
              onClick={() => onDeleteRow(currentSelectedRow, selectedCell.r)}
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

      {/* 右下角提示通知 (對齊 FoxPro 盲打風格，非阻斷式彈窗) */}
      {toastAlert && (
        <div
          className={`fixed bottom-12 right-6 z-50 flex items-center justify-between space-x-3 px-4 py-2.5 rounded-lg shadow-2xl border-2 font-bold text-sm max-w-md transition-all animate-bounce ${
            toastAlert.type === 'error'
              ? 'bg-red-600 text-white border-red-400'
              : toastAlert.type === 'warning'
              ? 'bg-amber-600 text-white border-amber-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`}
          role="alert"
        >
          <div className="flex items-center space-x-2">
            {toastAlert.type === 'error' ? (
              <XCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{toastAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastAlert(null)}
            className="text-white hover:text-gray-200 underline text-xs ml-2 cursor-pointer"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
}
