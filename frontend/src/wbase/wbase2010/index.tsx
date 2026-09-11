import React, { useEffect } from 'react';
import { useWbase2010 } from './useWbase2010';
import type { CompanyItem } from '../../services/wbase2010';
import { Wbase2010Form } from './Wbase2010Form';
import { Wbase2010Print } from './wbase2010Print';
import { TABS_CONFIG } from './companyFieldDefs';
import { useTheme } from '../menu/ThemeContext';
import { FoxProGridCard } from '../../components/FoxProGridCard';
import type { FoxProGridCardColumn } from '../../components/FoxProGridCard';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  LogOut,
  Printer,
} from 'lucide-react';

interface Wbase2010PageProps {
  onBackToMenu?: () => void;
}

const COMPANY_COLUMNS: FoxProGridCardColumn<CompanyItem>[] = [
  { key: 'code', label: '編號', width: '90px' },
  { key: 'name', label: '客戶名稱', width: '1fr' },
  { key: 'uni', label: '統編', width: '130px' },
  { key: 'owner', label: '負責人', width: '90px' },
  { key: 'tel', label: '電話', width: '140px' },
  {
    key: 'type',
    label: '類別',
    width: '70px',
    render: (c) => (
      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-700">
        {c.type || '上市'}
      </span>
    ),
  },
];

