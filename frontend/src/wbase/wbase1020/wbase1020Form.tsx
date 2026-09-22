import React from 'react';
import type { CpaItem } from '../../services/wbase1020';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1020FormProps {
  rows: CpaItem[];
  onRowsChange: (newRows: CpaItem[]) => void;
  onSaveRow: (row: CpaItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: CpaItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: CpaItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const CPA_COLUMNS: ColumnDefV2<CpaItem>[] = [
  { key: 'cpaCode', label: '代號', isPrimaryKey: true, width: '110px', className: 'text-black font-bold' },
  { key: 'cpaName', label: '會計師姓名', width: '150px', className: 'font-bold' },
  { key: 'licenseNo', label: '證照字號', width: '200px' },
  { key: 'officeName', label: '事務所名稱', width: '220px' },
  { key: 'tel', label: '電話', width: '140px' },
  { key: 'address', label: '通訊地址', width: '280px' },
  { key: 'memo', label: '備註', width: '1fr' },
];

export const Wbase1020Form: React.FC<Wbase1020FormProps> = ({
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
  const createEmptyRow = (): CpaItem => ({
    cpaCode: '',
    cpaName: '',
    licenseNo: '',
    officeName: '',
    tel: '',
    fax: '',
    address: '',
    memo: '',
  });

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    const q = (query || '').toLowerCase();
    return (rows || [])
      .filter(
        (x) =>
          (x?.cpaCode || '').toLowerCase().includes(q) ||
          (x?.cpaName || '').toLowerCase().includes(q) ||
          (x?.officeName || '').toLowerCase().includes(q)
      )
      .map((x) => ({
        code: x?.cpaCode || '',
        name: x?.cpaName || '',
        spec: x?.officeName || '',
      }));
  };

  return (
    <FoxProGridV2<CpaItem>
      rows={rows}
      columns={CPA_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="會計師開窗搜尋 [F3]"
      getRowKey={(row, idx) => row?.cpaCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
