import React, { useState } from 'react';
import { WbaseMainLayout } from './WbaseMainLayout';
import { WbaseMenuTree } from './WbaseMenuTree';
import { WBASE_MENU_DATA } from './menuConfig';
import type { MenuItem } from './menuConfig';
import { useMenuKeyboard } from './useMenuKeyboard';
import { Wbase1010Page } from '../wbase1010';
import { Wbase1020Page } from '../wbase1020';
import { Wbase1030Page } from '../wbase1030';
import { Wbase1050Page } from '../wbase1050';
import { Wbase1060Page } from '../wbase1060';
import { Wbase1070Page } from '../wbase1070';
import { Wbase1080Page } from '../wbase1080';
import { Wbase2010Page } from '../wbase2010';
import { Wbase2010SplitPage } from '../wbase2010/Wbase2010SplitPage';
import { Wbase2030Page } from '../wbase2030';
import { Wbase2040Page } from '../wbase2040';
import { Wbase2050Page } from '../wbase2050';
import { Wbase3010Page } from '../wbase3010';
import { Wbase3020Page } from '../wbase3020';
import { Wbase3020_buyinv_print } from '../wbase3020/wbase3020_buyinv_print';
import { Wbase3025_Media, Wbase3025_Net } from '../wbase3025';
import { Wbase3050_buylist_print, Wbase3050_buyinv_setamt } from '../wbase3050';
import { Wbase3060 } from '../wbase3060';
import { Wbase4010Page } from '../wbase4010';
import { Wbase4020Page } from '../wbase4020';
import { Wbase5010Index, type Wbase50TabType } from '../wbase5010';
import { Wbase5070Page } from '../wbase5070';
import { useTheme } from './ThemeContext';

interface WbaseMainPageProps {
  onBackToMainMenu?: () => void;
}

export const WbaseMainPage: React.FC<WbaseMainPageProps> = ({ onBackToMainMenu }) => {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [wbase4010Mode, setWbase4010Mode] = useState<number>(1);
  const [wbase4020Tab, setWbase4020Tab] = useState<'4020' | '4030' | '4040' | '4050' | '4060'>('4020');
  const [wbase5010Tab, setWbase5010Tab] = useState<Wbase50TabType>('5010');
  const { isDark } = useTheme();

  // Trigger when a leaf menu item is selected/clicked
  const handleSelectAction = (item: MenuItem) => {
    if (item.code === 'wbase1010') {
      setActiveModule('wbase1010');
    } else if (item.code === 'wbase1020') {
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
    } else if (item.code === 'wbase2020') {
      setActiveModule('wbase2020');
    } else if (item.code === 'wbase2030') {
      setActiveModule('wbase2030');
    } else if (item.code === 'wbase2040') {
      setActiveModule('wbase2040');
    } else if (item.code === 'wbase2050') {
      setActiveModule('wbase2050');
    } else if (item.code === 'wbase3010') {
      setActiveModule('wbase3010');
    } else if (item.code === 'wbase3020') {
      setActiveModule('wbase3020');
    } else if (item.code === 'wbase3030' || item.code === 'wbase3020_buyinv_print') {
      setActiveModule('wbase3020_buyinv_print');
    } else if (item.code === 'wbase3025' || item.code === 'wbase3041') {
      setActiveModule('wbase3025');
    } else if (item.code === 'wbase3025n' || item.code === 'wbase3042') {
      setActiveModule('wbase3025n');
    } else if (item.code === 'wbase3050' || item.code === 'wbase3050_buylist_print') {
      setActiveModule('wbase3050_buylist_print');
    } else if (item.code === 'wbase3050_buyinv_setamt') {
      setActiveModule('wbase3050_buyinv_setamt');
    } else if (item.code === 'wbase3060' || item.code === 'wbase3060_01') {
      setActiveModule('wbase3060_01');
    } else if (item.code === 'wbase4010') {
      setWbase4010Mode(1);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4011') {
      setWbase4010Mode(1);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4012') {
      setWbase4010Mode(2);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4013') {
      setWbase4010Mode(3);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4014') {
      setWbase4010Mode(4);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4015') {
      setWbase4010Mode(5);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4016') {
      setWbase4010Mode(6);
      setActiveModule('wbase4010');
    } else if (item.code === 'wbase4020') {
      setWbase4020Tab('4020');
      setActiveModule('wbase4020');
    } else if (item.code === 'wbase4030') {
      setWbase4020Tab('4030');
      setActiveModule('wbase4020');
    } else if (item.code === 'wbase4040') {
      setWbase4020Tab('4040');
      setActiveModule('wbase4020');
    } else if (item.code === 'wbase4050') {
      setWbase4020Tab('4050');
      setActiveModule('wbase4020');
    } else if (item.code === 'wbase4060') {
      setWbase4020Tab('4060');
      setActiveModule('wbase4020');
    } else if (item.code === 'wbase5010') {
      setWbase5010Tab('5010');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5020') {
      setWbase5010Tab('5020');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5030') {
      setWbase5010Tab('5030');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5040') {
      setWbase5010Tab('5040');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5050') {
      setWbase5010Tab('5050');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5060') {
      setWbase5010Tab('5060');
      setActiveModule('wbase5010');
    } else if (item.code === 'wbase5070') {
      setActiveModule('wbase5070');
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
          {activeModule === 'wbase1010' ? (
            <Wbase1010Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase1020' ? (
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
          ) : activeModule === 'wbase2020' || activeModule === 'wbase2030' ? (
            <Wbase2030Page
              key={activeModule}
              mode={activeModule === 'wbase2020' ? 'export' : 'import'}
              onBackToMenu={() => setActiveModule(null)}
            />
          ) : activeModule === 'wbase2040' ? (
            <Wbase2040Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase2050' ? (
            <Wbase2050Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3010' ? (
            <Wbase3010Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3020' ? (
            <Wbase3020Page onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3020_buyinv_print' ? (
            <Wbase3020_buyinv_print onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3025' ? (
            <Wbase3025_Media onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3025n' ? (
            <Wbase3025_Net onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3050' || activeModule === 'wbase3050_buylist_print' ? (
            <Wbase3050_buylist_print onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3050_buyinv_setamt' ? (
            <Wbase3050_buyinv_setamt onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase3060' || activeModule === 'wbase3060_01' ? (
            <Wbase3060 onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase4010' ? (
            <Wbase4010Page initialMode={wbase4010Mode} onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase4020' ? (
            <Wbase4020Page initialTab={wbase4020Tab} onBackToMenu={() => setActiveModule(null)} />
          ) : activeModule === 'wbase5010' ? (
            <Wbase5010Index initialTab={wbase5010Tab} onClose={() => setActiveModule(null)} />
          ) : activeModule === 'wbase5070' ? (
            <Wbase5070Page onBackToMenu={() => setActiveModule(null)} />
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
