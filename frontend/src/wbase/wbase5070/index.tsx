import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Leaf } from 'lucide-react';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import { TransferPasswordModal } from '../wbase2030/TransferPasswordModal';
import { ConfirmDialog, MessageDialog, type MessageState } from '../wbase2030/Wbase2030Dialogs';
import { KeyHintBar } from '../wbase2040/KeyHintBar';
import {
  apiErrorMessage,
  currentRocYear,
  exportCarbonExcel,
  fetchCarbonCustomers,
  fetchCarbonSales,
  isWrongPassword,
  verifyCarbonPassword,
  type CarbonCondition,
  type CarbonCustomer,
  type CarbonSalesRow,
} from '../../services/wbase5070';
import { Wbase5070RangeModal } from './Wbase5070RangeModal';
import { Wbase5070Condition, type ConditionInput } from './Wbase5070Condition';

interface Wbase5070PageProps {
  onBackToMenu?: () => void;
}

type ModalKind = 'range' | 'find' | 'assign' | 'password' | null;

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 失敗清單最多列出幾筆，其餘以「…等 n 家」帶過 */
const MAX_LISTED = 10;

/**
 * 5-7 碳健檢企業名單匯出 (VFP base50.prg wbasemenu05cmd07)。
 * 第一段「選擇客戶」(VFP wbase4000，FoxProGridV2 唯讀格線)：Enter 選擇/取消並移到下一列、F3 全選、F4 全不選、
 * F2 指定客戶、F7 查詢、F8 或 Space 區間選擇、Esc 離開並進入第二段。
 * 第二段「碳健檢企業名單匯出功能」(VFP wbase5070)：資料年度、營業起始/結束月份，F8 問轉檔列印密碼後計算各客戶
 * 401 資料檔 (t403.dbf) 的銷售額合計並匯出 Excel；Esc 放棄回主選單。
 */
