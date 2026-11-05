import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { AddressSelectModal } from '../../components/FoxProGrid/AddressSelectModal';
import { useTheme } from '../menu/ThemeContext';
import { KeyHintBar } from '../wbase2040/KeyHintBar';
import { OFFICE_BYTES, type CstoreItem } from '../../services/wbase1010';
import { truncateBig5 } from '../../services/validation';
import { useWbase1010, type Wbase1010Confirm } from './useWbase1010';
import { Wbase1010Form, type FocusRequest } from './Wbase1010Form';
import { Wbase1010CstoreGrid } from './Wbase1010CstoreGrid';
import { Wbase1010_cstore_print } from './wbase1010_cstore_print';

interface Wbase1010PageProps {
  onBackToMenu?: () => void;
}

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

const confirmText = (c: NonNullable<Wbase1010Confirm>): { title: string; question: string } => {
  switch (c.kind) {
    case 'deleteCstore':
      return { title: '訊息', question: `是否確定刪除:${c.row.origNo || c.row.no}` };
    case 'leaveOffice':
      return { title: '尚未存檔', question: '預設事務所資料已修改但尚未按 F8 確定，是否放棄修改並離開？' };
  }
};

/**
 * 1-1 事務所資料維護 (VFP base10.prg wbasemenu01cmd01 → LIBS\wbase.vcx wbase1010「事務所資料維護」)
 * 預設事務所資料：F2 地址選單 / F4 事務所資料 / F8 確定 / Esc 離開
 * 事務所資料 (wbase1010f4)：F5 轉入預設 / Ins 新增 / Del 刪除 / F4 列印 / F8 尋找 / F12 方向 / Esc 離開
 */
