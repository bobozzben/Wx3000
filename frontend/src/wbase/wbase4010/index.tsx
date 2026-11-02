import React, { useState, useEffect, useMemo } from 'react';
import { useWbase4010 } from './useWbase4010';
import { Wbase4010Form } from './Wbase4010Form';
import { Wbase4010BatchCopyModal } from './Wbase4010BatchCopyModal';
import { Wbase4010Print } from './wbase4010Print';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { ACCOUNT_MODES, getDeptDescription } from '../../services/wbase4010';
import {
  Plus,
  Trash2,
  Copy,
  Printer,
  Search,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase4010PageProps {
  initialMode?: number;
  onBackToMenu?: () => void;
}

export const Wbase4010Page: React.FC<Wbase4010PageProps> = ({
  initialMode = 1,
  onBackToMenu,
}) => {
  const { isDark } = useTheme();

  const {
    currentMode,
    switchMode,
    rows,
    setRows,
    refAccounts,
    loading,
    selectedIndex,
    setSelectedIndex,
    isPrintOpen,
    openPrint,
    closePrint,
    isCopyOpen,
    openCopy,
    closeCopy,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    rowToDelete,
    openDeleteConfirm,
    confirmDelete,
    toastMessage,
    errorToast,
    setErrorToast,
    showAutoCloseToast,
    refreshData,
    handleSaveRow,
    handleInsertRow,
    handleBatchCopy,
  } = useWbase4010(initialMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [jumpDirection, setJumpDirection] = useState<'right' | 'down'>('right');

  const meta = ACCOUNT_MODES[currentMode] || ACCOUNT_MODES[1];

  // 初始載入與切換行業模式時重整
  useEffect(() => {
    refreshData();
  }, [currentMode, refreshData]);

  // 全域快速鍵監聽 (F3: 複製, F4/F7: 列印, F8: 尋找, F12: 方向切換, Ins: 新增, Del: 刪除, Esc: 離開)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.key === 'F3') {
        e.preventDefault();
        openCopy();
        return;
      }

      if (e.key === 'F4' || e.key === 'F7') {
        e.preventDefault();
        openPrint();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        setIsSearchModalOpen(true);
        return;
      }

      if (e.key === 'F12') {
        e.preventDefault();
        setJumpDirection((prev) => (prev === 'right' ? 'down' : 'right'));
        showAutoCloseToast(
          jumpDirection === 'right' ? '游標方向切換為: [向下 ↓]' : '游標方向切換為: [向右 →]'
        );
        return;
      }

      if (e.key === 'Escape') {
        if (isCopyOpen) {
          e.preventDefault();
          closeCopy();
          return;
        }
        if (isPrintOpen) {
          e.preventDefault();
          closePrint();
          return;
        }
        if (isSearchModalOpen) {
          e.preventDefault();
          setIsSearchModalOpen(false);
          return;
        }
        if (isDeleteConfirmOpen) {
          e.preventDefault();
          setIsDeleteConfirmOpen(false);
          return;
        }
        if (onBackToMenu) {
          e.preventDefault();
          onBackToMenu();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    openCopy,
    openPrint,
    isCopyOpen,
    isPrintOpen,
    isSearchModalOpen,
    isDeleteConfirmOpen,
    jumpDirection,
    setIsDeleteConfirmOpen,
    closeCopy,
    closePrint,
    showAutoCloseToast,
    onBackToMenu,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshData(searchQuery);
  };

  const selectedRow = rows[selectedIndex];

  const existingAccnos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const c = r.accno?.trim().toUpperCase();
      if (c) s.add(c);
    });
    return s;
  }, [rows]);

  // F8 搜尋清單轉換
  const searchItems: SearchItem[] = useMemo(() => {
    return rows.map((r) => ({
      code: r.accno?.trim() || '',
      name: `${r.accname || ''} ${r.accnamel ? `(${r.accnamel})` : ''}`,
      tag: r.accno.trim().length <= 4 ? '總帳' : '明細',
    }));
  }, [rows]);

  const handleSelectSearchItem = (item: SearchItem) => {
    const idx = rows.findIndex((r) => r.accno.trim().toUpperCase() === item.code.trim().toUpperCase());
    if (idx >= 0) {
      setSelectedIndex(idx);
    }
  };

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      {/* 頂部整合標題列 */}
      <WbasePageHeader
        title={`會計科目基本資料維護 - ${meta.label}`}
        code={`wbase401${currentMode}`}
        onBackToMenu={onBackToMenu}
        mode="grid"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshData()}
              className="p-1 rounded bg-blue-800 hover:bg-blue-700 text-white transition-colors"
              title="重新整理 (F6)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 6 大行業會計科目範本切換頁籤 */}
      <div className="flex items-center px-3 pt-2 gap-1 border-b border-slate-300 dark:border-slate-800 bg-slate-200/80 dark:bg-slate-900/80 select-none overflow-x-auto">
        {Object.values(ACCOUNT_MODES).map((item) => {
          const isActive = item.mode === currentMode;
          return (
            <button
              key={item.mode}
              onClick={() => switchMode(item.mode)}
              className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-blue-900 text-white shadow-xs border-t-2 border-yellow-400'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-900 dark:hover:text-white'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              <span className="text-[10px] opacity-75 font-mono">({item.tableName})</span>
            </button>
          );
        })}
      </div>

      {/* 快捷操作按鈕列與快速查詢 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleInsertRow}
            className="px-2.5 py-1 text-xs font-bold rounded bg-blue-700 hover:bg-blue-800 text-white shadow-xs transition-colors flex items-center gap-1"
            title="新增明細科目 (Ins)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>[Ins] 新增</span>
          </button>

          <button
            onClick={() => openDeleteConfirm()}
            disabled={!selectedRow}
            className="px-2.5 py-1 text-xs font-bold rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1"
            title="刪除科目 (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>[Del] 刪除</span>
          </button>

          <button
            onClick={openCopy}
            className="px-2.5 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1"
            title="從標準檔複製總帳科目 (F3)"
          >
            <Copy className="w-3.5 h-3.5 text-yellow-300" />
            <span>[F3] 複製</span>
          </button>

          <button
            onClick={openPrint}
            className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1"
            title="列印科目對照表 / Excel (F4/F7)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>[F4/F7] 列印</span>
          </button>

          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="px-2.5 py-1 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1"
            title="代號/名稱搜尋 (F8)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>[F8] 尋找</span>
          </button>

          <button
            onClick={() => {
              setJumpDirection((prev) => (prev === 'right' ? 'down' : 'right'));
              showAutoCloseToast(
                jumpDirection === 'right' ? '游標方向切換為: [向下 ↓]' : '游標方向切換為: [向右 →]'
              );
            }}
            className="px-2.5 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-slate-700 dark:text-slate-200"
            title="Enter 鍵游標移動方向切換 (F12)"
          >
            {jumpDirection === 'right' ? (
              <>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400" />
                <span>方向 [→]</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-yellow-400" />
                <span>方向 [↓]</span>
              </>
            )}
            <span className="text-[10px] text-slate-400">[F12]</span>
          </button>
        </div>

        {/* 快速關鍵字篩選 */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="快速篩選科目代號 / 名稱..."
              className={`pl-7 pr-2 py-1 text-xs rounded border font-mono outline-hidden w-56 ${
                isDark
                  ? 'bg-slate-800 border-slate-700 focus:border-yellow-400 text-white'
                  : 'bg-slate-50 border-slate-300 focus:border-blue-600 text-slate-900'
              }`}
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            搜尋
          </button>
        </form>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 min-h-0 w-full overflow-hidden p-2 flex flex-col">
        <Wbase4010Form
          rows={rows}
          mode={currentMode}
          onRowsChange={setRows}
          onSaveRow={handleSaveRow}
          onOpenPrint={openPrint}
          onSelectRow={(_, idx) => setSelectedIndex(idx)}
          onInsertRow={handleInsertRow}
          onDeleteRow={() => openDeleteConfirm()}
          onRefreshData={() => refreshData()}
          onExit={onBackToMenu}
          enterDirection={jumpDirection}
          statusBarInfo={
            selectedRow ? (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>
                  目前選中：
                  <strong className="text-yellow-300 font-bold ml-1">{selectedRow.accno}</strong>
                  <span className="ml-1.5">{selectedRow.accname}</span>
                </span>
                {selectedRow.dept && selectedRow.dept.trim() && (
                  <span className="text-sky-300">
                    明細: [{getDeptDescription(selectedRow.dept)}]
                  </span>
                )}
                {selectedRow.taxcode && selectedRow.taxcode.trim() === '*' && (
                  <span className="text-amber-400 font-bold">
                    [營業稅額: 自動產生 5% 稅額]
                  </span>
                )}
              </div>
            ) : null
          }
        />
      </div>

      {/* Bottom Hint Banner (對齊 VFP wbase401010 thisform.memo) */}
      <div className="px-4 py-2 bg-slate-900 text-slate-200 text-xs font-mono border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-1 select-none">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-yellow-400 font-bold">【科目明細指引】</span>
          <span className="text-slate-300">{meta.memoHint}</span>
        </div>
        <div className="text-slate-400 whitespace-nowrap text-[11px]">
          稅額 [*]: 輸入本科目將自動產生 5% 稅額
        </div>
      </div>

      {/* F3 Batch Copy Modal */}
      <Wbase4010BatchCopyModal
        isOpen={isCopyOpen}
        refAccounts={refAccounts}
        existingAccnos={existingAccnos}
        modeTitle={meta.label}
        onClose={closeCopy}
        onConfirm={handleBatchCopy}
      />

      {/* F4 / F7 Print & Excel Export Modal */}
      <Wbase4010Print
        isOpen={isPrintOpen}
        onClose={closePrint}
        data={rows}
        modeTitle={meta.label}
      />

      {/* F8 Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        title={`會計科目代號搜尋 [F8] - ${meta.label}`}
        onSearch={async (q) => {
          const upper = q.trim().toUpperCase();
          if (!upper) return searchItems;
          return searchItems.filter(
            (i) => i.code.toUpperCase().includes(upper) || i.name.includes(q.trim())
          );
        }}
        onSelect={handleSelectSearchItem}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div
            className={`w-full max-w-md rounded-lg shadow-2xl border p-5 ${
              isDark
                ? 'bg-slate-900 border-red-500 text-white'
                : 'bg-white border-red-600 text-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                  確認刪除會計科目
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  您確定要刪除科目代號：
                  <strong className="font-mono text-red-600 font-bold ml-1">
                    {rowToDelete.accno}
                  </strong>
                  （{rowToDelete.accname}）嗎？
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  若本年度尚有傳票發生金額或期初餘額，系統將強制阻斷刪除。
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消 (Esc)
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-bold rounded bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl bg-emerald-600 text-white text-sm font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Error Toast */}
      {errorToast && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl bg-red-600 text-white text-sm font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="ml-2 hover:opacity-80">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
