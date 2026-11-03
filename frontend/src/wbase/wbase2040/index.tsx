import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Receipt, AlertTriangle } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import { SORT_LABELS, type FeeReceiptRow } from '../../services/wbase2040';
import { isReceiptLocked, useWbase2040 } from './useWbase2040';
import { Wbase2040Form } from './Wbase2040Form';
import { Wbase2040DetailModal } from './Wbase2040DetailModal';
import { Wbase2040MemoModal } from './Wbase2040MemoModal';
import { Wbase2040BatchModal } from './Wbase2040BatchModal';
import { Wbase2040Print } from './wbase2040Print';
import { Wbase2040RecPrint } from './wbase2040_rec_print';
import { KeyHintBar } from './KeyHintBar';
import { searchCustomers, searchStaff } from './lookups';

interface Wbase2040PageProps {
  onBackToMenu?: () => void;
}

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

/**
 * 2-4 客戶收費資料輸入 (VFP base20.prg wbasemenu02cmd04 → FORMS\recmom.scx「客戶收費金額登錄」)
 * 快速鍵對齊 VFP：Ins 新增 / Del 刪除 / Space 輸入明細 / F3 收據摘要 / F4 收據列印 / F5 批次收款單 /
 * F6 請款單 / F7 排序 / F8 共用說明 / F9 收費統計表 / F12 游標方向 / Esc 離開
 */
