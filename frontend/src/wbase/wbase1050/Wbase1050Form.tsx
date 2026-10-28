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

/**
 * taxno.dbf 7 個欄位名稱與抬頭定義 (嚴格對齊，未對應欄位不顯示)
 * "代號,姓名,單位,電話,助理人員,住址,備註"
 * "no,name,department,tel,helpman,addr,memo"
 */
const TAX_COLUMNS: ColumnDefV2<TaxOfficerItem>[] = [
  { key: 'no', label: '代號', isPrimaryKey: true, width: '110px', className: 'text-blue-900 dark:text-sky-300 font-bold' },
  { key: 'name', label: '姓名', width: '130px', className: 'font-semibold' },
  { key: 'department', label: '單位', width: '160px' },
  { key: 'tel', label: '電話', width: '130px' },
  { key: 'helpman', label: '助理人員', width: '130px' },
  { key: 'addr', label: '住址', width: '250px' },
  { key: 'memo', label: '備註', width: '1fr' },
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
    no: '',
    name: '',
    department: '',
    tel: '',
    helpman: '',
    addr: '',
    memo: '',
    // 兼容舊別名
    taxCode: '',
    taxName: '',
    taxBureau: '',
    unit: '',
    address: '',
    ext: '',
    fax: '',
    mobile: '',
    email: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          (x.no || x.taxCode || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.name || x.taxName || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.department || x.unit || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.helpman || x.taxBureau || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.tel || '').toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.no || x.taxCode || '',
        name: x.name || x.taxName || '',
        spec: `${x.department || x.unit || ''} ${x.helpman || x.taxBureau || ''}`.trim(),
      }));
  };

  return (
    <FoxProGridV2<TaxOfficerItem>
      gridId="wbase1050_grid"
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
      getRowKey={(row, idx) => row.no || row.taxCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
