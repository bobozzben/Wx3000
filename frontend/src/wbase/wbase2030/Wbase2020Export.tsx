import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { KeyHintBar } from '../wbase2040/KeyHintBar';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  exportCustbak,
  fetchCustbakCustomers,
  saveBase64File,
  type CustbakCustomer,
} from '../../services/wbase2030';
import { CustomerSelectGrid, type SelectColumn } from './CustomerSelectGrid';
import { AssignCustomerModal } from './AssignCustomerModal';
import { MessageDialog, type MessageState } from './Wbase2030Dialogs';
import { Toast } from './Toast';
import { useToast } from './useToast';

interface Wbase2020ExportProps {
  password: string;
  onBackToMenu?: () => void;
}

const COLUMNS: SelectColumn<CustbakCustomer>[] = [
  { key: 'no', label: '代號', width: '157px' },
  { key: 'name', label: '名稱', width: '340px' },
  { key: 'unino', label: '統一編號', width: '125px' },
];

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

/**
 * 2-2 客戶資料匯出 (VFP wbase2020)：勾選客戶後 F8 產生 custbak.dbf 並下載。
 * 與 VFP 的差異：一開始全部未勾選 (不讀 customer.sel)、未勾選不能匯出、失敗時留在畫面可重試
 */
export const Wbase2020Export: React.FC<Wbase2020ExportProps> = ({ password, onBackToMenu }) => {
  const { isDark } = useTheme();
  const [rows, setRows] = useState<CustbakCustomer[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'assign' | 'search' | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);
  const { toast, showToast, clearToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetchCustbakCustomers()
      .then((list) => !cancelled && setRows(list.map((c) => ({ ...c, selected: false }))))
      .catch((err) => !cancelled && setMessage({ type: 'error', title: '錯誤', lines: [apiErrorMessage(err, '讀取客戶資料失敗')] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows]);

  const toggle = useCallback((idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }, []);
  const selectAll = (selected: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selected })));

  const assign = (no: string) => {
    const idx = rows.findIndex((r) => r.no === no);
    if (idx < 0) return false;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: true } : r)));
    setCursor(idx);
    return true;
  };

  const runExport = async () => {
    const nos = rows.filter((r) => r.selected).map((r) => r.no);
    if (nos.length === 0) {
      showToast('請先選擇要匯出的客戶 (Space 勾選、F3 全選、F6 指定)', 'warning');
      return;
    }
    setBusy(true);
    try {
      const result = await exportCustbak(password, nos);
      saveBase64File(result.fileName, result.content);
      const lines = [`已匯出 ${result.count} 筆客戶資料，檔名 ${result.fileName}。`, '請將下載的檔案複製到要匯入的電腦，在 2-3 客戶資料匯入選擇此檔。'];
      if (result.missing.length > 0) lines.push(`以下 ${result.missing.length} 筆在地端資料檔中已找不到，未匯出：${result.missing.join(', ')}`);
      setMessage({ type: 'success', title: '匯出完成', lines, onClose: onBackToMenu });
    } catch (err) {
      setMessage({ type: 'error', title: '匯出失敗', lines: [apiErrorMessage(err, '匯出客戶資料失敗')] });
    } finally {
      setBusy(false);
    }
  };

  const keyActions: Record<string, () => void> = {
    F3: () => selectAll(true),
    F4: () => selectAll(false),
    F6: () => setModal('assign'),
    F8: () => runExport(),
    F9: () => setModal('search'),
    Escape: () => onBackToMenu?.(),
  };
  const keyActionsRef = useRef(keyActions);
  keyActionsRef.current = keyActions;

  const dialogOpen = modal !== null || message !== null;
  const blocked = dialogOpen || busy || loading;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault(); // 防止瀏覽器 F5 重新整理等預設動作
      if (dialogOpen) return; // 子視窗自己處理按鍵
      const action = keyActionsRef.current[e.key];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (busy || loading) return;
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialogOpen, busy, loading]);

  const searchRows = async (query: string): Promise<SearchItem[]> => {
    const kw = query.trim().toLowerCase();
    return rows
      .filter((r) => !kw || r.no.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw))
      .map((r) => ({ code: r.no, name: r.name }));
  };

  return (
    <>
      <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col gap-2 overflow-hidden">
        <CustomerSelectGrid
          rows={rows}
          columns={COLUMNS}
          isSelected={(r) => r.selected}
          cursor={cursor}
          onCursorChange={setCursor}
          onToggle={toggle}
          active={!blocked}
          emptyText={loading ? '讀取中…' : '查無客戶資料'}
        />
        <div className="flex items-center justify-between px-1 text-sm font-bold">
          <span className={isDark ? 'text-sky-300' : 'text-blue-700'}>{busy ? '匯出中…' : '勾選要匯出的客戶後按 F8 匯出資料'}</span>
          <span>
            勾選 <span className="text-red-600">{selectedCount}</span> / {rows.length} 筆
          </span>
        </div>
      </div>

      <KeyHintBar
        keys={[
          { key: 'Space', label: '選擇', onClick: blocked ? undefined : () => { toggle(cursor); setCursor((c) => Math.min(rows.length - 1, c + 1)); } },
          { key: 'F3', label: '全選', onClick: blocked ? undefined : keyActions.F3 },
          { key: 'F4', label: '全不選', onClick: blocked ? undefined : keyActions.F4 },
          { key: 'F6', label: '編號', onClick: blocked ? undefined : keyActions.F6 },
          { key: 'F9', label: '查詢', onClick: blocked ? undefined : keyActions.F9 },
          { key: 'F8', label: '匯出資料', onClick: blocked ? undefined : keyActions.F8 },
          { key: 'Esc', label: '離開', onClick: onBackToMenu, danger: true },
        ]}
      />

      {modal === 'assign' && <AssignCustomerModal customers={rows} onAssign={assign} onClose={() => setModal(null)} />}

      <SearchModal
        isOpen={modal === 'search'}
        title="查詢客戶"
        onSearch={searchRows}
        onSelect={(item) => {
          // VFP _form_find：只移動游標，不勾選
          const idx = rows.findIndex((r) => r.no === item.code);
          if (idx >= 0) setCursor(idx);
          setModal(null);
        }}
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

      <Toast toast={toast} onClose={clearToast} />
    </>
  );
};
