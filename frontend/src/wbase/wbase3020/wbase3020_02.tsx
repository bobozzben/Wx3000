import React, { useState, useEffect, useMemo } from 'react';
import { useWbase3020 } from './useWbase3020';
import { Wbase3020_buyinv_print } from './wbase3020_buyinv_print';
import { FoxProGridV2, type ColumnDefV2, type HeaderGroupDef } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import type { InvoicePurchaseItem } from '../../services/wbase3020';
import {
  Receipt,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

interface Wbase3020_02Props {
  onBackToSele?: () => void;
  onBackToMenu?: () => void;
}

const INVOICE_COLUMNS: ColumnDefV2<InvoicePurchaseItem>[] = [
  { key: 'companyCode', label: '公司編號', isPrimaryKey: true, width: '120px', className: 'font-bold text-blue-900' },
  { key: 'companyShortName', label: '公司簡稱', width: '140px', className: 'font-bold' },
  { key: 'unifiedNo', label: '公司統編', width: '130px', className: 'font-mono' },
  { key: 'taxNo', label: '稅籍編號', width: '130px', className: 'font-mono' },
  { key: 'manualTwoDup', label: '二聯', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualTwoDupSub', label: '二聯副', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualThreeDup', label: '三聯', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualThreeDupSub', label: '三聯副', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualSpecial', label: '特種', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashTwoDup', label: '二聯', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashThreeDup', label: '三聯', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashThreeDupSub', label: '三聯副', width: '70px', align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
];

export const Wbase3020_02: React.FC<Wbase3020_02Props> = ({ onBackToSele, onBackToMenu }) => {
  const { isDark } = useTheme();

  const {
    period,
    times,
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
  } = useWbase3020();

  const [searchQuery, setSearchQuery] = useState('');
  const [directionRight, setDirectionRight] = useState(true);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Global Keyboard Shortcuts (F7: Print, Esc: Exit/Close, Ins: Add)
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
        if (onBackToSele) {
          e.preventDefault();
          onBackToSele();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [openPrint, closePrint, isPrintOpen, isDeleteConfirmOpen, setIsDeleteConfirmOpen, onBackToSele]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshData(searchQuery);
  };

  const createEmptyRow = (): InvoicePurchaseItem => ({
    period,
    times,
    companyCode: '',
    companyShortName: '',
    unifiedNo: '',
    taxNo: '',
    manualTwoDup: 0,
    manualTwoDupSub: 0,
    manualThreeDup: 0,
    manualThreeDupSub: 0,
    manualSpecial: 0,
    cashTwoDup: 0,
    cashThreeDup: 0,
    cashThreeDupSub: 0,
  });

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.companyCode.toLowerCase().includes(query.toLowerCase()) ||
          x.companyShortName.toLowerCase().includes(query.toLowerCase()) ||
          x.unifiedNo.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.companyCode,
        name: x.companyShortName,
        spec: `統編:${x.unifiedNo || '無'} | 稅籍:${x.taxNo || '無'}`,
      }));
  };

  const headerGroups: HeaderGroupDef[] = useMemo(
    () => [
      { label: '', width: '570px' },
      {
        label: '＜ 手開式統一發票 ＞',
        width: '350px',
        className: isDark
          ? 'text-purple-300 bg-purple-950/70 font-extrabold tracking-widest border-purple-800'
          : 'text-purple-900 bg-purple-100/90 font-extrabold tracking-widest border-purple-300',
      },
      {
        label: '＜ 收銀機專用 ＞',
        width: '210px',
        className: isDark
          ? 'text-indigo-300 bg-indigo-950/70 font-extrabold tracking-widest border-indigo-800'
          : 'text-indigo-900 bg-indigo-100/90 font-extrabold tracking-widest border-indigo-300',
      },
    ],
    [isDark]
  );

  const selectedRow = rows[selectedIndex];

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      {/* Top Header & Search Bar (Merged) */}
      <div
        className={`shrink-0 px-4 py-2 border-b flex items-center justify-between font-bold text-sm shadow-xs transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-b-2 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {onBackToSele && (
            <button
              onClick={onBackToSele}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold text-xs shadow-xs transition border ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                  : 'bg-white hover:bg-blue-100 border-blue-400 text-blue-900'
              }`}
              title="返回期別選擇"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>重新選擇期別</span>
            </button>
          )}

          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded border ${
              isDark
                ? 'bg-blue-950 border-blue-800 text-blue-300'
                : 'bg-blue-100 border-blue-300 text-blue-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-blue-500" />
            <span className="font-mono text-sm font-extrabold">期別 {period}</span>
          </div>

          <div
            className={`px-2.5 py-1 rounded border text-xs font-bold ${
              isDark
                ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            {times === '1' ? '本期首次購買' : '本期追加購買'}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋公司編號 / 簡稱 / 統編..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-64 px-3 py-1 rounded text-xs focus:outline-none border transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 placeholder-slate-400'
                    : 'bg-white border-slate-300 text-slate-800 focus:border-blue-600 placeholder-slate-400'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2" />
            </div>
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition border border-blue-500"
            >
              搜尋
            </button>
          </form>

          <button
            onClick={() => refreshData()}
            disabled={loading}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-bold border transition ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                : 'bg-white hover:bg-gray-100 border-slate-300 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </button>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 min-h-0 p-4 flex flex-col overflow-hidden">
        <FoxProGridV2<InvoicePurchaseItem>
          rows={rows}
          columns={INVOICE_COLUMNS}
          headerGroups={headerGroups}
          createEmptyRow={createEmptyRow}
          onRowsChange={setRows}
          onSaveRow={handleSaveRow}
          onShowSummary={() => {
            if (onBackToSele) onBackToSele();
          }}
          statusBarInfo={
            selectedRow ? (
              <span className="text-xs">
                目前選取公司：[{selectedRow.companyCode}] {selectedRow.companyShortName} | 統編：{selectedRow.unifiedNo || '無'}
              </span>
            ) : null
          }
          onF3Search={handleF3Search}
          f3SearchTitle="發票購買公司開窗查詢 [F3]"
          getRowKey={(row, idx) => `${row.companyCode}_${idx}`}
          onInsertRow={() => {
            const newRow = createEmptyRow();
            setRows([...rows, newRow]);
          }}
          onDeleteRow={() => openDeleteConfirm()}
          onExit={onBackToSele || onBackToMenu}
          hideKeyboardHints={true}
          escLabel="儲存/離開"
          customActions={
            <>
              {/* F3 轉檔 */}
              <button
                type="button"
                onClick={() => alert('F3 轉檔功能：已完成預購轉檔準備')}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F3</span>
                <span>轉檔</span>
              </button>

              {/* F4 清除 */}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('確定要清除畫面上未儲存的輸入嗎？')) {
                    refreshData();
                  }
                }}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F4</span>
                <span>清除</span>
              </button>

              {/* F6 查詢 */}
              <button
                type="button"
                onClick={() => refreshData(searchQuery)}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F6</span>
                <span>查詢</span>
              </button>

              {/* F7 列印 */}
              <button
                type="button"
                onClick={openPrint}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F7</span>
                <span>列印</span>
              </button>

              {/* F8 上期拷貝 */}
              <button
                type="button"
                onClick={() => alert('F8 上期拷貝：已成功由前一期別載入發票份數基底紀錄')}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F8</span>
                <span>上期拷貝</span>
              </button>

              {/* F12 方向 */}
              <button
                type="button"
                onClick={() => setDirectionRight(!directionRight)}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F12</span>
                <span>方向 {directionRight ? '→' : '↓'}</span>
              </button>
            </>
          }
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
              <h3 className="text-lg font-bold">確認刪除該筆發票購買紀錄？</h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              您即將刪除發票購買紀錄：
              <span className="font-bold text-yellow-400 ml-1">
                [{selectedRow.companyCode}] {selectedRow.companyShortName}
              </span>
              <br />
              此操作將從 PostgreSQL 資料庫 (基本發票購買) 中移除資料，無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-slate-800 rounded font-bold text-sm transition"
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
          <span>已成功儲存至 PostgreSQL 資料庫 (基本發票購買)！</span>
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

      {/* Print Preview Dialog (wbase3020_buyinv_print) */}
      {isPrintOpen && <Wbase3020_buyinv_print onClose={closePrint} />}
    </div>
  );
};
