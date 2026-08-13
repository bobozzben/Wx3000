import React, { useState } from 'react';
import { WbaseMainLayout } from './WbaseMainLayout';
import { WbaseMenuTree } from './WbaseMenuTree';
import { WBASE_MENU_DATA } from './menuConfig';
import type { MenuItem } from './menuConfig';
import { useMenuKeyboard } from './useMenuKeyboard';
import { Wbase1020Page } from '../wbase1020';
import { Wbase1030Page } from '../wbase1030';
import { Wbase1050Page } from '../wbase1050';
import { Wbase2010Page } from '../wbase2010';
import { ArrowLeft, LayoutGrid, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export const WbaseMainPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();

  // Trigger when a leaf menu item is selected/clicked
  const handleSelectAction = (item: MenuItem) => {
    if (item.code === 'wbase1020') {
      setActiveModule('wbase1020');
    } else if (item.code === 'wbase1030') {
      setActiveModule('wbase1030');
    } else if (item.code === 'wbase1050') {
      setActiveModule('wbase1050');
    } else if (item.code === 'wbase2010') {
      setActiveModule('wbase2010');
    } else if (item.code === 'A00') {
      // 結束離開
      if (window.confirm('確定要離開系統嗎？')) {
        window.close();
      }
    } else if (item.code === '900') {
      // 重新連線
      window.location.reload();
    } else {
      alert(
        `[系統提示] 您點擊了功能項：${item.title} (${item.code})\n目前此模組正在移植建置中！`
      );
    }
  };

  const {
    level1Idx,
    level2Idx,
    level3Idx,
    activeLevel,
    setLevel1Idx,
    setLevel2Idx,
    setLevel3Idx,
  } = useMenuKeyboard({
    menuData: WBASE_MENU_DATA,
    onSelectAction: handleSelectAction,
    enabled: activeModule === null,
  });

  const handleSelectLevel1 = (idx: number) => {
    if (level1Idx === idx && level2Idx !== null) {
      // Already selected & expanded → collapse
      setLevel2Idx(null);
      setLevel3Idx(null);
    } else {
      // Select new Tier 1 item and expand its Tier 2
      setLevel1Idx(idx);
      setLevel3Idx(null);
      const children = WBASE_MENU_DATA[idx]?.children || [];
      if (children.length > 0) {
        setLevel2Idx(0);
      } else {
        setLevel2Idx(null);
      }
    }
  };

  const handleSelectLevel2 = (idx: number) => {
    if (level2Idx === idx && level3Idx !== null) {
      // Already selected & expanded → collapse Tier 3
      setLevel3Idx(null);
    } else {
      setLevel2Idx(idx);
      const currentCat = WBASE_MENU_DATA[level1Idx];
      const currentGroup = currentCat?.children?.[idx];
      if (currentGroup?.children && currentGroup.children.length > 0) {
        setLevel3Idx(0);
      } else {
        setLevel3Idx(null);
      }
    }
  };

  // Module view: render the active module with a navigation bar
  if (activeModule !== null) {
    const is1020 = activeModule === 'wbase1020';
    return (
      <div
        className={`w-full min-h-screen flex flex-col transition-colors duration-300 ${
          isDark ? 'bg-slate-900' : 'bg-[#F8FAFC]'
        }`}
      >
        {/* Navigation Breadcrumb Bar */}
        <div
          className={`px-5 py-2.5 flex items-center justify-between transition-colors duration-300 ${
            isDark
              ? 'bg-slate-950 border-b border-slate-700/50 shadow-md'
              : 'bg-white border-b border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveModule(null)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all duration-200 text-sm"
              title="返回主選單 (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回主選單</span>
            </button>

            <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>

            <div
              className={`flex items-center space-x-1.5 text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-600 font-medium'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <span>{activeModule?.startsWith('wbase20') ? '客戶資料' : '事務所資料'}</span>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>/</span>
              <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeModule === 'wbase1020'
                  ? '會計師/記帳士資料'
                  : activeModule === 'wbase1050'
                  ? '稅務人員資料'
                  : activeModule === 'wbase2010'
                  ? '客戶資料建檔'
                  : '員工資料'}
              </span>
              <span className={`text-xs ml-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                ({activeModule})
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-300 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
              }`}
              title={isDark ? '切換至淺色主題' : '切換至深色主題'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <kbd
              className={`text-xs px-2.5 py-1 rounded border font-mono font-bold transition-colors duration-300 ${
                isDark
                  ? 'text-slate-500 bg-slate-800/80 border-slate-700/50'
                  : 'text-slate-600 bg-slate-100 border-slate-200'
              }`}
            >
              Esc 返回
            </kbd>
          </div>
        </div>

        {/* Submodule Page Content */}
        <div className="flex-1">
          {activeModule === 'wbase1020' ? (
            <Wbase1020Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1050' ? (
            <Wbase1050Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase2010' ? (
            <Wbase2010Page onBackToMenu={() => setActiveModule(null)} />
          ) : (
            <Wbase1030Page onBackToMenu={() => setActiveModule(null)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <WbaseMainLayout>
      <WbaseMenuTree
        menuData={WBASE_MENU_DATA}
        level1Idx={level1Idx}
        level2Idx={level2Idx}
        level3Idx={level3Idx}
        activeLevel={activeLevel}
        onSelectLevel1={handleSelectLevel1}
        onSelectLevel2={handleSelectLevel2}
        onSelectLevel3={handleSelectAction}
      />
    </WbaseMainLayout>
  );
};
