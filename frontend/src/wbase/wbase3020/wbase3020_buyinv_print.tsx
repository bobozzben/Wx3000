import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Printer,
  FileSpreadsheet,
  X,
  Calendar,
  Sparkles,
  Layers,
  Check,
  Sun,
  Moon,
  Building2,
  MapPin,
  Eye,
} from 'lucide-react';
import { getSystemParam } from '../../services/systemParamService';
import {
  queryBuyinvPrintData,
  callLocalagentReport,
  exportToXlsx,
  type InvoicePurchaseItem,
} from '../../services/wbase3020';
import {
  FormUtilSelectXlsxFieldsList,
  type XlsxFieldItem,
} from '../../components/SelectXlsxField';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import axios from 'axios';

interface Wbase3020BuyinvPrintProps {
  onClose?: () => void;
}

export const Wbase3020_buyinv_print: React.FC<Wbase3020BuyinvPrintProps> = ({ onClose }) => {
  const { isDark, toggleTheme } = useTheme();

  // Form Field States
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('06');
  const [mode, setMode] = useState<'1' | '2'>('1'); // 1: 依地址縣市, 2: 依購買地點
  const [cityCond, setCityCond] = useState('*'); // * 代表不分區全部轉出
  const [placeCond, setPlaceCond] = useState('');
  const [placeName, setPlaceName] = useState('購買地點名稱');
  const [sortOrder, setSortOrder] = useState<'1' | '2'>('1'); // 1: 依統一編號, 2: 依稅籍編號
  const [exportXlsxConfig, setExportXlsxConfig] = useState(false);

  // Status & UI States
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isXlsxModalOpen, setIsXlsxModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [queriedData, setQueriedData] = useState<InvoicePurchaseItem[]>([]);

  // F2 Search Modal
  const [isF2ModalOpen, setIsF2ModalOpen] = useState<boolean>(false);

  // Default XLSX export fields definition (Matching Image 2)
  const defaultXlsxFields: XlsxFieldItem[] = [
    { key: 'manualSpecial', label: '特種', customTitle: '特種', selected: true },
    { key: 'cashTwoDup', label: '收銀二聯', customTitle: '二收', selected: true },
    { key: 'cashThreeDup', label: '收銀三聯', customTitle: '三收', selected: true },
    { key: 'cashThreeDupSub', label: '收銀三聯副', customTitle: '四收', selected: true },
    { key: 'seq', label: '序', customTitle: '序', selected: false },
    { key: 'serialNo', label: '流水號', customTitle: '流水號', selected: false },
    { key: 'companyShortName', label: '公司簡稱', customTitle: '公司簡稱', selected: false },
    { key: 'companyAddr', label: '公司地址', customTitle: '公司地址', selected: false },
    { key: 'placeCode', label: '購票地點編號', customTitle: '購票地點編號', selected: false },
    { key: 'empCode', label: '登打人員編號', customTitle: '登打人員編號', selected: false },
    { key: 'prevSeq', label: '上次順序', customTitle: '上次順序', selected: false },
    { key: 'period', label: '期別', customTitle: '期別', selected: false },
    { key: 'times', label: '購買次數', customTitle: '購買次數', selected: false },
    { key: 'transferFlag', label: '轉檔', customTitle: '轉檔', selected: false },
    { key: 'appendFlag', label: '追加', customTitle: '追加', selected: false },
    { key: 'manualTwoTrack', label: '手開二聯字軌', customTitle: '手開二聯字軌', selected: false },
    { key: 'manualTwoStartNo', label: '手開二聯起號', customTitle: '手開二聯起號', selected: false },
    { key: 'manualTwoEndNo', label: '手開二聯迄號', customTitle: '手開二聯迄號', selected: false },
  ];

  const [xlsxFields, setXlsxFields] = useState<XlsxFieldItem[]>(defaultXlsxFields);

  // Element Refs for Keyboard Focus Navigation
  const btnPreviewRef = useRef<HTMLButtonElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const startMonthRef = useRef<HTMLInputElement>(null);
  const endMonthRef = useRef<HTMLInputElement>(null);
  const modeInputRef = useRef<HTMLInputElement>(null);
  const cityCondRef = useRef<HTMLInputElement>(null);
  const placeCondRef = useRef<HTMLInputElement>(null);
  const sortOrderInputRef = useRef<HTMLInputElement>(null);
  const exportConfigRef = useRef<HTMLInputElement>(null);
  const btnPrintRef = useRef<HTMLButtonElement>(null);
  const btnExportRef = useRef<HTMLButtonElement>(null);
  const btnLeaveRef = useRef<HTMLButtonElement>(null);

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | HTMLButtonElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if ('select' in ref.current && typeof (ref.current as any).select === 'function') {
          (ref.current as any).select();
        }
      }
    }, 50);
  };

  // 1. Fetch Year/Month period from Database: a3000 schema: e3000__comm Table: 總帳參數設定
  useEffect(() => {
    let isMounted = true;
    const loadSystemPeriod = async () => {
      try {
        const savedPeriod = await getSystemParam(
          'e3000__comm',
          '總帳參數設定',
          '營業稅發票購買期別',
          '11505-06'
        );
        if (isMounted && savedPeriod && savedPeriod.includes('-')) {
          const parts = savedPeriod.split('-');
          if (parts[0].length >= 3) {
            setYear(parts[0].substring(0, parts[0].length - 2));
            setStartMonth(parts[0].substring(parts[0].length - 2));
            setEndMonth(parts[1] || '06');
          }
        }
      } catch (err) {
        console.error('Failed to load system period param:', err);
      }
    };
    loadSystemPeriod();
    focusAndSelect(yearRef);
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. QueryData Function: Fetch data from Postgresql Database: a3000 schema: e3000__comm Table: 基本發票購買
  const QueryData = useCallback(async (): Promise<InvoicePurchaseItem[]> => {
    setIsLoading(true);
    setStatusMessage('正在從資料庫 (Postgresql Database: a3000 schema: e3000__comm Table: 基本發票購買) 提取資料...');
    const formattedPeriod = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;

    const data = await queryBuyinvPrintData({
      period: formattedPeriod,
      times: '1',
      mode,
      cityCondition: mode === '1' ? cityCond : undefined,
      placeCondition: mode === '2' ? placeCond : undefined,
      sortOrder,
    });

    setQueriedData(data);
    setIsLoading(false);
    setStatusMessage(`資料查詢完成，共 ${data.length} 筆紀錄。`);
    return data;
  }, [year, startMonth, endMonth, mode, cityCond, placeCond, sortOrder]);

  // 3. F4. 預覽資料 Action (除錯用)
  const handlePreviewData = useCallback(async () => {
    await QueryData();
    setIsPreviewModalOpen(true);
  }, [QueryData]);

  // 4. F7. 列印 Action
  const handlePrint = useCallback(async () => {
    const data = await QueryData();
    if (data.length === 0) {
      alert('⚠️ 查無符合條件之發票購買資料！');
    }

    setStatusMessage('正在呼叫 localagent_koffi wbaseRP.dll waccrep3101_b 函數...');
    const res = await callLocalagentReport(1, 10, 10, 0, 0, 'C:\\temp\\buyinv_print.pdf');

    if (res.success) {
      setStatusMessage('🎉 報表已成功透過 localagent_koffi 產生並開啟預覽！');
      alert(`[F7.列印成功]\n已呼叫 localagent_koffi (wbaseRP.dll -> waccrep3101_b)\n回傳代碼: ${res.retCode ?? 0}`);
    } else {
      setStatusMessage(`⚠️ 報表呼叫回應: ${res.error || 'localagent 未啟動，即將開啟網頁印表機預覽'}`);
      alert(
        `[F7.列印提示]\nLocalAgent (wbaseRP.dll -> waccrep3101_b) 呼叫結果: ${res.error || '連線中'}\n系統將將直接進行網頁列印預覽！`
      );
      window.print();
    }
  }, [QueryData]);

  // 5. F8. 匯出 Action
  const handleExport = useCallback(async () => {
    const data = await QueryData();
    if (data.length === 0) {
      alert('⚠️ 查無符合條件之資料可供匯出！');
      return;
    }

    if (exportXlsxConfig) {
      setIsXlsxModalOpen(true);
    } else {
      executeExportExcel(data, xlsxFields);
    }
  }, [QueryData, exportXlsxConfig, xlsxFields]);

  // Execute Excel file export
  const executeExportExcel = async (data: InvoicePurchaseItem[], fields: XlsxFieldItem[]) => {
    const selected = fields.filter((f) => f.selected);
    if (selected.length === 0) {
      alert('⚠️ 請至少選擇一個匯出欄位！');
      return;
    }
    setStatusMessage('正在匯出資料至 EXCEL (.xlsx)...');
    const success = await exportToXlsx(data, selected, `預購統一發票清冊_${year}${startMonth}-${endMonth}.xlsx`);
    if (success) {
      setStatusMessage('🎉 EXCEL 檔案已成功匯出並提至畫面前景！');
      alert('[F8.匯出成功]\nEXCEL 檔案已順利匯出並移至前台開啟！');
    } else {
      setStatusMessage('❌ EXCEL 匯出失敗，請檢查權限或瀏覽器設定。');
    }
  };

  const handleConfirmXlsxFields = (updatedFields: XlsxFieldItem[]) => {
    setXlsxFields(updatedFields);
    setIsXlsxModalOpen(false);
    executeExportExcel(queriedData, updatedFields);
  };

  const handleLeave = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const handleOpenF2Modal = () => {
    setIsF2ModalOpen(true);
  };

  const handleSelectPlaceItem = (item: SearchItem) => {
    setPlaceCond(item.code);
    setPlaceName(item.name);
    setIsF2ModalOpen(false);
  };

  // Global Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isXlsxModalOpen || isF2ModalOpen || isPreviewModalOpen) return;

      if (e.key === 'F4') {
        e.preventDefault();
        handlePreviewData();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleExport();
      } else if (e.key === 'F2') {
        if (mode === '2') {
          e.preventDefault();
          handleOpenF2Modal();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleLeave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isXlsxModalOpen, isF2ModalOpen, mode, handlePrint, handleExport, handleLeave]);

  const formattedPeriodTag = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden">
      {/* Outer Window Dialog matching modern design image */}
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors duration-300 max-h-[92vh] ${
          isDark
            ? 'bg-slate-900 text-white border-slate-800'
            : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
        {/* Header Bar with Gradient */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between transition-colors ${
            isDark
              ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800'
              : 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md'
          }`}
        >
          <div className="flex items-center space-x-3">
            {/* Header Icon Box */}
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">
                  預購統一發票列印
                </h2>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  Enter/F7 列印
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">
                FormWBase320_buyinv_Print
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button (淺色 / 深色) */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition backdrop-blur-xs"
              title={isDark ? '切換至淺色主題' : '切換至深色主題'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>淺色</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-200" />
                  <span>深色</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={handleLeave}
              className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body Cards Container */}
        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
          {/* Card 1: 發票購買期別 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>發票購買期別</span>
              </div>
              <span
                className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${
                  isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                [Enter] 下一欄
              </span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2.5">
              <div className="flex items-center space-x-1.5 font-bold text-sm sm:text-base">
                <input
                  ref={yearRef}
                  type="text"
                  maxLength={3}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') focusAndSelect(startMonthRef);
                  }}
                  className={`w-20 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:bg-slate-900'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                  }`}
                />
                <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>年</span>

                <input
                  ref={startMonthRef}
                  type="text"
                  maxLength={2}
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') focusAndSelect(endMonthRef);
                  }}
                  className={`w-16 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:bg-slate-900'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                  }`}
                />
                <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>-</span>

                <input
                  ref={endMonthRef}
                  type="text"
                  maxLength={2}
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusAndSelect(modeInputRef);
                    }
                  }}
                  className={`w-16 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                  }`}
                />
                <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>月</span>
              </div>

              {/* Formatted Tag Pill Badge */}
              <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-md shadow-indigo-600/20 tracking-wider">
                {formattedPeriodTag}
              </div>
            </div>
          </div>

          {/* Card 2: 轉出模式條件 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs space-y-2.5 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>
                  轉出模式條件 (代碼 1~2)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${
                    isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  [1/2 切換]
                </span>
                <input
                  ref={modeInputRef}
                  type="text"
                  maxLength={1}
                  value={mode}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '1' || val === '2') {
                      setMode(val as '1' | '2');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '1' || e.key === '2') {
                      setMode(e.key as '1' | '2');
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const curMode = (e.target as HTMLInputElement).value || mode;
                      const targetRef = curMode === '2' ? placeCondRef : cityCondRef;
                      setTimeout(() => {
                        focusAndSelect(targetRef);
                      }, 50);
                    }
                  }}
                  className={`w-12 py-1 border-2 rounded-xl text-center font-black text-sm transition focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                  }`}
                />
              </div>
            </div>

            {/* Radio / Option Cards Grid matching Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
              {/* Option 1: 依地址縣市 */}
              <div
                onClick={() => {
                  setMode('1');
                  setTimeout(() => focusAndSelect(cityCondRef), 50);
                }}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  mode === '1'
                    ? isDark
                      ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-md'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 font-extrabold text-sm sm:text-base">
                    <MapPin className="w-4 h-4" />
                    <span>1. 依地址縣市</span>
                  </div>
                  {mode === '1' && <Check className="w-4 h-4 stroke-[3]" />}
                </div>

                <div className="flex items-center space-x-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={cityCondRef}
                    type="text"
                    value={cityCond}
                    disabled={mode !== '1'}
                    onChange={(e) => setCityCond(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        focusAndSelect(sortOrderInputRef);
                      }
                    }}
                    className={`w-full px-2.5 py-1 border-2 rounded-lg font-bold text-xs sm:text-sm transition focus:outline-none ${
                      mode === '1'
                        ? 'bg-white text-slate-900 border-amber-400 focus:ring-2 focus:ring-amber-300'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-700'
                    }`}
                  />
                </div>
                <p
                  className={`text-[11px] mt-1 font-semibold ${
                    mode === '1' ? (isDark ? 'text-indigo-200' : 'text-blue-100') : 'text-red-500'
                  }`}
                >
                  (* : 代表不分區全部轉出)
                </p>
              </div>

              {/* Option 2: 依購買地點 */}
              <div
                onClick={() => {
                  setMode('2');
                  setTimeout(() => focusAndSelect(placeCondRef), 50);
                }}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  mode === '2'
                    ? isDark
                      ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-md'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 font-extrabold text-sm sm:text-base">
                    <Building2 className="w-4 h-4" />
                    <span>2. 依購買地點</span>
                  </div>
                  {mode === '2' && <Check className="w-4 h-4 stroke-[3]" />}
                </div>

                <div className="flex items-center space-x-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={placeCondRef}
                    type="text"
                    value={placeCond}
                    disabled={mode !== '2'}
                    onChange={(e) => setPlaceCond(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'F2') {
                        e.preventDefault();
                        handleOpenF2Modal();
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        focusAndSelect(sortOrderInputRef);
                      }
                    }}
                    placeholder="按 F2 開窗"
                    className={`w-24 px-2.5 py-1 border-2 rounded-lg font-bold text-xs sm:text-sm transition focus:outline-none ${
                      mode === '2'
                        ? 'bg-white text-slate-900 border-amber-400 focus:ring-2 focus:ring-amber-300'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-700'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold truncate ${
                      mode === '2' ? (isDark ? 'text-indigo-100' : 'text-white') : 'text-slate-500'
                    }`}
                  >
                    {placeName}
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1 font-semibold ${
                    mode === '2' ? (isDark ? 'text-indigo-200' : 'text-blue-100') : 'text-slate-400'
                  }`}
                >
                  (按 F2 鍵可開窗選擇地點)
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: 排序方式與匯出設定 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs space-y-2.5 ${
              isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>
                  排序方式與匯出設定 (代碼 1~2)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${
                    isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  [1/2 切換]
                </span>
                <input
                  ref={sortOrderInputRef}
                  type="text"
                  maxLength={1}
                  value={sortOrder}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '1' || val === '2') {
                      setSortOrder(val as '1' | '2');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '1' || e.key === '2') {
                      setSortOrder(e.key as '1' | '2');
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      focusAndSelect(exportConfigRef);
                    }
                  }}
                  className={`w-12 py-1 border-2 rounded-xl text-center font-black text-sm transition focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                  }`}
                />
              </div>
            </div>

            {/* Sort Order Pills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
              <div
                onClick={() => {
                  setSortOrder('1');
                  focusAndSelect(exportConfigRef);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                  sortOrder === '1'
                    ? isDark
                      ? 'bg-indigo-950/70 border-indigo-500 text-white font-black'
                      : 'bg-indigo-600 text-white border-indigo-600 font-black shadow-sm'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="font-extrabold text-xs sm:text-sm">1. 依統一編號排序</span>
                {sortOrder === '1' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>

              <div
                onClick={() => {
                  setSortOrder('2');
                  focusAndSelect(exportConfigRef);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                  sortOrder === '2'
                    ? isDark
                      ? 'bg-indigo-950/70 border-indigo-500 text-white font-black'
                      : 'bg-indigo-600 text-white border-indigo-600 font-black shadow-sm'
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="font-extrabold text-xs sm:text-sm">2. 依稅籍編號排序</span>
                {sortOrder === '2' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* Checkbox Card for XLSX Export */}
            <div
              onClick={() => setExportXlsxConfig(!exportXlsxConfig)}
              className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center space-x-3 transition-all ${
                exportXlsxConfig
                  ? isDark
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                  : isDark
                  ? 'bg-slate-900/40 border-slate-700/60 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <input
                ref={exportConfigRef}
                type="checkbox"
                checked={exportXlsxConfig}
                onChange={(e) => setExportXlsxConfig(e.target.checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusAndSelect(btnPrintRef);
                  }
                }}
                className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 focus:ring-emerald-400 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex-1">
                <span className="font-extrabold text-xs sm:text-sm">匯出 xlsx 設定</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  (勾選此項時，按下 F8 匯出將彈出 FormUtilSelectXlsxFieldsList 選擇要匯出的欄位)
                </p>
              </div>
            </div>
          </div>

          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold text-center border shadow-xs ${
                isDark
                  ? 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}
            >
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 border-t transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/90'
          }`}
        >
          {/* Left Side: Debug / Preview Button */}
          <div>
            <button
              ref={btnPreviewRef}
              onClick={handlePreviewData}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePreviewData();
                }
              }}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm"
            >
              <Eye className="w-4 h-4 text-white" />
              <span>F4. 預覽資料</span>
            </button>
          </div>

          {/* Right Side: Action Buttons */}
          <div className="flex items-center space-x-2.5 font-bold text-xs sm:text-sm">
            <button
              ref={btnPrintRef}
              onClick={handlePrint}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePrint();
                }
              }}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>F7. 列印</span>
            </button>

            <button
              ref={btnExportRef}
              onClick={handleExport}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExport();
                }
              }}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>F8. 匯出</span>
            </button>

            <button
              ref={btnLeaveRef}
              onClick={handleLeave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLeave();
                }
              }}
              className={`flex items-center space-x-1.5 px-4 sm:px-4.5 py-2 rounded-xl border-2 transition active:scale-95 shadow-xs focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              <X className="w-4 h-4 text-red-500 stroke-[3]" />
              <span>Esc. 離開</span>
            </button>
          </div>
        </div>
      </div>

      {/* Shared XLSX Field Selection Modal (FormUtilSelectXlsxFieldsList) */}
      <FormUtilSelectXlsxFieldsList
        isOpen={isXlsxModalOpen}
        fields={xlsxFields}
        defaultFields={defaultXlsxFields}
        onConfirm={handleConfirmXlsxFields}
        onClose={() => setIsXlsxModalOpen(false)}
      />

      {/* F2 Search Modal for Place Code */}
      <SearchModal
        isOpen={isF2ModalOpen}
        title="購票地點查詢 [F2]"
        onSearch={async (kw: string) => {
          try {
            const res = await axios.get('/api/wbase3010', { params: { keyword: kw } });
            if (Array.isArray(res.data)) {
              return res.data.map((x: any) => ({
                code: x.placeCode || x.code || '',
                name: x.placeName || x.name || '',
              }));
            }
          } catch (e) {}
          return [
            { code: '01', name: '台北市分局' },
            { code: '02', name: '新北市分局' },
            { code: '03', name: '台中市分局' },
            { code: '04', name: '高雄市分局' },
          ];
        }}
        onSelect={handleSelectPlaceItem}
        onClose={() => setIsF2ModalOpen(false)}
      />

      {/* Debug Data Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
          <div
            className={`w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
              isDark
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-800 border-slate-300'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-5 py-3 flex items-center justify-between border-b ${
                isDark
                  ? 'bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border-slate-800'
                  : 'bg-gradient-to-r from-sky-700 to-indigo-700 text-white shadow-md'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-lg tracking-wide text-white">
                  除錯用資料預覽 (共 {queriedData.length} 筆紀錄)
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Table Body */}
            <div className="p-4 overflow-auto flex-1">
              {queriedData.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-bold text-base">
                  ⚠️ 依目前設定條件查詢無相符之發票購買資料！
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-xl shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className={`border-b ${
                          isDark
                            ? 'bg-slate-800 text-amber-300 border-slate-700'
                            : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}
                      >
                        <th className="p-2.5 font-bold border-r text-center">#</th>
                        <th className="p-2.5 font-bold border-r">公司編號</th>
                        <th className="p-2.5 font-bold border-r">公司簡稱</th>
                        <th className="p-2.5 font-bold border-r">統一編號</th>
                        <th className="p-2.5 font-bold border-r">稅籍編號</th>
                        <th className="p-2.5 font-bold border-r">購票地點</th>
                        <th className="p-2.5 font-bold border-r">期別</th>
                        <th className="p-2.5 font-bold">縣市/地點</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {queriedData.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-amber-400/10 transition ${
                            idx % 2 === 0
                              ? isDark
                                ? 'bg-slate-900/60'
                                : 'bg-white'
                              : isDark
                              ? 'bg-slate-800/40'
                              : 'bg-slate-50'
                          }`}
                        >
                          <td className="p-2 font-mono text-center border-r font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-mono font-bold text-sky-400 border-r">
                            {item.companyCode || '-'}
                          </td>
                          <td className="p-2 font-bold border-r">
                            {item.companyShortName || '-'}
                          </td>
                          <td className="p-2 font-mono border-r">{item.unifiedNo || '-'}</td>
                          <td className="p-2 font-mono border-r">{item.taxNo || '-'}</td>
                          <td className="p-2 border-r">{item.placeCode || '-'}</td>
                          <td className="p-2 font-mono border-r">{item.period || '-'}</td>
                          <td className="p-2 truncate max-w-xs">{item.city || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className={`px-5 py-3 flex items-center justify-between border-t ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-400 font-bold">
                查詢條件: {year}年{startMonth}-{endMonth}月 | 轉出模式: {mode === '1' ? '依地址縣市(' + cityCond + ')' : '依購買地點(' + placeCond + ')'} | 排序: {sortOrder === '1' ? '統一編號' : '稅籍編號'}
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition shadow-sm active:scale-95"
              >
                關閉預覽 (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
