import React, { useState, useEffect, useMemo } from 'react';
import {
  TAX_ACCOUNTING_SYSTEMS,
  AUDIT_SYSTEMS,
  INSTITUTIONAL_SYSTEMS,
  CORPORATE_SYSTEMS,
  QUICK_SERVICES,
  BRANCH_OFFICES,
  BOTTOM_TOOL_ACTIONS,
} from './menuData';
import type { SubsystemItem, QuickServiceItem } from './types';
import { MainMenuButton } from './MainMenuButton';
import { SubsystemModal } from './SubsystemModal';
import { ServiceModal } from './ServiceModal';
import { useTheme } from '../wbase/menu/ThemeContext';
import {
  Bell,
  CloudDownload,
  Mic,
  Zap,
  RotateCw,
  Download,
  Globe,
  Power,
  FileSpreadsheet,
  Calculator,
  ShieldCheck,
  Landmark,
  Briefcase,
  MapPin,
  Headphones,
  Sparkles,
} from 'lucide-react';

interface MainMenuPageProps {
  onNavigateSubsystem?: (subsystemCode: string, target?: string) => void;
  clientTitle?: string;
  dataPath?: string;
  execPath?: string;
  showHeader?: boolean;
}

export const MainMenuPage: React.FC<MainMenuPageProps> = ({
  onNavigateSubsystem,
  showHeader = false,
  clientTitle = '芋某大學學院',
}) => {
  const { isDark } = useTheme();
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemItem | null>(null);
  const [activeService, setActiveService] = useState<QuickServiceItem | null>(null);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const allSubsystems = useMemo(
    () => [
      ...TAX_ACCOUNTING_SYSTEMS,
      ...AUDIT_SYSTEMS,
      ...INSTITUTIONAL_SYSTEMS,
      ...CORPORATE_SYSTEMS,
    ],
    []
  );

  // Handle clicking a subsystem button
  const handleSubsystemClick = (item: SubsystemItem) => {
    if (item.isEmptySlot) return;

    if (item.isAvailable && onNavigateSubsystem) {
      onNavigateSubsystem(item.code, item.routeTarget);
    } else {
      setSelectedSubsystem(item);
    }
  };

  // Keyboard shortcut support (e.g. pressing 1, Z, A, etc. when no modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedSubsystem || activeService || activeToolId) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = e.key.toUpperCase();
      if (key.length === 1) {
        const matched = allSubsystems.find(
          (sys) => !sys.isEmptySlot && sys.id.toUpperCase() === key
        );
        if (matched) {
          e.preventDefault();
          handleSubsystemClick(matched);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allSubsystems, selectedSubsystem, activeService, activeToolId, onNavigateSubsystem]);

  // Handle launch button inside modal
  const handleLaunchFromModal = (item: SubsystemItem) => {
    if (onNavigateSubsystem) {
      onNavigateSubsystem(item.code, item.routeTarget);
    }
  };

  // Handle bottom action buttons
  const handleBottomToolClick = (toolId: string) => {
    if (toolId === 'exit') {
      if (window.confirm('確定要離開奇勝資訊管理系統嗎？')) {
        const electron = (window as unknown as { electronAPI?: { closeWindow?: () => void } })
          .electronAPI;
        if (electron?.closeWindow) {
          electron.closeWindow();
        } else {
          window.close();
        }
      }
      return;
    }
    setActiveToolId(toolId);
  };

  const renderServiceIcon = (type: QuickServiceItem['iconType']) => {
    switch (type) {
      case 'bullhorn':
        return <Bell className="w-3.5 h-3.5 shrink-0" />;
      case 'cloud':
        return <CloudDownload className="w-3.5 h-3.5 shrink-0" />;
      case 'headset':
        return <Headphones className="w-3.5 h-3.5 shrink-0" />;
      case 'mic':
        return <Mic className="w-3.5 h-3.5 shrink-0" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const getServiceButtonStyle = (srv: QuickServiceItem) => {
    switch (srv.actionType) {
      case 'notice':
        return isDark
          ? 'bg-gradient-to-r from-rose-900/60 to-red-900/50 hover:from-rose-800/70 hover:to-red-800/60 border-rose-700/60 text-rose-100'
          : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border-rose-500 text-white';
      case 'support':
        return isDark
          ? 'bg-gradient-to-r from-amber-900/60 to-orange-900/50 hover:from-amber-800/70 hover:to-orange-800/60 border-amber-700/60 text-amber-100'
          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border-amber-400 text-white';
      default:
        return isDark
          ? 'bg-slate-800/70 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:text-white'
          : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 hover:text-blue-700 hover:border-blue-300';
    }
  };

  const renderToolIcon = (type: string | undefined, iconText?: string) => {
    if (iconText) {
      return (
        <span
          className={`w-3.5 h-3.5 rounded-full font-bold text-[10px] flex items-center justify-center font-serif italic ${
            isDark
              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
              : 'bg-blue-100 text-blue-800 border border-blue-300'
          }`}
        >
          {iconText}
        </span>
      );
    }
    switch (type) {
      case 'backup':
        return <RotateCw className="w-3.5 h-3.5 text-emerald-500" />;
      case 'update':
        return <Download className="w-3.5 h-3.5 text-indigo-500" />;
      case 'web':
        return <Globe className="w-3.5 h-3.5 text-sky-500" />;
      case 'exit':
        return <Power className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const cardContainerCls = isDark
    ? 'bg-slate-900 border-slate-800 shadow-sm'
    : 'bg-white border-slate-200/90 shadow-2xs';

  return (
    <div
      className={`relative w-full h-full min-h-0 flex-1 select-none overflow-x-hidden overflow-y-auto md:overflow-hidden flex flex-col justify-between font-sans transition-colors duration-200 ${
        isDark
          ? 'bg-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-slate-50 via-slate-100/60 to-blue-50/30 text-slate-800'
      }`}
    >
      {/* Main Content Container - Fits 1920*1080 without scroll */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-2.5 sm:px-4 py-1.5 xl:py-2 flex flex-col flex-1 justify-between h-full min-h-0">
        {/* Optional Standalone Header */}
        {showHeader && (
          <header
            className={`flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl border transition-colors ${cardContainerCls}`}
          >
            <div className="flex items-center space-x-2">
              <img
                src="/favicon.svg"
                alt="奇勝資訊 Wx3000"
                className="w-7 h-7 rounded-lg shadow-xs select-none object-contain"
              />
              <h1 className="text-base font-black">奇勝資訊</h1>
            </div>
            <div className="text-xs font-extrabold">{clientTitle}</div>
          </header>
        )}

        {/* 3-Column Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 xl:gap-2.5 flex-1 min-h-0 items-stretch">
          {/* Column 1 (Left): 稅務會計系統 (16 slots) */}
          <div
            className={`md:col-span-4 flex flex-col justify-between p-2 xl:p-2.5 rounded-xl border transition-colors ${cardContainerCls}`}
          >
            <div>
              {/* Category Header */}
              <div
                className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-2xs">
                    <Calculator className="w-3.5 h-3.5" />
                  </div>
                  <h2
                    className={`text-[14.5px] xl:text-[15.5px] font-black tracking-wide ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    稅務會計系統
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${
                    isDark
                      ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  15 模組
                </span>
              </div>

              {/* Subsystem List (16 items tightly spaced) */}
              <div className="flex flex-col space-y-[2px]">
                {TAX_ACCOUNTING_SYSTEMS.map((item) => (
                  <MainMenuButton
                    key={item.id}
                    item={item}
                    onClick={handleSubsystemClick}
                    onInfoClick={(it) => setSelectedSubsystem(it)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Column 2 (Middle): 審計簽證系統 + 機關團體系統 + 台北/台南分公司 */}
          <div className="md:col-span-4 flex flex-col justify-between space-y-2 xl:space-y-2.5">
            {/* Top: 審計簽證系統 */}
            <div className={`p-2 xl:p-2.5 rounded-xl border transition-colors ${cardContainerCls}`}>
              <div
                className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <h2
                    className={`text-[14.5px] xl:text-[15.5px] font-black tracking-wide ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    審計簽證系統
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${
                    isDark
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  A ~ E
                </span>
              </div>
              <div className="flex flex-col space-y-[2px]">
                {AUDIT_SYSTEMS.map((item) => (
                  <MainMenuButton
                    key={item.id}
                    item={item}
                    onClick={handleSubsystemClick}
                    onInfoClick={(it) => setSelectedSubsystem(it)}
                  />
                ))}
              </div>
            </div>

            {/* Middle: 機關團體系統 */}
            <div className={`p-2 xl:p-2.5 rounded-xl border transition-colors ${cardContainerCls}`}>
              <div
                className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-2xs">
                    <Landmark className="w-3.5 h-3.5" />
                  </div>
                  <h2
                    className={`text-[14.5px] xl:text-[15.5px] font-black tracking-wide ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    機關團體系統
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${
                    isDark
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  L ~ N
                </span>
              </div>
              <div className="flex flex-col space-y-[2px]">
                {INSTITUTIONAL_SYSTEMS.map((item) => (
                  <MainMenuButton
                    key={item.id}
                    item={item}
                    onClick={handleSubsystemClick}
                    onInfoClick={(it) => setSelectedSubsystem(it)}
                  />
                ))}
              </div>
            </div>

            {/* Bottom: 台北公司 & 台南公司 */}
            <div
              className={`p-2 xl:p-2.5 rounded-xl border transition-colors space-y-1.5 text-xs ${cardContainerCls}`}
            >
              {[BRANCH_OFFICES[0], BRANCH_OFFICES[2]].map((office, idx) => (
                <div
                  key={office.city}
                  className={
                    idx > 0
                      ? `pt-1.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200/80'}`
                      : ''
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold text-xs flex items-center gap-1 ${
                        isDark ? 'text-slate-100' : 'text-slate-800'
                      }`}
                    >
                      <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                      {office.city}
                    </span>
                    <span
                      className={`font-mono text-[11px] flex items-center gap-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <span>TEL:{office.tel}</span>
                      <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
                      <span>FAX:{office.fax}</span>
                    </span>
                  </div>
                  <div
                    className={`text-[10px] pl-4 truncate leading-tight ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {office.address}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 (Right): 公司版系統 + 快捷服務中心 + 台中/高雄分公司 */}
          <div className="md:col-span-4 flex flex-col justify-between space-y-2 xl:space-y-2.5">
            {/* Top: 公司版系統 */}
            <div className={`p-2 xl:p-2.5 rounded-xl border transition-colors ${cardContainerCls}`}>
              <div
                className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-2xs">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <h2
                    className={`text-[14.5px] xl:text-[15.5px] font-black tracking-wide ${
                      isDark ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    公司版系統
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${
                    isDark
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  O ~ U
                </span>
              </div>
              <div className="flex flex-col space-y-[2px]">
                {CORPORATE_SYSTEMS.map((item) => (
                  <MainMenuButton
                    key={item.id}
                    item={item}
                    onClick={handleSubsystemClick}
                    onInfoClick={(it) => setSelectedSubsystem(it)}
                  />
                ))}
              </div>
            </div>

            {/* Middle: 快捷服務與支援中心 */}
            <div className={`p-2 xl:p-2.5 rounded-xl border transition-colors ${cardContainerCls}`}>
              <div
                className={`flex items-center justify-between pb-1 mb-1.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <h3
                    className={`text-xs font-bold tracking-wider uppercase ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    快捷服務與支援
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_SERVICES.map((srv, index) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setActiveService(srv)}
                    className={`${
                      index === 0 ? 'col-span-2' : ''
                    } relative flex items-center justify-between px-2.5 py-1 rounded-md border font-bold text-[12.5px] xl:text-[13.5px] tracking-tight shadow-2xs transition-all duration-100 active:scale-[0.99] cursor-pointer ${getServiceButtonStyle(
                      srv
                    )}`}
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      {renderServiceIcon(srv.iconType)}
                      <span className="truncate leading-none">{srv.title}</span>
                    </div>

                    {srv.badge && (
                      <span className="bg-white text-rose-600 text-[9px] font-black px-1 rounded-full shadow-2xs shrink-0 leading-none">
                        {srv.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom: 台中公司 & 高雄公司 */}
            <div
              className={`p-2 xl:p-2.5 rounded-xl border transition-colors space-y-1.5 text-xs ${cardContainerCls}`}
            >
              {[BRANCH_OFFICES[1], BRANCH_OFFICES[3]].map((office, idx) => (
                <div
                  key={office.city}
                  className={
                    idx > 0
                      ? `pt-1.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200/80'}`
                      : ''
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold text-xs flex items-center gap-1 ${
                        isDark ? 'text-slate-100' : 'text-slate-800'
                      }`}
                    >
                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      {office.city}
                    </span>
                    <span
                      className={`font-mono text-[11px] flex items-center gap-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <span>TEL:{office.tel}</span>
                      <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
                      <span>FAX:{office.fax}</span>
                    </span>
                  </div>
                  <div
                    className={`text-[10px] pl-4 truncate leading-tight ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {office.address}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Toolbar & Version Tag */}
        <footer
          className={`mt-2 px-3 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-colors ${cardContainerCls}`}
        >
          {/* Left: Version Tag & Hotkey Hint */}
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2 py-0.2 rounded-md font-mono font-bold text-[11px] border ${
                isDark
                  ? 'bg-slate-800 text-amber-300 border-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              V2.4-A
            </span>
            <span
              className={`hidden md:inline text-[11px] ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              提示：可直接按鍵盤代號（如 <kbd className="font-mono font-bold">1</kbd>、
              <kbd className="font-mono font-bold">Z</kbd>）快速啟動
            </span>
          </div>

          {/* Right: Bottom Actions Toolbar */}
          <div className="flex items-center flex-wrap gap-1.5 justify-end">
            {BOTTOM_TOOL_ACTIONS.map((tool) => {
              const isExit = tool.id === 'exit';
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleBottomToolClick(tool.id)}
                  className={`relative group flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs xl:text-[13px] font-bold transition-all duration-100 cursor-pointer active:scale-95 ${
                    isExit
                      ? isDark
                        ? 'bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border-rose-800/60'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : isDark
                      ? 'bg-slate-800/70 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 shadow-2xs'
                  }`}
                >
                  {renderToolIcon(tool.iconType, tool.iconText)}
                  <span className="tracking-tight">{tool.title}</span>

                  {tool.badge && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] font-black px-1 rounded-full shadow-2xs">
                      {tool.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </footer>
      </div>

      {/* Subsystem Details / Introduction Modal */}
      <SubsystemModal
        item={selectedSubsystem}
        onClose={() => setSelectedSubsystem(null)}
        onLaunch={handleLaunchFromModal}
      />

      {/* Quick Services / Tools Dialog Modal */}
      <ServiceModal
        service={activeService}
        toolActionId={activeToolId}
        onClose={() => {
          setActiveService(null);
          setActiveToolId(null);
        }}
      />
    </div>
  );
};
