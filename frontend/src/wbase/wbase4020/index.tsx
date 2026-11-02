import React, { useEffect, useMemo } from 'react';
import { useWbase4020 } from './useWbase4020';
import type { Wbase4020Tab } from './useWbase4020';
import { Wbase4020Form } from './Wbase4020Form';
import { Wbase4030Form } from './Wbase4030Form';
import { Wbase4040Form } from './Wbase4040Form';
import { Wbase4050Form } from './Wbase4050Form';
import { Wbase4060Form } from './Wbase4060Form';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import {
  FileSpreadsheet,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowDown,
  FileText,
  Boxes,
  Bookmark,
  Sliders,
} from 'lucide-react';

export interface Wbase4020PageProps {
  initialTab?: Wbase4020Tab;
  onBackToMenu?: () => void;
}

const TAB_CONFIGS: { id: Wbase4020Tab; label: string; icon: React.ReactNode; subtitle: string }[] = [
  {
    id: '4020',
    label: '4-2 營業稅設定',
    icon: <FileText className="w-4 h-4" />,
    subtitle: '客戶營業稅專用會計科目、媒體申報方式、總繳與申報週期維護 (customer.dbf)',
  },
  {
    id: '4030',
    label: '4-3 傳票轉檔設定',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    subtitle: '客戶進銷項傳票連線轉檔型態、連線種類與連線天數設定 (customer.dbf)',
  },
  {
    id: '4040',
    label: '4-4 進銷存方式設定',
    icon: <Boxes className="w-4 h-4" />,
    subtitle: '客戶期末存貨計算方式與會計類別設定 (acc_st.dbf / customer.dbf)',
  },
  {
    id: '4050',
    label: '4-5 共用科目摘要',
    icon: <Bookmark className="w-4 h-4" />,
    subtitle: '各會計科目常用傳票摘要預設片語清單維護 (descrip.dbf)',
  },
  {
    id: '4060',
    label: '4-6 共用參數設定',
    icon: <Sliders className="w-4 h-4" />,
    subtitle: '全系統共用參數：多家列印作業模式設定 (pub_para.dbf)',
  },
];

