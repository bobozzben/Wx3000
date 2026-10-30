import React, { useState, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { EmpItem } from '../../services/wbase1030';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import { AddressSelectModal } from '../../components/FoxProGrid/AddressSelectModal';
import {
  isValidEmail,
  checkTaxId,
  checkRocDate,
  checkPhoneDigits,
  checkBig5Compatible,
  checkPswRule,
  checkOnepassRule,
} from '../../services/validation';

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
 * keyin.dbf 12 個欄位名稱與抬頭定義 (嚴格對齊 wbase130.pas 檢核與行為)
 * "no,name,psw,birthday,tel,id,addr,memo,oneuserid,onepassno,phone,email"
 * "編號,姓名,密碼,生日,電話,身份證字號,住址,備註,工商一站式帳號,一站式會計軟體驗證碼,電子送達手機,電子送達收件人EMAIL"
 */
const KEYIN_COLUMNS: ColumnDefV2<EmpItem>[] = [
  {
    key: 'no',
    label: '編號',
    isPrimaryKey: true,
    width: '130px',
    uppercase: true,
    maxLength: 10,
    maxBytes: 10,
    className: 'text-blue-900 dark:text-sky-300 font-bold',
    validate: (val, row) => {
      const trimmed = val.trim().toUpperCase();
      if (!trimmed) {
        return { valid: false, message: '編號不可空白！請輸入人員編號。' };
      }
      const orig = (row?.no || row?.empCode || '').trim().toUpperCase();
      if (orig === 'SUPERVISOR' && trimmed !== 'SUPERVISOR') {
        return { valid: false, message: 'SUPERVISOR 為保留帳號，編號不可更改！' };
      }
      const b5 = checkBig5Compatible(trimmed);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const code = String(val || '').trim().toUpperCase();
      if (!code) {
        return <span className="text-red-500 font-bold text-xs">[未填編號]</span>;
      }
      const isSuper = code === 'SUPERVISOR';
      return (
        <span className="flex items-center gap-1 font-mono font-bold">
          <span className={isSuper ? 'text-purple-600 dark:text-purple-400 font-black' : ''}>
            {code}
          </span>
          {isSuper && (
            <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-800">
              系統保留
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: 'name',
    label: '姓名',
    width: '120px',
    maxLength: 20,
    maxBytes: 20,
    className: 'font-semibold',
    validate: (val) => {
      const trimmed = val.trim();
      if (!trimmed) {
        return { valid: true, message: '' };
      }
      const b5 = checkBig5Compatible(trimmed);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const name = String(val || '').trim();
      if (!name) {
        return <span className="text-gray-400 dark:text-slate-500">-</span>;
      }
      return <span className="truncate">{name}</span>;
    },
  },
  {
    key: 'psw',
    label: '密碼',
    width: '110px',
    uppercase: true,
    maxLength: 8,
    maxBytes: 8,
    validate: (val) => {
      const check = checkPswRule(val);
      if (!check.valid) {
        return { valid: false, message: check.message };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const pswStr = String(val || '').trim();
      if (!pswStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      return <span className="font-mono">{pswStr}</span>;
    },
  },
  {
    key: 'birthday',
    label: '生日',
    width: '110px',
    maxLength: 9,
    validate: (val) => {
      const trimmed = val.trim();
      if (!trimmed) return { valid: true, message: '', normalized: '' };
      const check = checkRocDate(trimmed);
      if (!check.valid) {
        return { valid: false, message: `生日提示：${check.message}`, isWarning: true };
      }
      return { valid: true, message: '', normalized: check.normalized };
    },
    renderCell: (val: any) => {
      const bStr = String(val || '').trim();
      if (!bStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      const check = checkRocDate(bStr);
      return (
        <span className="font-mono">
          {check.valid && check.normalized ? check.normalized : bStr}
        </span>
      );
    },
  },
  {
    key: 'tel',
    label: '電話',
    width: '130px',
    maxLength: 20,
    maxBytes: 20,
    validate: (val) => {
      const b5 = checkBig5Compatible(val);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      return { valid: true, message: '' };
    },
  },
  {
    key: 'id',
    label: '身份證字號',
    width: '130px',
    uppercase: true,
    maxLength: 10,
    maxBytes: 10,
    validate: (val) => {
      const trimmed = val.trim().toUpperCase();
      if (!trimmed) return { valid: true, message: '' };
      const b5 = checkBig5Compatible(trimmed);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      const check = checkTaxId(trimmed);
      if (!check.valid) {
        return {
          valid: false,
          message: `身份證字號提示：${check.message.trim()} (此為提示，仍可正常存檔)`,
          isWarning: true,
        };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const idStr = String(val || '').trim().toUpperCase();
      if (!idStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      const check = checkTaxId(idStr);
      const isInvalid = !check.valid;
      return (
        <span className="flex items-center gap-1.5 truncate font-mono">
          {isInvalid && (
            <span title={check.message.trim()} className="flex items-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </span>
          )}
          <span className={isInvalid ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
            {idStr}
          </span>
        </span>
      );
    },
  },
  {
    key: 'addr',
    label: '住址',
    width: '220px',
    maxLength: 60,
    maxBytes: 60,
    validate: (val) => {
      const b5 = checkBig5Compatible(val);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      return { valid: true, message: '' };
    },
  },
  {
    key: 'memo',
    label: '備註',
    width: '160px',
    maxLength: 20,
    maxBytes: 20,
    validate: (val) => {
      const b5 = checkBig5Compatible(val);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      return { valid: true, message: '' };
    },
  },
  {
    key: 'oneuserid',
    label: '工商一站式帳號',
    width: '150px',
    maxLength: 20,
    maxBytes: 20,
  },
  {
    key: 'onepassno',
    label: '一站式會計軟體驗證碼',
    width: '180px',
    maxLength: 15,
    maxBytes: 15,
    validate: (val) => {
      const check = checkOnepassRule(val);
      if (!check.valid) {
        return { valid: false, message: check.message };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const passStr = String(val || '').trim();
      if (!passStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      return <span className="font-mono">{passStr}</span>;
    },
  },
  {
    key: 'phone',
    label: '電子送達手機',
    width: '130px',
    digitOnly: true,
    maxLength: 10,
    validate: (val) => {
      const trimmed = val.trim();
      if (!trimmed) return { valid: true, message: '' };
      const check = checkPhoneDigits(trimmed);
      if (!check.valid) {
        return { valid: false, message: check.message };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const phoneStr = String(val || '').trim();
      if (!phoneStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      const check = checkPhoneDigits(phoneStr);
      const isInvalid = !check.valid;
      return (
        <span className="flex items-center gap-1 font-mono">
          {isInvalid && (
            <span
              className="px-1 py-0.2 bg-red-600 text-white text-[10px] font-bold rounded shadow-sm"
              title={check.message}
            >
              !
            </span>
          )}
          <span className={isInvalid ? 'text-red-500 font-bold' : ''}>{phoneStr}</span>
        </span>
      );
    },
  },
  {
    key: 'email',
    label: '電子送達收件人EMAIL',
    width: '220px',
    maxLength: 60,
    maxBytes: 60,
    validate: (val) => {
      const trimmed = val.trim();
      if (!trimmed) return { valid: true, message: '' };
      const b5 = checkBig5Compatible(trimmed);
      if (!b5.valid) {
        return { valid: false, message: b5.message };
      }
      if (!isValidEmail(trimmed)) {
        return {
          valid: false,
          message: '電子郵件提示：格式可能不合規 (此為提示，仍可正常存檔)',
          isWarning: true,
        };
      }
      return { valid: true, message: '' };
    },
    renderCell: (val: any) => {
      const emailStr = String(val || '').trim();
      if (!emailStr) return <span className="text-gray-400 dark:text-slate-500">-</span>;
      const isInvalid = !isValidEmail(emailStr);
      return (
        <span className="flex items-center gap-1.5 truncate">
          {isInvalid && (
            <span
              className="px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded shrink-0 shadow-sm"
              title="電子郵件格式非標準，此為提示，仍可正常儲存"
            >
              ⚠️ 提示
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
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [targetAddrRowIndex, setTargetAddrRowIndex] = useState<number>(-1);
  const [currentAddrValue, setCurrentAddrValue] = useState<string>('');

  const handleOpenAddrModal = useCallback((row: EmpItem, rowIndex: number, currentVal: string) => {
    setTargetAddrRowIndex(rowIndex);
    setCurrentAddrValue(currentVal || row.addr || row.address || '');
    setAddrModalOpen(true);
  }, []);

  const handleAddressConfirm = useCallback(
    (selectedAddress: string) => {
      setAddrModalOpen(false);
      if (targetAddrRowIndex >= 0 && targetAddrRowIndex < rows.length) {
        const updated = [...rows];
        const targetRow = {
          ...updated[targetAddrRowIndex],
          addr: selectedAddress,
          address: selectedAddress,
        };
        updated[targetAddrRowIndex] = targetRow;
        onRowsChange(updated);
        onSaveRow(targetRow);
      }
    },
    [rows, targetAddrRowIndex, onRowsChange, onSaveRow]
  );

  const columns = useMemo<ColumnDefV2<EmpItem>[]>(() => {
    return KEYIN_COLUMNS.map((col) => {
      if (col.key === 'addr') {
        return {
          ...col,
          hasEllipsis: true,
          ellipsisLabel: 'F2',
          onEllipsisClick: (row, rIdx, curVal) => {
            handleOpenAddrModal(row, rIdx, curVal);
          },
        };
      }
      return col;
    });
  }, [handleOpenAddrModal]);

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
    <>
      <FoxProGridV2<EmpItem>
        gridId="wbase1030_grid"
        rows={rows}
        columns={columns}
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
        minRows={0}
      />
      <AddressSelectModal
        isOpen={addrModalOpen}
        initialValue={currentAddrValue}
        onClose={() => setAddrModalOpen(false)}
        onConfirm={handleAddressConfirm}
      />
    </>
  );
};
