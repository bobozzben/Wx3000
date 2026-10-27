import React from 'react';
import type { SubsystemItem } from './types';
import { Info, ChevronRight } from 'lucide-react';
import { useTheme } from '../wbase/menu/ThemeContext';

interface MainMenuButtonProps {
  item: SubsystemItem;
  onClick: (item: SubsystemItem) => void;
  onInfoClick: (item: SubsystemItem) => void;
}

export const MainMenuButton: React.FC<MainMenuButtonProps> = ({ item, onClick, onInfoClick }) => {
  const { isDark } = useTheme();

  if (item.isEmptySlot) {
    return (
      <div className="py-0.5 px-1.5">
        <div
          className={`h-px w-full border-t border-dashed ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        />
      </div>
    );
  }

  // Extract prefix code (e.g., "1-營業稅申報系統" -> codeBadge: "1", label: "營業稅申報系統")
  const match = item.title.match(/^([A-Z0-9]+)-(.*)$/i);
  const codeBadge = match ? match[1] : item.id;
  const displayTitle = match ? match[2].replace(/\s+/g, '') : item.title;

  const getThemeAccents = () => {
    switch (item.colorTheme) {
      case 'magenta':
        return {
          badgeBg: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-500/20',
          cardBorder: isDark
            ? 'border-slate-800 hover:border-rose-500/50 bg-slate-800/50 hover:bg-slate-800/80'
            : 'border-slate-200/90 hover:border-rose-300 bg-white hover:bg-rose-50/40',
          hoverShadow: isDark
            ? 'hover:shadow-[0_2px_8px_rgba(244,63,94,0.15)]'
            : 'hover:shadow-[0_2px_8px_rgba(244,63,94,0.1)]',
          accentText: isDark ? 'group-hover:text-rose-300' : 'group-hover:text-rose-700',
        };
      case 'orange':
        return {
          badgeBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-orange-500/20',
          cardBorder: isDark
            ? 'border-slate-800 hover:border-amber-500/50 bg-slate-800/50 hover:bg-slate-800/80'
            : 'border-slate-200/90 hover:border-amber-300 bg-white hover:bg-amber-50/40',
          hoverShadow: isDark
            ? 'hover:shadow-[0_2px_8px_rgba(245,158,11,0.15)]'
            : 'hover:shadow-[0_2px_8px_rgba(245,158,11,0.1)]',
          accentText: isDark ? 'group-hover:text-amber-300' : 'group-hover:text-amber-700',
        };
      case 'green':
        return {
          badgeBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20',
          cardBorder: isDark
            ? 'border-slate-800 hover:border-emerald-500/50 bg-slate-800/50 hover:bg-slate-800/80'
            : 'border-slate-200/90 hover:border-emerald-300 bg-white hover:bg-emerald-50/40',
          hoverShadow: isDark
            ? 'hover:shadow-[0_2px_8px_rgba(16,185,129,0.15)]'
            : 'hover:shadow-[0_2px_8px_rgba(16,185,129,0.1)]',
          accentText: isDark ? 'group-hover:text-emerald-300' : 'group-hover:text-emerald-700',
        };
      case 'blue':
      default:
        return {
          badgeBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20',
          cardBorder: isDark
            ? 'border-slate-800 hover:border-blue-500/50 bg-slate-800/50 hover:bg-slate-800/80'
            : 'border-slate-200/90 hover:border-blue-300 bg-white hover:bg-blue-50/40',
          hoverShadow: isDark
            ? 'hover:shadow-[0_2px_8px_rgba(59,130,246,0.15)]'
            : 'hover:shadow-[0_2px_8px_rgba(59,130,246,0.1)]',
          accentText: isDark ? 'group-hover:text-blue-300' : 'group-hover:text-blue-700',
        };
    }
  };

  const accent = getThemeAccents();

  return (
    <div className="flex items-center gap-1 group">
      {/* Main Interactive Subsystem Button */}
      <button
        type="button"
        onClick={() => onClick(item)}
        title={item.isAvailable ? `開啟 ${item.title} (${item.code})` : `${item.title} (點擊查看模組說明)`}
        className={`flex-1 relative flex items-center justify-between h-[27px] xl:h-[28px] px-2 rounded-md border transition-all duration-100 transform active:scale-[0.99] cursor-pointer select-none ${accent.cardBorder} ${accent.hoverShadow}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Code / Shortcut Badge */}
          <span
            className={`w-[18px] h-[18px] xl:w-5 xl:h-5 rounded text-[11px] xl:text-xs font-mono font-black flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-100 group-hover:scale-105 ${accent.badgeBg}`}
          >
            {codeBadge}
          </span>

          {/* Subsystem Title - Enlarged & High-Contrast */}
          <span
            className={`font-sans font-bold text-[13.5px] xl:text-[14.5px] tracking-normal truncate transition-colors leading-none ${
              isDark ? 'text-slate-50' : 'text-slate-900'
            } ${accent.accentText}`}
          >
            {displayTitle}
          </span>
        </div>

        {/* Right Status Indicator & Arrow */}
        <div className="flex items-center gap-1 shrink-0">
          {item.isAvailable && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight border leading-none ${
                isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>已上線</span>
            </span>
          )}
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-100 group-hover:translate-x-0.5 ${
              isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
        </div>
      </button>

      {/* Info Button (i) on the right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInfoClick(item);
        }}
        title={`查看【${item.title}】功能介紹`}
        className={`w-[27px] h-[27px] xl:w-[28px] xl:h-[28px] shrink-0 rounded-md border flex items-center justify-center transition-all duration-100 cursor-pointer ${
          isDark
            ? 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-sky-300 hover:bg-slate-800 hover:border-sky-500/40'
            : 'bg-slate-100/80 border-slate-200/80 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200'
        }`}
      >
        <Info className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
      </button>
    </div>
  );
};
