import React, { useRef, useEffect, useState } from 'react';
import type { MenuItem } from './menuConfig';
import { useTheme } from './ThemeContext';
import {
  Building2,
  Users,
  Receipt,
  Settings,
  BarChart3,
  Wrench,
  BookOpen,
  RefreshCw,
  LogOut,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WbaseMenuTreeProps {
  menuData: MenuItem[];
  level1Idx: number;
  level2Idx: number | null;
  level3Idx: number | null;
  activeLevel: number;
  onSelectLevel1: (idx: number) => void;
  onSelectLevel2: (idx: number) => void;
  onSelectLevel3: (item: MenuItem) => void;
}

/* ─── Icon Resolver ──────────────────────────────────────── */
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Building2,
  Users,
  Receipt,
  Settings,
  BarChart3,
  Wrench,
  BookOpen,
  RefreshCw,
  LogOut,
};

/* ─── Per-category color tokens (dark / rich-light variants) ──── */
const CATEGORY_COLORS: Record<
  string,
  { darkBg: string; lightBg: string; text: string; lightText: string; accent: string }
> = {
  '100': { darkBg: 'from-blue-500/20 to-blue-600/10',     lightBg: 'from-blue-100 via-indigo-100/90 to-blue-50', text: 'text-blue-400',    lightText: 'text-indigo-800',  accent: 'border-l-indigo-600' },
  '200': { darkBg: 'from-emerald-500/20 to-emerald-600/10', lightBg: 'from-emerald-100 via-teal-100/90 to-emerald-50', text: 'text-emerald-400', lightText: 'text-emerald-800', accent: 'border-l-emerald-600' },
  '300': { darkBg: 'from-amber-500/20 to-amber-600/10',   lightBg: 'from-amber-100 via-yellow-100/90 to-amber-50', text: 'text-amber-400',   lightText: 'text-amber-900',   accent: 'border-l-amber-600' },
  '400': { darkBg: 'from-purple-500/20 to-purple-600/10', lightBg: 'from-purple-100 via-violet-100/90 to-purple-50', text: 'text-purple-400',  lightText: 'text-purple-800',  accent: 'border-l-purple-600' },
  '500': { darkBg: 'from-rose-500/20 to-rose-600/10',     lightBg: 'from-rose-100 via-pink-100/90 to-rose-50', text: 'text-rose-400',    lightText: 'text-rose-800',    accent: 'border-l-rose-600' },
  '600': { darkBg: 'from-cyan-500/20 to-cyan-600/10',     lightBg: 'from-cyan-100 via-sky-100/90 to-cyan-50', text: 'text-cyan-400',    lightText: 'text-cyan-800',    accent: 'border-l-cyan-600' },
  '800': { darkBg: 'from-indigo-500/20 to-indigo-600/10', lightBg: 'from-indigo-100 via-blue-100/90 to-indigo-50', text: 'text-indigo-400',  lightText: 'text-indigo-800',  accent: 'border-l-indigo-600' },
  '900': { darkBg: 'from-orange-500/20 to-orange-600/10', lightBg: 'from-orange-100 via-amber-100/90 to-orange-50', text: 'text-orange-400',  lightText: 'text-orange-900',  accent: 'border-l-orange-600' },
  'A00': { darkBg: 'from-red-500/20 to-red-600/10',       lightBg: 'from-red-100 via-rose-100/90 to-red-50', text: 'text-red-400',     lightText: 'text-red-800',     accent: 'border-l-red-600' },
};

/* ─── Animated accordion wrapper ──────────────────────────── */
const AccordionContent: React.FC<{
  open: boolean;
  children: React.ReactNode;
}> = ({ open, children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<string>('0px');

  useEffect(() => {
    if (open && contentRef.current) {
      setMaxH(`${contentRef.current.scrollHeight}px`);
      const timer = setTimeout(() => setMaxH('none'), 320);
      return () => clearTimeout(timer);
    } else {
      if (contentRef.current) {
        setMaxH(`${contentRef.current.scrollHeight}px`);
        void contentRef.current.offsetHeight;
      }
      requestAnimationFrame(() => setMaxH('0px'));
    }
  }, [open]);

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: maxH }}
    >
      {children}
    </div>
  );
};

