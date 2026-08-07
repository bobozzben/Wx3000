import { useState, useCallback, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  CellValueChangedEvent,
  CellFocusedEvent,
  RowSelectedEvent,
  CellEditingStoppedEvent,
} from 'ag-grid-community';
import { useFoxProKeyboard } from './useFoxProKeyboard';
import { SearchModal } from './SearchModal';
import type { SearchItem } from './SearchModal';

export interface FoxProGridProps<T = Record<string, any>> {
  rows: T[];
  columnDefs: ColDef<T>[];
  onRowsChange: (newRows: T[]) => void;
  onF4Search?: (row: T, colId: string) => Promise<SearchItem[]>;
  onF7Print?: () => void;
  onF12Save?: (rows: T[]) => void;
  onF9Query?: () => void;
  onProductSearch?: (productCode: string, rowIndex: number) => Promise<void>;
  editableColIds?: string[];
  createEmptyRow: () => T;
  statusBarInfo?: string;
  onRowSelect?: (row: T | null) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<T>) => void;
}

export const FoxProGrid = <T extends Record<string, any>>({
  rows,
  columnDefs,
  onRowsChange,
  onF4Search,
  onF7Print,
  onF12Save,
  onF9Query,
  onProductSearch,
  editableColIds = [],
  createEmptyRow,
  statusBarInfo,
  onRowSelect,
  onCellValueChanged,
}: FoxProGridProps<T>) => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchTargetRow, setSearchTargetRow] = useState<T | null>(null);
  const [searchTargetColId, setSearchTargetColId] = useState<string>('');
  const [searchModalTitle, setSearchModalTitle] = useState<string>('資料開窗搜尋 (F4)');

  const onAppendRow = useCallback(() => {
    const newRow = createEmptyRow();
    onRowsChange([...rows, newRow]);
  }, [rows, onRowsChange, createEmptyRow]);

  const handleF4Search = useCallback(
    (row: T, colId: string) => {
      if (!onF4Search) return;
      setSearchTargetRow(row);
      setSearchTargetColId(colId);
      setSearchModalTitle(colId === '編號' ? '會計師編號搜尋 (F4)' : '資料開窗搜尋 (F4)');
      setSearchModalOpen(true);
    },
    [onF4Search]
  );

  const { handleKeyDownCapture } = useFoxProKeyboard({
    gridApi,
    rows,
    editableColIds,
    onAppendRow,
    onF4Search: handleF4Search,
    onF7Print,
    onF9Query,
    onF12Save: () => onF12Save && onF12Save(rows),
    onProductSearch,
  });

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();

    // Auto focus first editable cell on grid ready
    setTimeout(() => {
      if (rows.length > 0) {
        const firstCol = editableColIds[0] || (columnDefs[0]?.field as string) || '';
        params.api.setFocusedCell(0, firstCol);
      }
    }, 100);
  };

  useEffect(() => {
    if (gridApi && rows.length > 0) {
      const firstCol = editableColIds[0] || (columnDefs[0]?.field as string) || '';
      gridApi.setFocusedCell(0, firstCol);
    }
  }, [gridApi, rows.length]);

  const handleCellFocused = (event: CellFocusedEvent) => {
    if (event.rowIndex !== null && event.rowIndex !== undefined && rows[event.rowIndex]) {
      if (onRowSelect) {
        onRowSelect(rows[event.rowIndex]);
      }
    }
  };

  const handleRowSelected = (event: RowSelectedEvent) => {
    if (event.node.isSelected() && onRowSelect) {
      onRowSelect(event.data);
    }
  };

  const handleCellEditingStopped = (event: CellEditingStoppedEvent<T>) => {
    // If productCode changed, trigger onProductSearch or autocheck
    if (event.column.getColId() === '編號' && event.newValue !== event.oldValue) {
      if (onProductSearch && event.newValue) {
        onProductSearch(event.newValue, event.rowIndex ?? 0);
      }
    }
  };

  const handleSearchModalSelect = (item: SearchItem) => {
    if (!searchTargetRow || !gridApi) return;

    const rowIndex = rows.findIndex((r) => r === searchTargetRow);
    if (rowIndex === -1) return;

    const updatedRows = [...rows];
    const target: Record<string, any> = { ...updatedRows[rowIndex] };

    if (searchTargetColId === 'cpaCode' || searchTargetColId === 'cpaName') {
      target.productCode = item.code;
      target.productName = item.name;
      if (item.spec !== undefined) target.spec = item.spec;
      if (item.price !== undefined) {
        target.price = item.price;
        target.qty = target.qty || 1;
        target.amount = (target.qty || 1) * item.price;
      }
    } else {
      target[searchTargetColId] = item.code;
    }

    updatedRows[rowIndex] = target as T;
    onRowsChange(updatedRows);
    setSearchModalOpen(false);

    const colIdx = editableColIds.indexOf(searchTargetColId);
    const nextColId =
      colIdx !== -1 && colIdx < editableColIds.length - 1
        ? editableColIds[colIdx + 1]
        : editableColIds[0];

    setTimeout(() => {
      gridApi.setFocusedCell(rowIndex, nextColId);
      gridApi.startEditingCell({ rowIndex, colKey: nextColId });
    }, 50);
  };

  // Ensure there are always at least 15 rows visible for direct Excel-style entry
  const displayRows = useMemo(() => {
    if (rows.length >= 15) return rows;
    const padded = [...rows];
    while (padded.length < 15) {
      padded.push(createEmptyRow());
    }
    return padded;
  }, [rows, createEmptyRow]);

  // Compute total amount if amount field exists in rows
  const totalAmount = useMemo(() => {
    return displayRows.reduce((sum, r) => {
      const val = parseFloat(r.amount || r.total || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [displayRows]);

  return (
    <div
      className="flex flex-col w-full h-full font-mono outline-none"
      onKeyDownCapture={handleKeyDownCapture}
      tabIndex={-1}
    >
      <div className="ag-theme-alpine foxpro-grid w-full h-[608px] border-2 border-blue-900 rounded shadow-md overflow-hidden">
        <AgGridReact
          rowData={displayRows}
          columnDefs={columnDefs}
          defaultColDef={{
            editable: true,
            sortable: true,
            resizable: true,
          }}
          onGridReady={onGridReady}
          onCellFocused={handleCellFocused}
          onRowSelected={handleRowSelected}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStopped={handleCellEditingStopped}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={false}
          suppressClickEdit={false}
          suppressRowClickSelection={true}
          suppressCellFocus={false}
          enterNavigatesVertically={true}
          enterNavigatesVerticallyAfterEdit={true}
          undoRedoCellEditing={true}
          undoRedoCellEditingLimit={100}
          enableCellTextSelection={false}
          suppressScrollOnNewData={true}
          rowHeight={38}
          headerHeight={38}
        />
      </div>

      {/* FoxPro Modern Yellow-accented Status Bar */}
      <div className="mt-2 flex flex-wrap items-center justify-between bg-blue-950 text-white px-4 py-2 rounded font-bold text-sm border-t-2 border-yellow-500 shadow gap-2">
        <div className="flex items-center space-x-6">
          <span className="text-yellow-400 font-bold">
            總金額: <span className="text-white font-mono text-base">${totalAmount.toLocaleString()}</span>
          </span>
          <span className="text-yellow-400">
            筆數: <span className="text-white">{rows.length}</span> 列
          </span>
          {statusBarInfo && <span className="text-gray-300 text-xs">{statusBarInfo}</span>}
        </div>
        <div className="flex flex-wrap items-center space-x-3 text-xs font-normal text-gray-300">
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-300 font-bold">
            [F2] 編輯
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-cyan-300 font-bold">
            [F4] 開窗
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-green-300 font-bold">
            [F7] 列印
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-yellow-400 font-bold">
            [F12] 存檔
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-white font-bold">
            [Enter] 下一格
          </span>
          <span className="bg-blue-900 px-2 py-0.5 rounded border border-blue-600 text-gray-200 font-bold">
            [↑↓] 換列/底端新增
          </span>
        </div>
      </div>

      <SearchModal
        isOpen={searchModalOpen}
        title={searchModalTitle}
        onSearch={() =>
          onF4Search && searchTargetRow
            ? onF4Search(searchTargetRow, searchTargetColId)
            : Promise.resolve([])
        }
        onSelect={handleSearchModalSelect}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
};