export const Wbase5070Page: React.FC<Wbase5070PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();
  const [rows, setRows] = useState<CarbonCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [cursor, setCursor] = useState(0);
  const [locate, setLocate] = useState<{ no: string; seq: number } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [cond, setCond] = useState<ConditionInput>(() => ({ year: currentRocYear(), smonth: '01', emonth: '12' }));
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState<{ lines: string[]; onYes: () => void } | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCarbonCustomers()
      .then((list) => !cancelled && setRows(list.map((c) => ({ ...c, selected: false }))))
      .catch((err) => !cancelled && setMessage({ type: 'error', title: '錯誤', lines: [apiErrorMessage(err, '讀取客戶資料失敗')] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows]);

  // ---------------------------------------------------------------- 選擇客戶 (wbase4000)
  const toggle = useCallback((idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }, []);
  const selectAll = (selected: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selected })));

  /** 把格線游標移到指定客戶 (FoxProGridV2 activeRowKey；每次定位換一個 seq，同一家客戶也能重複定位) */
  const moveTo = (no: string) => setLocate((prev) => ({ no, seq: (prev?.seq ?? 0) + 1 }));
  const getRowKey = useCallback((row: CarbonCustomer) => `${row.no}\u0001${locate?.seq ?? 0}`, [locate?.seq]);
  const activeRowKey = locate ? `${locate.no}\u0001${locate.seq}` : undefined;

  /** VFP enter.Click：切換選擇後移到下一列 (末筆停在末筆)。以 ↓ 交給 FoxProGridV2 移動游標 */
  const toggleAndNext = () => {
    if (rows.length === 0) return;
    toggle(cursor);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  };

  /** VFP f8.Click (wbase4001)：區間內設為選擇，區間外不變 */
  const applyRange = (startNo: string, endNo: string) => {
    setModal(null);
    setRows((prev) =>
      prev.map((r) => {
        const no = r.no.toUpperCase();
        const inRange = (!startNo || no >= startNo) && (!endNo || no <= endNo);
        return inRange ? { ...r, selected: true } : r;
      })
    );
  };

  /** VFP F2 (sele9 客戶選單)：選到的客戶設為選擇並移到該列；已選擇時提示「客戶已經選擇!!」 */
  const assign = (item: SearchItem) => {
    setModal(null);
    const idx = rows.findIndex((r) => r.no === item.code);
    if (idx < 0) return;
    moveTo(item.code);
    if (rows[idx].selected) {
      setMessage({ type: 'warning', title: '訊息', lines: ['客戶已經選擇!!'] });
      return;
    }
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: true } : r)));
  };

  /** VFP f7.Click (_form_find)：只移動游標，不改選擇 */
  const find = (item: SearchItem) => {
    setModal(null);
    if (rows.some((r) => r.no === item.code)) moveTo(item.code);
  };

  const searchCustomers = async (query: string): Promise<SearchItem[]> => {
    const kw = query.trim().toLowerCase();
    return rows
      .filter((r) => !kw || r.no.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw))
      .map((r) => ({ code: r.no, name: r.selected ? `→ ${r.name}` : r.name }));
  };

  const selectKeyActions: Record<string, () => void> = {
    Enter: toggleAndNext,
    ' ': () => setModal('range'),
    F8: () => setModal('range'),
    F3: () => selectAll(true),
    F4: () => selectAll(false),
    F2: () => setModal('assign'),
    F7: () => setModal('find'),
    Escape: () => setPhase('condition'),
  };
  const selectKeyActionsRef = useRef(selectKeyActions);
  selectKeyActionsRef.current = selectKeyActions;

  const blocked = loading || modal !== null || message !== null || confirm !== null || progress !== null;

  // 第一段的按鍵在 capture 階段攔截，維持 VFP wbase4000 的配置 (FoxProGridV2 自己也聽 F3 / F7 / Esc)
  useEffect(() => {
    if (phase !== 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      if (blocked) return; // 子視窗自己處理按鍵
      const action = selectKeyActionsRef.current[e.key];
      if (!action || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase, blocked]);

  const columns: ColumnDefV2<CarbonCustomer>[] = [
    {
      key: 'selected',
      label: '選擇',
      width: '80px',
      align: 'center',
      editable: false,
      renderCell: (val, _row, rIdx) => (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => toggle(rIdx)}
          className="flex h-full w-full items-center justify-center text-lg font-black text-red-600"
          title="Enter 或點選切換"
        >
          {val ? '→' : ''}
        </button>
      ),
    },
    { key: 'no', label: '公司編號', width: '130px', editable: false },
    { key: 'name', label: '公  司  名  稱', width: '460px', editable: false },
  ];

  const actionButton = (key: string, label: string, onClick: () => void) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => !blocked && onClick()}
      className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
    >
      <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">{key}</span>
      <span>{label}</span>
    </button>
  );

  // ---------------------------------------------------------------- 轉出 (wbase5070 f8.Click)
  const condition = (): CarbonCondition => ({ year: cond.year.trim(), startMonth: Number(cond.smonth), endMonth: Number(cond.emonth) });
  const selectedNos = () => rows.filter((r) => r.selected).map((r) => r.no);

  /** F8：欄位已由 Wbase5070Condition 檢核；沒有選擇客戶時回到第一段，否則問轉檔列印密碼 */
  const startExport = () => {
    if (selectedCount === 0) {
      setMessage({ type: 'warning', title: '訊息', lines: ['尚未選擇任何客戶，請先選擇要匯出的客戶!'], onClose: () => setPhase('select') });
      return;
    }
    setModal('password');
  };

  const checkPassword = async (password: string) => {
    setChecking(true);
    let ok = false;
    try {
      ok = await verifyCarbonPassword(password);
    } catch (err) {
      setModal(null);
      setMessage({ type: 'error', title: '錯誤', lines: [apiErrorMessage(err, '密碼檢查失敗')] });
      return;
    } finally {
      setChecking(false);
    }
    setModal(null);
    if (!ok) {
      // VFP：密碼錯誤!，留在畫面
      setMessage({ type: 'error', title: '錯誤', lines: ['密碼錯誤!'] });
      return;
    }
    await computeAndSave(password);
  };

  const computeAndSave = async (password: string) => {
    const c = condition();
    const nos = selectedNos();
    const result = await fetchCarbonSales(password, c, nos, (done, total) => setProgress({ done, total }))
      .catch((err) => {
        setMessage({ type: 'error', title: isWrongPassword(err) ? '錯誤' : '轉出失敗', lines: [apiErrorMessage(err, '計算年度銷售額失敗')] });
        return null;
      })
      .finally(() => setProgress(null));
    if (!result) return;

    const failed = result.rows.filter((r) => r.source === 'error');
    const lines: string[] = [];
    if (failed.length > 0) {
      lines.push(`下列 ${failed.length} 家客戶的 401 資料讀取失敗，年度銷售額合計會以 0 匯出：`);
      failed.slice(0, MAX_LISTED).forEach((r) => lines.push(`  ${r.no} ${r.name}：${r.message ?? ''}`));
      if (failed.length > MAX_LISTED) lines.push(`  …等 ${failed.length} 家`);
    }
    if (result.missing.length > 0) {
      lines.push(`下列 ${result.missing.length} 家客戶已不在客戶資料中，不會匯出：${result.missing.join(', ')}`);
    }
    if (result.rows.length === 0) {
      setMessage({ type: 'error', title: '轉出失敗', lines: [...lines, '沒有可匯出的客戶。'] });
      return;
    }
    if (lines.length > 0) {
      const data = result.rows;
      setConfirm({
        lines: [...lines, '仍要匯出 Excel 嗎？'],
        onYes: () => {
          setConfirm(null);
          void save(data, c);
        },
      });
      return;
    }
    await save(result.rows, c);
  };

  const save = async (data: CarbonSalesRow[], c: CarbonCondition) => {
    try {
      const fileName = await exportCarbonExcel(data, `碳健檢企業名單_${c.year}年${pad2(c.startMonth)}-${pad2(c.endMonth)}月`);
      const noFile = data.filter((r) => r.source === 'nofile').length;
      const lines = [`已匯出 ${data.length} 家客戶，檔名 ${fileName}。`];
      if (noFile > 0) lines.push(`其中 ${noFile} 家在 ${c.year} 年度沒有 401 資料檔 (t403.dbf)，年度銷售額合計為 0。`);
      // VFP 轉出後 thisform.release 回主選單
      setMessage({ type: 'success', title: '匯出完成', lines, onClose: onBackToMenu });
    } catch (err) {
      setMessage({ type: 'error', title: '匯出失敗', lines: [apiErrorMessage(err, '產生 Excel 檔失敗')] });
    }
  };

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      <WbasePageHeader
        onBackToMenu={onBackToMenu}
        category="管理報表"
        icon={<Leaf className="w-4 h-4 text-black" />}
        title="5-7 碳健檢企業名單匯出"
        code="wbase5070"
        mode={phase === 'select' ? 'grid' : 'edit'}
        modeLabel={phase === 'select' ? '選擇客戶' : '轉出條件'}
      />

      {phase === 'select' ? (
        <>
          <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col overflow-hidden">
            <FoxProGridV2<CarbonCustomer>
              rows={rows}
              columns={columns}
              createEmptyRow={() => ({ no: '', name: '', selected: false })}
              onRowsChange={setRows}
              onSelectRow={(_row, idx) => setCursor(idx)}
              getRowKey={getRowKey}
              activeRowKey={activeRowKey}
              allowInsert={false}
              height="100%"
              gridId="wbase5070_cust_grid"
              statusBarInfo={
                <span>
                  已選擇 <span className="text-yellow-300">{selectedCount}</span> 家{loading ? '　讀取中…' : ''}
                </span>
              }
              customActions={
                <>
                  {actionButton('Enter', '選擇', toggleAndNext)}
                  {actionButton('F3', '全選', () => selectAll(true))}
                  {actionButton('F4', '全不選', () => selectAll(false))}
                  {actionButton('F2', '指定', () => setModal('assign'))}
                  {actionButton('F7', '查詢', () => setModal('find'))}
                  {actionButton('F8', '區間選擇', () => setModal('range'))}
                </>
              }
              onExit={() => !blocked && setPhase('condition')}
              escLabel="離開 (進入轉出條件)"
            />
          </div>
          <div className={`px-4 pb-2 text-sm font-bold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
            選好要匯出的客戶後按 Esc 離開，再輸入資料年度與月份區間。
          </div>
        </>
      ) : (
        <>
          <Wbase5070Condition
            value={cond}
            onChange={setCond}
            selectedCount={selectedCount}
            active={!blocked}
            onConfirm={startExport}
            onCancel={() => onBackToMenu?.()}
          />
          <KeyHintBar
            keys={[
              { key: 'Enter', label: '下一欄' },
              { key: 'F8', label: '確定 (轉出 Excel)' },
              { key: 'Esc', label: '放棄', onClick: onBackToMenu, danger: true },
            ]}
          />
        </>
      )}

      {modal === 'range' && <Wbase5070RangeModal customers={rows} onConfirm={applyRange} onCancel={() => setModal(null)} />}

      <SearchModal
        isOpen={modal === 'assign' || modal === 'find'}
        title={modal === 'assign' ? '客戶基本資料選單 (選擇客戶)' : '查詢客戶'}
        onSearch={searchCustomers}
        onSelect={(item) => (modal === 'assign' ? assign(item) : find(item))}
        onClose={() => setModal(null)}
      />

      {modal === 'password' && <TransferPasswordModal checking={checking} onConfirm={checkPassword} onCancel={() => setModal(null)} />}

      {progress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className={`w-full max-w-sm rounded-lg border-2 p-6 text-center shadow-2xl ${
              isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-blue-900 text-slate-800'
            }`}
          >
            <p className="font-bold">計算年度銷售額中…</p>
            <p className="mt-2 font-mono text-sm">
              {progress.done} / {progress.total} 家
            </p>
            <div className={`mt-3 h-2 overflow-hidden rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog title="確認匯出" lines={confirm.lines} onYes={confirm.onYes} onNo={() => setConfirm(null)} />}

      {message && (
        <MessageDialog
          message={message}
          onDismiss={() => {
            setMessage(null);
            message.onClose?.();
          }}
        />
      )}
    </div>
  );
};

export default Wbase5070Page;
