import React, { useCallback } from 'react';
import type { TaxOfficerItem } from '../../services/wbase1050';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1050FormProps {
  rows: TaxOfficerItem[];
  onRowsChange: (newRows: TaxOfficerItem[]) => void;
  onSaveRow: (row: TaxOfficerItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: TaxOfficerItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: TaxOfficerItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const TAX_COLUMNS: ColumnDefV2<TaxOfficerItem>[] = [
  { key: 'taxCode', label: '稅務人員編號', isPrimaryKey: true, width: '130px', className: 'text-blue-900 font-bold' },
  { key: 'taxName', label: '稅務人員姓名', width: '150px' },
  { key: 'taxBureau', label: '國稅局/稽徵所', width: '170px' },
  { key: 'unit', label: '單位', width: '110px' },
  { key: 'tel', label: '聯絡電話', width: '130px' },
  { key: 'ext', label: '分機', width: '80px' },
  { key: 'mobile', label: '行動電話', width: '140px' },
  { key: 'email', label: '電子信箱', width: '190px' },
  { key: 'memo', label: '備註事項', width: '1fr' },
];

export const Wbase1050Form: React.FC<Wbase1050FormProps> = ({
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
  const createEmptyRow = useCallback((): TaxOfficerItem => ({
    taxCode: '',
    taxName: '',
    taxBureau: '',
    unit: '',
    tel: '',
    ext: '',
    mobile: '',
    email: '',
    memo: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.taxCode.toLowerCase().includes(query.toLowerCase()) ||
          x.taxName.toLowerCase().includes(query.toLowerCase()) ||
          (x.taxBureau && x.taxBureau.toLowerCase().includes(query.toLowerCase()))
      )
      .map((x) => ({
        code: x.taxCode,
        name: x.taxName,
        spec: x.taxBureau || x.unit || '',
      }));
  };

  return (
    <FoxProGridV2<TaxOfficerItem>
      rows={rows}
      columns={TAX_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="稅務人員開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.taxCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
