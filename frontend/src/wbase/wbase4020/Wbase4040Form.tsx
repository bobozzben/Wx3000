import React, { useState, useMemo, useCallback } from 'react';
import type { AccStItem } from './services/wbase4020';
import {
  STOCK_MODE_MAP,
  ACCTYPE_MAP,
} from './services/wbase4020';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { ArrowRight, ArrowDown, Search } from 'lucide-react';

interface Wbase4040FormProps {
  rows: AccStItem[];
  onRowsChange: (newRows: AccStItem[]) => void;
  onSaveRow: (row: AccStItem, rowIndex: number) => Promise<void>;
  onExit?: () => void;
  enterDirection?: 'right' | 'down';
  onDirectionToggle?: () => void;
  onOpenSearch?: () => void;
}

export const Wbase4040Form: React.FC<Wbase4040FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onExit,
  enterDirection = 'right',
  onDirectionToggle,
  onOpenSearch,
}) => {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [activeCellDesc, setActiveCellDesc] = useState<string>('');

  const createEmptyRow = useCallback(
    (): AccStItem => ({
      no: '',
      name: '',
      stock: 'A',
      acctype: 'A',
    }),
    []
  );

  const columns: ColumnDefV2<AccStItem>[] = useMemo(() => {
    return [
      {
        key: 'no',
        label: '客戶代號',
        width: '120px',
        isPrimaryKey: true,
        editable: false,
        className: 'font-mono font-bold tracking-wider text-amber-500 dark:text-amber-300',
      },
      {
        key: 'name',
        label: '客戶名稱',
        width: '260px',
        editable: false,
        className: 'font-bold text-slate-800 dark:text-slate-100',
      },
      {
        key: 'stock',
        label: '期末存貨計算方式',
        width: '240px',
        maxLength: 1,
        maxBytes: 1,
        uppercase: true,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim().toUpperCase();
          if (v && !['A', 'B', 'C'].includes(v)) {
            return { valid: false, message: '期末存貨計算方式請輸入 A, B 或 C' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || 'A').trim().toUpperCase();
          return (
            <span className="font-bold text-blue-700 dark:text-blue-300">
              {s} {STOCK_MODE_MAP[s] ? `(${STOCK_MODE_MAP[s].replace(/^[A-Z]\./, '')})` : ''}
            </span>
          );
        },
      },
      {
        key: 'acctype',
        label: '會計類別',
        width: '200px',
        maxLength: 1,
        maxBytes: 1,
        uppercase: true,
        align: 'center',
        className: 'font-mono text-center font-bold',
        validate: (val) => {
          const v = (val || '').trim().toUpperCase();
          if (v && !['A', 'B', 'C', 'D'].includes(v)) {
            return { valid: false, message: '會計類別請輸入 A, B, C 或 D' };
          }
          return { valid: true, message: '' };
        },
        renderCell: (val) => {
          const s = String(val || 'A').trim().toUpperCase();
          return (
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {s} {ACCTYPE_MAP[s] ? `(${ACCTYPE_MAP[s].replace(/^[A-Z]\./, '')})` : ''}
            </span>
          );
        },
      },
    ];
  }, []);

  const handleActiveCellChange = (colKey: string) => {
    switch (colKey) {
      case 'stock':
        setActiveCellDesc('期末存貨計算方式：A.由進銷存檔計算 B.自行輸入期末金額 C.自行輸入期末傳票');
        break;
      case 'acctype':
        setActiveCellDesc('會計類別：A.標準會計 B.非歷年制 C.營造業 D.建設業');
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
            目前客戶：<span className="text-blue-700 dark:text-amber-300">[{selectedRow.no}] {selectedRow.name}</span>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-0 relative">
        <FoxProGridV2<AccStItem>
          gridId="wbase4040_grid"
          rows={rows}
          columns={columns}
          createEmptyRow={createEmptyRow}
          onRowsChange={onRowsChange}
          onSaveRow={onSaveRow}
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
          {activeCellDesc || '提示：[Enter]盲打維護，[F12]切換游標方向，[Esc]離開並自動同步至客戶主檔'}
        </div>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <span>游標方向: <strong className="text-amber-600 dark:text-amber-400">{enterDirection === 'right' ? '→ [向右]' : '↓ [向下]'}</strong></span>
          <span>筆數: <strong className="text-slate-900 dark:text-slate-100">{rows.length}</strong></span>
        </div>
      </div>
    </div>
  );
};
