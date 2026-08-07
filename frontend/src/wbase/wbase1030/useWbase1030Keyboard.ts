import { useCallback } from 'react';
import type { GridApi } from 'ag-grid-community';

export interface UseWbase1030KeyboardProps<T = Record<string, any>> {
  gridApi: GridApi | null;
  displayRows: T[];
  editableColIds: string[];
  onAppendRow: () => void;
  onOpenF3Search: (row: T, colId: string) => void;
  onOpenF7Print: () => void;
  onSaveAndSummarize: () => void;
}

export const useWbase1030Keyboard = <T extends Record<string, any>>({
  gridApi,
  displayRows,
  editableColIds,
  onAppendRow,
  onOpenF3Search,
  onOpenF7Print,
  onSaveAndSummarize,
}: UseWbase1030KeyboardProps<T>) => {
  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!gridApi) return;
      if (e.nativeEvent.isComposing) return;

      const key = e.key;
      const focusedCell = gridApi.getFocusedCell();
      if (!focusedCell) return;

      const { rowIndex, column } = focusedCell;
      const colId = column.getColId();
      const totalRows = gridApi.getDisplayedRowCount();

      const currentColIdx = editableColIds.indexOf(colId);

      // F2: Edit Cell Directly
      if (key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        gridApi.startEditingCell({ rowIndex, colKey: colId });
        return;
      }

      // F3: Open Search Modal
      if (key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        if (displayRows[rowIndex]) {
          onOpenF3Search(displayRows[rowIndex], colId);
        }
        return;
      }

      // F7: Open Print Modal
      if (key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        onOpenF7Print();
        return;
      }

      // ESC: Save & Summarize
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        gridApi.stopEditing(false);
        onSaveAndSummarize();
        return;
      }

      // Enter & Tab Navigation
      if (key === 'Enter' || key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();

        const isShift = e.shiftKey;
        gridApi.stopEditing(false);

        if (isShift) {
          // Shift+Tab: Move Left / Previous Row
          if (currentColIdx > 0) {
            const prevColId = editableColIds[currentColIdx - 1];
            setTimeout(() => {
              gridApi.setFocusedCell(rowIndex, prevColId);
              gridApi.startEditingCell({ rowIndex, colKey: prevColId });
            }, 30);
          } else if (rowIndex > 0) {
            const lastColId = editableColIds[editableColIds.length - 1];
            const prevRowIdx = rowIndex - 1;
            setTimeout(() => {
              gridApi.setFocusedCell(prevRowIdx, lastColId);
              gridApi.startEditingCell({ rowIndex: prevRowIdx, colKey: lastColId });
            }, 30);
          }
          return;
        }

        // Enter or Tab (Forward): Move Right / Next Row / Append Row
        if (currentColIdx !== -1 && currentColIdx < editableColIds.length - 1) {
          const nextColId = editableColIds[currentColIdx + 1];
          setTimeout(() => {
            gridApi.setFocusedCell(rowIndex, nextColId);
            gridApi.startEditingCell({ rowIndex, colKey: nextColId });
          }, 30);
        } else {
          const firstColId = editableColIds[0] || colId;
          if (rowIndex < totalRows - 1) {
            const nextRowIdx = rowIndex + 1;
            setTimeout(() => {
              gridApi.setFocusedCell(nextRowIdx, firstColId);
              gridApi.startEditingCell({ rowIndex: nextRowIdx, colKey: firstColId });
            }, 30);
          } else {
            onAppendRow();
            setTimeout(() => {
              const newTotalRows = gridApi.getDisplayedRowCount();
              if (newTotalRows > totalRows) {
                const newRowIdx = newTotalRows - 1;
                gridApi.setFocusedCell(newRowIdx, firstColId);
                gridApi.startEditingCell({ rowIndex: newRowIdx, colKey: firstColId });
              }
            }, 100);
          }
        }
        return;
      }

      // ArrowDown on last row: append a new row
      if (key === 'ArrowDown') {
        if (rowIndex === totalRows - 1) {
          e.preventDefault();
          e.stopPropagation();
          gridApi.stopEditing(false);
          onAppendRow();
          setTimeout(() => {
            const newTotalRows = gridApi.getDisplayedRowCount();
            if (newTotalRows > totalRows) {
              const newRowIdx = newTotalRows - 1;
              gridApi.setFocusedCell(newRowIdx, colId);
              gridApi.startEditingCell({ rowIndex: newRowIdx, colKey: colId });
            }
          }, 100);
        }
        return;
      }
    },
    [
      gridApi,
      displayRows,
      editableColIds,
      onAppendRow,
      onOpenF3Search,
      onOpenF7Print,
      onSaveAndSummarize,
    ]
  );

  return { handleKeyDownCapture };
};