export const Wbase1010Page: React.FC<Wbase1010PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();
  const store = useWbase1010();
  const {
    view, loading, busy, toast, clearToast, confirm, setConfirm, picker, setPicker,
    form, setField, loadOffice, saveOfficeForm, isDirty,
    cstoreRows, setCstoreRows, cstoreFocusKey, cstoreGridEpoch, cstoreDirection, isPrintOpen,
    openCstore, closeCstore, addCstoreRow, saveCstoreRow, askDeleteCstore, removeCstore, setCstoreSelectedKey,
    transferToOffice, pickCstoreAddr, locateCstore, toggleDirection, openPrint, closePrint,
  } = store;
  const [focusRequest, setFocusRequest] = useState<FocusRequest>({ field: 'tel', seq: 0 });

  const requestFocus = useCallback(
    (field: FocusRequest['field']) => setFocusRequest((prev) => ({ field, seq: prev.seq + 1 })),
    []
  );

  useEffect(() => {
    // store 是模組層級的單例，重新進入時回到初始狀態 (VFP 每次 newobj 重建表單)
    useWbase1010.getState().reset();
    loadOffice().then(() => requestFocus('tel'));
  }, [loadOffice, requestFocus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, toast.type === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // VFP fesc 直接關閉不存檔；網頁版有未存檔的修改時先確認
  const leave = useCallback(() => {
    if (useWbase1010.getState().isDirty()) setConfirm({ kind: 'leaveOffice' });
    else onBackToMenu?.();
  }, [setConfirm, onBackToMenu]);

  const runConfirm = useCallback(
    (yes: boolean) => {
      const c = useWbase1010.getState().confirm;
      setConfirm(null);
      if (!c || !yes) return;
      if (c.kind === 'deleteCstore') void removeCstore(c.row);
      if (c.kind === 'leaveOffice') onBackToMenu?.();
    },
    [setConfirm, removeCstore, onBackToMenu]
  );

  // 頁面快速鍵：在格線之前 (capture) 攔截，確認框與存檔中的按鍵不會落到 FoxProGridV2 (它監聽 window)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      const s = useWbase1010.getState();
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
      if (s.picker || s.isPrintOpen) return; // 地址選單、尋找與列印視窗自己處理按鍵

      if (s.view === 'office') {
        if (e.key === 'F4') {
          e.stopPropagation();
          void s.openCstore();
        } else if (e.key === 'F8') {
          e.stopPropagation();
          void s.saveOfficeForm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          leave();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return; // 格線編輯中 (VFP 編輯框內只有 F2/Enter/Esc)
      if (e.key === 'F4') {
        e.stopPropagation();
        void s.openPrint();
      } else if (e.key === 'F5') {
        e.stopPropagation();
        s.transferToOffice();
      } else if (e.key === 'F8') {
        e.stopPropagation();
        s.setPicker({ kind: 'cstoreSearch' });
      } else if (e.key === 'F12') {
        e.stopPropagation();
        s.toggleDirection();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [runConfirm, leave]);

  const onPickAddr = useCallback(
    (row: CstoreItem, currentValue: string) => setPicker({ kind: 'cstoreAddr', rowKey: row._key, value: currentValue }),
    [setPicker]
  );

  const searchCstore = useCallback(
    async (q: string): Promise<SearchItem[]> => {
      const kw = q.trim().toLowerCase();
      return useWbase1010
        .getState()
        .cstoreRows.filter((r) => r.no.trim())
        .filter((r) => !kw || [r.no, r.name, r.tel, r.hname].some((v) => v.toLowerCase().includes(kw)))
        .map((r) => ({ code: r.no, name: r.name, spec: r.tel }));
    },
    []
  );

  const cstoreView = view === 'cstore';
  const c = confirm ? confirmText(confirm) : null;
  const officeAddrOpen = picker?.kind === 'officeAddr';
  const cstoreAddr = picker?.kind === 'cstoreAddr' ? picker : null;

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      <WbasePageHeader
        onBackToMenu={cstoreView ? () => void closeCstore() : leave}
        backLabel={cstoreView ? '返回預設事務所' : '返回主選單'}
        category="事務所資料"
        icon={<Building2 className="w-4 h-4 text-black" />}
        title={cstoreView ? '事務所資料維護 › 事務所資料' : '事務所資料維護'}
        code={cstoreView ? 'wbase1010f4' : 'wbase1010'}
        actions={
          <div className="flex items-center gap-3 text-xs font-bold">
            {cstoreView && (
              <span className="text-red-500" title="改變游標方向請按 F12">
                {cstoreDirection === 'right' ? '→ 往右' : '↓ 往下'}
              </span>
            )}
            {(loading || busy) && <span className="text-blue-500">處理中…</span>}
          </div>
        }
      />

      {/* 兩個畫面以條件式 render 切換 (VFP 開 F4 時隱藏主表單)；FoxProGridV2 監聽 window 按鍵，列印視窗開啟時先卸載格線 */}
      {cstoreView ? (
        <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col overflow-hidden">
          {isPrintOpen ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">列印設定中…</div>
          ) : (
            <Wbase1010CstoreGrid
              key={cstoreGridEpoch}
              rows={cstoreRows}
              onRowsChange={setCstoreRows}
              onSaveRow={saveCstoreRow}
              onInsertRow={addCstoreRow}
              onDeleteRow={askDeleteCstore}
              onSelectRow={(row) => setCstoreSelectedKey(row?._key)}
              onPickAddr={onPickAddr}
              onExit={() => void closeCstore()}
              activeRowKey={cstoreFocusKey}
              enterDirection={cstoreDirection}
            />
          )}
        </div>
      ) : (
        <Wbase1010Form
          form={form}
          dirty={isDirty()}
          onChange={setField}
          onOpenAddr={() => setPicker({ kind: 'officeAddr' })}
          onSave={() => void saveOfficeForm()}
          focusRequest={focusRequest}
        />
      )}

      <KeyHintBar
        keys={
          cstoreView
            ? [
                { key: 'F5', label: '轉入預設', onClick: transferToOffice },
                { key: 'Ins', label: '新增', onClick: addCstoreRow },
                { key: 'Del', label: '刪除' },
                { key: 'F4', label: '列印', onClick: () => void openPrint() },
                { key: 'F8', label: '尋找', onClick: () => setPicker({ kind: 'cstoreSearch' }) },
                { key: 'F12', label: '方向', onClick: toggleDirection },
                { key: 'Esc', label: '離開', onClick: () => void closeCstore(), danger: true },
              ]
            : [
                { key: 'F2', label: '地址選單', onClick: () => setPicker({ kind: 'officeAddr' }) },
                { key: 'F4', label: '事務所資料', onClick: () => void openCstore() },
                { key: 'F8', label: '確定', onClick: () => void saveOfficeForm() },
                { key: 'Esc', label: '離開', onClick: leave, danger: true },
              ]
        }
      />

      {/* 預設事務所地址選單 (VFP f2.Click → w_getaddr) */}
      <AddressSelectModal
        isOpen={officeAddrOpen}
        initialValue={form.addr}
        onClose={() => {
          setPicker(null);
          requestFocus('addr');
        }}
        onConfirm={(addr) => {
          setField('addr', truncateBig5(addr, OFFICE_BYTES.addr));
          setPicker(null);
          requestFocus('addr');
        }}
      />

      {/* 事務所資料格線的地址選單 (VFP wbase1010f4 f2.Click) */}
      <AddressSelectModal
        isOpen={cstoreAddr !== null}
        initialValue={cstoreAddr?.value ?? ''}
        onClose={() => pickCstoreAddr(null)}
        onConfirm={(addr) => pickCstoreAddr(addr)}
      />

      {/* F8 尋找 (VFP _form_find) */}
      <SearchModal
        isOpen={picker?.kind === 'cstoreSearch'}
        title="事務所資料尋找 [F8]"
        onSearch={searchCstore}
        onSelect={(item) => {
          setPicker(null);
          locateCstore(item.code);
        }}
        onClose={() => setPicker(null)}
      />

      {/* F4 列印 (VFP wbase1010f41) */}
      {cstoreView && isPrintOpen && (
        <Wbase1010_cstore_print rows={cstoreRows.filter((r) => r.origNo)} onClose={closePrint} />
      )}

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
            <p className="mt-2 text-sm font-bold leading-relaxed">{c.question} Y/N?</p>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => runConfirm(false)}
                className="rounded bg-gray-200 px-4 py-1.5 text-sm font-bold text-slate-800 hover:bg-gray-300"
              >
                否 (N)
              </button>
              <button
                type="button"
                onClick={() => runConfirm(true)}
                className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-600"
              >
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

export default Wbase1010Page;
