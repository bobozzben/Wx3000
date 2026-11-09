import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import axios from 'axios';
import { getSystemParam, setSystemParam } from '../../services/systemParamService';
import { getDataDrive } from '../../services/apiConfig';
import { useTheme } from '../menu/ThemeContext';
import { importExcelTracks, fetchDocImage, readBlobErrorMessage, type DocImageName } from '../../services/wbase3060';
import { ConfirmDialog, MessageDialog, type MessageState } from '../wbase2030/Wbase2030Dialogs';
import {
  ImportParseError,
  parseImportRows,
  readFirstSheetRows,
  validatePeriodInput,
  type ImportMode,
} from './wbase3060Import';

export interface Wbase3060_01Props {
  onConfirm: (params: {
    period: string;
    times: string;
    sortOrder: '1' | '2' | '3';
  }) => void;
  onClose: () => void;
}

/** VFP wbase3022 Command6：財政部印刷廠發票網路申購 */
const PPMOF_URL = 'https://invoice.ppmof.gov.tw/';

interface DocPreviewState {
  name: DocImageName;
  title: string;
  url?: string;
  error?: string;
}

const describeImportError = (err: unknown): string => {
  if (err instanceof ImportParseError) return err.message;
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || err.message;
  }
  return err instanceof Error ? err.message : '檔案格式無法辨識';
};

