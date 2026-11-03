import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import { isoToRoc, type FeeReceiptLineRow } from '../../services/wbase2040';
import { isReceiptLocked, useWbase2040 } from './useWbase2040';
import { searchFeeItems, searchNotes } from './lookups';
import { KeyHintBar } from './KeyHintBar';

const LOCKED_MESSAGE = '此收費單已全部收款，明細不可修改。如需修改，請先以 Space 取消已收註記。';

interface Wbase2040DetailModalProps {
  /** 確認視窗開啟時不處理 Space/F12 */
  suspended: boolean;
}

/**
 * 客戶收費明細登錄 (VFP recmoney.scx)：已收,收費項目,項目名稱,收費金額,備註
 * Ins 新增 / Del 刪除 / Space 收費 / F2 開窗 / F12 游標方向 / Esc 離開 (重算表頭)
 */
export const Wbase2040DetailModal: React.FC<Wbase2040DetailModalProps> = ({ suspended }) => {
  const { isDark } = useTheme();
  const {
    detail, lines, setLines, lineSelectedKey, setLineSelectedKey, lineFocusKey, enterDirection, toggleDirection,
    addLine, saveLineRow, patchLine, toggleLinePaid, closeDetail, setConfirm, showToast,
  } = useWbase2040();
  const [picker, setPicker] = useState<{ kind: 'item' | 'note'; line: FeeReceiptLineRow } | null>(null);
  const locked = isReceiptLocked(detail);

  const currentLine = useMemo(() => lines.find((l) => l.recordNumber === lineSelectedKey), [lines, lineSelectedKey]);
  const currentRef = useRef(currentLine);
  currentRef.current = currentLine;

  // Space 收費、F12 游標方向 (FoxProGridV2 不處理這兩個鍵)
  useEffect(() => {
    if (suspended || picker) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' || e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'F12') toggleDirection();
        else if (currentRef.current) toggleLinePaid(currentRef.current);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [suspended, picker, toggleDirection, toggleLinePaid]);

  const guard = useCallback(
    (next?: (val: string) => { valid: boolean; message: string }) => (val: string) =>
      locked ? { valid: false, message: LOCKED_MESSAGE } : next ? next(val) : { valid: true, message: '' },
    [locked]
  );

  const columns = useMemo<ColumnDefV2<FeeReceiptLineRow>[]>(
    () => [
      { key: 'isover', label: '已收', width: '70px', align: 'center', editable: false, className: 'font-bold text-red-600' },
      {
        key: 'itemno',
        label: '收費項目',
        width: '120px',
        uppercase: true,
        maxBytes: 4,
        hasEllipsis: true,
        onEllipsisClick: (row) => (locked ? showToast(LOCKED_MESSAGE) : setPicker({ kind: 'item', line: row })),
        validate: guard(),
      },
      { key: 'item', label: '項目名稱', width: '1fr', maxBytes: 40, validate: guard() },
      {
        key: 'money',
        label: '收費金額',
        width: '150px',
        align: 'right',
        digitOnly: true,
        validate: guard((val) =>
          Number(val || 0) > 999999999 ? { valid: false, message: '收費金額超出範圍' } : { valid: true, message: '' }
        ),
        renderCell: (val) => (
          <span className="w-full text-right font-mono">{Number(val || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</span>
        ),
      },
      {
        key: 'note',
        label: '備註',
        width: '1fr',
        maxBytes: 60,
        hasEllipsis: true,
        onEllipsisClick: (row) => (locked ? showToast(LOCKED_MESSAGE) : setPicker({ kind: 'note', line: row })),
        validate: guard(),
      },
    ],
    [guard, locked, showToast]
  );

  const createEmptyLine = useCallback(
    (): FeeReceiptLineRow => ({ recordNumber: 0, rno: '', cno: '', recdate: '', money: 0, isover: '', itemno: '', item: '', note: '', recman: '' }),
    []
  );

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        className={`flex h-full max-h-[760px] w-full max-w-6xl flex-col overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-100 border-blue-900 text-slate-900'
        }`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-white ${isDark ? 'bg-slate-900' : 'bg-blue-900'}`}>
          <h3 className="text-lg font-bold">客戶收費明細登錄</h3>
          <span className="font-mono text-sm text-yellow-300">
            [公司: {detail.cno} {detail.abbr}][單號:{detail.rno}][日期:{isoToRoc(detail.recdate)}]
          </span>
          {locked && <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">已全部收款 (明細唯讀)</span>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-4">
          <FoxProGridV2<FeeReceiptLineRow>
            gridId="wbase2040_detail_grid"
            rows={lines}
            columns={columns}
            createEmptyRow={createEmptyLine}
            onRowsChange={setLines}
            onSaveRow={(row) => saveLineRow(row)}
            onInsertRow={() => addLine()}
            onDeleteRow={(row) => {
              if (!row) return;
              if (detail.isover) showToast('已註明收費,無法刪除,如欲刪除請將<收費>清空!');
              else setConfirm({ kind: 'deleteLine', line: row });
            }}
            onSelectRow={(row) => setLineSelectedKey(row?.recordNumber)}
            onShowSummary={() => closeDetail()}
            onExit={() => closeDetail()}
            escLabel="離開"
            getRowKey={(row) => row.recordNumber}
            activeRowKey={lineFocusKey}
            editOnInsert={false}
            enterDirection={enterDirection}
            height="100%"
            statusBarInfo={() => (
              <span className="text-xs">
                已收 {Number(detail.amt || 0).toLocaleString('zh-TW')}｜未收 {Number(detail.notamt || 0).toLocaleString('zh-TW')}
              </span>
            )}
          />
        </div>

        <KeyHintBar
          keys={[
            { key: 'Ins', label: '新增', onClick: () => addLine() },
            {
              key: 'Del',
              label: '刪除',
              onClick: () => {
                if (!currentLine) return;
                if (detail.isover) showToast('已註明收費,無法刪除,如欲刪除請將<收費>清空!');
                else setConfirm({ kind: 'deleteLine', line: currentLine });
              },
            },
            { key: 'Space', label: '收費', onClick: () => currentLine && toggleLinePaid(currentLine) },
            { key: 'F2', label: '開窗' },
            { key: 'F12', label: enterDirection === 'right' ? '游標 →' : '游標 ↓', onClick: toggleDirection },
            { key: 'Esc', label: '離開', onClick: () => closeDetail(), danger: true },
          ]}
        />
      </div>

      <SearchModal
        isOpen={picker?.kind === 'item'}
        title="收費項目"
        onSearch={searchFeeItems}
        onSelect={(item) => {
          const line = picker!.line;
          setPicker(null);
          patchLine(line, { itemno: item.code });
        }}
        onClose={() => setPicker(null)}
      />
      <SearchModal
        isOpen={picker?.kind === 'note'}
        title="備註"
        onSearch={searchNotes}
        onSelect={(item) => {
          const line = picker!.line;
          setPicker(null);
          patchLine(line, { note: item.name });
        }}
        onClose={() => setPicker(null)}
      />
    </div>
  );
};
