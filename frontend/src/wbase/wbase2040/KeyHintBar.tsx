import React from 'react';
import { useTheme } from '../menu/ThemeContext';

export interface KeyHint {
  key: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}

/** 底部按鍵列 (對應 VFP 表單下方的 hcmd2 按鈕)，每顆按鈕都有對應快速鍵 */
export const KeyHintBar: React.FC<{ keys: KeyHint[] }> = ({ keys }) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 border-t px-2 py-2 sm:px-4 ${
        isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-white'
      }`}
    >
      {keys.map((k) => (
        <button
          key={k.key}
          type="button"
          tabIndex={-1}
          onClick={k.onClick}
          disabled={!k.onClick}
          className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-bold transition ${
            k.danger
              ? 'border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
              : isDark
                ? 'border-slate-600 text-sky-300 hover:bg-slate-800'
                : 'border-blue-300 text-blue-800 hover:bg-blue-50'
          } ${k.onClick ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
        >
          <kbd className={`rounded px-1 font-mono ${isDark ? 'bg-slate-700 text-yellow-300' : 'bg-blue-900 text-white'}`}>{k.key}</kbd>
          {k.label}
        </button>
      ))}
    </div>
  );
};
