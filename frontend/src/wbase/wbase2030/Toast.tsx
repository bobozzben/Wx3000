import React from 'react';
import type { ToastState } from './useToast';

/** 非阻斷提示，點一下或數秒後消失 (同 2-4 收費資料輸入) */
export const Toast: React.FC<{ toast: ToastState | null; onClose: () => void }> = ({ toast, onClose }) =>
  toast ? (
    <div
      className={`fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 rounded-lg border-2 px-4 py-2 text-sm font-bold shadow-xl ${
        toast.type === 'error'
          ? 'border-red-500 bg-red-50 text-red-700'
          : toast.type === 'warning'
            ? 'border-amber-500 bg-amber-50 text-amber-800'
            : 'border-emerald-500 bg-emerald-50 text-emerald-800'
      }`}
      onClick={onClose}
    >
      {toast.message}
    </div>
  ) : null;
