import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

export interface MessageState {
  type: 'success' | 'error' | 'warning';
  title: string;
  lines: string[];
  /** 關閉後要做的事，例如回選單 (VFP 匯出、匯入完成後關閉畫面) */
  onClose?: () => void;
}

const ICONS = {
  success: <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />,
  error: <XCircle className="h-8 w-8 shrink-0 text-red-500" />,
  warning: <AlertTriangle className="h-8 w-8 shrink-0 text-amber-500" />,
};

/** 訊息視窗 (VFP messagebox)：Enter 或 Esc 關閉 */
export const MessageDialog: React.FC<{ message: MessageState; onDismiss: () => void }> = ({ message, onDismiss }) => {
  const { isDark } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full max-w-lg rounded-lg border-2 p-6 shadow-2xl ${
          isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-blue-900 text-slate-800'
        }`}
      >
        <div className="mb-3 flex items-center gap-3">
          {ICONS[message.type]}
          <h3 className="text-lg font-bold">{message.title}</h3>
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto font-mono text-sm leading-relaxed">
          {message.lines.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap break-all">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onDismiss} className="rounded bg-blue-800 px-5 py-1.5 text-sm font-bold text-white hover:bg-blue-700">
            確定 (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

/** 確認視窗：Y / Enter 確定，N / Esc 取消 */
export const ConfirmDialog: React.FC<{ title: string; lines: string[]; onYes: () => void; onNo: () => void }> = ({ title, lines, onYes, onNo }) => {
  const { isDark } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const yes = e.key === 'y' || e.key === 'Y' || e.key === 'Enter';
      const no = e.key === 'n' || e.key === 'N' || e.key === 'Escape';
      if (!yes && !no) return;
      e.preventDefault();
      e.stopPropagation();
      if (yes) onYes();
      else onNo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onYes, onNo]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div
        className={`w-full max-w-lg rounded-lg border-2 p-6 shadow-2xl ${
          isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-600 text-slate-800'
        }`}
      >
        <div className="mb-3 flex items-center gap-3 text-red-500">
          <AlertTriangle className="h-8 w-8 shrink-0" />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <div className="space-y-1 text-sm leading-relaxed">
          {lines.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap break-all">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onNo} className="rounded bg-gray-200 px-4 py-1.5 text-sm font-bold text-slate-800 hover:bg-gray-300">
            否 (N)
          </button>
          <button onClick={onYes} className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-600">
            是 (Y)
          </button>
        </div>
      </div>
    </div>
  );
};
