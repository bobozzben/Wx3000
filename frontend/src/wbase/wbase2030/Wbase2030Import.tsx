import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { KeyHintBar } from '../wbase2040/KeyHintBar';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  discardCustbakImport,
  importCustbak,
  previewCustbak,
  type CustbakPreview,
  type CustbakPreviewRow,
} from '../../services/wbase2030';
import { CustomerSelectGrid, type SelectColumn } from './CustomerSelectGrid';
import { AssignCustomerModal } from './AssignCustomerModal';
import { ConfirmDialog, MessageDialog, type MessageState } from './Wbase2030Dialogs';
import { Toast } from './Toast';
import { useToast } from './useToast';

interface Wbase2030ImportProps {
  password: string;
  onBackToMenu?: () => void;
}

type ImportRow = CustbakPreviewRow & { selected: boolean };

const COLUMNS: SelectColumn<ImportRow>[] = [
  { key: 'no', label: '代號', width: '113px' },
  { key: 'name', label: '名稱', width: '295px' },
  {
    key: 'exists',
    label: '狀態',
    width: '90px',
    align: 'center',
    render: (r) => (r.exists ? <span className="text-amber-600">覆蓋</span> : <span className="text-emerald-600">新增</span>),
  },
];

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

/**
 * 2-3 客戶資料匯入 (VFP wbase2030)：上傳 custbak.dbf，勾選客戶後 F9 依代號新增或整筆覆蓋 customer.dbf。
 * 與 VFP 的差異：customer.sel 不覆蓋；匯入前確認新增／覆蓋筆數並提示來源缺少的欄位；未勾選不能匯入；
 * 鎖定失敗逐筆列出；沒有匯入就離開時不顯示「匯入完成」
 */
