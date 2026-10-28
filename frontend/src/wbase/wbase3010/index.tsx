import React, { useState } from 'react';
import { useWbase3010 } from './useWbase3010';
import { Wbase3010Form } from './Wbase3010Form';
import { Wbase3010Print } from './wbase3010Print';
import { WbasePageHeader } from '../../components/WbasePageHeader';
import {
  MapPin,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase3010PageProps {
  onBackToMenu?: () => void;
}

export const Wbase3010Page: React.FC<Wbase3010PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();

  const {
    rows,
    setRows,
    errorToast,
    setErrorToast,
    showAutoCloseToast,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isPrintOpen,
    closePrint,
    selectedIndex,
    refreshData,
    handleSaveRow,
    openDeleteConfirm,
    confirmDelete,
    openPrint,
  } = useWbase3010();

  const [searchQuery, setSearchQuery] = useState('');

  // Initial load
  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Global keyboard shortcuts (F7: Print, Esc: Exit/Close)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Do not override input typing except function keys like F7
      if (e.key === 'F7') {
        e.preventDefault();
        openPrint();
        return;
      }

      if (e.key === 'Escape') {
        if (isPrintOpen) {
          e.preventDefault();
          closePrint();
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
  }, [openPrint, closePrint, isPrintOpen, isDeleteConfirmOpen, setIsDeleteConfirmOpen, onBackToMenu]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      refreshData();
      return;
    }
    refreshData(searchQuery);
  };

  const selectedRow = rows[selectedIndex];

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      {/* Merged Single Header Bar */}
      <WbasePageHeader
        onBackToMenu={onBackToMenu}
        category="發票統購"
        icon={<MapPin className="w-4 h-4 text-black" />}
        title="統一發票購買地點維護"
        code="wbase3010"
        actions={
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋代號 / 地點 / 連絡人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-36 sm:w-48 px-2.5 py-1 rounded text-xs focus:outline-none border ${
                  isDark
                    ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                    : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1.5" />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded border border-blue-600 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              搜尋
            </button>
          </form>
        }
      />

      {/* Main Grid Content Area */}
      <div className="flex-1 min-h-0 p-2 sm:p-4 md:p-6 flex flex-col overflow-hidden">
        <Wbase3010Form
          rows={rows}
          onRowsChange={setRows}
          onSaveRow={handleSaveRow}
          onOpenPrint={openPrint}
          onShowSummary={() => {
            if (onBackToMenu) onBackToMenu();
          }}
          statusBarInfo={(row) =>
            row && row.placeCode ? (
              <span className="text-xs">
                目前選取：[{row.placeCode}] {row.placeName || '未命名'} | 連絡人：{row.contactPerson || '(無)'} | 電話：{row.contactTel || '(無)'}
              </span>
            ) : null
          }
          onSelectRow={(_row, idx) => {
            const { setSelectedIndex } = useWbase3010.getState();
            setSelectedIndex(idx);
          }}
          onInsertRow={() => {
            const newRow = { placeCode: '', placeName: '', placeAddress: '', contactPerson: '', contactTel: '', memo: '' };
            setRows([...rows, newRow]);
          }}
          onDeleteRow={() => openDeleteConfirm()}
          onRefreshData={() => refreshData(searchQuery)}
          onExit={onBackToMenu}
        />
      </div>

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div
            className={`border-2 rounded-lg p-6 max-w-md w-full shadow-2xl transition-colors ${
              isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-600 text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3 text-red-500 mb-4">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="text-lg font-bold">確認刪除該筆購票地點？</h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              您即將刪除購票地點：
              <span className="font-bold text-yellow-400 ml-1">
                [{selectedRow.placeCode}] {selectedRow.placeName}
              </span>
              <br />
              此操作將從 PostgreSQL 資料庫中移除資料，無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className={`px-4 py-1.5 rounded font-bold text-sm transition ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'
                }`}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded text-sm shadow transition"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Close Toast (Saved) */}
      {showAutoCloseToast && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl border border-emerald-400 animate-bounce font-bold text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>已成功儲存至 PostgreSQL 資料庫！</span>
        </div>
      )}

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center justify-between space-x-3 bg-red-600 text-white px-4 py-2.5 rounded-lg shadow-xl border border-red-400 font-bold text-sm max-w-md">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-white hover:text-gray-200 underline text-xs"
          >
            關閉
          </button>
        </div>
      )}

      {/* Print Preview Dialog */}
      <Wbase3010Print />
    </div>
  );
};

export default Wbase3010Page;
