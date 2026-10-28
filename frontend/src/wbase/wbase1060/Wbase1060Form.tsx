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

/**
 * recitem.dbf 3 個欄位名稱與抬頭定義 (嚴格對齊，未對應欄位不顯示)
 * "項目,項目名稱,收費金額"
 * "itemno,item,amt"
 */
const FEE_COLUMNS: ColumnDefV2<FeeItem>[] = [
  { key: 'itemno', label: '項目', isPrimaryKey: true, width: '130px', className: 'text-blue-900 dark:text-sky-300 font-bold' },
  { key: 'item', label: '項目名稱', width: '1fr', className: 'font-semibold' },
  {
    key: 'amt',
    label: '收費金額',
    width: '180px',
    align: 'right',
    renderCell: (val) => (
      <span className="w-full text-right font-mono font-bold">
        {Number(val || 0).toLocaleString('zh-TW')}
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
    itemno: '',
    item: '',
    amt: 0,
    feeCode: '',
    feeName: '',
    price: 0,
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          (x.itemno || x.feeCode || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.item || x.feeName || '').toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.itemno || x.feeCode || '',
        name: x.item || x.feeName || '',
        spec: `${Number(x.amt !== undefined ? x.amt : x.price || 0).toLocaleString('zh-TW')}`,
      }));
  };

  return (
    <FoxProGridV2<FeeItem>
      gridId="wbase1060_grid"
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
      getRowKey={(row, idx) => row.itemno || row.feeCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
