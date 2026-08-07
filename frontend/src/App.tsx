import { useState } from 'react';
import { WbaseMainPage } from './wbase/menu/wbaseMainPage';
import { PurchaseOrderPage } from './wtaxop/PurchaseOrder/PurchaseOrderPage';
import { LayoutGrid, FileText } from 'lucide-react';
import { ThemeProvider } from './wbase/menu/ThemeContext';

function App() {
  const [activeTab, setActiveTab] = useState<'wbase' | 'purchase'>('wbase');

  return (
    <ThemeProvider>
      <div className="w-full min-h-screen bg-gray-100 flex flex-col font-mono">
        {/* Top Navigation Bar */}
        <header className="bg-slate-950 text-white px-6 py-2 border-b-2 border-yellow-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <span className="bg-yellow-400 text-black font-extrabold px-2 py-0.5 rounded text-sm tracking-wider">
              Wx3000
            </span>
            <span className="text-base font-bold tracking-wide text-yellow-300">
              雲端會計進銷存系統 (FoxPro 重製版)
            </span>
          </div>

          {/* Tab Selection */}
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('wbase')}
              className={`flex items-center space-x-1 px-4 py-1.5 rounded font-bold text-sm transition border ${activeTab === 'wbase'
                  ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                  : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
                }`}
            >
              <LayoutGrid className="w-4 h-4 text-yellow-400" />
              <span>基本資料管理主畫面 [wbase]</span>
            </button>

            <button
              onClick={() => setActiveTab('purchase')}
              className={`flex items-center space-x-1 px-4 py-1.5 rounded font-bold text-sm transition border ${activeTab === 'purchase'
                  ? 'bg-blue-900 text-yellow-300 border-yellow-400 shadow-md'
                  : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
                }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>TEST [wtaxop]</span>
            </button>
          </nav>
        </header>

        {/* Main Page Area */}
        <main className="flex-1">
          {activeTab === 'wbase' ? <WbaseMainPage /> : <PurchaseOrderPage />}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;


