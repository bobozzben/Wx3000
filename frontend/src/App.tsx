import { useState, useEffect } from 'react';
import { WbaseMainPage } from './wbase/menu/wbaseMainPage';
import { PurchaseOrderPage } from './wtaxop/PurchaseOrder/PurchaseOrderPage';
import { LayoutGrid, FileText, Server, Monitor, Sun, Moon, HardDrive, ShieldCheck } from 'lucide-react';
import { ThemeProvider, useTheme } from './wbase/menu/ThemeContext';
import { ServerConfigModal } from './components/ServerConfigModal';
import { getApiServerUrl, isElectronApp, checkServerConnection } from './services/apiConfig';

function AppContent() {
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'wbase' | 'purchase'>('wbase');
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiServerUrl());
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  // 定期或載入時檢查伺服器連線狀態
  useEffect(() => {
    let isMounted = true;
    const testStatus = async () => {
      const res = await checkServerConnection();
      if (isMounted) setIsOnline(res.success);
    };
    testStatus();
    const interval = setInterval(testStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [serverUrl]);

  // 全域快捷鍵 Ctrl+Shift+S 開啟伺服器設定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setIsServerModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full h-screen h-dvh overflow-hidden bg-gray-100 flex flex-col font-mono select-none">
      {/* Unified Single-Row Top Navigation Bar (合併第一列與第二列) */}
      <header className="bg-slate-950 text-white px-2 sm:px-4 py-1.5 sm:py-2 border-b-2 border-yellow-400 flex items-center justify-between gap-1.5 sm:gap-3 shadow-lg shrink-0">
        {/* Left: Brand & System Title */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0 shrink-0">
          <span className="bg-yellow-400 text-black font-extrabold px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm tracking-wider whitespace-nowrap shrink-0">
            Wx3000
          </span>
          <span className="hidden md:inline text-sm lg:text-base font-bold tracking-wide text-yellow-300 whitespace-nowrap truncate">
            {activeTab === 'wbase' ? 'WBASE 基本資料管理系統' : '會計進銷存管理系統'}
          </span>
          {isElectronApp() && (
            <span className="hidden xl:flex bg-blue-900 text-blue-200 border border-blue-600 text-xs px-2 py-0.5 rounded items-center space-x-1 whitespace-nowrap shrink-0">
              <Monitor className="w-3 h-3 text-yellow-400 shrink-0" />
              <span>桌面端</span>
            </span>
          )}
        </div>

        {/* Right: Module Switcher + Server Status + Theme Toggle + Badges */}
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 shrink-0">
          {/* Tab Selection */}
          <nav className="flex space-x-1 sm:space-x-1.5 shrink-0">
            <button
              onClick={() => setActiveTab('wbase')}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded font-bold text-xs sm:text-sm transition border whitespace-nowrap cursor-pointer ${
                activeTab === 'wbase'
                  ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                  : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span className="sm:hidden">基本資料</span>
              <span className="hidden sm:inline xl:hidden">基本資料管理</span>
              <span className="hidden xl:inline">基本資料管理 [wbase]</span>
            </button>

            <button
              onClick={() => setActiveTab('purchase')}
              className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded font-bold text-xs sm:text-sm transition border whitespace-nowrap cursor-pointer ${
                activeTab === 'purchase'
                  ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                  : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="sm:hidden">進貨單</span>
              <span className="hidden sm:inline xl:hidden">進貨單據</span>
              <span className="hidden xl:inline">進貨單據 [wtaxop]</span>
            </button>
          </nav>

          {/* 伺服器狀態與連線設定按鈕 */}
          <button
            type="button"
            onClick={() => setIsServerModalOpen(true)}
            title={`點擊設定 ERP 伺服器連線 (${serverUrl}) [Ctrl+Shift+S]`}
            className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-yellow-400 text-[11px] sm:text-xs transition cursor-pointer text-gray-300 hover:text-white whitespace-nowrap shrink-0"
          >
            <Server className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="hidden sm:inline font-semibold text-yellow-300 max-w-[110px] md:max-w-[150px] truncate">
              {serverUrl.replace(/^https?:\/\//, '')}
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOnline === true
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : isOnline === false
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-yellow-500 animate-pulse'
              }`}
              title={isOnline === true ? '伺服器連線正常' : isOnline === false ? '伺服器未連線' : '檢查中'}
            />
          </button>

          {/* Theme Toggle Button (合併自第二列) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-indigo-950 border-indigo-500 text-indigo-200 hover:bg-indigo-900'
            }`}
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">淺色</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">深色</span>
              </>
            )}
          </button>

          {/* DB & Admin Badges (大螢幕顯示) */}
          <div className="hidden xl:flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs whitespace-nowrap shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>PostgreSQL a3000</span>
          </div>
          <div className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>最高管理者</span>
          </div>
        </div>
      </header>

      {/* 伺服器連線設定 Modal */}
      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onServerChanged={(newUrl) => setServerUrl(newUrl)}
      />

      {/* Main Page Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'wbase' ? <WbaseMainPage /> : <PurchaseOrderPage />}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;


