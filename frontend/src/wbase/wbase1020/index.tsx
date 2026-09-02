import React, { useState, useEffect } from 'react';
import { useWbase1020 } from './useWbase1020';
import { Wbase1020Form } from './Wbase1020Form';
import { Wbase1020Print } from './wbase1020Print';
import {
  Users,
  Search,
  RefreshCw,
  Printer,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase1020PageProps {
  onBackToMenu?: () => void;
}

export const Wbase1020Page: React.FC<Wbase1020PageProps> = ({ onBackToMenu }) => {
  const { isDark } = useTheme();

  const {
    rows,
    setRows,
    loading,
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
  } = useWbase1020();

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
      className={`min-h-screen flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#F6F8FA] text-slate-800'
      }`}
    >
      {/* Banner */}
      <div
        className={`px-6 py-4 border-b flex items-center justify-between shadow-md transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-blue-900 text-blue-900'
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
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider flex items-center gap-2">
              會計師資料維護
              <span className="text-xs px-2 py-0.5 rounded bg-blue-800 text-white font-normal">
                wbase1020
              </span>
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              提供基本會計師主檔資料建置、編輯、刪除與區間清冊列印
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋會計師代號 / 姓名..."
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
      <div className="flex-1 p-6 flex flex-col min-h-0">
        <Wbase1020Form
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
                目前選取：[{selectedRow.cpaCode}] {selectedRow.cpaName} | 事務所：{selectedRow.officeName || '-'}
              </span>
            ) : null
          }
        />
      </div>

      {/* Bottom Actions Bar */}
      <div
        className={`px-6 py-3 border-t flex justify-between items-center text-xs transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-gray-400'
            : 'bg-white border-slate-200 text-gray-600'
        }`}
      >
        <div className="flex space-x-4">
          <span>[↑/↓] 筆數切換</span>
          <span>[Enter] 編輯/跳欄</span>
          <span>[F2] 欄位搜尋</span>
          <span>[F3] 開窗搜尋</span>
          <span>[F7] 列印預覽</span>
          <span>[Esc] 存檔關閉</span>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => refreshData()}
            disabled={loading}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-bold border transition ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-slate-600'
                : 'bg-gray-100 hover:bg-gray-200 text-slate-700 border-slate-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </button>

          <button
            onClick={openPrint}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white font-bold rounded text-sm border border-blue-600 transition"
          >
            <Printer className="w-4 h-4" />
            <span>列印清冊 [F7]</span>
          </button>

          <button
            onClick={() => openDeleteConfirm()}
            disabled={rows.length === 0}
            className="flex items-center space-x-1 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded text-sm border border-red-500 transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>刪除此筆</span>
          </button>
        </div>
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
              <h3 className="text-lg font-bold">確認刪除該筆會計師資料？</h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              您即將刪除會計師資料：
              <span className="font-bold text-yellow-400 ml-1">
                [{selectedRow.cpaCode}] {selectedRow.cpaName}
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
      <Wbase1020Print />
    </div>
  );
};

export default Wbase1020Page;
