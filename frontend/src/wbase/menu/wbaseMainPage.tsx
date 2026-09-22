import React, { useState } from 'react';
import { WbaseMainLayout } from './WbaseMainLayout';
import { WbaseMenuTree } from './WbaseMenuTree';
import { WBASE_MENU_DATA } from './menuConfig';
import type { MenuItem } from './menuConfig';
import { useMenuKeyboard } from './useMenuKeyboard';
import { Wbase1020Page } from '../wbase1020';
import { Wbase1030Page } from '../wbase1030';
import { Wbase1050Page } from '../wbase1050';
import { Wbase1060Page } from '../wbase1060';
import { Wbase1070Page } from '../wbase1070';
import { Wbase1080Page } from '../wbase1080';
import { Wbase2010Page } from '../wbase2010';
import { Wbase2010SplitPage } from '../wbase2010/Wbase2010SplitPage';
import { Wbase3010Page } from '../wbase3010';
import { Wbase3020Page } from '../wbase3020';
import { Wbase3020_buyinv_print } from '../wbase3020/wbase3020_buyinv_print';
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
    } else if (item.code === 'wbase1060') {
      setActiveModule('wbase1060');
    } else if (item.code === 'wbase1070') {
      setActiveModule('wbase1070');
    } else if (item.code === 'wbase1080') {
      setActiveModule('wbase1080');
    } else if (item.code === 'wbase2010') {
      setActiveModule('wbase2010');
    } else if (item.code === 'wbase2010_split') {
      setActiveModule('wbase2010_split');
    } else if (item.code === 'wbase3010') {
      setActiveModule('wbase3010');
    } else if (item.code === 'wbase3020') {
      setActiveModule('wbase3020');
    } else if (item.code === 'wbase3030' || item.code === 'wbase3020_buyinv_print') {
      setActiveModule('wbase3020_buyinv_print');
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
    return (
      <div
        className={`w-full h-full min-h-0 flex-1 flex flex-col transition-colors duration-300 ${
          isDark ? 'bg-slate-900' : 'bg-slate-100'
        }`}
      >
        {/* Navigation Breadcrumb Bar */}
        <div
          className={`shrink-0 px-5 py-2.5 flex items-center justify-between transition-colors duration-300 ${
            isDark
              ? 'bg-slate-950 border-b border-slate-700/50 shadow-md'
              : 'bg-white border-b-2 border-slate-200/90 shadow-xs'
          }`}
        >
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveModule(null)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-md shadow-indigo-600/20 transition-all duration-200 text-sm"
              title="返回主選單 (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回主選單</span>
            </button>

            <span className={isDark ? 'text-slate-700' : 'text-slate-400 font-bold'}>|</span>

            <div
              className={`flex items-center space-x-1.5 text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-800 font-semibold'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-indigo-600'}`} />
              <span>
                {activeModule?.startsWith('wbase30')
                  ? '發票統購'
                  : activeModule?.startsWith('wbase20')
                  ? '客戶資料'
                  : '事務所資料'}
              </span>
              <span className={isDark ? 'text-slate-700' : 'text-slate-400'}>/</span>
              <span className={`font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>
                {activeModule === 'wbase1020'
                  ? '會計師/記帳士資料'
                  : activeModule === 'wbase1050'
                  ? '稅務人員資料'
                  : activeModule === 'wbase1060'
                  ? '基本收費項目'
                  : activeModule === 'wbase1070'
                  ? '收費項目備註'
                  : activeModule === 'wbase1080'
                  ? '基本收費摘要'
                  : activeModule === 'wbase2010'
                  ? '客戶資料建檔'
                  : activeModule === 'wbase2010_split'
                  ? '客戶資料建檔 (左右雙欄測試)'
                  : activeModule === 'wbase3010'
                  ? '購買地點'
                  : activeModule === 'wbase3020'
                  ? '預購統一發票輸入'
                  : '員工資料'}
              </span>
              <span className={`text-xs ml-1 font-bold ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
                ({activeModule})
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all duration-300 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 shadow-2xs'
              }`}
              title={isDark ? '切換至淺色主題' : '切換至深色主題'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <kbd
              className={`text-xs px-2.5 py-1 rounded border font-mono font-black transition-colors duration-300 ${
                isDark
                  ? 'text-slate-500 bg-slate-800/80 border-slate-700/50'
                  : 'text-yellow-300 bg-slate-800 border-slate-700 shadow-2xs'
              }`}
            >
              Esc 返回
            </kbd>
          </div>
        </div>

        {/* Submodule Page Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeModule === 'wbase1020' ? (
            <Wbase1020Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1050' ? (
            <Wbase1050Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1060' ? (
            <Wbase1060Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1070' ? (
            <Wbase1070Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1080' ? (
            <Wbase1080Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase2010' ? (
            <Wbase2010Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase2010_split' ? (
            <Wbase2010SplitPage onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3010' ? (
            <Wbase3010Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3020' ? (
            <Wbase3020Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3020_buyinv_print' ? (
            <Wbase3020_buyinv_print onClose={() => setActiveModule(null)} />
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
