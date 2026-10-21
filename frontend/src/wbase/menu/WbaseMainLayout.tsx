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
      className={`w-full h-full min-h-0 flex-1 flex flex-col select-none transition-colors duration-300 ${
        isDark ? 'bg-slate-900' : 'bg-slate-100'
      }`}
    >
      {/* Top Title Bar */}
      <header
        className={`shrink-0 px-2.5 sm:px-5 py-1.5 sm:py-2.5 flex items-center justify-between gap-2 transition-colors duration-300 ${
          isDark
            ? 'bg-slate-950 border-b border-slate-700/50 shadow-md'
            : 'bg-white border-b-2 border-slate-200/90 shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg sm:rounded-xl shadow-md shadow-indigo-600/20 shrink-0">
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1
              className={`text-sm sm:text-base font-black tracking-wide truncate whitespace-nowrap transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              WBASE 基本資料管理系統
            </h1>
            <p
              className={`hidden sm:block text-xs font-semibold truncate whitespace-nowrap transition-colors duration-300 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Wx3000 雲端會計系統 • 三階功能選單
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs font-semibold shrink-0 whitespace-nowrap">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 transition-all duration-200 whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:text-amber-300'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 shadow-2xs font-bold'
            }`}
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span>淺色</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span>深色</span>
              </>
            )}
          </button>

          <div
            className={`hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-colors duration-200 whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-400'
                : 'bg-white border-slate-300 text-slate-800 shadow-2xs'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>PostgreSQL a3000</span>
          </div>
          <div
            className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-colors duration-200 whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-400'
                : 'bg-white border-slate-300 text-slate-800 shadow-2xs'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>最高管理者</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>

      {/* Bottom Status Bar */}
      <WbaseStatusBar />
    </div>
  );
};
