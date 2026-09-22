import React, { useCallback } from 'react';
import type { EmpItem } from '../../services/wbase1030';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1030FormProps {
  rows: EmpItem[];
  onRowsChange: (newRows: EmpItem[]) => void;
  onSaveRow: (row: EmpItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: EmpItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: EmpItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const EMP_COLUMNS: ColumnDefV2<EmpItem>[] = [
  { key: 'empCode', label: '人員編號', isPrimaryKey: true, width: '130px', className: 'text-blue-900 font-bold' },
  { key: 'empName', label: '人員姓名', width: '180px' },
  { key: 'depName', label: '密碼/部門', width: '140px' },
  { key: 'mobile', label: '行動電話', width: '150px' },
  { key: 'email', label: '電子信箱', width: '220px' },
  { key: 'oneUserId', label: '使用者ID', width: '140px' },
  { key: 'onePassNo', label: '通行碼', width: '1fr' },
];

export const Wbase1030Form: React.FC<Wbase1030FormProps> = ({
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
  const createEmptyRow = useCallback((): EmpItem => ({
    empCode: '',
    empName: '',
    depName: '',
    mobile: '',
    email: '',
    oneUserId: '',
    onePassNo: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.empCode.toLowerCase().includes(query.toLowerCase()) ||
          x.empName.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.empCode,
        name: x.empName,
        spec: x.depName,
      }));
  };

  return (
    <FoxProGridV2<EmpItem>
      rows={rows}
      columns={EMP_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="人員開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.empCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
