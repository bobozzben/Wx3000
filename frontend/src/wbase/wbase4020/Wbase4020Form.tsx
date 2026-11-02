import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { CustomerTaxItem } from './services/wbase4020';
import {
  MEDIA_TYPE_MAP,
  TPAY_MAP,
  MONTHV_MAP,
  checkBig5Compatible,
} from './services/wbase4020';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { AccountSearchModal } from './AccountSearchModal';
import { Wbase4021Modal } from './Wbase4021Modal';
import { Settings, BookmarkCheck, ArrowRight, ArrowDown, Search } from 'lucide-react';

interface Wbase4020FormProps {
  rows: CustomerTaxItem[];
  onRowsChange: (newRows: CustomerTaxItem[]) => void;
  onSaveRow: (row: CustomerTaxItem, rowIndex: number) => Promise<void>;
  onApplyDefaultTax: (row: CustomerTaxItem, rowIndex: number) => Promise<void>;
  onRefreshData?: () => void;
  onExit?: () => void;
  enterDirection?: 'right' | 'down';
  onDirectionToggle?: () => void;
  onOpenSearch?: () => void;
}

export const Wbase4020Form: React.FC<Wbase4020FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onApplyDefaultTax,
  onRefreshData,
  onExit,
  enterDirection = 'right',
  onDirectionToggle,
  onOpenSearch,
}) => {
  // Modal 狀態
  const [f7ModalOpen, setF7ModalOpen] = useState(false);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [searchTargetField, setSearchTargetField] = useState<keyof CustomerTaxItem | null>(null);
  const [searchTargetRowIndex, setSearchTargetRowIndex] = useState<number>(-1);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [activeCellDesc, setActiveCellDesc] = useState<string>('');

  const createEmptyRow = useCallback(
    (): CustomerTaxItem => ({
      no: '',
      abbr: '',
      name: '',
      bydno: '',
      bycno: '',
      bybkdno: '',
      bybkcno: '',
      sadno: '',
      sacno: '',
      sabkdno: '',
      sabkcno: '',
      casaccno: '',
      mediatype: '0',
      t401: '',
      fileno: '',
      tpay: '0',
      mainunino: '',
      monthv: '0',
    }),
    []
  );

  const handleOpenAccountSearch = useCallback(
    (field: keyof CustomerTaxItem, rowIndex: number) => {
      setSearchTargetField(field);
      setSearchTargetRowIndex(rowIndex);
      setAccountSearchOpen(true);
    },
    []
  );

  const handleSelectAccount = useCallback(
    (accno: string) => {
      if (searchTargetField && searchTargetRowIndex >= 0 && searchTargetRowIndex < rows.length) {
        const updated = [...rows];
        const currentRow = { ...updated[searchTargetRowIndex] };
        (currentRow as any)[searchTargetField] = accno.trim().toUpperCase();
        updated[searchTargetRowIndex] = currentRow;
        onRowsChange(updated);
        onSaveRow(currentRow, searchTargetRowIndex);
      }
      setAccountSearchOpen(false);
    },
    [searchTargetField, searchTargetRowIndex, rows, onRowsChange, onSaveRow]
  );

  // 監聽 F7 與 F8 快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        setF7ModalOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        const curRow = rows[selectedRowIndex];
        if (curRow && selectedRowIndex >= 0) {
          onApplyDefaultTax(curRow, selectedRowIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows, selectedRowIndex, onApplyDefaultTax]);

  const columns: ColumnDefV2<CustomerTaxItem>[] = useMemo(() => {
    const makeAccColumn = (
      key: keyof CustomerTaxItem & string,
      label: string,
      width: string = '105px'
    ): ColumnDefV2<CustomerTaxItem> => ({
      key,
      label,
      width,
      uppercase: true,
      maxLength: 8,
      maxBytes: 8,
      hasEllipsis: true,
      ellipsisLabel: 'F2',
      onEllipsisClick: (_row, rIdx) => handleOpenAccountSearch(key, rIdx),
      className: 'font-mono tracking-wider',
      validate: (val) => {
        const t = (val || '').trim().toUpperCase();
        if (t.length > 8) return { valid: false, message: `${label}不可超過8碼` };
        return { valid: true, message: '' };
      },
    });

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
      makeAccColumn('bydno', '進項借方'),
      makeAccColumn('bycno', '進項貸方'),
      makeAccColumn('bybkdno', '進項退出借方', '115px'),
      makeAccColumn('bybkcno', '進項退出貸方', '115px'),
      makeAccColumn('sadno', '銷項借方'),
      makeAccColumn('sacno', '銷項貸方'),
      makeAccColumn('sabkdno', '銷項退回借方', '115px'),
      makeAccColumn('sabkcno', '銷項退回貸方', '115px'),
      makeAccColumn('casaccno', '收銀機會計', '110px'),
      {
        key: 'mediatype',
        label: '媒體申報方式',
        width: '110px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['0', '1', '2', '3', '4'].includes(v)) {
            return { valid: false, message: '媒體申報方式請輸入 0~4' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '0').trim();
          return (
            <span title={MEDIA_TYPE_MAP[s] || s}>
              {s} {MEDIA_TYPE_MAP[s] ? `(${MEDIA_TYPE_MAP[s].replace(/^\d\./, '')})` : ''}
            </span>
          );
        },
      },
      {
        key: 't401',
        label: '申報書媒體',
        width: '95px',
        maxLength: 1,
        maxBytes: 1,
        uppercase: true,
        align: 'center',
        className: 'font-mono text-center',
      },
      {
        key: 'fileno',
        label: '檔案編號',
        width: '100px',
        maxLength: 10,
        maxBytes: 10,
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
        width: '105px',
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
      {
        key: 'mainunino',
        label: '總機構統編',
        width: '105px',
        maxLength: 8,
        maxBytes: 8,
        className: 'font-mono tracking-wider',
        validate: (val) => {
          const s = (val || '').trim();
          if (s && s.length !== 8) {
            return { valid: true, message: '總機構統一編號應為8碼數字', isWarning: true };
          }
          return { valid: true, message: '' };
        },
      },
      {
        key: 'monthv',
        label: '申報週期',
        width: '95px',
        maxLength: 1,
        maxBytes: 1,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim();
          if (v && !['0', '1'].includes(v)) {
            return { valid: false, message: '申報週期請輸入 0 (每期) 或 1 (每月)' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || '0').trim();
          return <span>{s} {MONTHV_MAP[s] ? `(${MONTHV_MAP[s].replace(/^\d\./, '')})` : ''}</span>;
        },
      },
    ];
  }, [handleOpenAccountSearch]);

  const handleActiveCellChange = (colKey: string) => {
    switch (colKey) {
      case 'mediatype':
        setActiveCellDesc('媒體申報方式 : 0.銷項 1.進項 2.進銷項 3.不媒體 4.(藍)進銷項');
        break;
      case 'tpay':
        setActiveCellDesc('總繳代號 : 0.無總繳 1.總機構總繳 2.分支機構由總機構總繳');
        break;
      case 'monthv':
        setActiveCellDesc('申報週期 : 0.每期 1.每月');
        break;
      case 'bydno':
      case 'bycno':
      case 'bybkdno':
      case 'bybkcno':
      case 'sadno':
      case 'sacno':
      case 'sabkdno':
      case 'sabkcno':
      case 'casaccno':
        setActiveCellDesc('會計科目代號 (按 [F2] 可開啟科目快選視窗)');
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
            <Settings className="w-3.5 h-3.5" /> 標準科目 [F7]
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedRow && selectedRowIndex >= 0) {
                onApplyDefaultTax(selectedRow, selectedRowIndex);
              }
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            title="將 accpara 標準會計科目一鍵套用至目前客戶"
          >
            <BookmarkCheck className="w-3.5 h-3.5" /> 標準參數 [F8]
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
        <FoxProGridV2<CustomerTaxItem>
          gridId="wbase4020_grid"
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

      {/* 底部即時說明條 (對齊 VFP memo.caption) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 text-xs font-mono">
        <div className="text-blue-800 dark:text-amber-300 font-bold min-h-[1.25rem] flex items-center">
          {activeCellDesc || '提示：使用方向鍵/Enter盲打移動，[F2]查詢科目，[F7]標準科目，[F8]套用標準參數，[F12]切換游標方向，[Esc]離開'}
        </div>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <span>游標方向: <strong className="text-amber-600 dark:text-amber-400">{enterDirection === 'right' ? '→ [向右]' : '↓ [向下]'}</strong></span>
          <span>筆數: <strong className="text-slate-900 dark:text-slate-100">{rows.length}</strong></span>
        </div>
      </div>

      {/* F7 Modal (標準會計科目設定) */}
      {f7ModalOpen && (
        <Wbase4021Modal
          isOpen={true}
          onClose={() => setF7ModalOpen(false)}
          onSaved={() => onRefreshData?.()}
        />
      )}

      {/* F2 Modal (會計科目查詢) */}
      {accountSearchOpen && searchTargetField && (
        <AccountSearchModal
          isOpen={true}
          onClose={() => setAccountSearchOpen(false)}
          onSelect={handleSelectAccount}
        />
      )}
    </div>
  );
};