export const Wbase4020Page: React.FC<Wbase4020PageProps> = ({
  initialTab = '4020',
  onBackToMenu,
}) => {
  const {
    activeTab,
    setActiveTab,
    loading,
    error,
    taxRows,
    setTaxRows,
    saveTaxRow,
    applyDefaultTax,
    voucherRows,
    setVoucherRows,
    saveVoucherRow,
    applyDefaultVoucher,
    stockRows,
    setStockRows,
    saveStockRow,
    enterDirection,
    toggleEnterDirection,
    refreshCurrentTab,
    searchOpen,
    setSearchOpen,
    handleSearchCustomer,
  } = useWbase4020(initialTab);

  // 當外部 initialTab 變更時同步
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, setActiveTab]);

  const currentTabConfig = TAB_CONFIGS.find((t) => t.id === activeTab) || TAB_CONFIGS[0];

  // 全域鍵盤監聽 (Esc / F12 / F9)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (searchOpen) return;

      if (e.key === 'F12') {
        e.preventDefault();
        toggleEnterDirection();
      } else if (e.key === 'F9' || e.key === 'F3') {
        if (activeTab === '4020' || activeTab === '4030' || activeTab === '4040') {
          e.preventDefault();
          setSearchOpen(true);
        }
      } else if (e.key === 'Escape') {
        // Esc 回主選單：防呆檢查畫面上是否有任何彈出視窗 (Modal) 開啟中
        const hasOpenModal = document.querySelector('.fixed.inset-0.z-50') !== null;
        if (hasOpenModal) {
          return;
        }

        if (onBackToMenu) {
          e.preventDefault();
          onBackToMenu();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchOpen, toggleEnterDirection, activeTab, setSearchOpen, onBackToMenu]);

  // 搜尋用清單轉換
  const searchItems: SearchItem[] = useMemo(() => {
    if (activeTab === '4020') {
      return taxRows.map((r) => ({
        code: r.no,
        name: r.abbr || r.name,
      }));
    } else if (activeTab === '4030') {
      return voucherRows.map((r) => ({
        code: r.no,
        name: r.abbr || r.name,
      }));
    } else if (activeTab === '4040') {
      return stockRows.map((r) => ({
        code: r.no,
        name: r.name,
      }));
    }
    return [];
  }, [activeTab, taxRows, voucherRows, stockRows]);

  const handleSelectSearch = (item: SearchItem) => {
    setSearchOpen(false);
    handleSearchCustomer(item.code);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-900 select-none">
      {/* 頂部標準 WbasePageHeader */}
      <WbasePageHeader
        category="4. 操作設定"
        title={currentTabConfig.label}
        code={`wbase${activeTab}`}
        mode="grid"
        modeLabel="GRID 盲打編修"
        onBackToMenu={onBackToMenu}
        actions={
          <div className="flex items-center gap-2">
            {(activeTab === '4020' || activeTab === '4030' || activeTab === '4040') && (
              <>
                <button
                  type="button"
                  onClick={toggleEnterDirection}
                  className="px-2.5 py-1 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 rounded flex items-center gap-1 shadow-xs transition-all"
                  title="切換 Enter 鍵游標移動方向 [F12]"
                >
                  {enterDirection === 'right' ? (
                    <ArrowRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5" />
                  )}
                  方向 [F12]: {enterDirection === 'right' ? '→' : '↓'}
                </button>

                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="px-2.5 py-1 text-xs font-mono font-bold bg-blue-700 hover:bg-blue-800 text-white rounded flex items-center gap-1 shadow-xs transition-all"
                  title="搜尋客戶代號 [F9 / F3]"
                >
                  <Search className="w-3.5 h-3.5" />
                  搜尋 [F9]
                </button>
              </>
            )}

            <button
              type="button"
              onClick={refreshCurrentTab}
              className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
              title="重新載入資料"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 五合一功能頁籤導覽列 (Tabs) */}
      <div className="flex items-center px-4 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 gap-1 overflow-x-auto">
        {TAB_CONFIGS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-mono text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-amber-500 text-blue-900 dark:text-amber-300 bg-white dark:bg-slate-900 shadow-xs'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 主工作區 (Tab 內容切換) */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {error && (
          <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs font-mono border-b border-rose-300">
            {error}
          </div>
        )}

        {activeTab === '4020' && (
          <Wbase4020Form
            rows={taxRows}
            onRowsChange={setTaxRows}
            onSaveRow={saveTaxRow}
            onApplyDefaultTax={applyDefaultTax}
            onRefreshData={refreshCurrentTab}
            onExit={onBackToMenu}
            enterDirection={enterDirection}
            onDirectionToggle={toggleEnterDirection}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}

        {activeTab === '4030' && (
          <Wbase4030Form
            rows={voucherRows}
            onRowsChange={setVoucherRows}
            onSaveRow={saveVoucherRow}
            onApplyDefaultVoucher={applyDefaultVoucher}
            onRefreshData={refreshCurrentTab}
            onExit={onBackToMenu}
            enterDirection={enterDirection}
            onDirectionToggle={toggleEnterDirection}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}

        {activeTab === '4040' && (
          <Wbase4040Form
            rows={stockRows}
            onRowsChange={setStockRows}
            onSaveRow={saveStockRow}
            onExit={onBackToMenu}
            enterDirection={enterDirection}
            onDirectionToggle={toggleEnterDirection}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}

        {activeTab === '4050' && <Wbase4050Form onExit={onBackToMenu} />}

        {activeTab === '4060' && <Wbase4060Form onExit={onBackToMenu} />}
      </div>

      {/* 共通客戶代號搜尋視窗 (F9 / F3) */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={`客戶代號搜尋 [F9 / F3] - ${currentTabConfig.label}`}
        onSearch={async (q) => {
          const upper = q.trim().toUpperCase();
          if (!upper) return searchItems;
          return searchItems.filter(
            (i) => i.code.toUpperCase().includes(upper) || i.name.includes(q.trim())
          );
        }}
        onSelect={handleSelectSearch}
      />
    </div>
  );
};
