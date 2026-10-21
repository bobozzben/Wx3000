import React from 'react';
import { WbaseStatusBar } from './WbaseStatusBar';
import { useTheme } from './ThemeContext';

interface WbaseMainLayoutProps {
  children: React.ReactNode;
}

export const WbaseMainLayout: React.FC<WbaseMainLayoutProps> = ({ children }) => {
  const { isDark } = useTheme();

  return (
    <div
      className={`w-full h-full min-h-0 flex-1 flex flex-col select-none transition-colors duration-300 ${
        isDark ? 'bg-slate-900' : 'bg-slate-100'
      }`}
    >
      {/* Main Content Area (頂部標題列已與全域第一列導覽列合併) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>

      {/* Bottom Status Bar */}
      <WbaseStatusBar />
    </div>
  );
};