/* ─── Main Component ──────────────────────────────────────── */
export const WbaseMenuTree: React.FC<WbaseMenuTreeProps> = ({
  menuData,
  level1Idx,
  level2Idx,
  level3Idx,
  activeLevel: _activeLevel,
  onSelectLevel1,
  onSelectLevel2,
  onSelectLevel3,
}) => {
  const { isDark } = useTheme();
  void _activeLevel;

  const currentTier1 = menuData[level1Idx] || menuData[0];
  const tier2Items = currentTier1?.children || [];

  const isTier1Expanded = (idx: number) => level1Idx === idx && level2Idx !== null;
  const isTier2Expanded = (idx: number) =>
    level2Idx === idx && level3Idx !== null && (tier2Items[idx]?.children?.length ?? 0) > 0;

  return (
    <div
      className={`flex-1 flex overflow-hidden transition-colors duration-300 ${
        isDark
          ? 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900'
          : 'bg-slate-100/90'
      }`}
    >
      {/* ──── Left Sidebar: Accordion Menu ──── */}
      <nav
        className={`w-80 shrink-0 flex flex-col overflow-y-auto transition-colors duration-300 ${
          isDark
            ? 'border-r border-slate-700/50 bg-slate-900/80 backdrop-blur'
            : 'border-r-2 border-slate-200/90 bg-white shadow-sm'
        }`}
      >
        {/* Sidebar Header */}
        <div
          className={`px-5 py-4 transition-colors duration-300 ${
            isDark ? 'border-b border-slate-700/50' : 'border-b-2 border-slate-200 bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <h2
              className={`text-sm font-black tracking-wide ${
                isDark ? 'text-slate-200' : 'text-slate-900'
              }`}
            >
              系統功能選單
            </h2>
          </div>
          <p
            className={`text-xs mt-1 font-semibold ${
              isDark ? 'text-slate-500' : 'text-slate-600'
            }`}
          >
            使用 ↑↓ 導覽 · Enter/→ 展開 · Esc/← 返回
          </p>
        </div>

        {/* Menu Items */}
        <div className="flex-1 py-2 px-2 space-y-1">
          {menuData.map((cat, catIdx) => {
            const IconComp = ICON_MAP[cat.icon || ''] || Zap;
            const colors = CATEGORY_COLORS[cat.code] || CATEGORY_COLORS['100'];
            const isSelected = level1Idx === catIdx;
            const isExpanded = isTier1Expanded(catIdx);
            const isLeaf = !cat.hasChildren;

            return (
              <div key={cat.id}>
                {/* Tier 1 Button */}
                <button
                  onClick={() => {
                    if (isLeaf) {
                      onSelectLevel3(cat);
                    } else {
                      onSelectLevel1(catIdx);
                    }
                  }}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-l-[4px] ${
                    isSelected
                      ? isDark
                        ? `bg-gradient-to-r ${colors.darkBg} ${colors.accent} text-white shadow-lg shadow-slate-900/50`
                        : `bg-gradient-to-r ${colors.lightBg} ${colors.accent} text-slate-950 font-extrabold shadow-xs`
                      : isDark
                        ? 'border-l-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        : 'border-l-transparent text-slate-800 hover:text-slate-950 hover:bg-slate-100 font-semibold'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        isSelected
                          ? isDark
                            ? `bg-slate-800/60 ${colors.text}`
                            : `bg-indigo-600 text-white shadow-xs`
                          : isDark
                            ? 'bg-slate-800/40 text-slate-500 group-hover:text-slate-300'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-indigo-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="truncate">{cat.title}</span>
                  </div>

                  {cat.hasChildren && (
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                        isExpanded
                          ? isDark ? 'rotate-90 text-white' : 'rotate-90 text-slate-900 font-bold'
                          : isDark
                            ? 'text-slate-600 group-hover:text-slate-400'
                            : 'text-slate-400 group-hover:text-slate-700'
                      }`}
                    />
                  )}
                </button>

                {/* Tier 2 Accordion Children */}
                {cat.hasChildren && isSelected && (
                  <AccordionContent open={isExpanded}>
                    <div
                      className={`ml-4 pl-3 mt-1 mb-1 space-y-0.5 ${
                        isDark ? 'border-l border-slate-700/50' : 'border-l-2 border-indigo-300'
                      }`}
                    >
                      {(cat.children || []).map((item, itemIdx) => {
                        const isTier2Selected = level1Idx === catIdx && level2Idx === itemIdx;
                        const isTier2Exp = isTier2Selected && isTier2Expanded(itemIdx);
                        const hasT3 = (item.children?.length ?? 0) > 0;

                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => {
                                if (hasT3) {
                                  onSelectLevel2(itemIdx);
                                } else {
                                  onSelectLevel2(itemIdx);
                                  onSelectLevel3(item);
                                }
                              }}
                              className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-200 border-l-2 ${
                                isTier2Selected
                                  ? isDark
                                    ? `bg-white/10 text-white font-medium ${colors.accent}`
                                    : `bg-indigo-100/90 text-indigo-950 font-black ${colors.accent} shadow-2xs`
                                  : isDark
                                    ? 'border-l-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    : 'border-l-transparent text-slate-800 hover:text-slate-950 hover:bg-slate-100 font-semibold'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <span
                                  className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                                    isTier2Selected
                                      ? isDark ? 'bg-white' : 'bg-indigo-700'
                                      : isDark
                                        ? 'bg-slate-600 group-hover:bg-slate-400'
                                        : 'bg-slate-400 group-hover:bg-indigo-600'
                                  }`}
                                />
                                <span className="truncate">{item.title}</span>
                              </div>

                              {hasT3 && (
                                <ChevronRight
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
                                    isTier2Exp
                                      ? isDark ? 'rotate-90 text-white' : 'rotate-90 text-indigo-950'
                                      : isDark ? 'text-slate-600' : 'text-slate-500'
                                  }`}
                                />
                              )}
                            </button>

                            {/* Tier 3 Accordion Children */}
                            {hasT3 && isTier2Selected && (
                              <AccordionContent open={isTier2Exp}>
                                <div
                                  className={`ml-4 pl-3 mt-0.5 mb-0.5 space-y-0.5 ${
                                    isDark
                                      ? 'border-l border-slate-700/40'
                                      : 'border-l-2 border-indigo-300'
                                  }`}
                                >
                                  {(item.children || []).map((sub, subIdx) => {
                                    const isTier3Selected = level3Idx === subIdx;
                                    return (
                                      <button
                                        key={sub.id}
                                        onClick={() => onSelectLevel3(sub)}
                                        className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                                          isTier3Selected
                                            ? isDark
                                              ? 'bg-indigo-500/30 text-indigo-200 font-medium'
                                              : 'bg-indigo-600 text-white font-extrabold shadow-sm'
                                            : isDark
                                              ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                              : 'text-slate-800 hover:text-indigo-900 hover:bg-indigo-50 font-semibold'
                                        }`}
                                      >
                                        <span
                                          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                                            isTier3Selected
                                              ? isDark ? 'bg-indigo-400' : 'bg-white'
                                              : isDark ? 'bg-slate-700' : 'bg-slate-400'
                                          }`}
                                        />
                                        <span>{sub.title}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div
          className={`px-4 py-3 text-xs font-semibold transition-colors duration-300 ${
            isDark
              ? 'border-t border-slate-700/50 text-slate-600'
              : 'border-t-2 border-slate-200 text-slate-600 bg-slate-50'
          }`}
        >
          Wx3000 會計管理系統 v1.0
        </div>
      </nav>

      {/* ──── Right Content Area: Welcome Dashboard ──── */}
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-300 ${
          isDark
            ? 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800'
            : 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100'
        }`}
      >
        <div className="text-center space-y-6 max-w-lg">
          {/* Logo area */}
          <div className="relative inline-flex">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-600/30">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-5.5 h-5.5 bg-emerald-400 rounded-full flex items-center justify-center animate-pulse shadow-md shadow-emerald-400/40">
              <span className="text-[10px] font-black text-black">✓</span>
            </div>
          </div>

          <div>
            <h1
              className={`text-2xl font-black tracking-tight transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-slate-950'
              }`}
            >
              歡迎使用 Wx3000
            </h1>
            <p
              className={`mt-2 text-sm leading-relaxed font-semibold transition-colors duration-300 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              FoxPro 雲端會計管理系統
              <br />
              請從左側選單選擇功能開始作業
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              {
                label: '功能模組',
                value: String(menuData.length),
                darkColor: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-white',
                lightColor: 'bg-white border-2 border-blue-200/90 shadow-sm text-blue-950 hover:border-blue-400',
                valColor: isDark ? 'text-white' : 'text-blue-700',
              },
              {
                label: '已啟用',
                value: '1',
                darkColor: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-white',
                lightColor: 'bg-white border-2 border-emerald-200/90 shadow-sm text-emerald-950 hover:border-emerald-400',
                valColor: isDark ? 'text-white' : 'text-emerald-700',
              },
              {
                label: '建置中',
                value: String(menuData.length - 1),
                darkColor: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-white',
                lightColor: 'bg-white border-2 border-amber-200/90 shadow-sm text-amber-950 hover:border-amber-400',
                valColor: isDark ? 'text-white' : 'text-amber-700',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`border rounded-xl px-4 py-3 transition-colors duration-300 ${
                  isDark ? `bg-gradient-to-br ${stat.darkColor}` : stat.lightColor
                }`}
              >
                <div className={`text-2xl font-black ${stat.valColor}`}>
                  {stat.value}
                </div>
                <div
                  className={`text-xs mt-0.5 font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Keyboard hints */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              { key: '↑↓', desc: '導覽選單' },
              { key: 'Enter', desc: '展開 / 執行' },
              { key: 'Esc', desc: '返回上層' },
              { key: '→', desc: '展開子選單' },
              { key: '←', desc: '收合選單' },
            ].map((hint) => (
              <div key={hint.key} className="flex items-center space-x-1.5 text-xs">
                <kbd
                  className={`px-2.5 py-1 rounded border font-mono text-[11px] font-black transition-colors duration-300 ${
                    isDark
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-slate-800 text-yellow-300 border-slate-700 shadow-xs'
                  }`}
                >
                  {hint.key}
                </kbd>
                <span className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  {hint.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
