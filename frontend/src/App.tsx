import { useState, useEffect } from 'react';
import { MainMenuPage } from './mainmenu';
import { WbaseMainPage } from './wbase/menu/wbaseMainPage';
import { PurchaseOrderPage } from './wtaxop/PurchaseOrder/PurchaseOrderPage';
import {
  LayoutGrid,
  FileText,
  Server,
  Monitor,
  Sun,
  Moon,
  HardDrive,
  ShieldCheck,
  Home,
  Building2,
} from 'lucide-react';
import { ThemeProvider, useTheme } from './wbase/menu/ThemeContext';
import { ServerConfigModal } from './components/ServerConfigModal';
import {
  getApiServerUrl,
  isElectronApp,
  checkServerConnection,
  getDataDrive,
  setDataDrive,
  isDataDriveConfigured,
  getPgSchema,
} from './services/apiConfig';

function AppContent() {
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'mainmenu' | 'wbase' | 'purchase'>('mainmenu');
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiServerUrl());
  const [dataDrive, setDriveState] = useState(getDataDrive());
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const clientTitle = '芋某大學學院';

  // 主選單開啟時，檢查資料來源磁碟機設定；若未設定過，預設為 C 碟並開啟設定視窗供使用者填寫
  useEffect(() => {
    if (activeTab === 'mainmenu') {
      const configured = isDataDriveConfigured();
      if (!configured) {
        setDataDrive('C', false);
        setDriveState('C');
        setIsServerModalOpen(true);
      }
    }
  }, [activeTab]);

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
    <div
      className={`w-full h-screen h-dvh overflow-hidden flex flex-col font-mono select-none transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* 整合單一現代化頂部工具列 (Merged Unified Top Navigation Bar) */}
      <header
        className={`px-3 sm:px-4 py-1 sm:py-1.5 border-b flex items-center justify-between gap-2 shadow-xs shrink-0 z-30 transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Left: Brand Emblem + Title + Module Navigation Tabs */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 shrink-0">
          {/* Chi-Sheng Hi WEB Emblem */}
          <img
            src="/favicon.svg"
            alt="奇勝資訊 Wx3000"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-xs shrink-0 select-none object-contain"
          />

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span
              className={`text-sm sm:text-base font-black tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              奇勝資訊
            </span>
            <span
              className={`hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold tracking-wider border ${
                isDark
                  ? 'bg-blue-950/70 text-blue-300 border-blue-800/70'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              Wx3000
            </span>
          </div>

          {/* Module Switcher Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 ml-1 sm:ml-2 shrink-0">
            <button
              onClick={() => setActiveTab('mainmenu')}
              className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-lg font-bold text-xs transition border whitespace-nowrap cursor-pointer ${
                activeTab === 'mainmenu'
                  ? isDark
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80'
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">主選單</span>
              <span className="hidden sm:inline">系統主選單</span>
            </button>

            <button
              onClick={() => setActiveTab('wbase')}
              className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-lg font-bold text-xs transition border whitespace-nowrap cursor-pointer ${
                activeTab === 'wbase'
                  ? isDark
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">基本資料</span>
              <span className="hidden sm:inline">基本資料管理</span>
            </button>

            <button
              onClick={() => setActiveTab('purchase')}
              className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-lg font-bold text-xs transition border whitespace-nowrap cursor-pointer ${
                activeTab === 'purchase'
                  ? isDark
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                  : isDark
                  ? 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">進貨單</span>
              <span className="hidden sm:inline">進貨單據</span>
            </button>
          </nav>

          {isElectronApp() && (
            <span
              className={`hidden xl:flex text-xs px-2 py-0.5 rounded-md items-center space-x-1 whitespace-nowrap shrink-0 border ${
                isDark
                  ? 'bg-slate-800 text-blue-300 border-slate-700'
                  : 'bg-slate-100 text-blue-800 border-slate-200'
              }`}
            >
              <Monitor className="w-3 h-3 text-blue-500 shrink-0" />
              <span>桌面端</span>
            </span>
          )}
        </div>

        {/* Center: Client / Organization Title */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs sm:text-sm font-extrabold tracking-wider ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/80 text-amber-300'
              : 'bg-blue-50/90 border-blue-200/80 text-blue-900'
          }`}
        >
          <Building2
            className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-blue-600'}`}
          />
          <span>{clientTitle}</span>
        </div>

        {/* Right: Server & Drive Combined Status + Theme Toggle + Badges */}
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 shrink-0">
          {/* 合併顯示：ERP 伺服器 IP 與資料來源磁碟機 (點擊開窗設定) */}
          <button
            type="button"
            onClick={() => setIsServerModalOpen(true)}
            title={`伺服器: ${serverUrl} | 資料來源: ${dataDrive}:\\w3000 (Schema: ${getPgSchema()}) [點擊或按 Ctrl+Shift+S 設定]`}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900'
            }`}
          >
            <Server
              className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-blue-600'}`}
            />
            <span className="font-mono font-medium max-w-[120px] md:max-w-[150px] truncate">
              {serverUrl.replace(/^https?:\/\//, '')}
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOnline === true
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                  : isOnline === false
                  ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                  : 'bg-amber-400'
              }`}
              title={
                isOnline === true ? '伺服器連線正常' : isOnline === false ? '伺服器未連線' : '檢查中'
              }
            />
            <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>|</span>
            <HardDrive className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
              {dataDrive}:\w3000
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80'
            }`}
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">淺色</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">深色</span>
              </>
            )}
          </button>

          {/* Admin Badge */}
          <div
            className={`hidden lg:flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>最高管理者</span>
          </div>
        </div>
      </header>

      {/* 伺服器連線與資料來源設定 Modal */}
      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onServerChanged={(newUrl) => setServerUrl(newUrl)}
        onConfigApplied={(drive) => setDriveState(drive)}
      />

      {/* Main Page Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'mainmenu' ? (
          <MainMenuPage
            clientTitle={clientTitle}
            onNavigateSubsystem={(code, target) => {
              if (code === 'wbase' || target === 'wbase') {
                setActiveTab('wbase');
              } else if (code === 'wtaxop' || target === 'purchase') {
                setActiveTab('purchase');
              }
            }}
          />
        ) : activeTab === 'wbase' ? (
          <WbaseMainPage onBackToMainMenu={() => setActiveTab('mainmenu')} />
        ) : (
          <PurchaseOrderPage />
        )}
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
