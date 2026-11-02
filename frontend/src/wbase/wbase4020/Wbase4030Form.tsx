import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { CustomerVoucherItem } from './services/wbase4020';
import {
  MONTHV_MAP,
  MEDIA_TYPE_MAP,
  TRAN_TYPE_MAP,
  TRAN_KIND_MAP,
  TPAY_MAP,
  checkBig5Compatible,
} from './services/wbase4020';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { Wbase4031Modal } from './Wbase4031Modal';
import { Settings, BookmarkCheck, ArrowRight, ArrowDown, Search } from 'lucide-react';

interface Wbase4030FormProps {
  rows: CustomerVoucherItem[];
  onRowsChange: (newRows: CustomerVoucherItem[]) => void;
  onSaveRow: (row: CustomerVoucherItem, rowIndex: number) => Promise<void>;
  onApplyDefaultVoucher: (row: CustomerVoucherItem, rowIndex: number) => Promise<void>;
  onRefreshData?: () => void;
  onExit?: () => void;
  enterDirection?: 'right' | 'down';
  onDirectionToggle?: () => void;
  onOpenSearch?: () => void;
}

export const Wbase4030Form: React.FC<Wbase4030FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onApplyDefaultVoucher,
  onRefreshData,
  onExit,
  enterDirection = 'right',
  onDirectionToggle,
  onOpenSearch,
}) => {
  const [f7ModalOpen, setF7ModalOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [activeCellDesc, setActiveCellDesc] = useState<string>('');

  const createEmptyRow = useCallback(
    (): CustomerVoucherItem => ({
      no: '',
      abbr: '',
      name: '',
      monthv: '0',
      mediatype: '0',
      trantype: '1',
      trankind: '1',
      trandate: 1,
      trantypeb: '1',
      trankindb: '1',
      trandateb: 1,
      fileno: '',
      tpay: '0',
    }),
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        setF7ModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        const curRow = rows[selectedRowIndex];
        if (curRow && selectedRowIndex >= 0) {
          onApplyDefaultVoucher(curRow, selectedRowIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows, selectedRowIndex, onApplyDefaultVoucher]);

  const columns: ColumnDefV2<CustomerVoucherItem>[] = useMemo(() => {
    return [
      {
        key: 'no',
        label: '客戶代號',
        width: '95px',
        isPrimaryKey: true,
        editable: false,
        className: 'font-mono font-bold tracking-wider text-amber-500 dark:text-amber-300',
      },
      {
        key: 'abbr',
        label: '客戶簡稱',
        width: '110px',
        editable: false,
        className: 'font-bold text-slate-800 dark:text-slate-100',
      },
      {
        key: 'monthv',
        label: '週期',
        width: '85px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['0', '1'].includes(v)) {
            return { valid: false, message: '週期請輸入 0 (每期) 或 1 (每月)' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '0').trim();
          return <span>{s} {MONTHV_MAP[s] ? `(${MONTHV_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'mediatype',
        label: '申報方式',
        width: '95px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['0', '1', '2', '3', '4'].includes(v)) {
            return { valid: false, message: '申報方式請輸入 0~4' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '0').trim();
          return <span>{s} {MEDIA_TYPE_MAP[s] ? `(${MEDIA_TYPE_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'trantype',
        label: '銷項連線型態',
        width: '115px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['1', '2', '3', '4', '5', '9'].includes(v)) {
            return { valid: false, message: '銷項連線型態請輸入 1, 2, 3, 4, 5 或 9' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '1').trim();
          return <span>{s} {TRAN_TYPE_MAP[s] ? `(${TRAN_TYPE_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'trankind',
        label: '銷項連線種類',
        width: '115px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['1', '2'].includes(v)) {
            return { valid: false, message: '銷項連線種類請輸入 1 或 2' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '1').trim();
          return <span>{s} {TRAN_KIND_MAP[s] ? `(${TRAN_KIND_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'trandate',
        label: '銷項連線天數',
        width: '105px',
        align: 'right',
        className: 'font-mono text-right',
        validate: (val) => {
          const n = Number(val);
          if (isNaN(n) || n < 0 || n > 99) {
            return { valid: false, message: '天數請輸入 0~99' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => <span>{val ?? 0} 天</span>,
      },
      {
        key: 'trantypeb',
        label: '進項連線型態',
        width: '115px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['1', '2', '3', '4', '5', '6', '9'].includes(v)) {
            return { valid: false, message: '進項連線型態請輸入 1, 2, 3, 4, 5, 6 或 9' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '1').trim();
          return <span>{s} {TRAN_TYPE_MAP[s] ? `(${TRAN_TYPE_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'trankindb',
        label: '進項連線種類',
        width: '115px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['1', '2'].includes(v)) {
            return { valid: false, message: '進項連線種類請輸入 1 或 2' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '1').trim();
          return <span>{s} {TRAN_KIND_MAP[s] ? `(${TRAN_KIND_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
      {
        key: 'trandateb',
        label: '進項連線天數',
        width: '105px',
        align: 'right',
        className: 'font-mono text-right',
        validate: (val) => {
          const n = Number(val);
          if (isNaN(n) || n < 0 || n > 99) {
            return { valid: false, message: '天數請輸入 0~99' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => <span>{val ?? 0} 天</span>,
      },
      {
        key: 'fileno',
        label: '檔案編號',
        width: '95px',
        maxLength: 8,
        maxBytes: 8,
        className: 'font-mono',
        validate: (val) => {
          const b5 = checkBig5Compatible(val || '');
          if (!b5.valid) return { valid: false, message: b5.message };
          return { valid: true, message: '' };
        },
      },
      {
        key: 'tpay',
        label: '總繳代號',
        width: '95px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['0', '1', '2'].includes(v)) {
            return { valid: false, message: '總繳代號請輸入 0, 1 或 2' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '0').trim();
          return <span>{s} {TPAY_MAP[s] ? `(${TPAY_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
    ];
  }, []);

  const handleActiveCellChange = (colKey: string) => {
    switch (colKey) {
      case 'monthv':
        setActiveCellDesc('申報週期 : 0.每期 1.每月');
        break;
      case 'mediatype':
        setActiveCellDesc('媒體申報方式 : 0.銷項 1.進項 2.進銷項 3.不媒體 4.(藍)進銷項');
        break;
      case 'trantype':
        setActiveCellDesc('銷項連線型態 : 1.逐筆 2.同一天合併 3.多天合併 4.逐筆切傳票(分開) 5.多天逐筆 9.不轉檔');
        break;
      case 'trankind':
        setActiveCellDesc('銷項連線種類 : 1.多種科目 2.單一科目');
        break;
      case 'trantypeb':
        setActiveCellDesc('進項連線型態 : 1.逐筆 2.同一天合併 3.多天合併 4.逐筆切傳票(分開) 5.多天逐筆 6.單筆 9.不轉檔');
        break;
      case 'trankindb':
        setActiveCellDesc('進項連線種類 : 1.多種科目 2.單一科目');
        break;
      case 'tpay':
        setActiveCellDesc('總繳代號 : 0.無總繳 1.總機構總繳 2.分支機構由總機構總繳');
        break;
      default:
        setActiveCellDesc('');
        break;
    }
  };

  const selectedRow = rows[selectedRowIndex];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* 頂部快捷動作條 */}
      <div className="px-4 py-2 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setF7ModalOpen(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1 shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" /> 標準參數 [F7]
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedRow && selectedRowIndex >= 0) {
                onApplyDefaultVoucher(selectedRow, selectedRowIndex);
              }
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            title="將 accpara 標準轉傳票參數一鍵套用至目前客戶"
          >
            <BookmarkCheck className="w-3.5 h-3.5" /> 套用標準參數 [F8]
          </button>
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" /> 尋找 [F9]
            </button>
          )}
          {onDirectionToggle && (
            <button
              type="button"
              onClick={onDirectionToggle}
              className="px-3 py-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-slate-200 font-bold rounded flex items-center gap-1"
            >
              {enterDirection === 'right' ? (
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
              )}
              方向 [F12]: {enterDirection === 'right' ? '→' : '↓'}
            </button>
          )}
        </div>

        {selectedRow && (
          <div className="text-slate-700 dark:text-slate-300 font-bold">
            目前客戶：<span className="text-blue-700 dark:text-amber-300">[{selectedRow.no}] {selectedRow.abbr || selectedRow.name}</span>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-0 relative">
        <FoxProGridV2<CustomerVoucherItem>
          gridId="wbase4030_grid"
          rows={rows}
          columns={columns}
          createEmptyRow={createEmptyRow}
          onRowsChange={onRowsChange}
          onSaveRow={onSaveRow}
          onOpenPrint={() => setF7ModalOpen(true)}
          onExit={onExit}
          onSelectRow={(row, rIdx) => {
            setSelectedRowIndex(rIdx);
            if (row) {
              handleActiveCellChange('');
            }
          }}
          enterDirection={enterDirection}
          minRows={0}
        />
      </div>

      {/* 底部即時說明條 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 text-xs font-mono">
        <div className="text-blue-800 dark:text-amber-300 font-bold min-h-[1.25rem] flex items-center">
          {activeCellDesc || '提示：[F7]標準科目/轉檔參數，[F8]套用標準參數，[F12]切換游標方向，[Esc]離開'}
        </div>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <span>游標方向: <strong className="text-amber-600 dark:text-amber-400">{enterDirection === 'right' ? '→ [向右]' : '↓ [向下]'}</strong></span>
          <span>筆數: <strong className="text-slate-900 dark:text-slate-100">{rows.length}</strong></span>
        </div>
      </div>

      {/* F7 Modal (標準轉傳票參數設定) */}
      {f7ModalOpen && (
        <Wbase4031Modal
          isOpen={true}
          onClose={() => setF7ModalOpen(false)}
          onSaved={() => onRefreshData?.()}
        />
      )}
    </div>
  );
};
