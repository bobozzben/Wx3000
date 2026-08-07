import { useCallback } from 'react';
import type { GridApi } from 'ag-grid-community';

export interface UseFoxProKeyboardProps<T = Record<string, any>> {
  gridApi: GridApi | null;
  rows: T[];
  editableColIds: string[];
  onAppendRow?: () => void;
  onF4Search?: (row: T, colId: string) => void;
  onF7Print?: () => void;
  onF9Query?: () => void;
  onF12Save?: () => void;
  onProductSearch?: (productCode: string, rowIndex: number) => Promise<void>;
}

export const useFoxProKeyboard = <T extends Record<string, any>>({
  gridApi,
  rows,
  editableColIds,
  onAppendRow,
  onF4Search,
  onF7Print,
  onF9Query,
  onF12Save,
  onProductSearch,
}: UseFoxProKeyboardProps<T>) => {
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

      const colsToUse =
        editableColIds.length > 0
          ? editableColIds
          : gridApi.getAllDisplayedColumns().map((c) => c.getColId());
      const currentColIdx = colsToUse.indexOf(colId);

      console.log("colid:", colId, "key:", key);

      // F2: Start Editing Cell
      if (key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        gridApi.startEditingCell({ rowIndex, colKey: colId });
        return;
      }

      // F4: Trigger Search Modal
      if (key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        if (onF4Search && rows[rowIndex]) {
          onF4Search(rows[rowIndex], colId);
        }
        return;
      }

      // F7: Print
      if (key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        if (onF7Print) onF7Print();
        return;
      }

      // F9: Query / Refresh
      if (key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        if (onF9Query) onF9Query();
        return;
      }

      // F12: Save & Show Totals
      if (key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        gridApi.stopEditing(false);
        if (onF12Save) onF12Save();
        return;
      }

      // Enter or Tab navigation
      if (key === 'Enter' || key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();

        // Check if editing productCode to invoke product search auto-fill
        if (colId === 'cpaCode' && onProductSearch) {
          const editingCells = gridApi.getEditingCells();
          if (editingCells.length > 0) {
            // Get current editing input value if needed
            const currentVal = (rows[rowIndex] as any)?.productCode;
            if (currentVal) {
              onProductSearch(currentVal, rowIndex);
            }
          }
        }

        //gridApi.stopEditing(false);

        //if (isShift) {
        // Shift+Tab: Move Left / Previous Row
        if (currentColIdx > 0) {
          const prevColId = colsToUse[currentColIdx - 1];
          setTimeout(() => {
            gridApi.setFocusedCell(rowIndex, prevColId);
            gridApi.startEditingCell({ rowIndex, colKey: prevColId });
          }, 30);
        } else if (rowIndex > 0) {
          const lastColId = colsToUse[colsToUse.length - 1];
          const prevRowIdx = rowIndex - 1;
          setTimeout(() => {
            gridApi.setFocusedCell(prevRowIdx, lastColId);
            gridApi.startEditingCell({ rowIndex: prevRowIdx, colKey: lastColId });
          }, 30);
        }
        //return;
        //}

        // Enter or Tab (Forward): Move Right / Next Row / Append Row
        if (currentColIdx !== -1 && currentColIdx < colsToUse.length - 1) {
          const nextColId = colsToUse[currentColIdx + 1];
          setTimeout(() => {
            gridApi.setFocusedCell(rowIndex, nextColId);
            gridApi.startEditingCell({ rowIndex, colKey: nextColId });
          }, 30);
        } else {
          const firstColId = colsToUse[0] || colId;
          if (rowIndex < totalRows - 1) {
            const nextRowIdx = rowIndex + 1;
            setTimeout(() => {
              gridApi.setFocusedCell(nextRowIdx, firstColId);
              gridApi.startEditingCell({ rowIndex: nextRowIdx, colKey: firstColId });
            }, 30);
          } else if (onAppendRow) {
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

      // ArrowDown key navigation
      if (key === 'ArrowDown') {
        if (rowIndex === totalRows - 1) {
          e.preventDefault();
          e.stopPropagation();
          gridApi.stopEditing(false);
          if (onAppendRow) {
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
        }
        return;
      }
    },
    [
      gridApi,
      rows,
      editableColIds,
      onAppendRow,
      onF4Search,
      onF7Print,
      onF9Query,
      onF12Save,
      onProductSearch,
    ]
  );

  return { handleKeyDownCapture };
};
