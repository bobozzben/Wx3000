import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import { KeyHintBar } from '../wbase2040/KeyHintBar';
import { FIELD_DESC, type BranchRow } from '../../services/wbase2050';
import { useWbase2050, type Wbase2050Confirm } from './useWbase2050';
import { Wbase2050Form } from './Wbase2050Form';
import { Wbase2050F8Form } from './Wbase2050F8Form';

interface Wbase2050PageProps {
  onBackToMenu?: () => void;
}

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

const isPickerOpen = () => useWbase2050.getState().picker !== null;

const confirmText = (c: NonNullable<Wbase2050Confirm>): { title: string; lines: string[]; question: string } => {
  switch (c.kind) {
    case 'deleteBranch': {
      const { no, origNo } = c.row;
      return { title: '訊息', lines: [], question: `是否確定刪除:${origNo && origNo !== no ? `${no} (原 ${origNo})` : no}` };
    }
    case 'moveBranch':
      return {
        title: '改掛分支機構',
        lines: [`客戶 ${c.customer.no} ${c.customer.abbr} 目前是總機構統編 ${c.customer.mainunino} 的分支機構。`],
        question: '是否改掛到本總機構？',
      };
    case 'leaveHq':
      return { title: '總機構回寫失敗', lines: c.lines, question: '是否仍要離開？(下次開啟時會再回寫)' };
    case 'leaveBranches':
      return { title: '分支機構存檔失敗', lines: c.lines, question: '是否放棄未存檔的修改並返回總機構清單？' };
  }
};

/**
 * 2-5 總分支機構設定 (VFP base20.prg wbasemenu02cmd05 → wbase1.vcx wbase2050「總分支機構設定」)
 * 總機構清單：Enter/字元鍵 編輯 / F8 分公司設定 / F12 游標方向 / Esc 離開
 * 分公司資料維護 (wbase2050f8)：Ins 新增 / Del 刪除 / F2 客戶選單 / F12 游標方向 / Esc 存檔並返回
 */
