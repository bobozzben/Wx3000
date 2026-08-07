import React, { useEffect, useState } from 'react';
import { useWbase1020 } from './useWbase1020';
import { Wbase1020Form } from './wbase1020Form';
import { Wbase1020Print } from './wbase1020Print';
import { FoxProGridV2 } from '../../components/FoxProGrid';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { updateCpa } from '../../services/wbase1020';
import type { CpaItem } from '../../services/wbase1020';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import {
  UserPlus,
  Edit,
  Trash2,
  Printer,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Users,
} from 'lucide-react';

interface Wbase1020PageProps {
  onBackToMenu?: () => void;
}

const CPA_COLUMNS: ColumnDefV2<CpaItem>[] = [
  { key: 'cpaCode', label: '代號', isPrimaryKey: true, width: '110px', className: 'text-yellow-400 font-bold' },
  { key: 'cpaName', label: '會計師姓名', width: '150px', className: 'font-bold' },
  { key: 'licenseNo', label: '證照字號', width: '200px' },
  { key: 'officeName', label: '事務所名稱', width: '220px' },
  { key: 'tel', label: '電話', width: '140px' },
  { key: 'address', label: '通訊地址', width: '280px' },
  { key: 'memo', label: '備註', width: '1fr' },
];

export const Wbase1020Page: React.FC<Wbase1020PageProps> = ({ onBackToMenu }) => {
  const {
    list,
    selectedItem,
    searchKeyword,
    setSearchKeyword,
    fetchList,
    openAddForm,
    openEditForm,
    openDeleteConfirm,
    isDeleteConfirmOpen,
    closeDeleteConfirm,
    confirmDelete,
    openPrint,
    actionMessage,
    clearActionMessage,
    loading,
  } = useWbase1020();

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

  const handleGridRowsChange = (newRows: CpaItem[]) => {
    useWbase1020.setState({ list: newRows });
  };

  const handleSaveRow = async (row: CpaItem) => {
    if (!row.cpaCode || !row.cpaCode.trim()) return;
    try {
      await updateCpa(row.cpaCode.trim(), row);
    } catch (err) {
      console.error('Save CPA row error:', err);
    }
  };

  const createEmptyRow = (): CpaItem => ({
    cpaCode: '',
    cpaName: '',
    licenseNo: '',
    officeName: '',
    tel: '',
    fax: '',
    address: '',
    memo: '',
  });

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

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return list
      .filter(
        (x) =>
          x.cpaCode.toLowerCase().includes(query.toLowerCase()) ||
          x.cpaName.toLowerCase().includes(query.toLowerCase()) ||
          x.officeName.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.cpaCode,
        name: x.cpaName,
        spec: x.officeName,
      }));
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-100 p-4 font-mono">
      {/* Top Banner / Breadcrumb Header */}
      <div className="bg-blue-950 border-2 border-blue-900 rounded-lg p-3 mb-3 text-white flex flex-wrap items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-yellow-500 text-black rounded font-bold shadow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-yellow-300">
              會計師資料維護作業 <span className="text-xs text-gray-300">[wbase1020]</span>
            </h1>
            <p className="text-xs text-gray-300">
              提供基本會計師主檔資料建置、編輯、刪除與區間清冊列印 (FoxPro 15 列版)。
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋代號/姓名/事務所..."
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

      {/* Main FoxProGridV2 View */}
      <div className="flex-1 mb-3">
        <FoxProGridV2<CpaItem>
          rows={list}
          columns={CPA_COLUMNS}
          createEmptyRow={createEmptyRow}
          onRowsChange={handleGridRowsChange}
          onSaveRow={handleSaveRow}
          onOpenPrint={openPrint}
          onShowSummary={handleShowSummary}
          onF3Search={handleF3Search}
          f3SearchTitle="會計師開窗搜尋 [F3]"
          getRowKey={(row, idx) => row.cpaCode || idx}
          statusBarInfo={
            selectedItem
              ? `已選取: [${selectedItem.cpaCode}] ${selectedItem.cpaName}`
              : '提示：[Enter]下一格 [↑↓]換列/底端新增 [F3]開窗 [F7]列印 [ESC]存檔'
          }
        />
      </div>

      {/* Main Action Bar */}
      <div className="bg-white border-2 border-blue-900 rounded-lg p-3 flex flex-wrap items-center justify-between shadow-md gap-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
          <span className="bg-blue-950 text-yellow-300 px-2 py-1 rounded">
            快捷鍵指示：
          </span>
          <span>[Enter] 編輯/下一欄</span>
          <span>•</span>
          <span>[↓] 新增列</span>
          <span>•</span>
          <span>[F2] 彈出表單</span>
          <span>•</span>
          <span>[F3] 開窗搜尋</span>
          <span>•</span>
          <span>[F4] 刪除</span>
          <span>•</span>
          <span>[F7] 列印</span>
          <span>•</span>
          <span>[ESC] 存檔並自動返回</span>
        </div>

        <div className="flex flex-wrap space-x-2">
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={loading}
            className="flex items-center space-x-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-3 py-1.5 rounded border border-gray-400 text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>整理</span>
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
            <span>[F4] 刪除</span>
          </button>

          <button
            type="button"
            onClick={() => openEditForm()}
            disabled={!selectedItem}
            className="flex items-center space-x-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-1.5 rounded border border-emerald-900 text-sm shadow transition disabled:opacity-50"
          >
            <Edit className="w-4 h-4 text-yellow-300" />
            <span>[F2] 彈出表單</span>
          </button>

          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center space-x-1 bg-blue-900 hover:bg-blue-800 text-white font-bold px-5 py-1.5 rounded border-2 border-yellow-400 text-sm shadow-lg transition"
          >
            <UserPlus className="w-4 h-4 text-yellow-400" />
            <span>新增會計師</span>
          </button>
        </div>
      </div>

      {/* Edit & Add Dialog */}
      <Wbase1020Form />

      {/* Print Preview & Filter Dialog */}
      <Wbase1020Print />

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div className="bg-slate-900 border-4 border-red-600 rounded-lg p-6 max-w-md w-full text-white shadow-2xl text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-red-400 mb-2">確認刪除會計師資料？</h3>
            <p className="text-sm text-gray-300 mb-6">
              您即將刪除代號為{' '}
              <span className="text-yellow-400 font-bold">
                [{selectedItem.cpaCode}] {selectedItem.cpaName}
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
              目前共有 <span className="text-yellow-400 text-xl font-mono px-1">{list.length}</span> 筆會計師記錄。
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
