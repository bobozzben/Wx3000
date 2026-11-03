import React, { useCallback, useMemo } from 'react';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { MEDIA_TYPE_MAP, TCHK_MAP, type HqItem } from '../../services/wbase2050';
import { FieldDescBar } from './FieldDescBar';

interface Wbase2050FormProps {
  rows: HqItem[];
  loading: boolean;
  onRowsChange: (rows: HqItem[]) => void;
  onSaveRow: (row: HqItem) => void;
  onSelectRow: (row: HqItem | undefined) => void;
  onActiveCellChange: (colKey: string) => void;
  onExit: () => void;
  activeRowKey?: string;
  enterDirection: 'right' | 'down';
  desc: string;
}

type Check = { valid: boolean; message: string };
const OK: Check = { valid: true, message: '' };

/** 只接受指定代碼；值沒有變 (例如空白的舊資料直接按 Enter) 時放行，對齊 VFP「不接受就不寫入」 */
const codeOf =
  (key: keyof HqItem, codes: string[], message: string) =>
  (val: string, row: HqItem): Check =>
    codes.includes(val) || val === String(row[key] ?? '') ? OK : { valid: false, message };

const plain = (val: any) => <span className="w-full text-center">{val}</span>;

const coded = (map: Record<string, string>) => (val: any) => {
  const label = map[String(val ?? '')] || String(val ?? '');
  return (
    <span className="block w-full truncate text-center" title={label}>
      {label}
    </span>
  );
};

/**
 * 總機構清單 (VFP wbase2050 Grid1，RecordSource cus：customer 中 tpay='1' 的客戶)
 * 可編輯：進銷項合併設定、零稅率媒體、固定資產退稅申報、不得扣抵媒體；進銷項媒體與申報書媒體由系統決定
 */
export const Wbase2050Form: React.FC<Wbase2050FormProps> = ({
  rows,
  loading,
  onRowsChange,
  onSaveRow,
  onSelectRow,
  onActiveCellChange,
  onExit,
  activeRowKey,
  enterDirection,
  desc,
}) => {
  const columns = useMemo<ColumnDefV2<HqItem>[]>(() => {
    const yesNo = (key: 'tzero' | 'tflog' | 'tnot', label: string, width: string): ColumnDefV2<HqItem> => ({
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
      { key: 'no', label: '客戶代號', width: '110px', editable: false, className: 'font-bold text-blue-900 dark:text-sky-300' },
      { key: 'abbr', label: '客戶簡稱', width: '140px', editable: false },
      { key: 'unino', label: '統一編號', width: '110px', editable: false },
      {
        key: 'tchk',
        label: '進銷項合併設定',
        width: '165px',
        align: 'center',
        digitOnly: true,
        maxLength: 1,
        validate: codeOf('tchk', ['1', '2'], '進銷項合併設定請輸入 1 或 2'),
        renderCell: coded(TCHK_MAP),
      },
      { key: 'mediatype', label: '進銷項媒體', width: '115px', align: 'center', editable: false, renderCell: coded(MEDIA_TYPE_MAP) },
      { key: 't401', label: '申報書媒體', width: '125px', align: 'center', editable: false, renderCell: plain },
      yesNo('tzero', '零稅率媒體', '110px'),
      yesNo('tflog', '固定資產退稅申報', '155px'),
      yesNo('tnot', '不得扣抵媒體', '135px'),
    ];
  }, []);

  const createEmptyRow = useCallback(
    (): HqItem => ({
      no: '', abbr: '', unino: '', tpay: '1', tchk: '', mediatype: '', t401: '', tzero: '', tflog: '', tnot: '',
      dbMediatype: '', dbT401: '', recordNumber: 0,
    }),
    []
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5">
      {!loading && rows.length === 0 && (
        <div className="shrink-0 rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800">
          尚無總機構（彙總註記=1）資料，請至客戶資料建檔設定
        </div>
      )}
      <FoxProGridV2<HqItem>
        gridId="wbase2050_hq"
        rows={rows}
        columns={columns}
        createEmptyRow={createEmptyRow}
        onRowsChange={onRowsChange}
        onSaveRow={(row) => onSaveRow(row)}
        onSelectRow={(row) => onSelectRow(row)}
        onActiveCellChange={(_row, _r, colKey) => onActiveCellChange(colKey)}
        onShowSummary={onExit}
        onExit={onExit}
        escLabel="離開"
        allowInsert={false}
        getRowKey={(row) => row.no}
        activeRowKey={activeRowKey}
        enterDirection={enterDirection}
        statusBarInfo={(row) =>
          row && row.no ? (
            <span className="text-xs">
              總機構：{row.no} {row.abbr}｜統編：{row.unino || '(未輸入)'}
            </span>
          ) : null
        }
      />
      <FieldDescBar text={desc} />
    </div>
  );
};