export const Wbase2050Page: React.FC<Wbase2050PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();
  const store = useWbase2050();
  const {
    view, loading, busy, toast, clearToast, confirm, setConfirm,
    hqRows, setHqRows, setHqSelectedNo, hqFocusNo, hqDirection, loadHq, saveHqRow, exitHq, openBranches,
    branchHq, branchRows, setBranchRows, branchFocusUid, branchGridEpoch, branchDirection, customers, picker,
    addBranchRow, saveBranchRow, openPicker, pickCustomer, closePicker, resolveMove, askDeleteBranch, removeBranch,
    saveAndCloseBranches, backToHq, toggleDirection,
  } = store;
  const [desc, setDesc] = useState('');

  useEffect(() => {
    // store 是模組層級的單例，重新進入時回到初始狀態 (VFP 每次 newobj 重建表單)
    useWbase2050.setState({
      view: 'hq', hqDirection: 'down', hqFocusNo: undefined, hqSelectedNo: undefined,
      branchHq: null, branchRows: [], customers: [], confirm: null, picker: null, toast: null, busy: false,
    });
    loadHq();
  }, [loadHq]);

  useEffect(() => {
    setDesc('');
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, toast.type === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  const leave = useCallback(async () => {
    if (await exitHq()) onBackToMenu?.();
  }, [exitHq, onBackToMenu]);

  const runConfirm = (yes: boolean) => {
    const c = useWbase2050.getState().confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'deleteBranch' && yes) removeBranch(c.row);
    if (c.kind === 'moveBranch') resolveMove(c.uid, c.customer, yes);
    if (c.kind === 'leaveHq' && yes) onBackToMenu?.();
    if (c.kind === 'leaveBranches' && yes) backToHq();
  };

  // 頁面快速鍵：在格線之前 (capture) 攔截，確認框與讀取中的按鍵不會落到 FoxProGridV2 (它監聽 window)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      const s = useWbase2050.getState();
      if (s.busy) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (s.confirm) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') runConfirm(true);
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') runConfirm(false);
        return;
      }
      if (s.picker) return; // F2 客戶選單自己處理按鍵
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return; // 格線編輯中 (VFP 編輯框內 F8 無效)
      if (e.key === 'F8' && s.view === 'hq') {
        e.stopPropagation();
        s.openBranches();
      } else if (e.key === 'F12') {
        e.stopPropagation();
        s.toggleDirection();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const searchCustomers = useCallback(
    async (q: string): Promise<SearchItem[]> => {
      const kw = q.trim().toLowerCase();
      return customers
        .filter((c) => !kw || [c.no, c.name, c.abbr, c.unino].some((v) => v.toLowerCase().includes(kw)))
        .map((c) => ({ code: c.no, name: c.name || c.abbr, spec: c.unino }));
    },
    [customers]
  );

  const onActiveCellChange = useCallback((colKey: string) => setDesc(FIELD_DESC[colKey] || ''), []);
  const onPickCustomer = useCallback((row: BranchRow) => openPicker(row), [openPicker]);

  const direction = view === 'hq' ? hqDirection : branchDirection;
  const branchView = view === 'branches' && branchHq;
  const c = confirm ? confirmText(confirm) : null;

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      <WbasePageHeader
        onBackToMenu={branchView ? saveAndCloseBranches : leave}
        backLabel={branchView ? '存檔並返回' : '返回主選單'}
        category="客戶資料"
        icon={<Building2 className="w-4 h-4 text-black" />}
        title={branchView ? '總分支機構設定 › 分公司資料維護' : '總分支機構設定'}
        code={branchView ? 'wbase2050f8' : 'wbase2050'}
        actions={
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-red-500" title="改變游標方向請按 F12">
              {direction === 'right' ? '→ 往右' : '↓ 往下'}
            </span>
            {(loading || busy) && <span className="text-blue-500">處理中…</span>}
          </div>
        }
      />

      <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col overflow-hidden">
        {/* 兩個畫面以條件式 render 切換：FoxProGridV2 監聽 window 按鍵，同時掛載兩個格線會一起反應 */}
        {branchView ? (
          <Wbase2050F8Form
            key={branchGridEpoch}
            hq={branchHq}
            customers={customers}
            rows={branchRows}
            isPickerOpen={isPickerOpen}
            onRowsChange={setBranchRows}
            onSaveRow={saveBranchRow}
            onInsertRow={addBranchRow}
            onDeleteRow={askDeleteBranch}
            onPickCustomer={onPickCustomer}
            onActiveCellChange={onActiveCellChange}
            onExit={saveAndCloseBranches}
            activeRowKey={branchFocusUid}
            enterDirection={branchDirection}
            desc={desc}
          />
        ) : (
          <Wbase2050Form
            rows={hqRows}
            loading={loading}
            onRowsChange={setHqRows}
            onSaveRow={saveHqRow}
            onSelectRow={(row) => setHqSelectedNo(row?.no || undefined)}
            onActiveCellChange={onActiveCellChange}
            onExit={leave}
            activeRowKey={hqFocusNo}
            enterDirection={hqDirection}
            desc={desc}
          />
        )}
      </div>

      <KeyHintBar
        keys={
          branchView
            ? [
                { key: 'Ins', label: '新增', onClick: addBranchRow },
                { key: 'Del', label: '刪除' },
                { key: 'F2', label: '客戶選單' },
                { key: 'F12', label: '方向', onClick: toggleDirection },
                { key: 'Esc', label: '存檔並返回', onClick: saveAndCloseBranches, danger: true },
              ]
            : [
                { key: 'F8', label: '分公司設定', onClick: openBranches },
                { key: 'F12', label: '方向', onClick: toggleDirection },
                { key: 'Esc', label: '離開', onClick: leave, danger: true },
              ]
        }
      />

      <SearchModal
        isOpen={picker !== null}
        title="客戶"
        onSearch={searchCustomers}
        onSelect={(item) => pickCustomer(item.code)}
        onClose={closePicker}
      />

      {c && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className={`w-full max-w-md rounded-lg border-2 p-6 shadow-2xl ${
              isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-600 text-slate-800'
            }`}
          >
            <div className="mb-4 flex items-center space-x-3 text-red-500">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <h3 className="text-lg font-bold">{c.title}</h3>
            </div>
            {c.lines.map((line) => (
              <p key={line} className="mb-1 text-sm leading-relaxed">
                {line}
              </p>
            ))}
            <p className="mt-2 text-sm font-bold leading-relaxed">{c.question} Y/N?</p>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => runConfirm(false)}
                className="rounded bg-gray-200 px-4 py-1.5 text-sm font-bold text-slate-800 hover:bg-gray-300"
              >
                否 (N)
              </button>
              <button onClick={() => runConfirm(true)} className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-600">
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
