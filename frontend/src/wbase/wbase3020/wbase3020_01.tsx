import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Calendar,
  Layers,
  Search,
  Receipt,
  Sparkles,
  UserCheck,
  MapPin,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import { getSystemParam, setSystemParam } from '../../services/systemParamService';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import axios from 'axios';
import { useTheme } from '../menu/ThemeContext';

interface Wbase3020_01Props {
  onConfirm: (params: {
    period: string;
    times: string;
    inputMode: string;
    inputCondition: string;
  }) => void;
  onClose: () => void;
}

export const Wbase3020_01: React.FC<Wbase3020_01Props> = ({ onConfirm, onClose }) => {
  const { isDark } = useTheme();

  // Form fields
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('06');
  const [times, setTimes] = useState('1');
  const [inputMode, setInputMode] = useState('1');
  const [inputCondition, setInputCondition] = useState('');

  // Element Refs for Keyboard Navigation
  const yearRef = useRef<HTMLInputElement>(null);
  const startMonthRef = useRef<HTMLInputElement>(null);
  const endMonthRef = useRef<HTMLInputElement>(null);
  const timesRef = useRef<HTMLInputElement>(null);
  const inputModeRef = useRef<HTMLInputElement>(null);
  const inputConditionRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // F2 Search Modal state
  const [isF2ModalOpen, setIsF2ModalOpen] = useState(false);
  const [f2Title, setF2Title] = useState('');

  // Focus utility helper
  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select();
      }
    }, 50);
  };

  // Load saved system parameters on mount & auto-focus year input
  useEffect(() => {
    const loadParams = async () => {
      try {
        const savedPeriod = await getSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買期別', '11505-06');
        const savedTimes = await getSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買次數', '1');
        const savedMode = await getSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買輸入方式', '1');
        const savedCond = await getSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買輸入條件', '');

        if (savedPeriod && savedPeriod.includes('-')) {
          const parts = savedPeriod.split('-');
          if (parts[0].length >= 3) {
            setYear(parts[0].substring(0, parts[0].length - 2));
            setStartMonth(parts[0].substring(parts[0].length - 2));
            setEndMonth(parts[1] || '06');
          }
        }
        if (savedTimes) setTimes(savedTimes);
        if (savedMode) setInputMode(savedMode);
        if (savedCond) setInputCondition(savedCond);
      } catch (err) {
        console.error('Failed to load system params in wbase3020_01:', err);
      } finally {
        focusAndSelect(yearRef);
      }
    };
    loadParams();
  }, []);

  const handleConfirm = useCallback(async () => {
    const formattedPeriod = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;
    try {
      await setSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買期別', formattedPeriod);
      await setSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買次數', times);
      await setSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買輸入方式', inputMode);
      await setSystemParam('e3000__comm', '總帳參數設定', '營業稅發票購買輸入條件', inputCondition);
    } catch (err) {
      console.error('Failed to save system params:', err);
    }

    onConfirm({
      period: formattedPeriod,
      times,
      inputMode,
      inputCondition,
    });
  }, [year, startMonth, endMonth, times, inputMode, inputCondition, onConfirm]);

  // Open F2 Modal for Mode 6 (購買地點) or Mode 7 (登入人員)
  const handleOpenF2Modal = useCallback(() => {
    if (inputMode === '6') {
      setF2Title('購買地點開窗選擇');
      setIsF2ModalOpen(true);
    } else if (inputMode === '7') {
      setF2Title('登入人員開窗選擇');
      setIsF2ModalOpen(true);
    }
  }, [inputMode]);

  // Global Keyboard Shortcuts (F8: Confirm, Esc: Exit, F2: Search Modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isF2ModalOpen) return;

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
      if (e.key === 'F2' && (inputMode === '6' || inputMode === '7')) {
        e.preventDefault();
        handleOpenF2Modal();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm, onClose, inputMode, isF2ModalOpen, handleOpenF2Modal]);

  // Keyboard navigation between fields on Enter / Arrow Keys
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentField: 'year' | 'startMonth' | 'endMonth' | 'times' | 'inputMode' | 'inputCondition'
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
          focusAndSelect(inputModeRef);
          break;
        case 'inputMode':
          if (['5', '6', '7'].includes(inputMode)) {
            focusAndSelect(inputConditionRef);
          } else {
            handleConfirm();
          }
          break;
        case 'inputCondition':
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
          focusAndSelect(inputModeRef);
          break;
        case 'inputMode':
          if (['5', '6', '7'].includes(inputMode)) {
            focusAndSelect(inputConditionRef);
          } else {
            confirmBtnRef.current?.focus();
          }
          break;
        case 'inputCondition':
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
        case 'inputMode':
          focusAndSelect(timesRef);
          break;
        case 'inputCondition':
          focusAndSelect(inputModeRef);
          break;
      }
    }
  };

  // F2 Search Query Handler
  const handleF2Search = async (query: string): Promise<SearchItem[]> => {
    if (inputMode === '6') {
      const res = await axios.get('/api/wbase3010', { params: { keyword: query } });
      const data = Array.isArray(res.data) ? res.data : [];
      return data.map((item: any) => ({
        code: item.placeCode || item.編號 || '',
        name: item.placeName || item.購買地點 || '',
        spec: item.placeAddress || item.購買地址 || '',
      }));
    } else if (inputMode === '7') {
      const res = await axios.get('/api/wbase1030', { params: { keyword: query } });
      const data = Array.isArray(res.data) ? res.data : [];
      return data.map((item: any) => ({
        code: item.empCode || item.建檔人員編號 || '',
        name: item.empName || item.建檔人員名稱 || '',
        spec: item.depName || item.部門 || '',
      }));
    }
    return [];
  };

  const handleF2Select = (item: SearchItem) => {
    setInputCondition(item.code);
    setIsF2ModalOpen(false);
    focusAndSelect(inputConditionRef);
  };

  const inputModesList = [
    { id: '1', label: '稅籍編號', icon: Building2 },
    { id: '2', label: '統一編號', icon: FileSpreadsheet },
    { id: '3', label: '客戶編號', icon: UserCheck },
    { id: '4', label: '上次次序', icon: ArrowRight },
    { id: '5', label: '依縣市別', icon: MapPin },
    { id: '6', label: '購買地點', icon: Search, hasF2: true },
    { id: '7', label: '登入人員', icon: UserCheck, hasF2: true },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none transition-colors duration-300 ${
        isDark
          ? 'bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950'
          : 'bg-slate-100 text-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-100 to-slate-100'
      }`}
    >
      {/* Main Container Card */}
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transition-all border-2 ${
          isDark
            ? 'bg-slate-900/90 border-slate-800/80 shadow-indigo-950/20 backdrop-blur-xl'
            : 'bg-white border-slate-300 shadow-slate-400/30 backdrop-blur-xl'
        }`}
      >
        {/* Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] px-6 py-4 sm:py-5 text-white">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-wide drop-shadow-sm flex items-center gap-2">
                  <span>發票購買期別設定</span>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold shadow-2xs">
                    Enter/F8 送出
                  </span>
                </h1>
                <p className="text-xs text-blue-100 font-mono mt-0.5 font-bold">
                  FormWBase430BuyinvSele
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
              title="離開 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Section 1: 發票購買期別 */}
          <div
            className={`p-4 sm:p-5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <label className={`text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  發票購買期別
                </label>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                  isDark ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                }`}
              >
                [Enter] 下一欄
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-1.5">
                <input
                  ref={yearRef}
                  type="text"
                  value={year}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setYear(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'year')}
                  className={`w-20 sm:w-24 px-3 py-2 rounded-lg font-mono text-center font-black text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="115"
                />
                <span className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>年</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <input
                  ref={startMonthRef}
                  type="text"
                  value={startMonth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setStartMonth(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'startMonth')}
                  className={`w-16 px-3 py-2 rounded-lg font-mono text-center font-black text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="05"
                />
                <span className={`text-sm font-black ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>-</span>
                <input
                  ref={endMonthRef}
                  type="text"
                  value={endMonth}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEndMonth(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'endMonth')}
                  className={`w-16 px-3 py-2 rounded-lg font-mono text-center font-black text-base border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                  placeholder="06"
                />
                <span className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>月</span>
              </div>

              {/* Formatted Badge */}
              <div
                className={`ml-auto px-3.5 py-1.5 rounded-lg font-mono text-xs font-black ${
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
            className={`p-4 sm:p-5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <label className={`text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  購買次數
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimes(val);
                  }}
                  onKeyDown={(e) => handleInputKeyDown(e, 'times')}
                  className={`w-14 px-2 py-1 text-center font-mono font-black text-base rounded-lg border-2 outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-2xs'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: '1', label: '1. 首次購買' },
                { id: '2', label: '2. 追加購買' },
              ].map((opt) => {
                const isSelected = times === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTimes(opt.id);
                      focusAndSelect(inputModeRef);
                    }}
                    className={`py-2.5 px-4 rounded-xl text-sm font-extrabold border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                          : 'bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-indigo-500/30'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className={`w-4 h-4 stroke-[3] ${isDark ? 'text-purple-400' : 'text-white'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: 輸入方式 */}
          <div
            className={`p-4 sm:p-5 rounded-xl border-2 transition-colors ${
              isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Layers className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <label className={`text-sm font-extrabold tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  輸入方式 (代碼 1~7)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    isDark ? 'text-indigo-400 bg-indigo-950/60' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                  }`}
                >
                  [1-7 盲打]
                </span>
                <input
                  ref={inputModeRef}
                  type="text"
                  value={inputMode}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputMode(val);
                    if (val !== '5' && val !== '6' && val !== '7') {
                      setInputCondition('');
                    }
                  }}
                  onKeyDown={(e) => handleInputKeyDown(e, 'inputMode')}
                  className={`w-14 px-2 py-1 text-center font-mono font-black text-base rounded-lg border-2 outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-slate-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {inputModesList.map((mode) => {
                const isSelected = inputMode === mode.id;
                const IconComponent = mode.icon;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setInputMode(mode.id);
                      if (mode.id !== '5' && mode.id !== '6' && mode.id !== '7') {
                        setInputCondition('');
                      }
                      if (['5', '6', '7'].includes(mode.id)) {
                        focusAndSelect(inputConditionRef);
                      } else {
                        focusAndSelect(inputModeRef);
                      }
                    }}
                    className={`p-2.5 rounded-xl text-xs font-extrabold border-2 transition-all flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                          : 'bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-indigo-500/30'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        : 'bg-white border-slate-200/90 text-slate-800 hover:bg-indigo-50/70 hover:text-indigo-950 hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isSelected
                          ? isDark ? 'text-indigo-400' : 'text-white'
                          : isDark ? 'opacity-50' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{mode.id}. {mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Condition Field (Mode 5, 6, 7) */}
          {(inputMode === '5' || inputMode === '6' || inputMode === '7') && (
            <div
              className={`p-4 sm:p-5 rounded-xl border-2 transition-colors ${
                isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className={`text-sm font-extrabold tracking-wider block ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {inputMode === '5' && '縣市別名稱'}
                  {inputMode === '6' && '購買地點選擇 (按 F2 開窗)'}
                  {inputMode === '7' && '登入人員選擇 (按 F2 開窗)'}
                </label>
                <span className="text-xs text-indigo-600 font-mono font-bold">[Enter] 確定送出</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  ref={inputConditionRef}
                  type="text"
                  value={inputCondition}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInputCondition(e.target.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, 'inputCondition')}
                  placeholder={
                    inputMode === '5'
                      ? '請輸入縣市名稱，完成按 Enter'
                      : inputMode === '6'
                      ? '請輸入或按 F2 開窗選擇購買地點'
                      : '請輸入或按 F2 開窗選擇登入人員'
                  }
                  className={`flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold border-2 transition-all outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30'
                      : 'bg-white border-indigo-300 text-slate-950 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                  }`}
                />

                {(inputMode === '6' || inputMode === '7') && (
                  <button
                    type="button"
                    onClick={handleOpenF2Modal}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                    title="按 F2 開窗選擇"
                  >
                    <Search className="w-4 h-4" />
                    <span>F2 開窗</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div
          className={`px-6 py-4 border-t-2 flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-md font-mono font-black flex items-center gap-1 shadow-2xs ${
                isDark
                  ? 'bg-indigo-950/40 border border-indigo-800/50 text-indigo-300'
                  : 'bg-slate-800 text-yellow-300 border border-slate-700'
              }`}
            >
              <CornerDownLeft className="w-3.5 h-3.5 text-yellow-400" /> Enter 移跳/確定
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-mono font-black shadow-2xs ${
                isDark
                  ? 'bg-slate-800 border border-slate-700 text-slate-300'
                  : 'bg-slate-800 text-yellow-300 border border-slate-700'
              }`}
            >
              [F8] 確定
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-mono font-black shadow-2xs ${
                isDark
                  ? 'bg-slate-800 border border-slate-700 text-slate-300'
                  : 'bg-slate-800 text-yellow-300 border border-slate-700'
              }`}
            >
              [Esc] 離開
            </span>
            {(inputMode === '6' || inputMode === '7') && (
              <span
                className={`px-2.5 py-1 rounded-md font-mono font-black shadow-2xs ${
                  isDark
                    ? 'bg-slate-800 border border-slate-700 text-slate-300'
                    : 'bg-slate-800 text-yellow-300 border border-slate-700'
                }`}
              >
                [F2] 開窗
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={`flex items-center space-x-1.5 px-5 py-2.5 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Esc. 離開</span>
            </button>

            <button
              ref={confirmBtnRef}
              type="button"
              onClick={handleConfirm}
              className="flex items-center space-x-1.5 px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950/20 border-2 border-emerald-700 transition-all hover:scale-102 active:scale-98 cursor-pointer focus:ring-2 focus:ring-emerald-400"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>F8. 確定</span>
            </button>
          </div>
        </div>
      </div>

      {/* F2 Search Modal */}
      <SearchModal
        isOpen={isF2ModalOpen}
        title={f2Title}
        onSearch={handleF2Search}
        onSelect={handleF2Select}
        onClose={() => {
          setIsF2ModalOpen(false);
          focusAndSelect(inputConditionRef);
        }}
      />
    </div>
  );
};