export const Wbase2030Import: React.FC<Wbase2030ImportProps> = ({ password, onBackToMenu }) => {
  const { isDark } = useTheme();
  const [preview, setPreview] = useState<CustbakPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<'upload' | 'import' | null>(null);
  const [modal, setModal] = useState<'assign' | 'confirm' | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);
  const { toast, showToast, clearToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // 離開畫面時清掉後端暫存的上傳檔 (匯入成功後後端已自行刪除)
  const importIdRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (importIdRef.current) discardCustbakImport(importIdRef.current);
  }, []);

  const selected = useMemo(() => rows.filter((r) => r.selected), [rows]);

  const toggle = useCallback((idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }, []);
  const selectAll = (value: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selected: value })));

  const assign = (no: string) => {
    const idx = rows.findIndex((r) => r.no === no);
    if (idx < 0) return false;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: true } : r)));
    setCursor(idx);
    return true;
  };

  const upload = async (file: File) => {
    setBusy('upload');
    try {
      const result = await previewCustbak(password, file);
      importIdRef.current = result.importId;
      setPreview(result);
      setFileName(file.name);
      setRows(result.rows.map((r) => ({ ...r, selected: false }))); // VFP：repl all sel with ""
      setCursor(0);
      if (result.rows.length === 0) showToast('檔案中沒有客戶資料', 'warning');
    } catch (err) {
      setMessage({ type: 'error', title: '錯誤', lines: [apiErrorMessage(err, '讀取匯入檔失敗')] });
    } finally {
      setBusy(null);
    }
  };

  const askImport = () => {
    if (selected.length === 0) {
      showToast('請先選擇要匯入的客戶 (Space 勾選、F3 全選、F6 指定)', 'warning');
      return;
    }
    setModal('confirm');
  };

  const runImport = async () => {
    if (!preview) return;
    setModal(null);
    setBusy('import');
    try {
      const result = await importCustbak(password, preview.importId, selected.map((r) => r.no));
      importIdRef.current = null;
      const lines = [`新增 ${result.inserted} 筆、覆蓋 ${result.updated} 筆。`];
      if (result.failed.length > 0) {
        lines.push(`失敗 ${result.failed.length} 筆 (未寫入，可稍後再匯入一次)：`);
        result.failed.forEach((f) => lines.push(`  ${f.no}  ${f.reason}`));
      }
      if (!result.synced) lines.push('客戶資料快照稍後讀取時會自動更新。');
      setMessage({ type: result.failed.length > 0 ? 'warning' : 'success', title: '匯入完成', lines, onClose: onBackToMenu });
    } catch (err: any) {
      const lines = [apiErrorMessage(err, '匯入客戶資料失敗')];
      if (err?.response?.status === 404) {
        // 暫存的上傳檔已不存在，請使用者重新選檔
        importIdRef.current = null;
        setPreview(null);
        setRows([]);
      }
      setMessage({ type: 'error', title: '匯入失敗', lines });
    } finally {
      setBusy(null);
    }
  };

  const keyActions: Record<string, () => void> = preview
    ? {
        F3: () => selectAll(true),
        F4: () => selectAll(false),
        F6: () => setModal('assign'),
        F9: askImport,
        Escape: () => onBackToMenu?.(),
      }
    : {
        Enter: () => fileRef.current?.click(),
        Escape: () => onBackToMenu?.(),
      };
  const keyActionsRef = useRef(keyActions);
  keyActionsRef.current = keyActions;

  const dialogOpen = modal !== null || message !== null;
  const blocked = dialogOpen || busy !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (FUNCTION_KEY.test(e.key)) e.preventDefault();
      if (dialogOpen) return;
      const action = keyActionsRef.current[e.key];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      action();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialogOpen, busy]);

  const inserts = selected.filter((r) => !r.exists).length;
  const updates = selected.length - inserts;
  const confirmLines = [
    `將新增 ${inserts} 筆、覆蓋 ${updates} 筆客戶資料。`,
    '覆蓋會以匯入檔取代整筆客戶資料 (複選標記除外)，無法復原。',
    ...(preview && preview.missingFields.length > 0
      ? [`匯入檔缺少下列欄位，匯入後這些欄位會被清空：${preview.missingFields.join(', ')}`]
      : []),
    '確定匯入? (Y/N)',
  ];

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".dbf,.DBF"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload(file);
        }}
      />

      <div className="flex-1 min-h-0 p-2 sm:p-4 flex flex-col gap-2 overflow-hidden">
        {preview ? (
          <>
            {preview.missingFields.length > 0 && (
              <div className="rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                匯入檔缺少 {preview.missingFields.length} 個欄位，匯入後這些欄位會被清空：{preview.missingFields.join(', ')}
              </div>
            )}
            <CustomerSelectGrid
              rows={rows}
              columns={COLUMNS}
              isSelected={(r) => r.selected}
              cursor={cursor}
              onCursorChange={setCursor}
              onToggle={toggle}
              active={!blocked}
              emptyText="檔案中沒有客戶資料"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm font-bold">
              <span className={isDark ? 'text-sky-300' : 'text-blue-700'}>
                {busy === 'import' ? '匯入中…' : `來源：${fileName}　勾選要匯入的客戶後按 F9 匯入資料`}
              </span>
              <span>
                勾選 <span className="text-red-600">{selected.length}</span> / {rows.length} 筆 (新增 {inserts}、覆蓋 {updates})
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div
              className={`w-full max-w-lg rounded-lg border-2 p-6 text-center shadow-md ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-800'
              }`}
            >
              <FileUp className="mx-auto mb-3 h-10 w-10 text-blue-600" />
              <p className="mb-1 text-lg font-bold">選擇要匯入的 custbak.dbf</p>
              <p className={`mb-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                由 2-2 客戶資料匯出 (Wx3000 或舊版 W3000) 產生的檔案
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => fileRef.current?.click()}
                className="rounded bg-blue-800 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy === 'upload' ? '讀取中…' : '選擇檔案 (Enter)'}
              </button>
            </div>
          </div>
        )}
      </div>

      <KeyHintBar
        keys={
          preview
            ? [
                { key: 'Space', label: '選擇', onClick: blocked ? undefined : () => { toggle(cursor); setCursor((c) => Math.min(rows.length - 1, c + 1)); } },
                { key: 'F3', label: '全選', onClick: blocked ? undefined : keyActions.F3 },
                { key: 'F4', label: '全不選', onClick: blocked ? undefined : keyActions.F4 },
                { key: 'F6', label: '指定客戶', onClick: blocked ? undefined : keyActions.F6 },
                { key: 'F9', label: '匯入資料', onClick: blocked ? undefined : keyActions.F9 },
                { key: 'Esc', label: '離開', onClick: onBackToMenu, danger: true },
              ]
            : [
                { key: 'Enter', label: '選擇檔案', onClick: blocked ? undefined : keyActions.Enter },
                { key: 'Esc', label: '離開', onClick: onBackToMenu, danger: true },
              ]
        }
      />

      {modal === 'assign' && <AssignCustomerModal customers={rows} onAssign={assign} onClose={() => setModal(null)} />}

      {modal === 'confirm' && <ConfirmDialog title="客戶資料匯入" lines={confirmLines} onYes={runImport} onNo={() => setModal(null)} />}

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
