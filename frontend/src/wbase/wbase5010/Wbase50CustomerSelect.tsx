import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import { MessageDialog, type MessageState } from '../wbase2030/Wbase2030Dialogs';
import { Wbase5070RangeModal } from '../wbase5070/Wbase5070RangeModal';
import type { LabelCustomerItem } from './services/wbase5010';
import { isCustomerChosen, toCopies, type CustomerSelectMode } from './wbase50Shared';

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

interface Wbase50CustomerSelectProps {
  mode: CustomerSelectMode;
  rows: LabelCustomerItem[];
  /** 傳 useState 的 setter：連續快速按鍵時以函式更新，不會蓋掉前一次的切換 */
  onRowsChange: React.Dispatch<React.SetStateAction<LabelCustomerItem[]>>;
  loading: boolean;
  error?: string | null;
  gridId: string;
  /** 下方說明文字 */
  hint: string;
  /** Esc 離開選擇客戶 */
  onExit: () => void;
}

/**
 * 第一段「選擇客戶」(與 wbase5070 相同的操作方式)。
 * select：Enter 選擇/取消並移到下一列、F3 全選、F4 全不選、F2 指定客戶、F7 查詢、F8 或 Space 區間選擇、Esc 離開。
 * copies：列印份數欄 Enter 或直接打數字修改份數、Space 份數 0/1 切換並移到下一列、F3 全部 1 份、F4 全部 0 份、
 *         F7 查詢、F8 區間 (區間內設為 1 份)、Esc 離開。
 */
