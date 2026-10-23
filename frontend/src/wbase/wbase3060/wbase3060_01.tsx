import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getSystemParam, setSystemParam } from '../../services/systemParamService';
import { useTheme } from '../menu/ThemeContext';
import { importExcelTracks, type ImportExcelTrackItem } from '../../services/wbase3060';

export interface Wbase3060_01Props {
  onConfirm: (params: {
    period: string;
    times: string;
    sortOrder: '1' | '2' | '3';
  }) => void;
  onClose: () => void;
}

export const Wbase3060_01: React.FC<Wbase3060_01Props> = ({ onConfirm, onClose }) => {
  const { isDark } = useTheme();

  // 期別與參數表單
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('06');
  const [times, setTimes] = useState('1'); // 1: 首次購買, 2: 追加購買
  const [sortOrder, setSortOrder] = useState<'1' | '2' | '3'>('1'); // 1: 依公司統編, 2: 依公司編號, 3: 依稅籍編號

  // 資料匯入區域狀態 (如 screen1.png)
  const [xlsFileName, setXlsFileName] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'1' | '2'>('1'); // 1: 網路購買, 2: 代售點購買
  const [qtyColOption, setQtyColOption] = useState<'I' | 'F'>('I'); // 'I': I 欄數量, 'F': F 欄數量
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  // 格式預覽與下載點 Modal
  const [previewModalType, setPreviewModalType] = useState<'online' | 'agent' | null>(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);

  // Refs for Keyboard Navigation
  const fileInputRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const startMonthRef = useRef<HTMLInputElement>(null);
  const endMonthRef = useRef<HTMLInputElement>(null);
  const timesRef = useRef<HTMLInputElement>(null);
  const sortOrderRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select();
      }
    }, 50);
  };

  // 載入系統參數
  useEffect(() => {
    const loadParams = async () => {
      try {
        const savedPeriod = await getSystemParam('c:/w3000/comm', '參數設定', '營業稅發票購買期別', '11505-06');
        const savedTimes = await getSystemParam('c:/w3000/comm', '參數設定', '營業稅發票購買次數', '1');
        const savedSort = await getSystemParam('c:/w3000/comm', '參數設定', '統購字軌排序方式', '1');

        if (savedPeriod && savedPeriod.includes('-')) {
          const parts = savedPeriod.split('-');
          if (parts[0].length >= 3) {
            setYear(parts[0].substring(0, parts[0].length - 2));
            setStartMonth(parts[0].substring(parts[0].length - 2));
            setEndMonth(parts[1] || '06');
          }
        }
        if (savedTimes) setTimes(savedTimes);
        if (savedSort && ['1', '2', '3'].includes(savedSort)) setSortOrder(savedSort as '1' | '2' | '3');
      } catch (err) {
        console.error('Failed to load system params in wbase3060_01:', err);
      } finally {
        focusAndSelect(yearRef);
      }
    };
    loadParams();
  }, []);

  const handleConfirm = useCallback(async () => {
    const formattedPeriod = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;
    try {
      await setSystemParam('c:/w3000/comm', '參數設定', '營業稅發票購買期別', formattedPeriod);
      await setSystemParam('c:/w3000/comm', '參數設定', '營業稅發票購買次數', times);
      await setSystemParam('c:/w3000/comm', '參數設定', '統購字軌排序方式', sortOrder);
    } catch (err) {
      console.error('Failed to save system params:', err);
    }

    onConfirm({
      period: formattedPeriod,
      times,
      sortOrder,
    });
  }, [year, startMonth, endMonth, times, sortOrder, onConfirm]);

  // 全域快捷鍵監聽
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewModalType || isUrlModalOpen) return;

      if (e.key === 'F8') {
        e.preventDefault();
        handleConfirm();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm, onClose, previewModalType, isUrlModalOpen]);

  // 輸入欄位鍵盤導航
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentField: 'year' | 'startMonth' | 'endMonth' | 'times' | 'sortOrder'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch (currentField) {
        case 'year':
          focusAndSelect(startMonthRef);
          break;
        case 'startMonth':
          focusAndSelect(endMonthRef);
          break;
        case 'endMonth':
          focusAndSelect(timesRef);
          break;
        case 'times':
          focusAndSelect(sortOrderRef);
          break;
        case 'sortOrder':
          handleConfirm();
          break;
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      switch (currentField) {
        case 'year':
        case 'startMonth':
        case 'endMonth':
          focusAndSelect(timesRef);
          break;
        case 'times':
          focusAndSelect(sortOrderRef);
          break;
        case 'sortOrder':
          confirmBtnRef.current?.focus();
          break;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      switch (currentField) {
        case 'startMonth':
        case 'endMonth':
          focusAndSelect(yearRef);
          break;
        case 'times':
          focusAndSelect(endMonthRef);
          break;
        case 'sortOrder':
          focusAndSelect(timesRef);
          break;
      }
    }
  };

  // 檔案選取處理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setXlsFileName(file.name);
      setImportMsg(null);
    }
  };

  // 執行 Excel 轉入解析
  const handleImportExcel = async () => {
    if (!excelFile) {
      alert('請先點選 [...] 按鈕選擇 XLS / XLSX 檔案！');
      return;
    }

    setIsImporting(true);
    setImportMsg({ type: 'info', text: '正在解析 Excel 內容並轉入資料庫...' });

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        throw new Error('Excel 檔案內無足夠的資料列');
      }

      const items: ImportExcelTrackItem[] = [];
      const formattedPeriod = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;

      // 檢查表頭或首列
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const rowStr = rows[i].join(',');
        if (rowStr.includes('統編') || rowStr.includes('統一編號') || rowStr.includes('字軌') || rowStr.includes('起號')) {
          headerRowIndex = i;
          break;
        }
      }

      const header = rows[headerRowIndex].map((h: any) => String(h).trim());

      // 尋找各欄位索引
      const findColIdx = (keywords: string[]) =>
        header.findIndex((col) => keywords.some((k) => col.includes(k)));

      let unifiedIdx = findColIdx(['統一編號', '統編', '營利事業統一編號']);
      let taxIdx = findColIdx(['稅籍編號', '稅籍']);
      let typeIdx = findColIdx(['發票類別', '發票種類', '種類', '聯式', '品名']);
      let trackIdx = findColIdx(['字軌', '發票字軌']);
      let startNoIdx = findColIdx(['起號', '發票起號', '起始號碼']);
      let endNoIdx = findColIdx(['迄號', '發票迄號', '截止號碼']);
      let qtyIdx = findColIdx(['本數', '數量', '冊數']);

      // 若為「代售點購買」且特定選擇 F 欄或 I 欄
      if (importMode === '2') {
        if (qtyColOption === 'F' && qtyIdx === -1) qtyIdx = 5; // F 欄 (0-indexed: 5)
        if (qtyColOption === 'I' && qtyIdx === -1) qtyIdx = 8; // I 欄 (0-indexed: 8)
      }

      // 若未找到明確標題，預設常用位置
      if (unifiedIdx === -1) unifiedIdx = 1;
      if (trackIdx === -1) trackIdx = 3;
      if (startNoIdx === -1) startNoIdx = 4;
      if (endNoIdx === -1) endNoIdx = 5;

      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const unifiedNo = unifiedIdx >= 0 ? String(row[unifiedIdx] || '').trim() : '';
        const taxNo = taxIdx >= 0 ? String(row[taxIdx] || '').trim() : '';
        const invoiceType = typeIdx >= 0 ? String(row[typeIdx] || '').trim() : '';
        const track = trackIdx >= 0 ? String(row[trackIdx] || '').trim().toUpperCase() : '';
        const startNo = startNoIdx >= 0 ? String(row[startNoIdx] || '').trim() : '';
        const endNo = endNoIdx >= 0 ? String(row[endNoIdx] || '').trim() : '';
        const quantity = qtyIdx >= 0 ? parseInt(String(row[qtyIdx] || '0'), 10) : 0;

        // 至少有統編或字軌才記錄
        if (unifiedNo || track || startNo) {
          items.push({
            unifiedNo,
            taxNo,
            invoiceType,
            track,
            startNo,
            endNo,
            quantity: isNaN(quantity) ? 0 : quantity,
          });
        }
      }

      if (items.length === 0) {
        throw new Error('未從檔案中辨識到有效的發票字軌資料列');
      }

      const res = await importExcelTracks(formattedPeriod, times, importMode, items);
      setImportMsg({
        type: 'success',
        text: res.message || `轉入成功！共解析 ${items.length} 列，已更新至資料庫。`,
      });
    } catch (err: any) {
      console.error('Import excel error:', err);
      setImportMsg({
        type: 'error',
        text: `轉入失敗：${err.message || '檔案格式無法辨識'}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className={`h-full w-full flex flex-col items-center justify-center p-2 sm:p-3 font-sans select-none overflow-y-auto transition-colors duration-300 ${
        isDark
          ? 'bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950'
          : 'bg-slate-100 text-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-100 to-slate-100'
      }`}
    >
      {/* 隱藏的 File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 主卡片 Container */}
      <div
        className={`w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all border-2 max-h-full ${
          isDark
            ? 'bg-slate-900/95 border-slate-800 shadow-indigo-950/20 backdrop-blur-xl'
            : 'bg-white border-slate-300 shadow-slate-400/30 backdrop-blur-xl'
        }`}
      >
        {/* Header 頂部藍色 Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] px-4 py-2 sm:px-5 sm:py-2.5 text-white shrink-0">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-2 sm:space-x-2.5">
              <div className="p-1 sm:p-1.5 bg-white/15 backdrop-blur-md rounded-lg border border-white/20 shadow-inner">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black tracking-wide drop-shadow-sm flex items-center gap-2">
                  <span>統購發票字軌期別設定</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold shadow-2xs">
                    Enter/F8 送出
                  </span>
                </h1>
                <p className="text-[10px] text-blue-100 font-mono font-bold">
                  FormWBase360BuyinvSele
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
              title="離開 (Esc)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* 表單內容 */}
        <div className="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 overflow-y-auto min-h-0 flex-1">
          {/* Section 1: 發票購買期別 */}
          <div
            className={`p-2 sm:p-2.5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <label className={`text-xs sm:text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  發票購買期別
                </label>
              </div>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  isDark ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                }`}
              >
                [Enter] 下一欄
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1">
                <input
                  ref={yearRef}
                  type="text"
                  value={year}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setYear(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'year')}
                  className={`w-20 px-2 py-1 rounded-lg font-mono text-center font-black text-sm sm:text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="115"
                />
                <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>年</span>
              </div>

              <div className="flex items-center space-x-1">
                <input
                  ref={startMonthRef}
                  type="text"
                  value={startMonth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setStartMonth(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'startMonth')}
                  className={`w-14 px-2 py-1 rounded-lg font-mono text-center font-black text-sm sm:text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="05"
                />
                <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>-</span>
                <input
                  ref={endMonthRef}
                  type="text"
                  value={endMonth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEndMonth(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'endMonth')}
                  className={`w-14 px-2 py-1 rounded-lg font-mono text-center font-black text-sm sm:text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="06"
                />
                <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>月</span>
              </div>

              <div
                className={`ml-auto px-2.5 py-0.5 rounded-lg font-mono text-xs font-black ${
                  isDark
                    ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50'
                    : 'bg-indigo-600 text-white shadow-xs border border-indigo-700'
                }`}
              >
                {year}
                {startMonth.padStart(2, '0')}-{endMonth.padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Section 2: 購買次數 */}
          <div
            className={`p-2 sm:p-2.5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <label className={`text-xs sm:text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  購買次數
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isDark ? 'text-purple-400 bg-purple-950/60' : 'text-purple-700 bg-purple-50 border border-purple-200'
                  }`}
                >
                  [1/2 切換]
                </span>
                <input
                  ref={timesRef}
                  type="text"
                  value={times}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTimes(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'times')}
                  className={`w-12 px-1.5 py-0.5 text-center font-mono font-black text-sm sm:text-base rounded-lg border-2 outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-2xs'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: '1', label: '1. 本期首次購買' },
                { id: '2', label: '2. 本期追加購買' },
              ].map((opt) => {
                const isSelected = times === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTimes(opt.id);
                      focusAndSelect(sortOrderRef);
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs sm:text-sm font-extrabold border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/50'
                          : 'bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-indigo-500/30'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className={`w-3.5 h-3.5 stroke-[3] ${isDark ? 'text-purple-400' : 'text-white'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: 排序方式 (如 screen2.png: 排序：公司統編) */}
          <div
            className={`p-2 sm:p-2.5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <ArrowUpDown className={`w-3.5 h-3.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <label className={`text-xs sm:text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  顯示排序方式
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isDark ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                  }`}
                >
                  [1-3 選擇]
                </span>
                <input
                  ref={sortOrderRef}
                  type="text"
                  value={sortOrder}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (['1', '2', '3'].includes(val)) setSortOrder(val as '1' | '2' | '3');
                  }}
                  onKeyDown={(e) => handleInputKeyDown(e, 'sortOrder')}
                  className={`w-12 px-1.5 py-0.5 text-center font-mono font-black text-sm sm:text-base rounded-lg border-2 outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '1', label: '1. 公司統編 (預設)' },
                { id: '2', label: '2. 公司編號' },
                { id: '3', label: '3. 稅籍編號' },
              ].map((opt) => {
                const isSelected = sortOrder === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortOrder(opt.id as '1' | '2' | '3');
                      confirmBtnRef.current?.focus();
                    }}
                    className={`py-1 px-2 rounded-lg text-xs font-extrabold border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-indigo-500/30'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className={`w-3.5 h-3.5 stroke-[3] ${isDark ? 'text-indigo-400' : 'text-white'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: 資料匯入區塊 (如 screen1.png 所示規格) */}
          <div
            className={`p-2 sm:p-2.5 rounded-xl border-2 transition-colors ${
              isDark
                ? 'bg-blue-950/20 border-blue-900/50 shadow-inner'
                : 'bg-sky-50/70 border-blue-300 shadow-sm'
            }`}
          >
            {/* 標題：資料匯入 */}
            <div className="flex items-center space-x-1.5 mb-1.5">
              <Upload className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />
              <h2 className={`text-xs sm:text-sm font-black tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                資料匯入
              </h2>
            </div>

            {/* XLS檔：輸入框 + [...] + [轉入] */}
            <div className="flex items-center space-x-1.5 mb-2">
              <span className={`text-xs sm:text-sm font-black shrink-0 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                XLS檔：
              </span>
              <input
                type="text"
                value={xlsFileName}
                readOnly
                placeholder="請選擇統購發票 Excel 檔案 (.xls 或 .xlsx)"
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 px-2.5 py-1 rounded-md font-mono text-xs font-bold border-2 transition-all outline-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 shadow-2xs'
                }`}
              />

              {/* [...] 瀏覽按鈕 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-2.5 py-1 rounded-md border-2 font-black text-xs sm:text-sm transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-2xs'
                }`}
                title="選擇檔案"
              >
                ...
              </button>

              {/* [轉入] 按鈕 */}
              <button
                type="button"
                onClick={handleImportExcel}
                disabled={isImporting || !excelFile}
                className={`px-3 py-1 rounded-md border-2 font-black text-xs sm:text-sm transition-all shadow-md cursor-pointer ${
                  excelFile && !isImporting
                    ? 'bg-red-50 hover:bg-red-100 border-red-300 text-red-600 active:scale-95'
                    : 'bg-slate-200/60 border-slate-300 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isImporting ? '轉入中...' : '轉入'}
              </button>
            </div>

            {/* 下方框線選項 (Radio Group: 網路購買 vs 代售點購買) */}
            <div
              className={`p-1.5 sm:p-2 rounded-lg border-2 transition-colors ${
                isDark ? 'bg-slate-900/60 border-blue-900/40' : 'bg-white/80 border-blue-200 shadow-2xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* 網路購買選項 */}
                <div className="flex items-center space-x-1.5">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="1"
                      checked={importMode === '1'}
                      onChange={() => setImportMode('1')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      網路購買
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setPreviewModalType('online')}
                    className={`px-2 py-0.5 text-xs font-bold rounded border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                    }`}
                  >
                    格式預覽
                  </button>
                </div>

                {/* 代售點購買選項 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="2"
                      checked={importMode === '2'}
                      onChange={() => setImportMode('2')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      代售點購買
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setPreviewModalType('agent')}
                    className={`px-2 py-0.5 text-xs font-bold rounded border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                    }`}
                  >
                    格式預覽
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUrlModalOpen(true)}
                    className={`px-2 py-0.5 text-xs font-bold rounded border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
                    }`}
                  >
                    下載點網址
                  </button>

                  {/* I 欄數量 vs F 欄數量 單選 */}
                  <div className="flex items-center space-x-1.5 pl-1.5 border-l border-slate-300">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="qtyColOption"
                        value="I"
                        checked={qtyColOption === 'I'}
                        onChange={() => setQtyColOption('I')}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                        I 欄數量
                      </span>
                    </label>

                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="qtyColOption"
                        value="F"
                        checked={qtyColOption === 'F'}
                        onChange={() => setQtyColOption('F')}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                        F 欄數量
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 轉入訊息提示 */}
            {importMsg && (
              <div
                className={`mt-1.5 p-1.5 rounded-lg text-xs font-bold ${
                  importMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                    : importMsg.type === 'error'
                    ? 'bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400'
                    : 'bg-blue-500/15 border border-blue-500/40 text-blue-600 dark:text-blue-400'
                }`}
              >
                {importMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* 底部功能按鈕列 */}
        <div
          className={`px-4 py-2 sm:px-5 sm:py-2.5 border-t-2 flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-500">
            <span>[F8 進入單檔輸入]</span>
            <span>[Esc 返回]</span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={handleConfirm}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/20 border-2 border-emerald-700 transition-all hover:scale-102 active:scale-98 cursor-pointer focus:ring-2 focus:ring-emerald-400"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>F8. 確定</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Esc. 離開</span>
            </button>
          </div>
        </div>
      </div>

      {/* 格式預覽彈跳視窗 */}
      {previewModalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl rounded-2xl border-2 p-5 shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2.5">
              <h3 className="text-base font-black flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-500" />
                <span>
                  {previewModalType === 'online' ? '「網路購買」標準 Excel 格式範例' : '「代售點購買」標準 Excel 格式範例'}
                </span>
              </h3>
              <button
                onClick={() => setPreviewModalType(null)}
                className="p-1 rounded-lg hover:bg-slate-500/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="font-bold text-slate-600 dark:text-slate-300">
                系統支援自動比對公司統編、稅籍編號與發票種類，請確認 Excel 包含以下主要欄位：
              </p>

              <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b">
                    <tr>
                      <th className="p-2">統一編號</th>
                      <th className="p-2">發票種類</th>
                      <th className="p-2">字軌</th>
                      <th className="p-2">起號</th>
                      <th className="p-2">迄號</th>
                      <th className="p-2">數量/本數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="p-2">70400563</td>
                      <td className="p-2">手開三聯</td>
                      <td className="p-2">AB</td>
                      <td className="p-2">12345601</td>
                      <td className="p-2">12345650</td>
                      <td className="p-2">1</td>
                    </tr>
                    <tr>
                      <td className="p-2">49103249</td>
                      <td className="p-2">手開二聯副</td>
                      <td className="p-2">AC</td>
                      <td className="p-2">87654301</td>
                      <td className="p-2">87654400</td>
                      <td className="p-2">2</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {previewModalType === 'agent' && (
                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
                  <span className="font-bold">提示：</span> 代售點購買如數量在第 6 欄請選「F 欄數量」；若數量在第 9 欄請選「I 欄數量」。
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalType(null)}
                className="px-4 py-1.5 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-500"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 下載點網址彈跳視窗 */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border-2 p-5 shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2.5">
              <h3 className="text-base font-black flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-indigo-500" />
                <span>代售點發票購票清單下載網址</span>
              </h3>
              <button onClick={() => setIsUrlModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-500/20">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="font-bold">
                請登入電子發票整合服務平台或各區國稅局指定代售點系統下載統購 Excel 清單：
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300 font-mono">
                <li>財政部電子發票整合服務平台：https://www.einvoice.nat.gov.tw</li>
                <li>財政部印刷廠發票網路申購：https://invoice.ppmof.gov.tw</li>
              </ul>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-4 py-1.5 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-500"
              >
                確定關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
