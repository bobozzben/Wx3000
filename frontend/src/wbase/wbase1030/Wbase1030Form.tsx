import React, { useCallback } from 'react';
import type { EmpItem } from '../../services/wbase1030';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import { isValidEmail } from '../../services/validation';

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

/**
 * keyin.dbf 12 個欄位名稱與抬頭定義 (嚴格對齊，未對應欄位不顯示)
 * "no,name,psw,birthday,tel,id,addr,memo,oneuserid,onepassno,phone,email"
 * "編號,姓名,密碼,生日,電話,身份證字號,住址,備註,工商一站式帳號,一站式會計軟體驗證碼,電子送達手機,電子送達收件人EMAIL"
 */
const KEYIN_COLUMNS: ColumnDefV2<EmpItem>[] = [
  { key: 'no', label: '編號', isPrimaryKey: true, width: '130px', className: 'text-blue-900 dark:text-sky-300 font-bold' },
  { key: 'name', label: '姓名', width: '120px', className: 'font-semibold' },
  { key: 'psw', label: '密碼', width: '110px' },
  { key: 'birthday', label: '生日', width: '110px' },
  { key: 'tel', label: '電話', width: '130px' },
  { key: 'id', label: '身份證字號', width: '130px' },
  { key: 'addr', label: '住址', width: '220px' },
  { key: 'memo', label: '備註', width: '160px' },
  { key: 'oneuserid', label: '工商一站式帳號', width: '150px' },
  { key: 'onepassno', label: '一站式會計軟體驗證碼', width: '180px' },
  { key: 'phone', label: '電子送達手機', width: '130px' },
  {
    key: 'email',
    label: '電子送達收件人EMAIL',
    width: '220px',
    renderCell: (val: any) => {
      const emailStr = String(val || '');
      if (!emailStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      const isInvalid = !isValidEmail(emailStr);
      return (
        <span className="flex items-center gap-1.5 truncate">
          {isInvalid && (
            <span
              className="px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded shrink-0 shadow-sm"
              title="電子郵件格式非標準，此為提示，仍可正常儲存"
            >
              ⚠️ 格式
            </span>
          )}
          <span className={isInvalid ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
            {emailStr}
          </span>
        </span>
      );
    },
  },
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
    no: '',
    name: '',
    psw: '',
    birthday: '',
    tel: '',
    id: '',
    addr: '',
    memo: '',
    oneuserid: '',
    onepassno: '',
    phone: '',
    email: '',
    // 兼容舊別名
    empCode: '',
    empName: '',
    depName: '',
    mobile: '',
    oneUserId: '',
    onePassNo: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          (x.no || x.empCode || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.name || x.empName || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.tel || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.id || '').toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.no || x.empCode || '',
        name: x.name || x.empName || '',
        spec: x.tel || x.memo || '',
      }));
  };

  return (
    <FoxProGridV2<EmpItem>
      gridId="wbase1030_grid"
      rows={rows}
      columns={KEYIN_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="建檔人員開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.no || row.empCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
