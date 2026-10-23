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
  ArrowLeft,
  Sun,
  Moon,
  LayoutGrid,
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
    key: 'acctType',
    label: '類別',
    width: '70px',
    render: (c) => (
      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-700">
        {c.acctType || '一般'}
      </span>
    ),
  },
];

export const Wbase2010Page: React.FC<Wbase2010PageProps> = ({ onBackToMenu }) => {
  const { isDark, toggleTheme } = useTheme();

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
      className={`h-full min-h-0 flex-1 flex flex-col font-sans selection:bg-blue-100 transition-colors duration-300 overflow-hidden ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900 font-medium'
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

      {/* Unified Single Top Bar */}
      <div
        className={`h-10 sm:h-11 shrink-0 border-b flex items-center justify-between px-3 md:px-4 z-30 transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-b-2 border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        {/* Left: Back to Menu + Breadcrumb + Mode Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm min-w-0">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold shadow-sm transition-all shrink-0 cursor-pointer text-xs"
              title="返回主選單 (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回主選單</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 min-w-0 font-medium">
            <LayoutGrid className={`w-3.5 h-3.5 shrink-0 hidden sm:block ${isDark ? 'text-slate-500' : 'text-indigo-600'}`} />
            <span className="hidden sm:inline text-xs text-slate-400">客戶資料 /</span>
            <span className={`font-black text-xs sm:text-sm truncate ${isDark ? 'text-white' : 'text-slate-950'}`}>
              客戶資料建檔
            </span>
            <span className="text-[11px] text-slate-500 font-mono font-bold hidden md:inline">
              (wbase2010)
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-1 sm:ml-2 shrink-0">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${
                mode === 'grid'
                  ? isDark
                    ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                  : isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              {mode === 'grid' ? 'GRID 瀏覽' : 'EDIT 編修'}
            </span>
          </div>
        </div>

        {/* Right: Selected record + Search button + Theme toggle + Esc */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {selectedCompany && (
            <div
              className={`hidden md:flex text-xs rounded-full px-2.5 py-0.5 border font-mono font-bold ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-yellow-300'
                  : 'bg-slate-50 border-slate-200 text-blue-900'
              }`}
            >
              {selectedCompany.code} · {selectedCompany.name}
            </div>
          )}

          <button
            onClick={openSearchModal}
            className={`h-7 px-2.5 rounded-lg border flex items-center justify-center gap-1 text-[11px] font-bold transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800 shadow-2xs'
            }`}
          >
            <Search size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            <span>查詢 F2</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white shadow-2xs'
            }`}
            title={isDark ? '切換至淺色主題' : '切換至深色主題'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <kbd
            className={`hidden sm:inline-block text-[11px] px-2 py-0.5 rounded border font-mono font-black whitespace-nowrap ${
              isDark
                ? 'text-slate-500 bg-slate-800/80 border-slate-700/50'
                : 'text-yellow-300 bg-slate-800 border-slate-700 shadow-2xs'
            }`}
          >
            Esc 返回
          </kbd>
        </div>
      </div>

      {/* Main Container: Fixed height, overflow-hidden */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-3 md:p-4 gap-3 max-w-[1500px] w-full mx-auto overflow-hidden">
        {/* Upper Part: Customer List Grid Card (Fixed at top, ALWAYS visible) */}
        <div className="shrink-0 w-full h-[200px] sm:h-[220px] md:h-[250px]">
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
            maxHeight="h-full"
            loading={loading}
            emptyText="查無客戶資料"
            getItemKey={(c) => c.code}
          />
        </div>

        {/* Lower Part: Left Tab Rail & Right Form Section Area */}
        <div className="flex-1 min-h-0 flex flex-row gap-2.5 sm:gap-3 overflow-hidden">
          {/* Left Vertical Tab Rail (F3 ~ F8): Auto-collapses to small F3~F8 buttons on narrow screens (<md), restores on md+ */}
          <div className="shrink-0 w-10 sm:w-11 md:w-[145px] lg:w-[155px] flex flex-col gap-1.5 overflow-y-auto pr-0.5 select-none transition-all duration-200">
            {TABS_CONFIG.map((tab) => {
              const isActive = activeTab === tab.idx;
              return (
                <button
                  key={tab.idx}
                  onClick={() => handleTabButtonClick(tab.idx)}
                  className={`group flex items-center h-9 rounded-lg text-xs font-semibold border transition-all text-left cursor-pointer shrink-0 w-10 sm:w-11 md:w-full justify-center md:justify-between px-1 md:px-2.5 lg:px-3 ${
                    isActive
                      ? isDark
                        ? 'bg-blue-950/90 border-blue-600 text-blue-200 shadow-sm ring-1 ring-blue-500/40 font-bold'
                        : 'bg-[#EEF4FF] border-blue-400 text-blue-700 shadow-sm ring-1 ring-blue-400/30 font-bold'
                      : isDark
                      ? 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  title={`${tab.title} (${tab.kbd})`}
                >
                  {/* Full label on Desktop (md+) */}
                  <div className="hidden md:flex items-center gap-2 truncate min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tab.color}`} />
                    <span className="truncate">{tab.title}</span>
                  </div>

                  {/* Compact view on narrow screens (<md): Colored Dot + Kbd */}
                  <div className="flex md:hidden flex-col items-center justify-center leading-none">
                    <span className={`w-1.5 h-1.5 rounded-full mb-0.5 shrink-0 ${tab.color}`} />
                    <span className="text-[11px] font-mono font-black">{tab.kbd}</span>
                  </div>

                  {/* Shortcut badge on Desktop (md+) */}
                  <span
                    className={`hidden md:inline-block text-[10px] border rounded px-1.5 py-0.5 font-mono shrink-0 ml-1 ${
                      isActive
                        ? isDark
                          ? 'border-blue-500 bg-blue-900 text-blue-100 font-bold'
                          : 'border-blue-400 bg-blue-100 text-blue-800 font-bold'
                        : isDark
                        ? 'border-slate-700 bg-slate-900 text-slate-400'
                        : 'border-slate-200 bg-slate-100 text-slate-500 font-medium'
                    }`}
                  >
                    {tab.kbd}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Form Content Cards (Independently Scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 sm:pr-1">
            <Wbase2010Form
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              inputRefsMap={inputRefsMap}
              mode={mode}
            />
          </div>
        </div>
      </div>

      {/* Unified Single Bottom Bar */}
      {mode === 'grid' ? (
        <div className="shrink-0 z-30 h-11 border-t bg-[#1E293B] border-slate-700/80 flex items-center justify-between px-3 md:px-4 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          {/* Left: Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={startAdd}
              className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 border bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 transition cursor-pointer"
            >
              <Plus size={13} />
              <span>Ins 新增</span>
            </button>

            <button
              onClick={deleteSelected}
              className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 border bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Del 刪除</span>
            </button>

            <button
              onClick={startEdit}
              className="h-8 px-3 sm:px-3.5 rounded-lg text-xs font-bold flex items-center gap-1 border bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-sm transition cursor-pointer"
            >
              <Edit3 size={13} />
              <span>F6 編修</span>
            </button>

            <button
              onClick={openSearchModal}
              className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 border bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 transition cursor-pointer"
            >
              <Search size={13} />
              <span>F2 查詢</span>
            </button>

            <button
              onClick={() => setIsPrintOpen(true)}
              className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 border bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 transition cursor-pointer"
            >
              <Printer size={13} />
              <span>P 列印</span>
            </button>
          </div>

          {/* Center: Shortcut Hint */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate px-2">
            <span>Grid: ↑↓換筆 · Enter/F6編修</span>
            <span className="text-slate-600">|</span>
            <span>編輯: Enter下一格 · Esc存檔回清單</span>
          </div>

          {/* Right: Record count + Mode badge + Exit Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300">
              <span className="hidden sm:inline">筆數</span>
              <span className="text-yellow-400">{selectedIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span>{filteredCompanies.length}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-950/80 text-blue-300 font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>BROWSE</span>
            </div>

            <button
              onClick={() => {
                if (onBackToMenu) onBackToMenu();
                else gridContainerRef.current?.focus();
              }}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-rose-900/60 hover:border-rose-700 text-slate-200 text-xs font-bold border border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut size={13} />
              <span>Esc 離開</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 z-30 h-11 border-t bg-[#0F172A] border-slate-700/80 flex items-center justify-between px-3 md:px-4 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          {/* Left: Mode description */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[11px] font-mono font-bold">
              {mode === 'add' ? '新增模式 ADD' : '編輯模式 EDIT'}
            </span>
            <span className="hidden sm:inline text-slate-400 text-xs font-normal">
              Enter 依序跳格 · F3~F8 切換分頁 · Esc / F9 儲存並回清單
            </span>
          </div>

          {/* Right: Save & Cancel Buttons */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={saveForm}
              className="h-8 px-3.5 sm:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>F9 / Esc. 儲存並回清單</span>
            </button>

            <button
              onClick={cancelEdit}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              放棄修改
            </button>
          </div>
        </div>
      )}

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
