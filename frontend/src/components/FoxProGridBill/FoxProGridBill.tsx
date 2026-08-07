import React, { useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community';
import { useFoxProKeyboard } from '../FoxProGrid/useFoxProKeyboard';
import { SearchModal } from '../FoxProGrid/SearchModal';
import type { SearchItem } from '../FoxProGrid/SearchModal';
import { searchProducts } from '../../services/api';
import type { PurchaseLineItem } from '../../services/api';

export interface FoxProGridBillProps {
  rows: PurchaseLineItem[];
  onRowsChange: (newRows: PurchaseLineItem[]) => void;
  onF12Save?: () => void;
  onF9Query?: () => void;
}

export const FoxProGridBill: React.FC<FoxProGridBillProps> = ({
  rows,
  onRowsChange,
  onF12Save,
  onF9Query,
}) => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchTargetIndex, setSearchTargetIndex] = useState<number>(-1);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const editableColIds = ['productCode', 'productName', 'qty', 'price', 'remark'];

  const createEmptyRow = (lineNo: number): PurchaseLineItem => ({
    lineNo,
    productCode: '',
    productName: '',
    qty: 0,
    price: 0,
    amount: 0,
    remark: '',
  });

  const onAppendRow = useCallback(() => {
    const newRow = createEmptyRow(rows.length + 1);
    onRowsChange([...rows, newRow]);
  }, [rows, onRowsChange]);

  const handleF4Search = useCallback((row: PurchaseLineItem, colId: string) => {
    const idx = rows.findIndex((r) => r === row || (r.lineNo === row.lineNo && r.lineNo > 0));
    setSearchTargetIndex(idx >= 0 ? idx : 0);

    if (colId === 'productCode' || colId === 'productName') {
      setSearchModalOpen(true);
    } else if (gridApi) {
      gridApi.startEditingCell({
        rowIndex: idx >= 0 ? idx : 0,
        colKey: colId,
      });
    }
  }, [rows, gridApi]);

  const { handleKeyDownCapture } = useFoxProKeyboard({
    gridApi,
    rows,
    editableColIds,
    onAppendRow,
    onF4Search: handleF4Search,
    onF9Query,
    onF12Save,
  });

  const handleCellValueChanged = async (event: CellValueChangedEvent) => {
    const { colDef, newValue, rowIndex } = event;
    if (rowIndex === null || rowIndex === undefined) return;

    const colId = colDef.field;
    const updatedRows = [...rows];
    const currentRow = { ...updatedRows[rowIndex] };

    if (colId === 'productCode') {
      const codeInput = (newValue || '').trim();
      if (!codeInput) {
        currentRow.productCode = '';
        currentRow.productName = '';
        currentRow.qty = 0;
        currentRow.price = 0;
        currentRow.amount = 0;
        updatedRows[rowIndex] = currentRow;
        onRowsChange(updatedRows);
        return;
      }

      const results = await searchProducts(codeInput);
      const exactMatch = results.find(
        (p) => p.code.toLowerCase() === codeInput.toLowerCase()
      );

      if (exactMatch) {
        currentRow.productCode = exactMatch.code;
        currentRow.productName = exactMatch.name;
        currentRow.price = exactMatch.price;
        currentRow.qty = currentRow.qty > 0 ? currentRow.qty : 1;
        currentRow.amount = currentRow.qty * exactMatch.price;
        updatedRows[rowIndex] = currentRow;
        onRowsChange(updatedRows);
      } else {
        currentRow.productCode = '';
        currentRow.productName = '';
        currentRow.qty = 0;
        currentRow.price = 0;
        currentRow.amount = 0;
        updatedRows[rowIndex] = currentRow;
        onRowsChange(updatedRows);

        setAlertMessage(`⚠️ 品號 [${codeInput}] 不存在，請重新輸入或按 F4 開窗搜尋！`);
      }
    } else if (colId === 'qty' || colId === 'price') {
      const qty = colId === 'qty' ? Number(newValue) || 0 : currentRow.qty;
      const price = colId === 'price' ? Number(newValue) || 0 : currentRow.price;
      currentRow.qty = qty;
      currentRow.price = price;
      currentRow.amount = qty * price;
      updatedRows[rowIndex] = currentRow;
      onRowsChange(updatedRows);
    }
  };

  const handleModalSelect = (item: SearchItem) => {
    if (searchTargetIndex < 0 || searchTargetIndex >= rows.length) return;

    const updatedRows = [...rows];
    const currentRow = { ...updatedRows[searchTargetIndex] };

    currentRow.productCode = item.code;
    currentRow.productName = item.name;
    currentRow.price = item.price || 0;
    currentRow.qty = currentRow.qty > 0 ? currentRow.qty : 1;
    currentRow.amount = currentRow.qty * (item.price || 0);

    updatedRows[searchTargetIndex] = currentRow;
    onRowsChange(updatedRows);
    setSearchModalOpen(false);

    if (gridApi) {
      setTimeout(() => {
        gridApi.setFocusedCell(searchTargetIndex, 'qty');
        gridApi.startEditingCell({ rowIndex: searchTargetIndex, colKey: 'qty' });
      }, 50);
    }
  };

  const columnDefs: ColDef<PurchaseLineItem>[] = [
    {
      headerName: '項次',
      valueGetter: 'node.rowIndex + 1',
      width: 70,
      suppressNavigable: true,
      cellClass: 'text-center font-bold bg-gray-100 text-gray-700',
    },
    {
      headerName: '產品代號 (F4)',
      field: 'productCode',
      editable: true,
      width: 140,
      cellClass: 'font-bold text-blue-900',
    },
    {
      headerName: '品名 (F4)',
      field: 'productName',
      editable: true,
      width: 220,
    },
    {
      headerName: '數量',
      field: 'qty',
      editable: true,
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p) => (p.value ? Number(p.value).toLocaleString() : '0'),
      cellClass: 'font-semibold text-right',
    },
    {
      headerName: '單價',
      field: 'price',
      editable: true,
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => (p.value ? `$${Number(p.value).toLocaleString()}` : '$0'),
      cellClass: 'font-semibold text-right text-emerald-800',
    },
    {
      headerName: '小計金額',
      field: 'amount',
      editable: false,
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => (p.value ? `$${Number(p.value).toLocaleString()}` : '$0'),
      cellClass: 'font-bold text-right text-blue-900 bg-blue-50',
    },
    {
      headerName: '備註',
      field: 'remark',
      editable: true,
      width: 200,
    },
  ];

  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalQty = rows.reduce((sum, r) => sum + (r.qty || 0), 0);

  return (
    <div
      className="flex flex-col w-full h-full font-mono outline-none"
      onKeyDownCapture={handleKeyDownCapture}
      tabIndex={-1}
    >
      <div className="ag-theme-alpine foxpro-grid w-full h-[480px] border-2 border-blue-900 rounded shadow-md overflow-hidden">
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          onGridReady={(p) => {
            setGridApi(p.api);
            p.api.sizeColumnsToFit();
          }}
          onCellValueChanged={handleCellValueChanged}
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

      <div className="mt-2 flex items-center justify-between bg-blue-950 text-white px-4 py-2.5 rounded font-bold text-sm border-t-2 border-yellow-500 shadow">
        <div className="flex space-x-6 text-base">
          <span>總筆數: <span className="text-yellow-400 font-extrabold">{rows.length}</span> 筆</span>
          <span>總數量: <span className="text-yellow-400 font-extrabold">{totalQty.toLocaleString()}</span></span>
          <span>總金額: <span className="text-yellow-300 text-lg font-black">${totalAmount.toLocaleString()}</span></span>
        </div>
        <div className="flex space-x-3 text-xs font-normal">
          <span className="bg-blue-800 px-2 py-1 rounded border border-blue-600 text-yellow-300 font-bold">[F2] 編輯</span>
          <span className="bg-blue-800 px-2 py-1 rounded border border-blue-600 text-cyan-300 font-bold">[F4] 開窗搜尋</span>
          <span className="bg-blue-800 px-2 py-1 rounded border border-blue-600 text-green-300 font-bold">[F7] 列印</span>
          <span className="bg-blue-800 px-2 py-1 rounded border border-blue-600 text-yellow-400 font-bold">[F12] 存檔</span>
          <span className="bg-blue-800 px-2 py-1 rounded border border-blue-600 text-white">[Enter] 下一格</span>
        </div>
      </div>

      <SearchModal
        isOpen={searchModalOpen}
        title="產品開窗搜尋 (F4)"
        onSearch={searchProducts}
        onSelect={handleModalSelect}
        onClose={() => setSearchModalOpen(false)}
      />

      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-red-900 border-4 border-yellow-400 text-white p-6 rounded-lg shadow-2xl max-w-lg text-center font-mono">
            <h4 className="text-xl font-bold text-yellow-300 mb-3">輸入錯誤警告</h4>
            <p className="text-lg font-semibold mb-6">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              className="bg-yellow-400 text-black px-6 py-2 rounded font-bold text-lg hover:bg-yellow-300 transition"
            >
              確定 (Enter / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