export const Wbase2010Page: React.FC<Wbase2010PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();

  const {
    companies,
    filteredCompanies,
    loading,
    selectedIndex,
    setSelectedIndex,
    mode,
    activeTab,
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    isPrintOpen,
    setIsPrintOpen,
    formData,
    setFormData,
    gridContainerRef,
    inputRefsMap,
    switchTab,
    startEdit,
    startAdd,
    cancelEdit,
    saveForm,
    deleteSelected,
    handleGridKeyDown,
    openSearchModal,
    closeSearchModal,
    selectCompanyFromSearch,
  } = useWbase2010(onBackToMenu);

  const [searchModalIndex, setSearchModalIndex] = React.useState<number>(0);
  const modalListRef = React.useRef<HTMLDivElement>(null);

  // Reset modal highlighted index when search modal opens or search query changes
  useEffect(() => {
    if (isSearchOpen) {
      setSearchModalIndex(0);
    }
  }, [isSearchOpen, searchQuery]);

  // Scroll active search item into view inside search modal list
  useEffect(() => {
    if (isSearchOpen) {
      const el = document.getElementById(`search-item-${searchModalIndex}`);
      const container = modalListRef.current;
      if (el && container) {
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const rowTop = el.offsetTop;
        const rowHeight = el.offsetHeight;

        if (rowTop < containerTop) {
          container.scrollTop = rowTop;
        } else if (rowTop + rowHeight > containerTop + containerHeight) {
          container.scrollTop = rowTop + rowHeight - containerHeight;
        }
      }
    }
  }, [searchModalIndex, isSearchOpen]);

  const handleSearchModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchModalIndex((prev) => Math.min(filteredCompanies.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchModalIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCompanies.length > 0 && filteredCompanies[searchModalIndex]) {
        selectCompanyFromSearch(filteredCompanies[searchModalIndex].code);
      }
    } else if (e.key === 'Escape' || e.key === 'F2') {
      e.preventDefault();
      closeSearchModal();
    }
  };

  // Scroll active row into view inside grid container in grid mode (strictly scoped to container)
  useEffect(() => {
    if (mode === 'grid') {
      const el = document.getElementById(`row-${selectedIndex}`);
      const container = gridContainerRef.current;
      if (el && container) {
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const rowTop = el.offsetTop;
        const rowHeight = el.offsetHeight;

        if (rowTop < containerTop) {
          container.scrollTop = rowTop;
        } else if (rowTop + rowHeight > containerTop + containerHeight) {
          container.scrollTop = rowTop + rowHeight - containerHeight;
        }
      }
    }
  }, [selectedIndex, mode, loading]);

  // Auto focus grid container when entering page or when mode is grid
  useEffect(() => {
    if (mode === 'grid') {
      const timer = setTimeout(() => {
        gridContainerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, loading]);

  const selectedCompany = filteredCompanies[selectedIndex] || companies[0] || null;

  const handleTabButtonClick = (tabIdx: number) => {
    switchTab(tabIdx);
    if (mode === 'grid') {
      startEdit();
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans selection:bg-blue-100 transition-colors duration-300 ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-[#F6F8FA] text-slate-800'
      }`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap');
        *{font-family:'Inter','Noto Sans TC',system-ui,-apple-system,sans-serif}
        .fox-flash{ background:#FEF08A !important; color: #0F172A !important; box-shadow:0 0 0 2px #FACC15 !important; transition: background 0.15s; }
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-thumb{background:${isDark ? '#475569' : '#CBD5E1'};border-radius:4px}
        ::-webkit-scrollbar-track{background:${isDark ? '#1E293B' : '#F1F5F9'}}
      `}</style>

      {/* Top Bar Header */}
      <div
        className={`h-[52px] border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-[13px]">
            F
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight leading-none">
              FoxPro Client
            </div>
            <div
              className={`text-[11px] leading-none mt-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              客戶主檔維護 · Beautified Fixed v2
            </div>
          </div>

          <div className="hidden md:flex ml-6 items-center gap-2">
            <span
              className={`text-[11px] px-2 py-1 rounded-full border font-medium ${
                isDark
                  ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                  : 'bg-blue-50 text-blue-700 border-blue-100'
              }`}
            >
              GRID MODE
            </span>
            <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/</span>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {mode === 'grid' ? '瀏覽' : '編輯'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`hidden md:flex text-[11px] rounded-full px-3 py-1 border ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {selectedCompany
              ? `${selectedCompany.code} · ${selectedCompany.name}`
              : '未選擇'}
          </div>

          <button
            onClick={openSearchModal}
            className={`h-8 w-8 md:w-auto md:px-3 rounded-lg border flex items-center justify-center gap-1.5 text-[12px] font-medium transition ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
            }`}
          >
            <Search size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            <span className="hidden md:inline">查詢 F2</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-3 md:p-5 gap-4 max-w-[1440px] w-full mx-auto">
        {/* Customer List Grid Card */}
        <FoxProGridCard<CompanyItem>
          title="客戶清單"
          totalCount={filteredCompanies.length}
          shortcutHint="↑↓ 換筆 · Enter / F6 編修 · F2 查詢"
          data={filteredCompanies}
          columns={COMPANY_COLUMNS}
          gridColsLayout="grid-cols-1 md:grid-cols-[90px_1fr_130px_90px_140px_70px]"
          selectedIndex={selectedIndex}
          onSelectRow={(_c, idx) => {
            setSelectedIndex(idx);
            gridContainerRef.current?.focus();
          }}
          onDoubleClickRow={startEdit}
          onKeyDown={handleGridKeyDown}
          gridContainerRef={gridContainerRef as unknown as React.RefObject<HTMLDivElement>}
          loading={loading}
          emptyText="查無客戶資料"
          getItemKey={(c) => c.code}
        />

        {/* Tab Pills & Form Section Area */}
        <div className="flex flex-col gap-3">
          {/* Tab Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {TABS_CONFIG.map((tab) => {
              const isActive = activeTab === tab.idx;
              return (
                <button
                  key={tab.idx}
                  onClick={() => handleTabButtonClick(tab.idx)}
                  className={`group flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium border transition-all shrink-0 ${
                    isActive
                      ? isDark
                        ? 'bg-blue-950/80 border-blue-700 text-blue-300 shadow-sm'
                        : 'bg-[#EEF4FF] border-blue-200 text-blue-700 shadow-sm'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${tab.color}`} />
                  <span>{tab.title}</span>
                  <span
                    className={`text-[10px] border rounded px-1 font-mono ${
                      isActive
                        ? isDark
                          ? 'border-blue-700 bg-blue-900 text-blue-200'
                          : 'border-blue-300 bg-blue-100 text-blue-800'
                        : isDark
                        ? 'border-slate-700 bg-slate-900 text-slate-400'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.kbd}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Form Content Cards */}
          <Wbase2010Form
            activeTab={activeTab}
            formData={formData}
            setFormData={setFormData}
            inputRefsMap={inputRefsMap}
            mode={mode}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="mt-auto sticky bottom-0 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
        <div
          className={`h-8 border-t flex items-center justify-between px-4 text-[11px] ${
            isDark
              ? 'bg-slate-950 border-slate-800 text-slate-400'
              : 'bg-[#F3F4F6] border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <span className="hidden md:inline">
              Grid: ↑↓換筆 Enter/F6編修 | 編輯: Enter下一格 F3~F8切頁 Esc存檔回清單 | 瀏覽: Esc離開
            </span>
            <span className="md:hidden">↑↓換筆 · Enter下一格 · Esc存檔/離開</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline">
              筆數 {selectedIndex + 1}/{filteredCompanies.length}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'edit' || mode === 'add' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            <span>{mode === 'edit' || mode === 'add' ? 'EDITING' : 'BROWSE'}</span>
          </div>
        </div>

        {/* Bottom Action Bar (Grid Mode) */}
        {mode === 'grid' && (
          <div className="h-[48px] bg-[#1E293B] flex items-center justify-between px-3 md:px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={startAdd}
                className="h-8 px-2.5 md:px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition"
              >
                <Plus size={14} />
                <span className="hidden md:inline">Ins 新增</span>
                <span className="md:hidden">Ins</span>
                <span className="hidden lg:inline ml-1 text-[10px] opacity-60 border border-white/20 rounded px-1">
                  Ins
                </span>
              </button>

              <button
                onClick={deleteSelected}
                className="h-8 px-2.5 md:px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition"
              >
                <Trash2 size={14} />
                <span className="hidden md:inline">Del 刪除</span>
                <span className="md:hidden">Del</span>
                <span className="hidden lg:inline ml-1 text-[10px] opacity-60 border border-white/20 rounded px-1">
                  Del
                </span>
              </button>

              <div className="w-px h-5 bg-slate-700 mx-1 hidden md:block" />

              <button
                onClick={startEdit}
                className="h-8 px-2.5 md:px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-sm transition"
              >
                <Edit3 size={14} />
                <span className="hidden md:inline">F6 編修</span>
                <span className="md:hidden">F6</span>
                <span className="hidden lg:inline ml-1 text-[10px] opacity-60 border border-white/20 rounded px-1">
                  F6
                </span>
              </button>

              <button
                onClick={openSearchModal}
                className="h-8 px-2.5 md:px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition"
              >
                <Search size={14} />
                <span className="hidden md:inline">F2 查詢</span>
                <span className="md:hidden">F2</span>
                <span className="hidden lg:inline ml-1 text-[10px] opacity-60 border border-white/20 rounded px-1">
                  F2
                </span>
              </button>

              <button
                onClick={() => setIsPrintOpen(true)}
                className="h-8 px-2.5 md:px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition"
              >
                <Printer size={14} />
                <span className="hidden md:inline">P 列印</span>
                <span className="md:hidden">P</span>
                <span className="hidden lg:inline ml-1 text-[10px] opacity-60 border border-white/20 rounded px-1">
                  P
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onBackToMenu) onBackToMenu();
                  else gridContainerRef.current?.focus();
                }}
                className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[12px] font-medium border border-slate-700 flex items-center gap-1.5 transition"
              >
                <LogOut size={14} />
                <span className="hidden md:inline">Esc 離開</span>
                <span className="md:hidden">離開</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Action Bar (Edit / Add Mode) */}
        {(mode === 'edit' || mode === 'add') && (
          <div className="h-[48px] bg-[#0F172A] flex items-center justify-between px-4">
            <div className="flex items-center gap-3 text-[12px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              編輯模式 · Enter 依序跳格 · Esc 儲存並回清單
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveForm}
                className="h-8 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>儲存並回清單</span>
                <span className="text-[10px] opacity-80 border border-white/30 rounded px-1 font-mono">Esc</span>
              </button>
              <button
                onClick={cancelEdit}
                className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[12px] font-medium border border-slate-700 transition"
              >
                放棄修改
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Modal Dialog (F2) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`rounded-[12px] shadow-2xl w-full max-w-[560px] overflow-hidden border-2 transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-blue-900 text-slate-900'
            }`}
          >
            <div
              className={`h-12 px-5 flex items-center justify-between border-b ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-[#1E3A8A] text-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-[14px]">
                <Search size={16} className="text-yellow-400" />
                <span>查詢客戶 F2 [純鍵盤 ↑↓移動 Enter選擇 Esc關閉]</span>
              </div>
              <button
                onClick={closeSearchModal}
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-blue-800 text-white'
                }`}
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchModalKeyDown}
                  placeholder="輸入編號、名稱、統編、負責人... (↑↓鍵選擇, Enter確定)"
                  className={`w-full h-10 pl-10 pr-3 rounded-[8px] border text-[13px] focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500'
                      : 'bg-white border-[#D1D5DB] text-slate-800 font-mono'
                  }`}
                />
              </div>

              <div
                ref={modalListRef}
                className={`mt-4 max-h-[300px] overflow-auto divide-y border rounded-lg ${
                  isDark
                    ? 'border-slate-700 divide-slate-800'
                    : 'border-slate-200 divide-slate-100'
                }`}
              >
                {filteredCompanies.map((c, idx) => {
                  const isSelected = idx === searchModalIndex;
                  return (
                    <button
                      key={c.code}
                      id={`search-item-${idx}`}
                      onClick={() => selectCompanyFromSearch(c.code)}
                      onMouseEnter={() => setSearchModalIndex(idx)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        isSelected
                          ? isDark
                            ? 'bg-blue-900/90 text-yellow-300 ring-2 ring-yellow-400 font-medium'
                            : 'bg-blue-600 text-white font-medium shadow-inner ring-2 ring-yellow-400'
                          : isDark
                          ? 'hover:bg-slate-800/80 text-slate-200'
                          : 'hover:bg-[#F5F7FF] text-slate-900'
                      }`}
                    >
                      <div>
                        <div className="text-[13px] font-medium flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                              isSelected
                                ? 'bg-yellow-400 text-slate-950 font-bold'
                                : isDark
                                ? 'bg-slate-800 text-slate-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {c.code}
                          </span>
                          <span>{c.name}</span>
                        </div>
                        <div
                          className={`text-[11px] mt-1 ${
                            isSelected
                              ? 'text-blue-100'
                              : isDark
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }`}
                        >
                          統編: {c.uni || '-'} · 負責人: {c.owner || '-'} · 電話: {c.tel || '-'}
                        </div>
                      </div>
                      <div
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-yellow-400 text-slate-950 font-bold'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.type || '上市'}
                      </div>
                    </button>
                  );
                })}

                {filteredCompanies.length === 0 && (
                  <div
                    className={`p-8 text-center text-[13px] ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    查無符合「{searchQuery}」之客戶資料
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px]">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  符合條件: {filteredCompanies.length} 筆
                </span>
                <button
                  onClick={closeSearchModal}
                  className="h-8 px-4 rounded-lg bg-slate-800 text-slate-200 text-[12px] font-medium hover:bg-slate-700 transition border border-slate-700"
                >
                  關閉 Esc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {isPrintOpen && (
        <Wbase2010Print
          company={selectedCompany}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
};
