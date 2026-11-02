import React, { useState, useMemo, useCallback } from 'react';
import type { AccountItem } from '../../services/wbase4010';
import {
  ACCOUNT_MODES,
  DEPT_MAPPINGS,
  getDeptDescription,
  checkBig5Compatible,
} from '../../services/wbase4010';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { Tag, X } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase4010FormProps {
  rows: AccountItem[];
  mode: number;
  onRowsChange: (newRows: AccountItem[]) => void;
  onSaveRow: (row: AccountItem, rowIndex: number) => Promise<void>;
  onOpenPrint: () => void;
  onSelectRow?: (row: AccountItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: (row?: AccountItem, rowIndex?: number) => void;
  onRefreshData?: () => void;
  onExit?: () => void;
  statusBarInfo?: React.ReactNode | ((row: AccountItem | undefined, rowIndex: number) => React.ReactNode);
  customActions?: React.ReactNode;
  enterDirection?: 'right' | 'down';
}

export const Wbase4010Form: React.FC<Wbase4010FormProps> = ({
  rows,
  mode,
  onRowsChange,
  onSaveRow,
  onOpenPrint,
  onSelectRow,
  onInsertRow,
  onDeleteRow,
  onRefreshData,
  onExit,
  statusBarInfo,
  customActions,
  enterDirection = 'right',
}) => {
  const { isDark } = useTheme();
  const meta = ACCOUNT_MODES[mode] || ACCOUNT_MODES[1];

  // F2 科目明細開窗選單狀態
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptTargetRowIndex, setDeptTargetRowIndex] = useState<number>(-1);

  // 取得目前行業允許的明細選項
  const availableDeptOptions = useMemo(() => {
    const list: { code: string; label: string }[] = [];
    for (const char of meta.pubdept) {
      if (char === ' ') {
        list.push({ code: ' ', label: '無 (空白)' });
      } else if (DEPT_MAPPINGS[char]) {
        list.push({ code: char, label: `${char} - ${DEPT_MAPPINGS[char]}` });
      }
    }
    return list;
  }, [meta.pubdept]);

  const handleOpenDeptModal = useCallback((_row: AccountItem, rowIndex: number) => {
    setDeptTargetRowIndex(rowIndex);
    setDeptModalOpen(true);
  }, []);

  const handleSelectDept = useCallback(
    (code: string) => {
      if (deptTargetRowIndex >= 0 && deptTargetRowIndex < rows.length) {
        const updated = [...rows];
        const currentRow = { ...updated[deptTargetRowIndex] };
        currentRow.dept = code.trim() || ' ';
        updated[deptTargetRowIndex] = currentRow;
        onRowsChange(updated);
        onSaveRow(currentRow, deptTargetRowIndex);
      }
      setDeptModalOpen(false);
    },
    [deptTargetRowIndex, rows, onRowsChange, onSaveRow]
  );

  const columns: ColumnDefV2<AccountItem>[] = useMemo(() => {
    return [
      {
        key: 'accno',
        label: '科目代號',
        isPrimaryKey: true,
        width: '120px',
        uppercase: true,
        maxLength: 8,
        maxBytes: 8,
        className: 'font-mono font-bold tracking-wider',
        validate: (val, row, rowIndex, allRows) => {
          const trimmed = val.trim().toUpperCase();
          if (!trimmed || trimmed === '新科目') {
            return { valid: false, message: '科目代號不可空白！' };
          }
          if (trimmed.length > 8) {
            return { valid: false, message: '科目代號不可超過8碼！' };
          }
          // 排除自身之重複檢查
          const isDup = allRows.some(
            (r, idx) => idx !== rowIndex && r.accno.trim().toUpperCase() === trimmed
          );
          if (isDup) {
            return { valid: false, message: `科目代號 [${trimmed}] 已重複！` };
          }

          const original = (row?.accno || '').trim().toUpperCase();
          const isPersisted =
            !row?._isNew &&
            Boolean(row?._record_number || row?.recordNumber || (original && original !== '新科目'));

          if (isPersisted && original && original !== trimmed) {
            return {
              valid: false,
              message: `既有科目代號 [${original}] 不可直接修改！如需變更請先刪除再新增。`,
            };
          }

          // 總帳科目 (4碼以內) vs 明細科目 (>4碼)
          if (trimmed.length <= 4) {
            if (!isPersisted) {
              if (meta.isOrgGroup) {
                if (trimmed.length === 4 && (trimmed.startsWith('70') || trimmed.startsWith('80'))) {
                  // 機關團體允許 70, 80
                } else {
                  return {
                    valid: false,
                    message: '不可新增總帳科目！機關團體僅開放新增 70 或 80 開頭之總帳科目。',
                  };
                }
              } else {
                return { valid: false, message: '不可新增總帳科目！請使用 [F3] 複製標準總帳科目。' };
              }
            }
          } else {
            // 明細科目: 母科目必須存在
            const parent = trimmed.substring(0, 4);
            const parentExists = allRows.some((r) => r.accno.trim().toUpperCase() === parent);
            if (!parentExists) {
              return { valid: false, message: `無此總帳科目 [${parent}]！新增子目必須先有母總帳科目。` };
            }
          }

          return { valid: true, message: '' };
        },
        renderCell: (val: any) => {
          const code = String(val || '').trim().toUpperCase();
          const isGeneral = code.length <= 4;
          return (
            <span className="flex items-center gap-1 font-mono">
              <span className={isGeneral ? 'text-amber-500 dark:text-amber-300 font-black' : 'text-slate-900 dark:text-slate-100 font-bold'}>
                {code || '-'}
              </span>
              {isGeneral && code.length > 0 && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-sans">
                  總帳
                </span>
              )}
            </span>
          );
        },
      },
      {
        key: 'accname',
        label: '科目名稱',
        width: '210px',
        maxLength: 20,
        maxBytes: 20,
        className: 'font-semibold',
        validate: (val) => {
          const b5 = checkBig5Compatible(val || '');
          if (!b5.valid) return { valid: false, message: b5.message };
          return { valid: true, message: '' };
        },
      },
      {
        key: 'dept',
        label: '科目明細',
        width: '130px',
        maxLength: 1,
        maxBytes: 1,
        uppercase: true,
        hasEllipsis: true,
        ellipsisLabel: 'F2',
        onEllipsisClick: (row, rIdx) => handleOpenDeptModal(row, rIdx),
        validate: (val) => {
          const d = (val || '').trim().toUpperCase();
          if (d && !meta.pubdept.includes(d)) {
            return {
              valid: false,
              message: `科目明細 [${d}] 不在此行業允許清單中 (${meta.pubdept.trim()})`,
            };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val: any) => {
          const desc = getDeptDescription(String(val || ''));
          return <span className="font-mono text-xs">{desc || '-'}</span>;
        },
      },
      {
        key: 'taxcode',
        label: '稅額',
        width: '65px',
        align: 'center',
        maxLength: 1,
        maxBytes: 1,
        validate: (val) => {
          const t = (val || '').trim();
          if (t && t !== '*') {
            return { valid: false, message: '稅額僅允許輸入 "*" 或空白！' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val: any) => {
          const isTax = String(val || '').trim() === '*';
          return (
            <span className={isTax ? 'font-bold text-amber-600 dark:text-amber-400 text-sm' : 'text-slate-400'}>
              {isTax ? '*' : ''}
            </span>
          );
        },
      },
      {
        key: 'accnamel',
        label: '長科目名稱',
        width: '260px',
        maxLength: 60,
        maxBytes: 60,
        validate: (val) => {
          const b5 = checkBig5Compatible(val || '');
          if (!b5.valid) return { valid: false, message: b5.message };
          return { valid: true, message: '' };
        },
        renderCell: (val: any) => <span className="text-xs">{val || ''}</span>,
      },
      {
        key: 'engaccname',
        label: '英文科目名稱',
        width: '280px',
        maxLength: 254,
        maxBytes: 254,
        renderCell: (val: any) => <span className="text-xs font-mono">{val || ''}</span>,
      },
    ];
  }, [meta, handleOpenDeptModal]);

  const createEmptyAccount = useCallback((): AccountItem => {
    return {
      accno: '',
      accname: '',
      dept: ' ',
      taxcode: ' ',
      accnamel: '',
      engaccname: '',
      serial: rows.length + 1,
      _isNew: true,
    };
  }, [rows.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full relative">
      <FoxProGridV2<AccountItem>
        rows={rows}
        columns={columns}
        createEmptyRow={createEmptyAccount}
        onRowsChange={onRowsChange}
        onSaveRow={onSaveRow}
        onOpenPrint={onOpenPrint}
        onSelectRow={onSelectRow}
        onInsertRow={onInsertRow}
        onDeleteRow={onDeleteRow}
        onRefreshData={onRefreshData}
        onExit={onExit}
        statusBarInfo={statusBarInfo}
        minRows={0}
        gridId={`wbase4010-grid-mode${mode}`}
        showRowIndex={true}
        height="100%"
        customActions={customActions}
        escLabel="儲存/離開"
        enterDirection={enterDirection}
      />

      {/* F2 科目明細快選視窗 */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div
            className={`w-full max-w-sm rounded-lg shadow-2xl border ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-blue-900 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2 bg-blue-900 text-white font-bold select-none text-sm">
              <span className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-yellow-400" />
                選擇科目明細類別 [F2]
              </span>
              <button
                onClick={() => setDeptModalOpen(false)}
                className="p-1 rounded hover:bg-blue-800 text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 font-mono text-sm">
              {availableDeptOptions.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => handleSelectDept(opt.code)}
                  className="w-full text-left px-3 py-2 hover:bg-yellow-50 dark:hover:bg-slate-800 flex items-center justify-between rounded transition-colors"
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs text-slate-400">代碼 [{opt.code}]</span>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                onClick={() => setDeptModalOpen(false)}
                className="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                關閉 (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
