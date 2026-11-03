import { useCallback, useEffect, useState } from 'react';

export interface ToastState {
  message: string;
  type: 'success' | 'warning' | 'error';
}

/** 非阻斷提示的狀態，數秒後自動清除 */
export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, type: ToastState['type'] = 'warning') => setToast({ message, type }), []);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, toast.type === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return { toast, showToast, clearToast };
};
