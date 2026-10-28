import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useTheme } from '../wbase/menu/ThemeContext';

export interface WbasePageHeaderProps {
  /** Return to main menu callback */
  onBackToMenu?: () => void;
  /** Back button label (default: '返回主選單') */
  backLabel?: string;
  /** Category breadcrumb (e.g., '事務所資料', '客戶資料', '發票統購') */
  category?: string;
  /** Module icon component or element */
  icon?: React.ReactNode;
  /** Module title (e.g., '1-2 會計師/記帳士資料維護') */
  title: string;
  /** Module code (e.g., 'wbase1020') */
  code?: string;
  /** Current operating mode (e.g., 'grid' | 'edit' | 'add' or string) */
  mode?: 'grid' | 'edit' | 'add' | string;
  /** Custom mode label */
  modeLabel?: string;
  /** Selected record indicator text or node (e.g., '選取：[02] 記帳士 BBB') */
  selectedInfo?: React.ReactNode;
  /** Search button click handler */
  onSearch?: () => void;
  /** Search button label (default: '查詢 F2') */
  searchLabel?: string;
  /** Custom action buttons or elements on the right */
  actions?: React.ReactNode;
  /** Additional custom elements or children */
  children?: React.ReactNode;
}

export const WbasePageHeader: React.FC<WbasePageHeaderProps> = ({
  onBackToMenu,
  backLabel = '返回主選單',
  category,
  icon,
  title,
  code,
  mode,
  modeLabel,
  selectedInfo,
  onSearch,
  searchLabel = '查詢 F2',
  actions,
  children,
}) => {
  const { isDark } = useTheme();

  return (
    <div
      className={`shrink-0 px-3 sm:px-5 py-2 border-b flex items-center justify-between gap-2 shadow-xs transition-colors z-20 ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-white'
          : 'bg-white border-b-2 border-slate-200 text-slate-900'
      }`}
    >
      {/* Left: Back button + Divider + Icon + Breadcrumb & Title + Code + Mode */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
        {onBackToMenu && (
          <button
            type="button"
            onClick={onBackToMenu}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition-all shrink-0 cursor-pointer text-xs"
            title="返回主選單 (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
        )}

        {onBackToMenu && (
          <span className={`shrink-0 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>|</span>
        )}

        {icon && (
          <div className="p-1.5 bg-yellow-400 text-black rounded font-bold shadow-2xs shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}

        <div className="flex items-center space-x-1.5 min-w-0 truncate">
          {category && (
            <span className="hidden md:inline text-xs text-slate-400 font-semibold shrink-0">
              {category} /
            </span>
          )}
          <h1 className="text-sm sm:text-base font-black tracking-wider truncate">
            {title}
          </h1>
          {code && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-800 text-white font-mono font-bold shrink-0">
              {code}
            </span>
          )}
        </div>

        {/* Mode Badge */}
        {mode && (
          <div className="hidden sm:flex items-center ml-1 sm:ml-2 shrink-0">
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full border font-bold ${
                mode === 'grid'
                  ? isDark
                    ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                  : isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              {modeLabel ||
                (mode === 'grid'
                  ? 'GRID 瀏覽模式'
                  : mode === 'edit'
                  ? 'EDIT 編修中'
                  : 'ADD 新增中')}
            </span>
          </div>
        )}
      </div>

      {/* Right: Selected row info + Search button + Custom actions + Esc tag */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        {selectedInfo && (
          <div
            className={`hidden md:flex text-xs rounded-full px-3 py-1 border font-mono font-bold ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-yellow-300'
                : 'bg-slate-50 border-slate-200 text-blue-900'
            }`}
          >
            {selectedInfo}
          </div>
        )}

        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className={`px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold border flex items-center space-x-1.5 transition shrink-0 whitespace-nowrap cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'
                : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800 shadow-2xs'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-blue-500" />
            <span>{searchLabel}</span>
          </button>
        )}

        {actions}
        {children}

        <kbd
          className={`hidden sm:inline-block text-xs px-2.5 py-1 rounded border font-mono font-black whitespace-nowrap transition-colors ${
            isDark
              ? 'text-slate-400 bg-slate-800 border-slate-700'
              : 'text-yellow-300 bg-slate-800 border-slate-700 shadow-2xs'
          }`}
        >
          Esc 返回
        </kbd>
      </div>
    </div>
  );
};