export const Wbase3060_01: React.FC<Wbase3060_01Props> = ({ onConfirm, onClose }) => {
  const { isDark } = useTheme();

  // 期別與參數表單
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('06');
  const [times, setTimes] = useState('1'); // 1: 首次購買, 2: 追加購買
  const [sortOrder, setSortOrder] = useState<'1' | '2' | '3'>('1'); // 1: 依公司統編, 2: 依公司編號, 3: 依稅籍編號

  // 資料匯入區域狀態 (VFP wbase3022 Label14 資料匯入 / Text7 XLS檔 / Command2 轉入 / BUYPOSI；GPQTY I/F 欄數量在舊版已隱藏，一律 I 欄)
  const [xlsFileName, setXlsFileName] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('1'); // 1: 網路購買, 2: 代售點購買
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  // 格式預覽 (<磁碟機>:\W3000\doc\tgo01.jpg / tgo02.jpg)
  const [preview, setPreview] = useState<DocPreviewState | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Refs for Keyboard Navigation
  const fileInputRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const startMonthRef = useRef<HTMLInputElement>(null);
  const endMonthRef = useRef<HTMLInputElement>(null);
  const timesRef = useRef<HTMLInputElement>(null);
  const sortOrderRef = useRef<HTMLInputElement>(null);
  const fileBoxRef = useRef<HTMLInputElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const dialogOpen = confirmImport || message !== null || preview !== null;

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

  // VFP wbase3022 Text2.Valid：購買次數 2 (追加) 只能用代售點購買格式，1 (首次) 預設回網路購買
  useEffect(() => {
    if (times === '2') setImportMode('2');
    else if (times === '1') setImportMode('1');
  }, [times]);

  // 離開畫面時釋放預覽圖片
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isImporting) return;
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
  }, [year, startMonth, endMonth, times, sortOrder, onConfirm, isImporting]);

  // 全域快捷鍵監聽
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen) return;

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
  }, [handleConfirm, onClose, dialogOpen]);

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
          fileBoxRef.current?.focus();
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

  // 檔案選取處理 (VFP Command1：GETFILE('xls?'))
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setXlsFileName(file.name);
      setImportMsg(null);
    }
    // 同一個檔案重選也要觸發 onChange
    e.target.value = '';
    fileBoxRef.current?.focus();
  };

  const openFilePicker = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const sourceLabel =
    importMode === '1' ? '財政部印刷廠發票網路購買配號明細 Excel資料' : '代售點購買發票配號明細';

  // [轉入]：VFP Command2.Click 的檢查，再問 Y/N
  const startImport = () => {
    if (isImporting) return;
    if (!excelFile) {
      setMessage({ type: 'warning', title: 'XLS 檔', lines: ['檔案不存在  或 未選擇檔案!'], onClose: () => fileBoxRef.current?.focus() });
      return;
    }
    const error = validatePeriodInput(year, startMonth, endMonth);
    if (error) {
      setMessage({ type: 'warning', title: '訊息', lines: [error], onClose: () => focusAndSelect(yearRef) });
      return;
    }
    setConfirmImport(true);
  };

  // 執行 Excel 解析與轉入
  const runImport = async () => {
    setConfirmImport(false);
    if (!excelFile) return;

    const y = year.trim();
    const bm = startMonth.trim().padStart(2, '0');
    const em = endMonth.trim().padStart(2, '0');
    setStartMonth(bm);
    setEndMonth(em);
    const formattedPeriod = `${y}${bm}-${em}`;

    setIsImporting(true);
    setImportMsg({ type: 'info', text: '正在解析 Excel 內容並轉入資料庫...' });

    try {
      const rows = await readFirstSheetRows(excelFile);
      const parsed = parseImportRows(rows, { year: y, endMonth: em, times, mode: importMode });
      if (parsed.items.length === 0) {
        throw new ImportParseError(
          importMode === '2'
            ? '檔案中沒有符合期別與購買方式 (首次購買取非零售、追加購買取零售) 的資料列'
            : '檔案中沒有統一編號開頭的資料列'
        );
      }

      const res = await importExcelTracks(formattedPeriod, times, importMode, parsed.items);

      const lines = [`轉入期別:${parsed.periodCode}`, '', res.message];
      if (parsed.skippedTypes.length > 0) lines.push(`略過不認得的發票種類：${parsed.skippedTypes.join('、')}`);
      if (res.unmatched.length > 0) {
        lines.push('', '找不到客戶資料，未轉入：');
        res.unmatched.slice(0, 10).forEach((u) => lines.push(`${u.unifiedNo} ${u.taxNo} ${u.companyName}`.trim()));
        if (res.unmatched.length > 10) lines.push(`… 共 ${res.unmatched.length} 家`);
      }
      lines.push('', '請繼續執行 <F8.確定> 編輯該資料.');

      setImportMsg({ type: 'success', text: `轉入期別 ${parsed.periodCode}：${res.message}` });
      setMessage({
        type: res.unmatched.length > 0 ? 'warning' : 'success',
        title: importMode === '1' ? '網路購買' : '代售點購買',
        lines,
        onClose: () => confirmBtnRef.current?.focus(),
      });
    } catch (err) {
      console.error('Import excel error:', err);
      const text = describeImportError(err);
      setImportMsg({ type: 'error', text: `轉入失敗：${text}` });
      setMessage({ type: 'error', title: '轉入失敗', lines: [text], onClose: () => importBtnRef.current?.focus() });
    } finally {
      setIsImporting(false);
    }
  };

  // 格式預覽：VFP Command4 (tgo01.jpg) / Command5 (tgo02.jpg)
  const openPreview = async (name: DocImageName, title: string) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview({ name, title });
    try {
      const url = await fetchDocImage(name);
      previewUrlRef.current = url;
      setPreview((p) => (p && p.name === name ? { ...p, url } : p));
    } catch (err) {
      const fallback = `找不到格式預覽圖檔 ${getDataDrive().toUpperCase()}:\\W3000\\doc\\${name}.jpg`;
      const text = await readBlobErrorMessage(err, fallback);
      setPreview((p) => (p && p.name === name ? { ...p, error: text } : p));
    }
  };

  const closePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  // 預覽視窗：Esc / Enter 關閉 (capture 階段，不讓畫面的 Esc 回選單)
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      closePreview();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [preview, closePreview]);

  const dataDrive = getDataDrive().toUpperCase();

  const smallButtonClass = `px-2 py-0.5 text-xs font-bold rounded border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
      : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
  }`;

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
                  FormWBase360BuyinvSele ‧ VFP wbase3022
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

          {/* Section 4: 資料匯入 (VFP wbase3022：XLS檔 [...] [轉入]、網路購買 / 代售點購買、格式預覽、下載點網址) */}
          <div
            className={`p-2 sm:p-2.5 rounded-xl border-2 transition-colors ${
              isDark
                ? 'bg-blue-950/20 border-blue-900/50 shadow-inner'
                : 'bg-sky-50/70 border-blue-300 shadow-sm'
            }`}
          >
            {/* 標題：資料匯入 */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Upload className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />
                <h2 className={`text-xs sm:text-sm font-black tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  資料匯入
                </h2>
              </div>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  isDark ? 'text-blue-300 bg-blue-950/60' : 'text-blue-700 bg-blue-50 border border-blue-200'
                }`}
              >
                [Enter 選檔] [↓ 轉入]
              </span>
            </div>

            {/* XLS檔：輸入框 + [...] + [轉入] */}
            <div className="flex items-center space-x-1.5 mb-2">
              <span className={`text-xs sm:text-sm font-black shrink-0 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                XLS檔：
              </span>
              <input
                ref={fileBoxRef}
                type="text"
                value={xlsFileName}
                readOnly
                placeholder="Enter 選擇統購發票 Excel 檔案 (.xls 或 .xlsx)"
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFilePicker();
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    importBtnRef.current?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusAndSelect(sortOrderRef);
                  }
                }}
                className={`flex-1 px-2.5 py-1 rounded-md font-mono text-xs font-bold border-2 transition-all outline-none cursor-pointer focus:ring-2 focus:ring-amber-400 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-amber-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-2xs'
                }`}
              />

              {/* [...] 瀏覽按鈕 */}
              <button
                type="button"
                onClick={openFilePicker}
                className={`px-2.5 py-1 rounded-md border-2 font-black text-xs sm:text-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
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
                ref={importBtnRef}
                type="button"
                onClick={startImport}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    confirmBtnRef.current?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    fileBoxRef.current?.focus();
                  }
                }}
                disabled={isImporting}
                className={`px-3 py-1 rounded-md border-2 font-black text-xs sm:text-sm transition-all shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  isImporting
                    ? 'bg-slate-200/60 border-slate-300 text-slate-400 cursor-not-allowed'
                    : excelFile
                    ? 'bg-red-50 hover:bg-red-100 border-red-300 text-red-600 active:scale-95'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100 shadow-2xs'
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
                {/* 網路購買選項 (追加購買不可用，VFP Text2.Valid) */}
                <div className="flex items-center space-x-1.5">
                  <label className={`flex items-center space-x-1 ${times === '2' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="1"
                      checked={importMode === '1'}
                      disabled={times === '2'}
                      onChange={() => setImportMode('1')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      網路購買
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => openPreview('tgo01', '「網路購買」Excel 格式預覽')}
                    className={smallButtonClass}
                    title={`${dataDrive}:\\W3000\\doc\\tgo01.jpg`}
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
                    onClick={() => openPreview('tgo02', '「代售點購買」Excel 格式預覽')}
                    className={smallButtonClass}
                    title={`${dataDrive}:\\W3000\\doc\\tgo02.jpg`}
                  >
                    格式預覽
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open(PPMOF_URL, '_blank', 'noopener,noreferrer')}
                    className={`${smallButtonClass} inline-flex items-center gap-1`}
                    title={PPMOF_URL}
                  >
                    <ExternalLink className="w-3 h-3" />
                    下載點網址
                  </button>
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
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  importBtnRef.current?.focus();
                }
              }}
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

      {/* 轉入確認 (VFP: 確定轉入 ... Y/N ?) */}
      {confirmImport && (
        <ConfirmDialog
          title={importMode === '1' ? '網路購買' : '代售點購買'}
          lines={[`確定轉入 ${sourceLabel} Y/N ?`, `期別 ${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}  次數 ${times}`, `檔案：${xlsFileName}`]}
          onYes={() => void runImport()}
          onNo={() => {
            setConfirmImport(false);
            importBtnRef.current?.focus();
          }}
        />
      )}

      {/* 訊息視窗 (VFP messagebox) */}
      {message && (
        <MessageDialog
          message={message}
          onDismiss={() => {
            const current = message;
            setMessage(null);
            current.onClose?.();
          }}
        />
      )}

      {/* 格式預覽圖檔 (VFP: RUN <磁碟機>:\W3000\doc\tgo0x.jpg) */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={closePreview}>
          <div
            className={`w-full max-w-6xl max-h-full flex flex-col rounded-2xl border-2 shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-2.5 border-b-2 shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-500" />
                <span>{preview.title}</span>
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                  {dataDrive}:\W3000\doc\{preview.name}.jpg
                </span>
              </h3>
              <button type="button" onClick={closePreview} className="p-1 rounded-lg hover:bg-slate-500/20 cursor-pointer" title="關閉 (Esc)">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`min-h-0 flex-1 overflow-auto p-3 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
              {preview.error ? (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm font-bold">
                  {preview.error}
                </div>
              ) : preview.url ? (
                <img src={preview.url} alt={preview.title} className="max-w-none rounded border border-slate-300 bg-white" />
              ) : (
                <div className="flex items-center gap-2 p-3 text-sm font-bold text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  讀取圖檔中…
                </div>
              )}
            </div>

            <div className={`px-4 py-2 border-t-2 flex items-center justify-between shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {preview.name === 'tgo01'
                  ? '第 1 列 N 欄為期別；資料列 A 統編 B 公司 C 稅籍，之後每 4 欄 (數量/字軌/起號/迄號) 依序為 二聯式、二聯副、三聯式、三聯副、特種、二收銀、三收銀、三收副'
                  : 'A 期別 B 統編 C 稅籍 D 公司 E 發票種類 F 字軌 G 起號 H 迄號 I 數量 J 購買方式 K 購買地點 (L 購買日期)'}
              </span>
              <button
                type="button"
                onClick={closePreview}
                className="px-4 py-1.5 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
              >
                Esc. 關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
