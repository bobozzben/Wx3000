import React, { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface TransferPasswordModalProps {
  checking: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

/**
 * 轉檔列印密碼 (VFP w_get_password_2 的 _form_pass：標籤「轉檔列印」、10 碼)。
 * 只收集輸入送給後端比對，前端不做任何比對。Enter 確定、Esc 放棄
 */
export const TransferPasswordModal: React.FC<TransferPasswordModalProps> = ({ checking, onConfirm, onCancel }) => {
  const { isDark } = useTheme();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 讀輸入框本身的值：快速盲打時 Enter 可能比最後一個字的 state 更新先到
      if (!checking) onConfirm(inputRef.current?.value ?? value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!checking) onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full max-w-sm overflow-hidden rounded-lg border-2 shadow-2xl ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-blue-900 text-slate-900'
        }`}
      >
        <div className={`flex items-center gap-2 px-4 py-3 text-white ${isDark ? 'bg-slate-950' : 'bg-blue-900'}`}>
          <KeyRound className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-bold">請輸入密碼</h3>
        </div>
        <div className="flex items-center gap-3 p-5 font-mono">
          <label htmlFor="wbase2030-password" className="shrink-0 font-bold">
            轉檔列印
          </label>
          <input
            id="wbase2030-password"
            ref={inputRef}
            type="password"
            maxLength={10}
            autoComplete="off"
            value={value}
            disabled={checking}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className={`w-full rounded border-2 px-3 py-2 text-base focus:outline-none ${
              isDark
                ? 'bg-slate-950 border-blue-500 text-yellow-300 focus:border-yellow-400'
                : 'bg-yellow-50 border-blue-600 text-slate-900 focus:border-yellow-500'
            }`}
          />
        </div>
        <div
          className={`flex justify-between border-t px-4 py-2 text-xs font-mono ${
            isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-gray-100 border-gray-200 text-gray-600'
          }`}
        >
          <span>{checking ? '檢查中…' : '[Enter] 確定'}</span>
          <span>[Esc] 放棄</span>
        </div>
      </div>
    </div>
  );
};
