import React, { useCallback, useMemo } from 'react';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { useTheme } from '../menu/ThemeContext';
import {
  MEDIA_TYPE_MAP,
  TCHK_LABEL_MAP,
  checkBranchCode,
  duplicateMessage,
  newBranchRow,
  type BranchRow,
  type CustomerPick,
  type HqItem,
} from '../../services/wbase2050';
import { FieldDescBar } from './FieldDescBar';

interface Wbase2050F8FormProps {
  hq: HqItem;
  customers: CustomerPick[];
  rows: BranchRow[];
  /** F2 客戶選單是否開啟中：開啟時格線失焦送出的暫存代號不檢查 (以函式讀取，失焦當下才判斷) */
  isPickerOpen: () => boolean;
  onRowsChange: (rows: BranchRow[]) => void;
  onSaveRow: (row: BranchRow) => void;
  onInsertRow: () => void;
  onDeleteRow: (row?: BranchRow) => void;
  onPickCustomer: (row: BranchRow) => void;
  onActiveCellChange: (colKey: string) => void;
  onExit: () => void;
  activeRowKey?: string;
  enterDirection: 'right' | 'down';
  desc: string;
}

type Check = { valid: boolean; message: string; isWarning?: boolean };
const OK: Check = { valid: true, message: '' };

const codeOf =
  (key: keyof BranchRow, codes: string[], message: string) =>
  (val: string, row: BranchRow): Check =>
    codes.includes(val) || val === String(row[key] ?? '') ? OK : { valid: false, message };

const plain = (val: any) => <span className="w-full text-center">{val}</span>;

/**
 * 分公司資料維護 (VFP wbase2050f8 Grid1，RecordSource tempd：mainunino 等於總機構統編的客戶)
 * Ins 新增 / Del 刪除 (立即生效) / 客戶代號 F2 開客戶選單 / Esc 整批存檔後返回總機構清單
 */
export const Wbase2050F8Form: React.FC<Wbase2050F8FormProps> = ({
  hq,
  customers,
  rows,
  isPickerOpen,
  onRowsChange,
  onSaveRow,
  onInsertRow,
  onDeleteRow,
  onPickCustomer,
  onActiveCellChange,
  onExit,
  activeRowKey,
  enterDirection,
  desc,
}) => {
  const { isDark } = useTheme();

  const columns = useMemo<ColumnDefV2<BranchRow>[]>(() => {
    const yesNo = (key: 'tzero' | 'tflog' | 'tnot', label: string, width: string): ColumnDefV2<BranchRow> => ({
      key,
      label,
      width,
      align: 'center',
      uppercase: true,
      maxLength: 1,
      validate: codeOf(key, ['Y', 'N'], `${label}請輸入 Y 或 N`),
      renderCell: plain,
    });
    return [
      {
        // 不設 isPrimaryKey：格線的主鍵空白檢查在 validate 之前執行，新列按 F2 時失焦送出的空白會被擋下並搶回焦點，
        // 選單就拿不到輸入焦點。空白與重複改在這裡檢查，選單開啟時放行，空白代號的列存檔時直接略過
        key: 'no',
        label: '客戶代號',
        width: '130px',
        uppercase: true,
        maxBytes: 8,
        className: 'font-bold text-blue-900 dark:text-sky-300',
        hasEllipsis: true,
        ellipsisLabel: 'F2',
        onEllipsisClick: (row) => onPickCustomer(row),
        validate: (val, row, rIdx, allRows) => {
          const code = val.trim();
          if (isPickerOpen()) return OK;
          if (!code) return { valid: false, message: '請輸入客戶代號 (可按 F2 開客戶選單)' };
          if (allRows.some((r, i) => i !== rIdx && r.no === code)) return { valid: false, message: duplicateMessage(code) };
          if (code === row.acceptedNo) return OK;
          const result = checkBranchCode(code, hq, customers);
          if (result.kind === 'block') return { valid: false, message: result.message };
          if (result.kind === 'move') {
            return { valid: false, isWarning: true, message: `該客戶已是總機構統編 ${result.customer.mainunino} 的分支機構` };
          }
          return OK;
        },
        renderCell: (val, row) => (
          <span className="flex items-center gap-1.5 truncate">
            <span className="truncate">{val}</span>
            {row.allowMove && (
              <span className="shrink-0 rounded bg-amber-500 px-1 text-[10px] font-black text-white" title="存檔時改掛到本總機構">
                改掛
              </span>
            )}
            {row.origNo && row.origNo !== row.no && (
              <span className="shrink-0 text-[10px] font-bold text-red-600" title="存檔時原客戶會移出本總機構">
                原 {row.origNo}
              </span>
            )}
          </span>
        ),
      },
      { key: 'abbr', label: '客戶簡稱', width: '170px', editable: false },
      { key: 'unino', label: '統一編號', width: '115px', editable: false },
      { key: 'tpay', label: '彙總註記', width: '100px', align: 'center', editable: false, renderCell: plain },
      {
        key: 'mediatype',
        label: '進銷項媒體',
        width: '140px',
        align: 'center',
        digitOnly: true,
        maxLength: 1,
        validate: codeOf('mediatype', ['0', '1', '2', '3', '4'], '進銷項媒體請輸入 0~4'),
        renderCell: (val) => {
          const label = MEDIA_TYPE_MAP[String(val ?? '')] || String(val ?? '');
          return (
            <span className="block w-full truncate text-center" title={label}>
              {label}
            </span>
          );
        },
      },
      { key: 't401', label: '申報書媒體', width: '125px', align: 'center', editable: false, renderCell: plain },
      yesNo('tzero', '零稅率媒體', '120px'),
      yesNo('tflog', '固定資產退稅申報', '175px'),
      yesNo('tnot', '不得扣抵媒體', '125px'),
    ];
  }, [hq, customers, isPickerOpen, onPickCustomer]);

  const createEmptyRow = useCallback(() => newBranchRow(hq), [hq]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5">
      {/* 頂端唯讀資訊列 (VFP 合併公司 / 統編 / 進銷存合併方式) */}
      <div
        className={`shrink-0 flex flex-wrap items-center gap-x-6 gap-y-1 rounded border px-3 py-2 text-sm font-bold ${
          isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'
        }`}
      >
        <span>
          合併公司：<span className="font-mono text-blue-800 dark:text-sky-300">[{hq.no}]</span> {hq.abbr}
        </span>
        <span>
          統編：<span className="font-mono">{hq.unino}</span>
        </span>
        <span>
          進銷存合併方式：<span className="text-blue-700 dark:text-sky-300">{TCHK_LABEL_MAP[hq.tchk] || hq.tchk}</span>
        </span>
      </div>

      <FoxProGridV2<BranchRow>
        gridId="wbase2050_branch"
        rows={rows}
        columns={columns}
        createEmptyRow={createEmptyRow}
        onRowsChange={onRowsChange}
        onSaveRow={(row) => onSaveRow(row)}
        onInsertRow={onInsertRow}
        onDeleteRow={(row) => onDeleteRow(row)}
        onActiveCellChange={(_row, _r, colKey) => onActiveCellChange(colKey)}
        onShowSummary={onExit}
        onExit={onExit}
        escLabel="存檔並返回"
        getRowKey={(row) => row.uid}
        activeRowKey={activeRowKey}
        enterDirection={enterDirection}
        statusBarInfo={(row) =>
          row && row.no ? (
            <span className="text-xs">
              分支：{row.no} {row.abbr}｜統編：{row.unino}
            </span>
          ) : null
        }
      />
      <FieldDescBar text={desc} />
    </div>
  );
};
