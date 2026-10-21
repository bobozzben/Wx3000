import { useState, useEffect } from 'react';
import { WbaseMainPage } from './wbase/menu/wbaseMainPage';
import { PurchaseOrderPage } from './wtaxop/PurchaseOrder/PurchaseOrderPage';
import { LayoutGrid, FileText, Server, Monitor } from 'lucide-react';
import { ThemeProvider } from './wbase/menu/ThemeContext';
import { ServerConfigModal } from './components/ServerConfigModal';
import { getApiServerUrl, isElectronApp, checkServerConnection } from './services/apiConfig';

function App() {
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
    <ThemeProvider>
      <div className="w-full h-screen h-dvh overflow-hidden bg-gray-100 flex flex-col font-mono select-none">
        {/* Top Navigation Bar */}
        <header className="bg-slate-950 text-white px-2 sm:px-4 py-1.5 sm:py-2 border-b-2 border-yellow-400 flex items-center justify-between gap-1.5 sm:gap-3 shadow-lg shrink-0">
          <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0 shrink-0">
            <span className="bg-yellow-400 text-black font-extrabold px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm tracking-wider whitespace-nowrap shrink-0">
              Wx3000
            </span>
            <span className="hidden md:inline text-sm lg:text-base font-bold tracking-wide text-yellow-300 whitespace-nowrap truncate">
              會計進銷存管理系統
            </span>
            {isElectronApp() && (
              <span className="hidden lg:flex bg-blue-900 text-blue-200 border border-blue-600 text-xs px-2 py-0.5 rounded items-center space-x-1 whitespace-nowrap shrink-0">
                <Monitor className="w-3 h-3 text-yellow-400 shrink-0" />
                <span>桌面客戶端</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
            {/* 伺服器狀態與連線設定按鈕 */}
            <button
              type="button"
              onClick={() => setIsServerModalOpen(true)}
              title="點擊設定 ERP 伺服器連線 (Ctrl+Shift+S)"
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-yellow-400 text-[11px] sm:text-xs transition cursor-pointer text-gray-300 hover:text-white whitespace-nowrap shrink-0"
            >
              <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400 shrink-0" />
              <span className="text-gray-400 hidden lg:inline">伺服器:</span>
              <span className="font-semibold text-yellow-300 max-w-[95px] sm:max-w-[140px] md:max-w-[160px] truncate">
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

            {/* Tab Selection */}
            <nav className="flex space-x-1 sm:space-x-2 shrink-0">
              <button
                onClick={() => setActiveTab('wbase')}
                className={`flex items-center space-x-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded font-bold text-xs sm:text-sm transition border whitespace-nowrap ${
                  activeTab === 'wbase'
                    ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                    : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
                <span className="sm:hidden">基本資料</span>
                <span className="hidden sm:inline lg:hidden">基本資料管理</span>
                <span className="hidden lg:inline">基本資料管理 [wbase]</span>
              </button>

              <button
                onClick={() => setActiveTab('purchase')}
                className={`flex items-center space-x-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded font-bold text-xs sm:text-sm transition border whitespace-nowrap ${
                  activeTab === 'purchase'
                    ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                    : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="sm:hidden">進貨單</span>
                <span className="hidden sm:inline lg:hidden">進貨單據</span>
                <span className="hidden lg:inline">進貨單據 [wtaxop]</span>
              </button>
            </nav>
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
    </ThemeProvider>
  );
}

export default App;


