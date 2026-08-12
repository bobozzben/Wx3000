import React, { useEffect, useState } from 'react';
import { useWbase1050 } from './useWbase1050';
import { Wbase1050Print } from './wbase1050Print';
import { Wbase1050Form } from './Wbase1050Form';
import type { TaxOfficerItem } from '../../services/wbase1050';
import { updateTaxOfficer } from '../../services/wbase1050';
import {
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface Wbase1050PageProps {
  onBackToMenu?: () => void;
}

export const Wbase1050Page: React.FC<Wbase1050PageProps> = ({ onBackToMenu }) => {
  const {
    list,
    selectedItem,
    searchKeyword,
    setSearchKeyword,
    fetchList,
    openDeleteConfirm,
    isDeleteConfirmOpen,
    closeDeleteConfirm,
    confirmDelete,
    openPrint,
    actionMessage,
    clearActionMessage,
    loading,
  } = useWbase1050();

  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);

  // Load list on initial mount
  useEffect(() => {
    fetchList();
  }, []);

  // 3-second auto-close countdown timer effect
  useEffect(() => {
    if (!saveSuccessOpen) return;

    if (countdown <= 0) {
      setSaveSuccessOpen(false);
      if (onBackToMenu) {
        onBackToMenu();
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [saveSuccessOpen, countdown, onBackToMenu]);

  const handleRowsChange = (newRows: TaxOfficerItem[]) => {
    useWbase1050.setState({ list: newRows });
  };

  const handleSaveRow = async (row: TaxOfficerItem) => {
    if (!row.taxCode || !row.taxCode.trim()) return;
    try {
      await updateTaxOfficer(row.taxCode.trim(), row);
    } catch (err) {
      console.error('Save row error:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchList(searchKeyword);
  };

  const handleShowSummary = (hasModified: boolean) => {
    if (hasModified) {
      setCountdown(3);
      setSaveSuccessOpen(true);
    } else {
      if (onBackToMenu) {
        onBackToMenu();
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-100 p-4 font-mono">
      {/* Top Banner Header */}
      <div className="bg-blue-950 border-2 border-blue-900 rounded-lg p-3 mb-3 text-white flex flex-wrap items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-yellow-500 text-black rounded font-bold shadow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-yellow-300">
              稅務人員資料維護作業 <span className="text-xs text-gray-300">[wbase1050]</span>
            </h1>
            <p className="text-xs text-gray-300">
              提供基本稅務人員 (國稅局/稽徵所/單位) 主檔資料建置、編輯、刪除與清冊列印 (FoxPro 盲打 15 列版)。
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋編號/姓名/稅局/單位..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="bg-slate-900 border border-blue-500 px-3 py-1.5 pl-9 rounded text-sm text-white font-mono focus:outline-none focus:border-yellow-400 w-64"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          </div>
          <button
            type="submit"
            className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded text-sm border border-blue-600 transition"
          >
            查詢
          </button>
        </form>
      </div>

      {/* Main 15-Row FoxPro Pure React Grid Container */}
      <div className="flex-1 mb-3">
        <Wbase1050Form
          rows={list}
          onRowsChange={handleRowsChange}
          onSaveRow={handleSaveRow}
          onOpenPrint={openPrint}
          onShowSummary={handleShowSummary}
          statusBarInfo={
            selectedItem
              ? `已選取: [${selectedItem.taxCode}] ${selectedItem.taxName} (${selectedItem.taxBureau || '未指定'})`
              : '提示：[Enter]下一格 [↑↓]換列/底端新增 [F3]開窗 [F7]列印 [ESC]存檔'
          }
        />
      </div>

      {/* Action Bar */}
      <div className="bg-white border-2 border-blue-900 rounded-lg p-3 flex flex-wrap items-center justify-between shadow-md gap-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
          <span className="bg-blue-950 text-yellow-300 px-2 py-1 rounded">
            熱鍵提示：
          </span>
          <span>[Enter] 編輯/下一欄</span>
          <span>•</span>
          <span>[↓] 新增列</span>
          <span>•</span>
          <span>[F2] 編輯</span>
          <span>•</span>
          <span>[F3] 開窗搜尋</span>
          <span>•</span>
          <span>[F7] 列印</span>
          <span>•</span>
          <span>[ESC] 存檔並自動返回主畫面</span>
        </div>

        <div className="flex flex-wrap space-x-2">
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={loading}
            className="flex items-center space-x-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-3 py-1.5 rounded border border-gray-400 text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </button>

          <button
            type="button"
            onClick={openPrint}
            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-yellow-300 font-bold px-4 py-1.5 rounded border border-slate-600 text-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>[F7] 清冊列印</span>
          </button>

          <button
            type="button"
            onClick={() => openDeleteConfirm()}
            disabled={!selectedItem}
            className="flex items-center space-x-1 bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-1.5 rounded border border-red-900 text-sm shadow transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>刪除項目</span>
          </button>
        </div>
      </div>

      {/* Print Modal */}
      <Wbase1050Print />

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div className="bg-slate-900 border-4 border-red-600 rounded-lg p-6 max-w-md w-full text-white shadow-2xl text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-red-400 mb-2">確認刪除稅務人員資料？</h3>
            <p className="text-sm text-gray-300 mb-6">
              您即將刪除編號為{' '}
              <span className="text-yellow-400 font-bold">
                [{selectedItem.taxCode}] {selectedItem.taxName}
              </span>{' '}
              的資料，此動作無法復原！
            </p>
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded text-sm transition"
              >
                取消 (Esc)
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-sm shadow-lg transition"
              >
                確認刪除 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Second Auto-Close Save Success Toast Modal */}
      {saveSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
          <div className="bg-blue-950 border-4 border-yellow-400 text-white p-6 rounded-lg shadow-2xl max-w-lg text-center animate-fade-in">
            <div className="flex justify-center mb-3">
              <CheckCircle className="w-14 h-14 text-yellow-400 animate-bounce" />
            </div>
            <h4 className="text-2xl font-bold mb-2 text-yellow-300">💾 資料存檔成功！</h4>
            <p className="text-base font-semibold mb-4 text-gray-200">
              目前共有 <span className="text-yellow-400 text-xl font-mono px-1">{list.length}</span> 筆稅務人員記錄。
            </p>

            <div className="mt-4 px-5 py-3 bg-yellow-400/20 border-2 border-yellow-400 rounded-lg text-yellow-200 text-base font-bold shadow-inner flex items-center justify-center space-x-2">
              <span>⏳ 系統將於</span>
              <span className="text-2xl font-bold font-mono text-yellow-400 bg-black/40 px-3 py-0.5 rounded border border-yellow-500/50">
                {countdown}
              </span>
              <span>秒後自動關閉並回到主畫面...</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Toast Message */}
      {actionMessage && actionMessage.type === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono">
          <div className="bg-red-950 border-4 border-red-500 text-white p-6 rounded-lg shadow-2xl max-w-lg text-center">
            <div className="flex justify-center mb-3">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
            <h4 className="text-xl font-bold mb-2">系統錯誤提示</h4>
            <p className="text-base font-semibold mb-6">{actionMessage.text}</p>
            <button
              onClick={clearActionMessage}
              className="bg-yellow-400 text-black px-6 py-2 rounded font-bold text-base hover:bg-yellow-300 transition"
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
