import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWbase3060 } from './useWbase3060';
import { FoxProGridV2, type ColumnDefV2, type HeaderGroupDef } from '../../components/FoxProGrid/FoxProGridV2';
import type { InvoiceTrackRecord } from '../../services/wbase3060';
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowLeft,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';
import { useTheme } from '../menu/ThemeContext';

export interface Wbase3060_02Props {
  period?: string;
  times?: string;
  sortOrder?: '1' | '2' | '3';
  onBackToSele?: () => void;
  onBackToMenu?: () => void;
  onBack?: () => void; // 相容 onBack
}

const TRACK_COLUMNS: ColumnDefV2<InvoiceTrackRecord>[] = [
  // 唯讀基礎欄位
  { key: 'companyCode', label: '公司編號', isPrimaryKey: true, width: '110px', editable: false, className: 'font-bold text-blue-900' },
  { key: 'companyShortName', label: '公司簡稱', width: '120px', editable: false, className: 'font-bold' },
  { key: 'unifiedNo', label: '公司統編', width: '100px', editable: false, className: 'font-mono' },
  { key: 'taxNo', label: '稅籍編號', width: '100px', editable: false, className: 'font-mono' },

  // 二聯(手)
  { key: 'manualTwoDup', label: '二聯(手)', width: '60px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualTwoTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'manualTwoStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'manualTwoEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 二聯副(手)
  { key: 'manualTwoDupSub', label: '二聯副(手)', width: '65px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualTwoSubTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'manualTwoSubStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'manualTwoSubEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 三聯(手)
  { key: 'manualThreeDup', label: '三聯(手)', width: '60px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualThreeTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'manualThreeStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'manualThreeEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 三聯副(手)
  { key: 'manualThreeDupSub', label: '三聯副(手)', width: '65px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'manualThreeSubTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'manualThreeSubStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'manualThreeSubEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 特種
  { key: 'manualSpecial', label: '特種', width: '60px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'specialTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'specialStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'specialEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 收銀二聯
  { key: 'cashTwoDup', label: '收銀二聯', width: '65px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashTwoTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'cashTwoStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'cashTwoEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 收銀三聯
  { key: 'cashThreeDup', label: '收銀三聯', width: '65px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashThreeTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'cashThreeStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'cashThreeEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },

  // 收銀三聯副
  { key: 'cashThreeDupSub', label: '收銀三聯副', width: '70px', editable: false, align: 'right', renderCell: (v) => <span className="w-full text-right font-mono">{Number(v || 0)}</span> },
  { key: 'cashThreeSubTrack', label: '字軌', width: '60px', align: 'center', className: 'font-bold font-mono text-center' },
  { key: 'cashThreeSubStartNo', label: '起號', width: '90px', align: 'center', className: 'font-mono text-center' },
  { key: 'cashThreeSubEndNo', label: '迄號', width: '90px', align: 'center', className: 'font-mono text-center' },
];

export const Wbase3060_02: React.FC<Wbase3060_02Props> = ({
  period: propPeriod,
  times: propTimes,
  sortOrder: propSortOrder,
  onBackToSele,
  onBackToMenu,
  onBack,
}) => {
  const { isDark } = useTheme();

  const handleExit = onBackToSele || onBack || onBackToMenu;

  const {
    period,
    times,
    sortOrder,
    setSearchParams,
    rows,
    setRows,
    loading,
    errorToast,
    setErrorToast,
    toastMessage,
    showAutoCloseToast,
    selectedIndex,
    setSelectedIndex,
    refreshData,
    handleSaveRow,
    handleClearTracks,
    handleExportExcel,
    handlePreview,
  } = useWbase3060();

  // 若父層傳入不同參數，同步更新 store
  useEffect(() => {
    if (propPeriod || propTimes || propSortOrder) {
      setSearchParams({
        period: propPeriod || period,
        times: propTimes || times,
        sortOrder: propSortOrder || sortOrder,
      });
    }
  }, [propPeriod, propTimes, propSortOrder, setSearchParams, period, times, sortOrder]);

  const [searchQuery, setSearchQuery] = useState('');
  const [directionRight, setDirectionRight] = useState(true);

  // 初始載入資料
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 全域鍵盤快捷鍵 (F5: 排序, F7: 匯出EXCEL, F8: 清除, F12: 方向, Esc: 離開)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.key === 'F5') {
        e.preventDefault();
        setSearchParams({
          period,
          times,
          sortOrder: sortOrder === '1' ? '2' : sortOrder === '2' ? '3' : '1',
        });
        refreshData(searchQuery);
        return;
      }

      if (e.key === 'F7') {
        e.preventDefault();
        handleExportExcel();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        handleClearTracks();
        return;
      }

      if (e.key === 'F12') {
        e.preventDefault();
        setDirectionRight((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (handleExit) {
          e.preventDefault();
          handleExit();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    handleExportExcel,
    handleClearTracks,
    handleExit,
    period,
    times,
    sortOrder,
    setSearchParams,
    refreshData,
    searchQuery,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshData(searchQuery);
  };

  const createEmptyRow = (): InvoiceTrackRecord => ({
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

  // 自動推算迄號處理
  const handleSaveRowWithAutoCalc = useCallback(
    async (updatedRow: InvoiceTrackRecord) => {
      const calcAutoEndNo = (
        startNo: string | undefined,
        qty: number,
        sheetsPerBook: number
      ): string | undefined => {
        if (startNo && startNo.trim().length === 8 && /^\d+$/.test(startNo.trim()) && qty > 0) {
          const startNum = parseInt(startNo.trim(), 10);
          return String(startNum + qty * sheetsPerBook - 1).padStart(8, '0');
        }
        return undefined;
      };

      const clone = { ...updatedRow };

      // 二聯
      if (!clone.manualTwoEndNo && clone.manualTwoStartNo) {
        const auto = calcAutoEndNo(clone.manualTwoStartNo, clone.manualTwoDup, 50);
        if (auto) clone.manualTwoEndNo = auto;
      }
      // 二聯副
      if (!clone.manualTwoSubEndNo && clone.manualTwoSubStartNo) {
        const auto = calcAutoEndNo(clone.manualTwoSubStartNo, clone.manualTwoDupSub, 50);
        if (auto) clone.manualTwoSubEndNo = auto;
      }
      // 三聯
      if (!clone.manualThreeEndNo && clone.manualThreeStartNo) {
        const auto = calcAutoEndNo(clone.manualThreeStartNo, clone.manualThreeDup, 50);
        if (auto) clone.manualThreeEndNo = auto;
      }
      // 三聯副
      if (!clone.manualThreeSubEndNo && clone.manualThreeSubStartNo) {
        const auto = calcAutoEndNo(clone.manualThreeSubStartNo, clone.manualThreeDupSub, 50);
        if (auto) clone.manualThreeSubEndNo = auto;
      }
      // 特種
      if (!clone.specialEndNo && clone.specialStartNo) {
        const auto = calcAutoEndNo(clone.specialStartNo, clone.manualSpecial, 50);
        if (auto) clone.specialEndNo = auto;
      }
      // 二收
      if (!clone.cashTwoEndNo && clone.cashTwoStartNo) {
        const auto = calcAutoEndNo(clone.cashTwoStartNo, clone.cashTwoDup, 250);
        if (auto) clone.cashTwoEndNo = auto;
      }
      // 三收
      if (!clone.cashThreeEndNo && clone.cashThreeStartNo) {
        const auto = calcAutoEndNo(clone.cashThreeStartNo, clone.cashThreeDup, 250);
        if (auto) clone.cashThreeEndNo = auto;
      }
      // 三收副
      if (!clone.cashThreeSubEndNo && clone.cashThreeSubStartNo) {
        const auto = calcAutoEndNo(clone.cashThreeSubStartNo, clone.cashThreeDupSub, 250);
        if (auto) clone.cashThreeSubEndNo = auto;
      }

      await handleSaveRow(clone);
    },
    [handleSaveRow]
  );

  // 雙層表頭定義 (FoxPro 經典高對比風格)
  const headerGroups: HeaderGroupDef[] = useMemo(
    () => [
      { label: '', width: '430px' },
      {
        label: '＜ 二聯(手) ＞',
        width: '300px',
        className: isDark
          ? 'text-purple-300 bg-purple-950/70 font-extrabold tracking-widest border-purple-800'
          : 'text-purple-900 bg-purple-100/90 font-extrabold tracking-widest border-purple-300',
      },
      {
        label: '＜ 二聯副(手) ＞',
        width: '305px',
        className: isDark
          ? 'text-indigo-300 bg-indigo-950/70 font-extrabold tracking-widest border-indigo-800'
          : 'text-indigo-900 bg-indigo-100/90 font-extrabold tracking-widest border-indigo-300',
      },
      {
        label: '＜ 三聯(手) ＞',
        width: '300px',
        className: isDark
          ? 'text-purple-300 bg-purple-950/70 font-extrabold tracking-widest border-purple-800'
          : 'text-purple-900 bg-purple-100/90 font-extrabold tracking-widest border-purple-300',
      },
      {
        label: '＜ 三聯副(手) ＞',
        width: '305px',
        className: isDark
          ? 'text-indigo-300 bg-indigo-950/70 font-extrabold tracking-widest border-indigo-800'
          : 'text-indigo-900 bg-indigo-100/90 font-extrabold tracking-widest border-indigo-300',
      },
      {
        label: '＜ 特種發票 ＞',
        width: '300px',
        className: isDark
          ? 'text-amber-300 bg-amber-950/70 font-extrabold tracking-widest border-amber-800'
          : 'text-amber-900 bg-amber-100/90 font-extrabold tracking-widest border-amber-300',
      },
      {
        label: '＜ 收銀二聯 ＞',
        width: '305px',
        className: isDark
          ? 'text-blue-300 bg-blue-950/70 font-extrabold tracking-widest border-blue-800'
          : 'text-blue-900 bg-blue-100/90 font-extrabold tracking-widest border-blue-300',
      },
      {
        label: '＜ 收銀三聯 ＞',
        width: '305px',
        className: isDark
          ? 'text-blue-300 bg-blue-950/70 font-extrabold tracking-widest border-blue-800'
          : 'text-blue-900 bg-blue-100/90 font-extrabold tracking-widest border-blue-300',
      },
      {
        label: '＜ 收銀三聯副 ＞',
        width: '310px',
        className: isDark
          ? 'text-blue-300 bg-blue-950/70 font-extrabold tracking-widest border-blue-800'
          : 'text-blue-900 bg-blue-100/90 font-extrabold tracking-widest border-blue-300',
      },
    ],
    [isDark]
  );

  const selectedRow = rows[selectedIndex];
  const sortLabel = sortOrder === '1' ? '公司統編' : sortOrder === '2' ? '公司編號' : '稅籍編號';

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col font-mono selection:bg-yellow-500 selection:text-black transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 font-medium'
      }`}
    >
      {/* 頂部 Header 與搜尋列 (與 Wbase3020_02 風格一致) */}
      <div
        className={`shrink-0 px-4 py-2 border-b flex items-center justify-between font-bold text-sm shadow-xs transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-b-2 border-slate-200 text-slate-900 font-bold'
        }`}
      >
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {handleExit && (
            <button
              onClick={handleExit}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold text-xs shadow-xs transition border cursor-pointer ${
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

          <div
            className={`px-2.5 py-1 rounded border text-xs font-bold ${
              isDark
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                : 'bg-indigo-50 text-indigo-900 border-indigo-300'
            }`}
          >
            排序：{sortLabel}
          </div>

          {/* 搜尋列 */}
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
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition border border-blue-500 cursor-pointer"
            >
              搜尋
            </button>
          </form>

          <button
            onClick={() => refreshData()}
            disabled={loading}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
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

      {/* 核心 Grid 區域 (使用 FoxProGridV2) */}
      <div className="flex-1 min-h-0 p-4 flex flex-col overflow-hidden">
        <FoxProGridV2<InvoiceTrackRecord>
          rows={rows}
          columns={TRACK_COLUMNS}
          headerGroups={headerGroups}
          createEmptyRow={createEmptyRow}
          onRowsChange={setRows}
          onSaveRow={handleSaveRowWithAutoCalc}
          onShowSummary={() => {
            if (handleExit) handleExit();
          }}
          statusBarInfo={
            selectedRow ? (
              <span className="text-xs">
                目前選取公司：[{selectedRow.companyCode}] {selectedRow.companyShortName} | 統編：{selectedRow.unifiedNo || ''}
              </span>
            ) : null
          }
          getRowKey={(row, idx) => `${row.companyCode}_${idx}`}
          onSelectRow={(_row, idx) => setSelectedIndex(idx)}
          onExit={handleExit}
          hideKeyboardHints={true}
          escLabel="儲存/離開"
          customActions={
            <>
              {/* F5 排序 */}
              <button
                type="button"
                onClick={() => {
                  setSearchParams({
                    period,
                    times,
                    sortOrder: sortOrder === '1' ? '2' : sortOrder === '2' ? '3' : '1',
                  });
                  refreshData(searchQuery);
                }}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="切換排序方式 (F5)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F5</span>
                <span>排序</span>
              </button>

              {/* F6 查詢 */}
              <button
                type="button"
                onClick={() => refreshData(searchQuery)}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="查詢過濾 (F6)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F6</span>
                <span>查詢</span>
              </button>

              {/* F7 匯出EXCEL */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="匯出字軌清單為 Excel (F7)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F7</span>
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>匯出EXCEL</span>
                </span>
              </button>

              {/* F8 資料清除 */}
              <button
                type="button"
                onClick={handleClearTracks}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="清除當前期別所有字軌 (F8)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F8</span>
                <span>資料清除</span>
              </button>

              {/* F4 預覽畫面 */}
              <button
                type="button"
                onClick={handlePreview}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="預覽畫面 (F4)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F4</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>預覽畫面</span>
                </span>
              </button>

              {/* F5 排序 */}
              <button
                type="button"
                onClick={() => {
                  setSearchParams({
                    period,
                    times,
                    sortOrder: sortOrder === '1' ? '2' : sortOrder === '2' ? '3' : '1',
                  });
                  refreshData(searchQuery);
                }}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="切換排序方式 (F5)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F5</span>
                <span>排序</span>
              </button>

              {/* F6 查詢 */}
              <button
                type="button"
                onClick={() => refreshData(searchQuery)}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="查詢過濾 (F6)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F6</span>
                <span>查詢</span>
              </button>

              {/* F7 匯出EXCEL */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="匯出字軌清單為 Excel (F7)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F7</span>
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>匯出EXCEL</span>
                </span>
              </button>

              {/* F8 資料清除 */}
              <button
                type="button"
                onClick={handleClearTracks}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="清除當前期別所有字軌 (F8)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F8</span>
                <span>資料清除</span>
              </button>

              {/* F12 方向 */}
              <button
                type="button"
                onClick={() => setDirectionRight(!directionRight)}
                className="flex items-center space-x-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black rounded border border-yellow-600 shadow-xs transition cursor-pointer"
                title="切換輸入焦點方向 (F12)"
              >
                <span className="bg-yellow-600 text-white text-[10px] px-1 rounded font-mono">F12</span>
                <span>方向 {directionRight ? '→' : '↓'}</span>
              </button>
            </>
          }
        />
      </div>

      {/* Auto-Close Toast (Saved / Updated) */}
      {showAutoCloseToast && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl border border-emerald-400 animate-bounce font-bold text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage || '已成功儲存至 PostgreSQL 資料庫 (基本發票購買)！'}</span>
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
            className="text-white hover:text-gray-200 underline text-xs cursor-pointer"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
};

export default Wbase3060_02;
