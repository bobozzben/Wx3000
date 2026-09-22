import React, { useCallback } from 'react';
import type { FeeItem } from '../../services/wbase1060';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1060FormProps {
  rows: FeeItem[];
  onRowsChange: (newRows: FeeItem[]) => void;
  onSaveRow: (row: FeeItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: FeeItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: FeeItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const FEE_COLUMNS: ColumnDefV2<FeeItem>[] = [
  { key: 'feeCode', label: '項目代號', isPrimaryKey: true, width: '160px', className: 'font-bold' },
  { key: 'feeName', label: '項目名稱', width: '1fr', className: 'font-bold' },
  {
    key: 'price',
    label: '收費金額',
    width: '200px',
    align: 'right',
    renderCell: (val) => (
      <span className="w-full text-right font-mono font-bold">
        NT$ {Number(val || 0).toLocaleString('zh-TW', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
];

export const Wbase1060Form: React.FC<Wbase1060FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onOpenPrint,
  onShowSummary,
  statusBarInfo,
  onSelectRow,
  onInsertRow,
  onDeleteRow,
  onRefreshData,
  onExit,
}) => {
  const createEmptyRow = useCallback((): FeeItem => ({
    feeCode: '',
    feeName: '',
    price: 0,
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.feeCode.toLowerCase().includes(query.toLowerCase()) ||
          x.feeName.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.feeCode,
        name: x.feeName,
        spec: `NT$ ${Number(x.price || 0).toLocaleString('zh-TW')}`,
      }));
  };

  return (
    <FoxProGridV2<FeeItem>
      rows={rows}
      columns={FEE_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="收費項目開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.feeCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
