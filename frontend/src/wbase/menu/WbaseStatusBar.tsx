import React, { useState, useEffect } from 'react';
import { User, Building, Keyboard, Calendar } from 'lucide-react';
import { useTheme } from './ThemeContext';

export const WbaseStatusBar: React.FC = () => {
  const { isDark } = useTheme();
  const currentUser = '管理者';
  const companyName = 'Wx3000 會計事務所';
  const keyboardHint = '↑↓ 導覽 · Enter 展開/執行 · Esc 返回';

  const [nowText, setNowText] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowText(
        now.toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) +
          ' ' +
          now.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer
      className={`text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none transition-colors duration-300 ${
        isDark
          ? 'bg-slate-950 border-t border-slate-700/50 text-slate-400'
          : 'bg-sky-100 border-t border-sky-300 text-blue-950 font-medium'
      }`}
    >
      {/* Left: User & Company */}
      <div className="flex items-center space-x-3">
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-colors duration-300 ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/50'
              : 'bg-sky-200/70 border-sky-300'
          }`}
        >
          <User className="w-3 h-3 text-indigo-500" />
          <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-blue-950'}`}>
            {currentUser}
          </span>
        </div>
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-colors duration-300 ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/50'
              : 'bg-sky-200/70 border-sky-300'
          }`}
        >
          <Building className="w-3 h-3 text-emerald-600" />
          <span className={isDark ? 'text-slate-400' : 'text-blue-900'}>{companyName}</span>
        </div>
      </div>

      {/* Center: Keyboard hints */}
      <div
        className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border transition-colors duration-300 ${
          isDark
            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
            : 'bg-blue-600 text-white border-blue-700 font-bold shadow-sm'
        }`}
      >
        <Keyboard className="w-3 h-3" />
        <span className="font-medium">{keyboardHint}</span>
      </div>

      {/* Right: Date & Time */}
      <div className="flex items-center space-x-1.5">
        <Calendar className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-blue-700'}`} />
        <span className="font-mono tabular-nums">{nowText}</span>
      </div>
    </footer>
  );
};
