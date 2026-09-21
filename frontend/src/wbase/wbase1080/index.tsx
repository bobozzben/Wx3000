import React, { useState, useEffect } from 'react';
import { useWbase1080 } from './useWbase1080';
import { Wbase1080Form } from './Wbase1080Form';
import { Wbase1080Print } from './wbase1080Print';
import {
  FileText,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase1080PageProps {
  onBackToMenu?: () => void;
}

export const Wbase1080Page: React.FC<Wbase1080PageProps> = ({ onBackToMenu }) => {
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
  } = useWbase1080();

  const [searchQuery, setSearchQuery] = useState('');

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Global keyboard shortcuts (F7: Print, Esc: Exit/Close)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

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
      {/* Banner */}
      <div
        className={`shrink-0 px-6 py-4 border-b flex items-center justify-between shadow-md transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-b-2 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <div className="flex items-center space-x-3">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-gray-300 hover:text-white transition"
              title="返回主選單"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2 bg-yellow-400 text-black rounded font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider flex items-center gap-2">
              基本收費摘要維護
              <span className="text-xs px-2 py-0.5 rounded bg-blue-800 text-white font-normal">
                wbase1080
              </span>
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              設定與管理標準基本收費摘要 (PostgreSQL Table: 基本收費摘要)
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋摘要代號 / 摘要說明..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-64 px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5" />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white text-sm font-bold rounded border border-blue-600 transition"
          >
            搜尋
          </button>
        </form>
      </div>

      {/* Main Grid Content Area */}
      <div className="flex-1 min-h-0 p-6 flex flex-col overflow-hidden">
        <Wbase1080Form
          rows={rows}
          onRowsChange={setRows}
          onSaveRow={handleSaveRow}
          onOpenPrint={openPrint}
          onShowSummary={() => {
            if (onBackToMenu) onBackToMenu();
          }}
          statusBarInfo={
            selectedRow ? (
              <span className="text-xs">
                目前選取：[{selectedRow.summaryCode}] {selectedRow.summaryName} | 摘要內容：{selectedRow.content || '-'}
              </span>
            ) : null
          }
          onInsertRow={() => {
            const newRow = { summaryCode: '', summaryName: '', content: '' };
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
              <h3 className="text-lg font-bold">確認刪除該筆收費摘要？</h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              您即將刪除收費摘要：
              <span className="font-bold text-yellow-400 ml-1">
                [{selectedRow.summaryCode}] {selectedRow.summaryName}
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
      <Wbase1080Print />
    </div>
  );
};

export default Wbase1080Page;
