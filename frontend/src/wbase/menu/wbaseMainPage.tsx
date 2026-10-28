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
import { Wbase3050_buylist_print, Wbase3050_buyinv_setamt } from '../wbase3050';
import { Wbase3060 } from '../wbase3060';
import { useTheme } from './ThemeContext';

interface WbaseMainPageProps {
  onBackToMainMenu?: () => void;
}

export const WbaseMainPage: React.FC<WbaseMainPageProps> = ({ onBackToMainMenu }) => {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { isDark } = useTheme();

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
    } else if (item.code === 'wbase3050' || item.code === 'wbase3050_buylist_print') {
      setActiveModule('wbase3050_buylist_print');
    } else if (item.code === 'wbase3050_buyinv_setamt') {
      setActiveModule('wbase3050_buyinv_setamt');
    } else if (item.code === 'wbase3060' || item.code === 'wbase3060_01') {
      setActiveModule('wbase3060_01');
    } else if (item.code === 'A00') {
      // 結束離開 / 回主選單
      if (onBackToMainMenu) {
        onBackToMainMenu();
      } else if (window.confirm('確定要離開系統嗎？')) {
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

  // Module view: render the active module directly (each submodule renders its own unified WbasePageHeader)
  if (activeModule !== null) {
    return (
      <div
        className={`w-full h-full min-h-0 flex-1 flex flex-col transition-colors duration-300 ${
          isDark ? 'bg-slate-900' : 'bg-slate-100'
        }`}
      >
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
          ) : activeModule === 'wbase3050' || activeModule === 'wbase3050_buylist_print' ? (
            <Wbase3050_buylist_print onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3050_buyinv_setamt' ? (
            <Wbase3050_buyinv_setamt onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3060' || activeModule === 'wbase3060_01' ? (
            <Wbase3060 onBackToMenu={() => setActiveModule(null)} />
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
