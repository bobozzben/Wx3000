import React from 'react';
import { WbaseStatusBar } from './WbaseStatusBar';
import { Monitor, HardDrive, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface WbaseMainLayoutProps {
  children: React.ReactNode;
}

export const WbaseMainLayout: React.FC<WbaseMainLayoutProps> = ({ children }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      className={`w-full min-h-screen flex flex-col select-none transition-colors duration-300 ${
        isDark ? 'bg-slate-900' : 'bg-[#F8FAFC]'
      }`}
    >
      {/* Top Title Bar */}
      <header
        className={`px-5 py-2.5 flex items-center justify-between transition-colors duration-300 ${
          isDark
            ? 'bg-slate-950 border-b border-slate-700/50 shadow-md'
            : 'bg-white border-b border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1
              className={`text-base font-bold tracking-wide transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              WBASE 基本資料管理系統
            </h1>
            <p
              className={`text-xs font-medium transition-colors duration-300 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              Wx3000 雲端會計系統 • 三階功能選單
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-medium">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:text-amber-300'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-2xs'
            }`}
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span>淺色</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>深色</span>
              </>
            )}
          </button>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-colors duration-200 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-400'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
            <span>PostgreSQL a3000</span>
          </div>
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-colors duration-200 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-400'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>最高管理者</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>

      {/* Bottom Status Bar */}
      <WbaseStatusBar />
    </div>
  );
};
