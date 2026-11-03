import React, { useCallback, useMemo } from 'react';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { checkReceiptDate, type FeeReceiptRow } from '../../services/wbase2040';
import { isReceiptLocked } from './useWbase2040';

interface Wbase2040FormProps {
  rows: FeeReceiptRow[];
  onRowsChange: (rows: FeeReceiptRow[]) => void;
  onSaveRow: (row: FeeReceiptRow) => Promise<void>;
  onInsertRow: () => void;
  onDeleteRow: (row?: FeeReceiptRow) => void;
  onSelectRow: (row: FeeReceiptRow | undefined) => void;
  onPickCustomer: (row: FeeReceiptRow) => void;
  onPickStaff: (row: FeeReceiptRow) => void;
  onExit?: () => void;
  activeRowKey?: number;
  enterDirection: 'right' | 'down';
}

const LOCKED_MESSAGE = '此收費單已全部收款，不可修改。如需修改，請先在明細 (Space) 取消已收註記。';

const money = (val: any) => (
  <span className="w-full text-right font-mono">{Number(val || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</span>
);

/** 已收清的單據整列唯讀 (VFP AfterRowColChange: text1.readonly = isover='*') */
const unlocked =
  (next?: (val: string, row: FeeReceiptRow) => { valid: boolean; message: string; normalized?: string }) =>
  (val: string, row: FeeReceiptRow) => {
    if (isReceiptLocked(row)) return { valid: false, message: LOCKED_MESSAGE };
    return next ? next(val, row) : { valid: true, message: '' };
  };

/**
 * recmom 主格線 (VFP Grid1)：已收,單號,請款日,客戶代號,客戶簡稱,已收金額,未收金額,收款人,註記
 */
export const Wbase2040Form: React.FC<Wbase2040FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onInsertRow,
  onDeleteRow,
  onSelectRow,
  onPickCustomer,
  onPickStaff,
  onExit,
  activeRowKey,
  enterDirection,
}) => {
  const columns = useMemo<ColumnDefV2<FeeReceiptRow>[]>(
    () => [
      { key: 'isover', label: '已收', width: '60px', align: 'center', editable: false, className: 'font-bold text-red-600' },
      {
        key: 'rno',
        label: '單號',
        width: '130px',
        maxBytes: 10,
        className: 'font-bold text-blue-900 dark:text-sky-300',
        validate: unlocked((val) => (val.trim() ? { valid: true, message: '' } : { valid: false, message: '單號不可空白' })),
      },
      { key: 'recdate', label: '請款日', width: '120px', validate: unlocked((val) => checkReceiptDate(val)) },
      {
        key: 'cno',
        label: '客戶代號',
        width: '120px',
        uppercase: true,
        maxBytes: 8,
        hasEllipsis: true,
        onEllipsisClick: (row) => onPickCustomer(row),
        validate: unlocked(),
      },
      { key: 'abbr', label: '客戶簡稱', width: '130px', editable: false },
      { key: 'amt', label: '已收金額', width: '130px', align: 'right', editable: false, renderCell: money },
      { key: 'notamt', label: '未收金額', width: '130px', align: 'right', editable: false, renderCell: money },
      {
        key: 'recman',
        label: '收款人',
        width: '130px',
        maxBytes: 10,
        hasEllipsis: true,
        onEllipsisClick: (row) => onPickStaff(row),
        validate: unlocked(),
      },
      { key: 'note', label: '註記', width: '1fr', maxBytes: 60, validate: unlocked() },
    ],
    [onPickCustomer, onPickStaff]
  );

  const createEmptyRow = useCallback(
    (): FeeReceiptRow => ({
      rno: '', recdate: '', cno: '', abbr: '', isover: '', recman: '', amt: 0, tax: 0, sum: 0, notamt: 0, note: '', recordNumber: 0,
    }),
    []
  );

  return (
    <FoxProGridV2<FeeReceiptRow>
      gridId="wbase2040_grid"
      rows={rows}
      columns={columns}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={(row) => onSaveRow(row)}
      onInsertRow={onInsertRow}
      onDeleteRow={(row) => onDeleteRow(row)}
      onSelectRow={(row) => onSelectRow(row)}
      onShowSummary={() => onExit?.()}
      onExit={onExit}
      escLabel="離開"
      getRowKey={(row) => row.recordNumber}
      activeRowKey={activeRowKey}
      editOnInsert={false}
      enterDirection={enterDirection}
      statusBarInfo={(row) =>
        row && row.rno ? (
          <span className="text-xs">
            單號：{row.rno}｜客戶：{row.cno} {row.abbr}｜已收 {Number(row.amt || 0).toLocaleString('zh-TW')}｜未收{' '}
            {Number(row.notamt || 0).toLocaleString('zh-TW')}
            {isReceiptLocked(row) && <span className="ml-2 font-bold text-red-600">已全部收款 (唯讀)</span>}
          </span>
        ) : null
      }
    />
  );
};