export const Wbase2040Page: React.FC<Wbase2040PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();
  const store = useWbase2040();
  const {
    rows, setRows, sortNo, selectedKey, setSelectedKey, focusKey, setFocusKey, enterDirection, toggleDirection, loading, toast, clearToast,
    modal, setModal, confirm, setConfirm, detail, memoText, setMemoText, showToast,
    refresh, cycleSort, addReceipt, saveReceiptRow, patchReceipt, removeReceipt, removeLine,
    openDetail, openReceiptMemo, saveReceiptMemo, openSharedMemo, saveSharedMemoText,
  } = store;
  const [picker, setPicker] = useState<{ kind: 'customer' | 'staff'; row: FeeReceiptRow } | null>(null);

  const selectedRow = useMemo(() => rows.find((r) => r.recordNumber === selectedKey), [rows, selectedKey]);
  const selectedRef = useRef(selectedRow);
  selectedRef.current = selectedRow;

  useEffect(() => {
    refresh(1);
  }, [refresh]);

  // 子視窗開啟時主格線會卸載，記下目前這一筆，關閉後重新掛載時回到原位
  const modalOpen = modal !== null;
  useEffect(() => {
    if (modalOpen) setFocusKey(useWbase2040.getState().selectedKey);
  }, [modalOpen, setFocusKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, toast.type === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  const runConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (c?.kind === 'deleteReceipt') await removeReceipt(c.row);
    if (c?.kind === 'deleteLine') await removeLine(c.line);
  };

  // 頁面快速鍵：在格線之前 (capture) 攔截 VFP 的功能鍵，避免被 FoxProGridV2 的 F3 搜尋 / F7 列印吃掉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      if (useWbase2040.getState().opening) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (confirm) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') runConfirm();
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') setConfirm(null);
        return;
      }
      if (modal || picker) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return; // 格線編輯中
      const row = selectedRef.current;
      const actions: Record<string, () => void> = {
        ' ': () => row && openDetail(row),
        F3: () => row && openReceiptMemo(row),
        F4: () => setModal('printReceipt'),
        F5: () => setModal('batch'),
        F6: () => setModal('printBill'),
        F7: () => cycleSort(),
        F8: () => openSharedMemo(),
        F9: () => setModal('stats'),
        F12: () => toggleDirection(),
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const askDeleteReceipt = (row?: FeeReceiptRow) => {
    if (row && row.recordNumber) setConfirm({ kind: 'deleteReceipt', row });
  };

  // 子視窗開啟時卸載主格線：FoxProGridV2 監聽 window 按鍵，留著會在背景跟著移動
  const gridVisible = modal === null;

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      <WbasePageHeader
        onBackToMenu={onBackToMenu}
        category="客戶資料"
        icon={<Receipt className="w-4 h-4 text-black" />}
        title="客戶收費金額登錄"
        code="wbase2040"
        actions={
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-red-500">排序:{SORT_LABELS[sortNo - 1]}</span>
            <span className="text-red-500" title="改變游標方向請按 F12">
              {enterDirection === 'right' ? '→' : '↓'}
            </span>
            {(loading || store.opening) && <span className="text-blue-500">讀取中…</span>}
          </div>
        }
      />

      <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col overflow-hidden">
        {gridVisible ? (
          <Wbase2040Form
            key={sortNo}
            rows={rows}
            onRowsChange={setRows}
            onSaveRow={saveReceiptRow}
            onInsertRow={() => addReceipt()}
            onDeleteRow={askDeleteReceipt}
            onSelectRow={(row) => setSelectedKey(row?.recordNumber || undefined)}
            onPickCustomer={(row) => (isReceiptLocked(row) ? showToast('此收費單已全部收款，不可修改。') : setPicker({ kind: 'customer', row }))}
            onPickStaff={(row) => (isReceiptLocked(row) ? showToast('此收費單已全部收款，不可修改。') : setPicker({ kind: 'staff', row }))}
            onExit={onBackToMenu}
            activeRowKey={focusKey}
            enterDirection={enterDirection}
          />
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <KeyHintBar
        keys={[
          { key: 'Ins', label: '新增', onClick: () => addReceipt() },
          { key: 'Del', label: '刪除', onClick: () => askDeleteReceipt(selectedRow) },
          { key: 'Space', label: '輸入明細', onClick: () => selectedRow && openDetail(selectedRow) },
          { key: 'F3', label: '收據摘要', onClick: () => selectedRow && openReceiptMemo(selectedRow) },
          { key: 'F4', label: '收據列印', onClick: () => setModal('printReceipt') },
          { key: 'F5', label: '批次收款單', onClick: () => setModal('batch') },
          { key: 'F6', label: '請款單', onClick: () => setModal('printBill') },
          { key: 'F7', label: '排序', onClick: () => cycleSort() },
          { key: 'F8', label: '共用說明', onClick: () => openSharedMemo() },
          { key: 'F9', label: '收費統計表(Excel輸出)', onClick: () => setModal('stats') },
          { key: 'F12', label: '游標方向', onClick: toggleDirection },
          { key: 'Esc', label: '離開', onClick: onBackToMenu, danger: true },
        ]}
      />

      {modal === 'detail' && <Wbase2040DetailModal suspended={confirm !== null} />}

      {modal === 'receiptMemo' && detail && (
        <Wbase2040MemoModal
          title="收據摘要內容編輯"
          subtitle={`[單號:${detail.rno}][${detail.cno} ${detail.abbr}]`}
          value={memoText}
          onChange={setMemoText}
          onSaveAndClose={saveReceiptMemo}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'sharedMemo' && (
        <Wbase2040MemoModal
          title="共用說明內容編輯"
          subtitle="收據與請款單共用"
          value={memoText}
          onChange={setMemoText}
          onSaveAndClose={saveSharedMemoText}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'batch' && (
        <Wbase2040BatchModal
          onClose={() => setModal(null)}
          onDone={(result) => {
            setModal(null);
            showToast(`${result.message} 共產生 ${result.created} 張 (${result.firstRno} ~ ${result.lastRno})`, 'success');
            refresh();
          }}
        />
      )}

      {(modal === 'printReceipt' || modal === 'printBill') && (
        <Wbase2040RecPrint mode={modal === 'printReceipt' ? 'receipt' : 'bill'} onClose={() => setModal(null)} />
      )}

      {modal === 'stats' && <Wbase2040Print onClose={() => setModal(null)} />}

      <SearchModal
        isOpen={picker?.kind === 'customer'}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => {
          const row = picker!.row;
          setPicker(null);
          patchReceipt(row.rno, { cno: item.code });
        }}
        onClose={() => setPicker(null)}
      />
      <SearchModal
        isOpen={picker?.kind === 'staff'}
        title="人員"
        onSearch={searchStaff}
        onSelect={(item) => {
          const row = picker!.row;
          setPicker(null);
          patchReceipt(row.rno, { recman: item.name });
        }}
        onClose={() => setPicker(null)}
      />

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className={`w-full max-w-md rounded-lg border-2 p-6 shadow-2xl ${
              isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-600 text-slate-800'
            }`}
          >
            <div className="mb-4 flex items-center space-x-3 text-red-500">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <h3 className="text-lg font-bold">{confirm.kind === 'deleteReceipt' ? '收費單' : '收費明細'}</h3>
            </div>
            <p className="mb-2 text-sm leading-relaxed">
              {confirm.kind === 'deleteReceipt'
                ? `確定刪除: ${confirm.row.rno} (含全部明細) Y/N?`
                : `確定刪除: [${confirm.line.itemno}] ${confirm.line.item} ${Number(confirm.line.money || 0).toLocaleString('zh-TW')} Y/N?`}
            </p>
            {confirm.kind === 'deleteReceipt' && isReceiptLocked(confirm.row) && (
              <p className="mb-2 text-sm font-bold text-red-600">注意：此收費單已全部收款。</p>
            )}
            <div className="mt-4 flex justify-end space-x-3">
              <button onClick={() => setConfirm(null)} className="rounded bg-gray-200 px-4 py-1.5 text-sm font-bold text-slate-800 hover:bg-gray-300">
                否 (N)
              </button>
              <button onClick={runConfirm} className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-600">
                是 (Y)
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 rounded-lg border-2 px-4 py-2 text-sm font-bold shadow-xl ${
            toast.type === 'error'
              ? 'border-red-500 bg-red-50 text-red-700'
              : toast.type === 'warning'
                ? 'border-amber-500 bg-amber-50 text-amber-800'
                : 'border-emerald-500 bg-emerald-50 text-emerald-800'
          }`}
          onClick={clearToast}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