export const Wbase50CustomerSelect: React.FC<Wbase50CustomerSelectProps> = ({
  mode,
  rows,
  onRowsChange,
  loading,
  error,
  gridId,
  hint,
  onExit,
}) => {
  const { isDark } = useTheme();
  /** 目前列 (FoxProGridV2 onSelectRow 回報；Enter / Space 切換後先自行往下一列，連按時不會重複切換同一列) */
  const cursorRef = useRef(0);
  const [locate, setLocate] = useState<{ no: string; seq: number } | null>(null);
  const [modal, setModal] = useState<'range' | 'find' | 'assign' | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);

  // 讀取失敗時顯示一次訊息
  useEffect(() => {
    if (error) setMessage({ type: 'error', title: '錯誤', lines: [`讀取客戶資料失敗：${error}`] });
  }, [error]);

  const chosenCount = useMemo(() => rows.filter((r) => isCustomerChosen(r, mode)).length, [rows, mode]);
  const totalCopies = useMemo(() => rows.reduce((sum, r) => sum + toCopies(r.prn), 0), [rows]);

  /** 設定某列為選擇 / 未選擇 (copies 模式：選擇 = 1 份，未選擇 = 0 份) */
  const withChoice = useCallback(
    (row: LabelCustomerItem, chosen: boolean): LabelCustomerItem =>
      mode === 'copies' ? { ...row, prn: chosen ? 1 : 0, selected: chosen } : { ...row, selected: chosen },
    [mode]
  );

  const toggle = useCallback(
    (idx: number) => {
      onRowsChange((prev) => prev.map((r, i) => (i === idx ? withChoice(r, !isCustomerChosen(r, mode)) : r)));
    },
    [onRowsChange, withChoice, mode]
  );
  const chooseAll = (chosen: boolean) => onRowsChange((prev) => prev.map((r) => withChoice(r, chosen)));

  /** 把格線游標移到指定客戶 (FoxProGridV2 activeRowKey；每次定位換一個 seq，同一家客戶也能重複定位) */
  const moveTo = (no: string) => setLocate((prev) => ({ no, seq: (prev?.seq ?? 0) + 1 }));
  const getRowKey = useCallback((row: LabelCustomerItem) => `${row.no}\u0001${locate?.seq ?? 0}`, [locate?.seq]);
  const activeRowKey = locate ? `${locate.no}\u0001${locate.seq}` : undefined;

  /** VFP enter.Click / space.Click：切換後移到下一列 (末筆停在末筆)。以 ↓ 交給 FoxProGridV2 移動游標 */
  const toggleAndNext = () => {
    if (rows.length === 0) return;
    const idx = Math.min(cursorRef.current, rows.length - 1);
    toggle(idx);
    cursorRef.current = Math.min(idx + 1, rows.length - 1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  };

  /** VFP f8.Click (wbase4001 / wbase201202)：區間內設為選擇，區間外不變 */
  const applyRange = (startNo: string, endNo: string) => {
    setModal(null);
    onRowsChange((prev) =>
      prev.map((r) => {
        const no = r.no.toUpperCase();
        const inRange = (!startNo || no >= startNo) && (!endNo || no <= endNo);
        return inRange ? withChoice(r, true) : r;
      })
    );
  };

  /** VFP F2 (sele9 客戶選單)：選到的客戶設為選擇並移到該列；已選擇時提示「客戶已經選擇!!」 */
  const assign = (item: SearchItem) => {
    setModal(null);
    const idx = rows.findIndex((r) => r.no === item.code);
    if (idx < 0) return;
    moveTo(item.code);
    if (isCustomerChosen(rows[idx], mode)) {
      setMessage({ type: 'warning', title: '訊息', lines: ['客戶已經選擇!!'] });
      return;
    }
    onRowsChange((prev) => prev.map((r) => (r.no === item.code ? withChoice(r, true) : r)));
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
      .map((r) => ({ code: r.no, name: isCustomerChosen(r, mode) ? `→ ${r.name}` : r.name }));
  };

  // select 模式 Enter / Space 都由頁面處理；copies 模式 Enter 交給格線編輯份數，Space 切換 0/1 份
  const keyActions: Record<string, () => void> =
    mode === 'select'
      ? {
          Enter: toggleAndNext,
          ' ': () => setModal('range'),
          F8: () => setModal('range'),
          F3: () => chooseAll(true),
          F4: () => chooseAll(false),
          F2: () => setModal('assign'),
          F7: () => setModal('find'),
          Escape: onExit,
        }
      : {
          ' ': toggleAndNext,
          F8: () => setModal('range'),
          F3: () => chooseAll(true),
          F4: () => chooseAll(false),
          F7: () => setModal('find'),
          Escape: onExit,
        };
  const keyActionsRef = useRef(keyActions);
  keyActionsRef.current = keyActions;

  const blocked = loading || modal !== null || message !== null;

  // 按鍵在 capture 階段攔截，維持 VFP 的配置 (FoxProGridV2 自己也聽 F3 / F7 / Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      if (blocked) return; // 子視窗自己處理按鍵
      // 格線正在編輯份數時 (焦點在格線的輸入框)，按鍵交給格線
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      const action = keyActionsRef.current[e.key];
      if (!action || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [blocked]);

  const selectColumn: ColumnDefV2<LabelCustomerItem> = {
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
  };
  const copiesColumn: ColumnDefV2<LabelCustomerItem> = {
    key: 'prn',
    label: '列印份數',
    width: '100px',
    align: 'right',
    editable: true,
    digitOnly: true,
    maxLength: 2,
    renderCell: (val) => <span className="block w-full pr-2 text-right">{toCopies(val) > 0 ? String(toCopies(val)) : ''}</span>,
  };
  const columns: ColumnDefV2<LabelCustomerItem>[] = [
    mode === 'copies' ? copiesColumn : selectColumn,
    { key: 'no', label: '公司編號', width: '130px', editable: false },
    { key: 'name', label: '公  司  名  稱', width: '460px', editable: false },
  ];

  /** 格線修改份數後：份數轉成數字，份數大於 0 的同時設為選擇 (VFP Text1.LostFocus) */
  const handleGridRowsChange = (next: LabelCustomerItem[]) => {
    if (mode !== 'copies') {
      onRowsChange(next);
      return;
    }
    onRowsChange(next.map((r) => ({ ...r, prn: toCopies(r.prn), selected: toCopies(r.prn) > 0 })));
  };

  const actionButton = (key: string, label: string, onClick: () => void) => (
    <button
      key={key}
      type="button"
      tabIndex={-1}
      onClick={() => !blocked && onClick()}
      className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
    >
      <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">{key}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col overflow-hidden">
        <FoxProGridV2<LabelCustomerItem>
          rows={rows}
          columns={columns}
          createEmptyRow={() => ({
            no: '',
            abbr: '',
            name: '',
            unino: '',
            hname: '',
            linkman: '',
            tel: '',
            addr: '',
            invaddr: '',
            prn: 0,
            selected: false,
          })}
          onRowsChange={handleGridRowsChange}
          onSelectRow={(_row, idx) => {
            cursorRef.current = idx;
          }}
          getRowKey={getRowKey}
          activeRowKey={activeRowKey}
          allowInsert={false}
          // copies：份數輸入完 Enter 往下一列 (VFP 公司編號、名稱欄不停格)
          enterDirection={mode === 'copies' ? 'down' : undefined}
          height="100%"
          gridId={gridId}
          statusBarInfo={
            <span>
              已選擇 <span className="text-yellow-300">{chosenCount}</span> 家
              {mode === 'copies' && (
                <>
                  ，共 <span className="text-yellow-300">{totalCopies}</span> 份
                </>
              )}
              {loading ? '　讀取中…' : ''}
            </span>
          }
          customActions={
            mode === 'select' ? (
              <>
                {actionButton('Enter', '選擇', toggleAndNext)}
                {actionButton('F3', '全選', () => chooseAll(true))}
                {actionButton('F4', '全不選', () => chooseAll(false))}
                {actionButton('F2', '指定', () => setModal('assign'))}
                {actionButton('F7', '查詢', () => setModal('find'))}
                {actionButton('F8', '區間選擇', () => setModal('range'))}
              </>
            ) : (
              <>
                {actionButton('Space', '選擇', toggleAndNext)}
                {actionButton('F3', '全選', () => chooseAll(true))}
                {actionButton('F4', '全不選', () => chooseAll(false))}
                {actionButton('F7', '查詢', () => setModal('find'))}
                {actionButton('F8', '區間選擇', () => setModal('range'))}
              </>
            )
          }
          onExit={() => !blocked && onExit()}
          escLabel="離開 (進入列印條件)"
        />
      </div>
      <div className={`px-4 pb-2 text-sm font-bold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>{hint}</div>

      {modal === 'range' && <Wbase5070RangeModal customers={rows} onConfirm={applyRange} onCancel={() => setModal(null)} />}

      <SearchModal
        isOpen={modal === 'assign' || modal === 'find'}
        title={modal === 'assign' ? '客戶基本資料選單 (選擇客戶)' : '查詢客戶'}
        onSearch={searchCustomers}
        onSelect={(item) => (modal === 'assign' ? assign(item) : find(item))}
        onClose={() => setModal(null)}
      />

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
