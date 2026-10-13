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
  DollarSign,
  FileText,
} from 'lucide-react';
import { getSystemParam } from '../../services/systemParamService';
import {
  queryBuyinvPrintData,
  getBuyinvPrices,
  callLocalagentWbase350BuyinvList,
  exportToXlsx,
  type InvoicePurchaseItem,
  type BuyinvPrintQueryRequest,
} from '../../services/wbase3050';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from '../../components/SelectXlsxField';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { fetchTicketPlaces } from '../../services/wbase3010';
import { Wbase3050_buyinv_setamt } from './wbase3050_buyinv_setamt';
import { useTheme } from '../menu/ThemeContext';

interface Wbase3050BuylistPrintProps {
  onClose?: () => void;
}

const STORAGE_KEY = 'wbase3050_xlsx_export_config';

const DEFAULT_V_FIELD_LIST =
  '公司編號,公司統編,公司名稱,稅籍編號,製表日期,手開二聯,手開二聯金額,手開二聯副,手開二聯副金額,手開三聯,手開三聯金額,手開三聯副,手開三聯副金額,特種,特種金額,收銀二聯,收銀二聯金額,收銀三聯,收銀三聯金額,收銀三聯副,收銀三聯副金額,公司本數,總金額,總家數,總本數';
const DEFAULT_V_CAPTION_LIST =
  '客戶,統一編號,客戶名稱,稅籍編號,製表日期,二聯,二聯金額,二聯副,二副金額,三聯,三聯金額,三聯副,三副金額,特種,特種金額,二收,二收金額,三收,三收金額,四收,四收金額,公司本數,總金額,總家數,總本數';
const DEFAULT_V_DISPLAY_FORMAT = ',,,,,本數,金額,本數,金額,本數,金額,本數,金額,本數,金額,本數,金額,本數,金額,本數,金額,本數,金額,家數,本數';
const DEFAULT_V_COLOR_LIST = ',,,,,,,,,,,,,,,,,,,,,,,,';

export const Wbase3050_buylist_print: React.FC<Wbase3050BuylistPrintProps> = ({ onClose }) => {
  const { isDark, toggleTheme } = useTheme();

  // 畫面匯出欄位設定 (優先讀取 localStorage 歷史變更)
  const [xlsxConfig, setXlsxConfig] = useState<XlsxSerializedConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.vFieldList) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved xlsx config from localStorage:', e);
    }
    return {
      vFieldList: DEFAULT_V_FIELD_LIST,
      vCaptionList: DEFAULT_V_CAPTION_LIST,
      vDisplayFormat: DEFAULT_V_DISPLAY_FORMAT,
      vColorList: DEFAULT_V_COLOR_LIST,
    };
  });

  // 1. 列印期別 (年, 起月, 迄月)
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('06');

  // 2. 分區模式 (1: 依地址縣市, 2: 依購買地點)
  const [mode, setMode] = useState<'1' | '2'>('1');
  const [cityCond, setCityCond] = useState('*'); // * 代表不分區全部轉出
  const [placeCond, setPlaceCond] = useState('');
  const [placeName, setPlaceName] = useState('購買地點名稱');

  // 3. 排序方式 (1: 依統一編號, 2: 依稅籍編號)
  const [sortOrder, setSortOrder] = useState<'1' | '2'>('1');

  // 4. 列印表格 (1: A4發票清單, 2: 中一刀發票領取簽收單)
  const [reportType, setReportType] = useState<'1' | '2'>('1');

  // 5. 匯出 xlsx 設定
  const [exportXlsxConfig, setExportXlsxConfig] = useState(false);

  // Status & Modal States
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSetAmtModalOpen, setIsSetAmtModalOpen] = useState<boolean>(false);
  const [isXlsxModalOpen, setIsXlsxModalOpen] = useState<boolean>(false);
  const [isF2ModalOpen, setIsF2ModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [queriedData, setQueriedData] = useState<InvoicePurchaseItem[]>([]);

  // 候選全量 XLSX 匯出欄位定義 (包含所有計算欄位)
  const defaultXlsxFields: XlsxFieldItem[] = [
    { key: 'companyCode', label: '公司編號', customTitle: '公司編號', selected: true },
    { key: 'unifiedNo', label: '公司統編', customTitle: '公司統編', selected: true },
    { key: 'companyShortName', label: '公司名稱', customTitle: '公司名稱', selected: true },
    { key: 'taxNo', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
    { key: 'reportDate', label: '製表日期', customTitle: '製表日期', selected: true },
    { key: 'manualTwoDup', label: '手開二聯', customTitle: '手開二聯', selected: true },
    { key: 'manualTwoDupAmt', label: '手開二聯金額', customTitle: '手開二聯金額', selected: true },
    { key: 'manualTwoDupSub', label: '手開二聯副', customTitle: '手開二聯副', selected: true },
    { key: 'manualTwoDupSubAmt', label: '手開二聯副金額', customTitle: '手開二聯副金額', selected: true },
    { key: 'manualThreeDup', label: '手開三聯', customTitle: '手開三聯', selected: true },
    { key: 'manualThreeDupAmt', label: '手開三聯金額', customTitle: '手開三聯金額', selected: true },
    { key: 'manualThreeDupSub', label: '手開三聯副', customTitle: '手開三聯副', selected: true },
    { key: 'manualThreeDupSubAmt', label: '手開三聯副金額', customTitle: '手開三聯副金額', selected: true },
    { key: 'manualSpecial', label: '特種', customTitle: '特種', selected: true },
    { key: 'manualSpecialAmt', label: '特種金額', customTitle: '特種金額', selected: true },
    { key: 'cashTwoDup', label: '收銀二聯', customTitle: '二收', selected: true },
    { key: 'cashTwoDupAmt', label: '收銀二聯金額', customTitle: '收銀二聯金額', selected: true },
    { key: 'cashThreeDup', label: '收銀三聯', customTitle: '三收', selected: true },
    { key: 'cashThreeDupAmt', label: '收銀三聯金額', customTitle: '收銀三聯金額', selected: true },
    { key: 'cashThreeDupSub', label: '收銀三聯副', customTitle: '四收', selected: true },
    { key: 'cashThreeDupSubAmt', label: '收銀三聯副金額', customTitle: '收銀三聯副金額', selected: true },
    { key: 'companyBooks', label: '公司本數', customTitle: '公司本數', selected: true },
    { key: 'totalAmt', label: '總金額', customTitle: '總金額', selected: true },
    { key: 'totalCount', label: '總家數', customTitle: '總家數', selected: true },
    { key: 'totalBooks', label: '總本數', customTitle: '總本數', selected: true },
    { key: 'companyTel', label: '公司電話', customTitle: '公司電話', selected: false },
    { key: 'companyFax', label: '公司傳真', customTitle: '公司傳真', selected: false },
    { key: 'dataYear', label: '資料年度', customTitle: '資料年度', selected: false },
    { key: 'dataStartMonth', label: '資料起月', customTitle: '資料起月', selected: false },
    { key: 'dataEndMonth', label: '資料迄月', customTitle: '資料迄月', selected: false },
    { key: 'seq', label: '序', customTitle: '序', selected: false },
    { key: 'serialNo', label: '流水號', customTitle: '流水號', selected: false },
    { key: 'companyAddr', label: '公司地址', customTitle: '公司地址', selected: false },
    { key: 'placeCode', label: '購票地點編號', customTitle: '購票地點編號', selected: false },
    { key: 'empCode', label: '登打人員編號', customTitle: '登打人員編號', selected: false },
    { key: 'period', label: '期別', customTitle: '期別', selected: false },
    { key: 'times', label: '購買次數', customTitle: '購買次數', selected: false },
  ];

  // Element Refs for Keyboard Focus Navigation
  const yearRef = useRef<HTMLInputElement>(null);
  const startMonthRef = useRef<HTMLInputElement>(null);
  const endMonthRef = useRef<HTMLInputElement>(null);
  const modeInputRef = useRef<HTMLInputElement>(null);
  const cityCondRef = useRef<HTMLInputElement>(null);
  const placeCondRef = useRef<HTMLInputElement>(null);
  const sortOrderInputRef = useRef<HTMLInputElement>(null);
  const reportTypeInputRef = useRef<HTMLInputElement>(null);
  const exportConfigRef = useRef<HTMLInputElement>(null);
  const btnPreviewRef = useRef<HTMLButtonElement>(null);
  const btnSetAmtRef = useRef<HTMLButtonElement>(null);
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

  // 1. 載入列印期別年月由 Database: a3000 schema: e3000__comm Table: 總帳參數設定 提取
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

  // 2. QueryData 函數：從 Postgresql Database: a3000 schema: e3000__comm Table: 基本發票購買 取得資料，並計算各金額與匯總欄位
  const QueryData = useCallback(async (): Promise<InvoicePurchaseItem[]> => {
    setIsLoading(true);
    setStatusMessage('正在從資料庫 (Postgresql Database: a3000 schema: e3000__comm Table: 基本發票購買) 提取資料並進行金額試算...');
    const formattedPeriod = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;

    const queryParams: BuyinvPrintQueryRequest = {
      period: formattedPeriod,
      times: '1',
      year,
      startMonth,
      endMonth,
      mode,
      cityCondition: mode === '1' ? cityCond : undefined,
      placeCondition: mode === '2' ? placeCond : undefined,
      sortOrder,
      reportType,
    };

    const [rawData, prices] = await Promise.all([
      queryBuyinvPrintData(queryParams),
      getBuyinvPrices(),
    ]);

    // 計算製表日期 (民國年月日, e.g. 115/05/20)
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const rocMonth = String(now.getMonth() + 1).padStart(2, '0');
    const rocDay = String(now.getDate()).padStart(2, '0');
    const reportDate = `${rocYear}/${rocMonth}/${rocDay}`;

    // 第一階段：計算每筆紀錄之各發票種類金額與公司本數
    const processedItems: InvoicePurchaseItem[] = rawData.map((item) => {
      const manualTwoDup = Number(item.manualTwoDup) || 0;
      const manualTwoDupSub = Number(item.manualTwoDupSub) || 0;
      const manualThreeDup = Number(item.manualThreeDup) || 0;
      const manualThreeDupSub = Number(item.manualThreeDupSub) || 0;
      const manualSpecial = Number(item.manualSpecial) || 0;
      const cashTwoDup = Number(item.cashTwoDup) || 0;
      const cashThreeDup = Number(item.cashThreeDup) || 0;
      const cashThreeDupSub = Number(item.cashThreeDupSub) || 0;

      const manualTwoDupAmt = manualTwoDup * (prices.manualTwoDup || 15);
      const manualTwoDupSubAmt = manualTwoDupSub * (prices.manualTwoDupSub || 16);
      const manualThreeDupAmt = manualThreeDup * (prices.manualThreeDup || 18);
      const manualThreeDupSubAmt = manualThreeDupSub * (prices.manualThreeDupSub || 19);
      const manualSpecialAmt = manualSpecial * (prices.manualSpecial || 15);
      const cashTwoDupAmt = cashTwoDup * (prices.cashTwoDup || 36);
      const cashThreeDupAmt = cashThreeDup * (prices.cashThreeDup || 85);
      const cashThreeDupSubAmt = cashThreeDupSub * (prices.cashThreeDupSub || 95);

      const companyBooks =
        manualTwoDup +
        manualTwoDupSub +
        manualThreeDup +
        manualThreeDupSub +
        manualSpecial +
        cashTwoDup +
        cashThreeDup +
        cashThreeDupSub;

      return {
        ...item,
        dataYear: item.dataYear || year,
        dataStartMonth: item.dataStartMonth || startMonth,
        dataEndMonth: item.dataEndMonth || endMonth,
        reportDate,
        manualTwoDup,
        manualTwoDupSub,
        manualThreeDup,
        manualThreeDupSub,
        manualSpecial,
        cashTwoDup,
        cashThreeDup,
        cashThreeDupSub,
        manualTwoDupAmt,
        manualTwoDupSubAmt,
        manualThreeDupAmt,
        manualThreeDupSubAmt,
        manualSpecialAmt,
        cashTwoDupAmt,
        cashThreeDupAmt,
        cashThreeDupSubAmt,
        companyBooks,
      };
    });

    // 第二階段：計算整體總匯總 (總家數, 總本數, 總金額)
    const totalCount = processedItems.length;
    const totalBooks = processedItems.reduce((acc, cur) => acc + (cur.companyBooks || 0), 0);
    const totalAmt = processedItems.reduce(
      (acc, cur) =>
        acc +
        (cur.manualTwoDupAmt || 0) +
        (cur.manualTwoDupSubAmt || 0) +
        (cur.manualThreeDupAmt || 0) +
        (cur.manualThreeDupSubAmt || 0) +
        (cur.manualSpecialAmt || 0) +
        (cur.cashTwoDupAmt || 0) +
        (cur.cashThreeDupAmt || 0) +
        (cur.cashThreeDupSubAmt || 0),
      0
    );

    // 第三階段：注入總體匯總欄位與中文鍵值映射
    const finalData: InvoicePurchaseItem[] = processedItems.map((item) => ({
      ...item,
      totalCount,
      totalBooks,
      totalAmt,
      '製表日期': reportDate,
      '手開二聯金額': item.manualTwoDupAmt,
      '手開二聯副金額': item.manualTwoDupSubAmt,
      '手開三聯金額': item.manualThreeDupAmt,
      '手開三聯副金額': item.manualThreeDupSubAmt,
      '特種金額': item.manualSpecialAmt,
      '收銀二聯金額': item.cashTwoDupAmt,
      '收銀三聯金額': item.cashThreeDupAmt,
      '收銀三聯副金額': item.cashThreeDupSubAmt,
      '總金額': totalAmt,
      '總家數': totalCount,
      '總本數': totalBooks,
      '公司本數': item.companyBooks,
      '公司電話': item.companyTel || '',
      '公司傳真': item.companyFax || '',
    }));

    setQueriedData(finalData);
    setIsLoading(false);
    setStatusMessage(
      `資料計算完成，共 ${finalData.length} 家公司，總本數: ${totalBooks} 本，總金額: NT$ ${totalAmt.toLocaleString()} 元。`
    );
    return finalData;
  }, [year, startMonth, endMonth, mode, cityCond, placeCond, sortOrder, reportType]);

  // 3. F4. 預覽資料 Action (全欄位表格)
  const handlePreviewData = useCallback(async () => {
    await QueryData();
    setIsPreviewModalOpen(true);
  }, [QueryData]);

  // 4. F6. 金額設定 Action
  const handleOpenSetAmt = useCallback(() => {
    setIsSetAmtModalOpen(true);
  }, []);

  // 5. F7. 列印 Action：呼叫 LocalAgent wbaseRP.dll 的 wbase350_buyinv_list
  const handlePrint = useCallback(async () => {
    const data = await QueryData();
    if (data.length === 0) {
      alert('⚠️ 查無符合條件之發票購買資料！');
      return;
    }

    const reportTypeName =
      reportType === '2'
        ? '中一刀發票領取簽收單 (frxReport_3502_buyinv)'
        : 'A4發票清單 (frxReport_3501_buyinv)';
    setStatusMessage(
      `正在透過 LocalAgent 呼叫 wbaseRP.dll 的 wbase350_buyinv_list (${reportTypeName})...`
    );
    const res = await callLocalagentWbase350BuyinvList(
      data,
      Number(reportType) || 1,
      0.125,
      0.0,
      0.0,
      0,
      0
    );

    if (res.success) {
      setStatusMessage(
        `🎉 報表預覽已成功開啟 (wbaseRP.dll -> wbase350_buyinv_list，表格: ${reportTypeName}，回傳碼: ${res.retCode ?? 0
        })`
      );
    } else {
      setStatusMessage(`⚠️ 報表呼叫失敗: ${res.error || 'LocalAgent 服務未啟動'}`);
      alert(
        `[F7.列印失敗]\nLocalAgent 報表預覽呼叫未成功：\n${res.error || '請確認本機 LocalAgent (http://localhost:18889) 服務已啟動'
        }`
      );
    }
  }, [QueryData, reportType]);

  // 6. F8. 匯出 Action
  const handleExport = useCallback(async () => {
    const data = await QueryData();
    if (data.length === 0) {
      alert('⚠️ 查無符合條件之資料可供匯出！');
      return;
    }

    if (exportXlsxConfig) {
      setIsXlsxModalOpen(true);
    } else {
      const defaultConfigured = parseXlsxConfigParams(
        defaultXlsxFields,
        xlsxConfig.vFieldList,
        xlsxConfig.vCaptionList,
        xlsxConfig.vDisplayFormat,
        xlsxConfig.vColorList
      );
      executeExportExcel(data, defaultConfigured);
    }
  }, [QueryData, exportXlsxConfig, defaultXlsxFields, xlsxConfig]);

  // 執行 Excel 檔案匯出並提示
  const executeExportExcel = async (data: InvoicePurchaseItem[], fields: XlsxFieldItem[]) => {
    const selected = fields.filter((f) => f.selected);
    if (selected.length === 0) {
      alert('⚠️ 請至少選擇一個匯出欄位！');
      return;
    }
    setStatusMessage('正在匯出資料至 EXCEL (.xlsx)...');
    const fileName = `購買統一發票清單_${year}${startMonth}-${endMonth}.xlsx`;
    const success = await exportToXlsx(data, selected, fileName);
    if (success) {
      setStatusMessage('🎉 EXCEL 檔案已成功匯出並提至畫面前景！');
      alert(`[F8.匯出成功]\nEXCEL 檔案 (${fileName}) 已順利匯出並移至前台開啟！`);
    } else {
      setStatusMessage('❌ EXCEL 匯出失敗，請檢查權限或瀏覽器設定。');
    }
  };

  const handleConfirmXlsxFields = (
    updatedFields: XlsxFieldItem[],
    savedConfig?: XlsxSerializedConfig
  ) => {
    if (savedConfig) {
      setXlsxConfig(savedConfig);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
      } catch (e) {
        console.warn('Failed to save xlsx export config to localStorage:', e);
      }
    }
    setIsXlsxModalOpen(false);
    executeExportExcel(queriedData, updatedFields);
  };

  const handleLeave = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  // F2 開窗搜尋購買地點
  const handleOpenF2Modal = () => {
    setIsF2ModalOpen(true);
  };

  const handleSelectPlaceItem = (item: SearchItem) => {
    setPlaceCond(item.code);
    setPlaceName(item.name || '購買地點名稱');
    setIsF2ModalOpen(false);
    focusAndSelect(sortOrderInputRef);
  };

  // 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isXlsxModalOpen || isF2ModalOpen || isSetAmtModalOpen || isPreviewModalOpen) return;

      if (e.key === 'F4') {
        e.preventDefault();
        handlePreviewData();
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleOpenSetAmt();
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
  }, [
    isXlsxModalOpen,
    isF2ModalOpen,
    isSetAmtModalOpen,
    isPreviewModalOpen,
    mode,
    handlePreviewData,
    handleOpenSetAmt,
    handlePrint,
    handleExport,
    handleLeave,
  ]);

  const formattedPeriodTag = `${year}${startMonth.padStart(2, '0')}-${endMonth.padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden">
      {/* Outer Window Dialog matching modern design */}
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors duration-300 max-h-[92vh] ${isDark
            ? 'bg-slate-900 text-white border-slate-800'
            : 'bg-slate-50 text-slate-800 border-slate-200'
          }`}
      >
        {/* Header Bar with Gradient */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between transition-colors ${isDark
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
                  購買統一發票清單列印
                </h2>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  Enter/F7 列印
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">
                FormWBase350_buyinv_Print
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button (淺色 / 深色) */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition backdrop-blur-xs cursor-pointer"
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
              className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body Cards Container */}
        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
          {/* Card 1: 列印期別 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs ${isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
              }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>列印發票期別</span>
              </div>
              <span
                className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
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
                  className={`w-20 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${isDark
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
                  className={`w-16 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${isDark
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
                  className={`w-16 px-2.5 py-1.5 border-2 rounded-xl text-center font-black text-base transition focus:outline-none ${isDark
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
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs space-y-2.5 ${isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>
                  分區模式條件 (代碼 1~2)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
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
                  className={`w-12 py-1 border-2 rounded-xl text-center font-black text-sm transition focus:outline-none ${isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                    }`}
                />
              </div>
            </div>

            {/* Option Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
              {/* Option 1: 依地址縣市 */}
              <div
                onClick={() => {
                  setMode('1');
                  setTimeout(() => focusAndSelect(cityCondRef), 50);
                }}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${mode === '1'
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
                    className={`w-full px-2.5 py-1 border-2 rounded-lg font-bold text-xs sm:text-sm transition focus:outline-none ${mode === '1'
                        ? 'bg-white text-slate-900 border-amber-400 focus:ring-2 focus:ring-amber-300'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-700'
                      }`}
                  />
                </div>
                <p
                  className={`text-[11px] mt-1 font-semibold ${mode === '1' ? (isDark ? 'text-indigo-200' : 'text-blue-100') : 'text-red-500'
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
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${mode === '2'
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
                    className={`w-24 px-2.5 py-1 border-2 rounded-lg font-bold text-xs sm:text-sm transition focus:outline-none ${mode === '2'
                        ? 'bg-white text-slate-900 border-amber-400 focus:ring-2 focus:ring-amber-300'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-700'
                      }`}
                  />
                  <span
                    className={`text-xs font-bold truncate ${mode === '2' ? (isDark ? 'text-indigo-100' : 'text-white') : 'text-slate-500'
                      }`}
                  >
                    {placeName}
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1 font-semibold ${mode === '2' ? (isDark ? 'text-indigo-200' : 'text-blue-100') : 'text-slate-400'
                    }`}
                >
                  (按 F2 鍵可開窗選擇地點)
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: 排序方式與列印表格設定 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs space-y-3 ${isDark
                ? 'bg-slate-800/80 border-slate-700/80'
                : 'bg-white border-slate-200/90 shadow-slate-100'
              }`}
          >
            {/* Section 3.1: 排序方式 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                  <span className={isDark ? 'text-white' : 'text-slate-800'}>
                    排序方式 (代碼 1~2)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
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
                        focusAndSelect(reportTypeInputRef);
                      }
                    }}
                    className={`w-12 py-1 border-2 rounded-xl text-center font-black text-sm transition focus:outline-none ${isDark
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
                    focusAndSelect(reportTypeInputRef);
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${sortOrder === '1'
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
                    focusAndSelect(reportTypeInputRef);
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${sortOrder === '2'
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
            </div>

            {/* Section 3.2: 列印表格樣式 */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                  <span className={isDark ? 'text-white' : 'text-slate-800'}>
                    列印表格樣式 (代碼 1~2)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                      }`}
                  >
                    [1/2 切換]
                  </span>
                  <input
                    ref={reportTypeInputRef}
                    type="text"
                    maxLength={1}
                    value={reportType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '1' || val === '2') {
                        setReportType(val as '1' | '2');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === '1' || e.key === '2') {
                        setReportType(e.key as '1' | '2');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        focusAndSelect(exportConfigRef);
                      }
                    }}
                    className={`w-12 py-1 border-2 rounded-xl text-center font-black text-sm transition focus:outline-none ${isDark
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                      }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                <div
                  onClick={() => {
                    setReportType('1');
                    focusAndSelect(exportConfigRef);
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${reportType === '1'
                      ? isDark
                        ? 'bg-indigo-950/70 border-indigo-500 text-white font-black'
                        : 'bg-indigo-600 text-white border-indigo-600 font-black shadow-sm'
                      : isDark
                        ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                >
                  <span className="font-extrabold text-xs sm:text-sm">1. A4發票清單</span>
                  {reportType === '1' && <Check className="w-4 h-4 stroke-[3]" />}
                </div>

                <div
                  onClick={() => {
                    setReportType('2');
                    focusAndSelect(exportConfigRef);
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${reportType === '2'
                      ? isDark
                        ? 'bg-indigo-950/70 border-indigo-500 text-white font-black'
                        : 'bg-indigo-600 text-white border-indigo-600 font-black shadow-sm'
                      : isDark
                        ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                >
                  <span className="font-extrabold text-xs sm:text-sm">2. 中一刀發票領取簽收單</span>
                  {reportType === '2' && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Checkbox Card for XLSX Export */}
            <div
              onClick={() => setExportXlsxConfig(!exportXlsxConfig)}
              className={`p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer flex items-center space-x-3 transition-all ${exportXlsxConfig
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
              className={`p-2.5 rounded-xl text-xs font-bold text-center border shadow-xs ${isDark
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
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 border-t transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/90'
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
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm cursor-pointer"
            >
              <Eye className="w-4 h-4 text-white" />
              <span>F4. 預覽資料</span>
            </button>
          </div>

          {/* Right Side: Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 font-bold text-xs sm:text-sm flex-wrap gap-y-1.5">
            {/* F6. 金額設定 */}
            <button
              ref={btnSetAmtRef}
              onClick={handleOpenSetAmt}
              className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition active:scale-95 focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer"
            >
              <DollarSign className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>F6. 金額設定</span>
            </button>

            {/* F7. 列印 */}
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
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>F7. 列印</span>
            </button>

            {/* F8. 匯出 */}
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
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>F8. 匯出</span>
            </button>

            {/* Esc. 離開 */}
            <button
              ref={btnLeaveRef}
              onClick={handleLeave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLeave();
                }
              }}
              className={`flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl border-2 transition active:scale-95 shadow-xs focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer ${isDark
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

      {/* Submodal 1: F6. 統購發票種類金額設定 */}
      <Wbase3050_buyinv_setamt
        isOpen={isSetAmtModalOpen}
        onClose={() => {
          setIsSetAmtModalOpen(false);
          focusAndSelect(btnSetAmtRef);
        }}
      />

      {/* Submodal 2: F8 匯出 XLSX 欄位選擇 Modal */}
      <FormUtilSelectXlsxFieldsList
        isOpen={isXlsxModalOpen}
        fields={defaultXlsxFields}
        defaultFields={defaultXlsxFields}
        vFieldList={xlsxConfig.vFieldList}
        vCaptionList={xlsxConfig.vCaptionList}
        vDisplayFormat={xlsxConfig.vDisplayFormat}
        vColorList={xlsxConfig.vColorList}
        onConfirm={handleConfirmXlsxFields}
        onClose={() => setIsXlsxModalOpen(false)}
      />

      {/* Submodal 3: F2 購買地點搜尋 Modal */}
      <SearchModal
        isOpen={isF2ModalOpen}
        title="購買地點開窗搜尋 [F2]"
        onSearch={async (query: string) => {
          const list = await fetchTicketPlaces(query);
          return list.map((item) => ({
            code: item.placeCode,
            name: item.placeName,
            spec: item.placeAddress || item.contactPerson,
          }));
        }}
        onSelect={handleSelectPlaceItem}
        onClose={() => {
          setIsF2ModalOpen(false);
          focusAndSelect(placeCondRef);
        }}
      />

      {/* Debug Data Preview Modal (包含所有欄位與常駐底部捲軸) */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 font-mono select-none">
          <div
            className={`w-full max-w-[96vw] xl:max-w-7xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${isDark
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-800 border-slate-300'
              }`}
          >
            {/* Modal Header */}
            <div
              className={`px-5 py-3 flex items-center justify-between border-b flex-shrink-0 ${isDark
                  ? 'bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border-slate-800'
                  : 'bg-gradient-to-r from-sky-700 to-indigo-700 text-white shadow-md'
                }`}
            >
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-lg tracking-wide text-white">
                  F4. 報表資料全欄位預覽 (共 {queriedData.length} 筆紀錄)
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Table Body with Native Bottom Scrollbar */}
            <div
              className={`flex-1 min-h-0 overflow-auto p-2 border-b ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50/50'
                }`}
              style={{
                scrollbarWidth: 'auto',
                scrollbarColor: isDark ? '#3b82f6 #0f172a' : '#6366f1 #e2e8f0',
              }}
            >
              {queriedData.length === 0 ? (
                <div className="py-24 text-center text-slate-500 font-bold text-base">
                  ⚠️ 依目前設定條件查詢無相符之發票購買資料！
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-[2800px]">
                  <thead>
                    <tr
                      className={`border-b sticky top-0 z-20 shadow-xs ${isDark
                          ? 'bg-[#1e3a8a] text-amber-300 border-slate-700'
                          : 'bg-indigo-900 text-amber-300 border-indigo-950'
                        }`}
                    >
                      <th className="p-2.5 font-bold border-r text-center sticky left-0 z-30 bg-[#1e3a8a] shadow-xs w-12">
                        #
                      </th>
                      <th className="p-2.5 font-bold border-r text-center bg-indigo-950/60 w-24">
                        製表日期
                      </th>
                      <th className="p-2.5 font-bold border-r text-center bg-indigo-950/60 w-20">
                        資料年度
                      </th>
                      <th className="p-2.5 font-bold border-r text-center bg-indigo-950/60 w-20">
                        資料起月
                      </th>
                      <th className="p-2.5 font-bold border-r text-center bg-indigo-950/60 w-20">
                        資料迄月
                      </th>
                      <th className="p-2.5 font-bold border-r w-24">期別</th>
                      <th className="p-2.5 font-bold border-r text-center w-20">購買次數</th>
                      <th className="p-2.5 font-bold border-r w-28">公司編號</th>
                      <th className="p-2.5 font-bold border-r w-28 text-emerald-300">公司統編</th>
                      <th className="p-2.5 font-bold border-r w-48">公司名稱</th>
                      <th className="p-2.5 font-bold border-r w-36">公司簡稱</th>
                      <th className="p-2.5 font-bold border-r w-32">稅籍編號</th>
                      <th className="p-2.5 font-bold border-r w-28">公司電話</th>
                      <th className="p-2.5 font-bold border-r w-28">公司傳真</th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-900/60 text-blue-200 w-20">
                        手開二聯
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-950/60 text-amber-300 w-24">
                        手開二聯金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-900/60 text-blue-200 w-20">
                        手開二聯副
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-950/60 text-amber-300 w-24">
                        手開二副金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-900/60 text-blue-200 w-20">
                        手開三聯
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-950/60 text-amber-300 w-24">
                        手開三聯金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-900/60 text-blue-200 w-20">
                        手開三聯副
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-blue-950/60 text-amber-300 w-24">
                        手開三副金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-purple-900/60 text-purple-200 w-16">
                        特種
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-purple-950/60 text-amber-300 w-24">
                        特種金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-900/60 text-emerald-200 w-20">
                        收銀二聯
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-950/60 text-amber-300 w-24">
                        收銀二聯金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-900/60 text-emerald-200 w-20">
                        收銀三聯
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-950/60 text-amber-300 w-24">
                        收銀三聯金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-900/60 text-emerald-200 w-20">
                        收銀三聯副
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-emerald-950/60 text-amber-300 w-24">
                        收銀三副金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-amber-900/60 text-amber-200 w-20">
                        公司本數
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-amber-900/60 text-amber-200 w-24">
                        總金額
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-amber-900/60 text-amber-200 w-20">
                        總家數
                      </th>
                      <th className="p-2.5 font-bold border-r text-right bg-amber-900/60 text-amber-200 w-20">
                        總本數
                      </th>
                      <th className="p-2.5 font-bold border-r w-28">購票地點編號</th>
                      <th className="p-2.5 font-bold border-r w-24">縣市別</th>
                      <th className="p-2.5 font-bold border-r w-64">公司地址</th>
                      <th className="p-2.5 font-bold border-r w-28">登打人員編號</th>
                      <th className="p-2.5 font-bold w-48">GUID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                    {queriedData.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-amber-400/20 transition ${idx % 2 === 0
                            ? isDark
                              ? 'bg-slate-900/80'
                              : 'bg-white'
                            : isDark
                              ? 'bg-slate-800/60'
                              : 'bg-slate-50'
                          }`}
                      >
                        <td
                          className={`p-2 text-center border-r font-bold sticky left-0 z-10 ${idx % 2 === 0
                              ? isDark
                                ? 'bg-slate-900'
                                : 'bg-white'
                              : isDark
                                ? 'bg-slate-800'
                                : 'bg-slate-50'
                            } text-slate-400`}
                        >
                          {idx + 1}
                        </td>
                        <td className="p-2 text-center border-r font-bold text-sky-300">
                          {item.製表日期 || '-'}
                        </td>
                        <td className="p-2 text-center border-r font-bold text-amber-400">
                          {item.dataYear || year}
                        </td>
                        <td className="p-2 text-center border-r">
                          {item.dataStartMonth || startMonth}
                        </td>
                        <td className="p-2 text-center border-r">
                          {item.dataEndMonth || endMonth}
                        </td>
                        <td className="p-2 border-r font-bold">{item.period || '-'}</td>
                        <td className="p-2 text-center border-r">{item.times || '1'}</td>
                        <td className="p-2 font-bold text-sky-400 border-r">
                          {item.companyCode || '-'}
                        </td>
                        <td className="p-2 font-bold text-emerald-400 border-r">
                          {item.unifiedNo || '-'}
                        </td>
                        <td
                          className="p-2 font-bold border-r max-w-xs truncate"
                          title={item.companyName || item.companyShortName}
                        >
                          {item.companyName || item.companyShortName || '-'}
                        </td>
                        <td className="p-2 border-r">{item.companyShortName || '-'}</td>
                        <td className="p-2 border-r">{item.taxNo || '-'}</td>
                        <td className="p-2 border-r">{item.companyTel || '-'}</td>
                        <td className="p-2 border-r">{item.companyFax || '-'}</td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.manualTwoDup) > 0 ? 'text-amber-400' : 'text-slate-500'
                            }`}
                        >
                          {item.manualTwoDup || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-amber-300">
                          {item.手開二聯金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.manualTwoDupSub) > 0 ? 'text-amber-400' : 'text-slate-500'
                            }`}
                        >
                          {item.manualTwoDupSub || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-amber-300">
                          {item.手開二聯副金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.manualThreeDup) > 0 ? 'text-amber-400' : 'text-slate-500'
                            }`}
                        >
                          {item.manualThreeDup || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-amber-300">
                          {item.手開三聯金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.manualThreeDupSub) > 0
                              ? 'text-amber-400'
                              : 'text-slate-500'
                            }`}
                        >
                          {item.manualThreeDupSub || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-amber-300">
                          {item.手開三聯副金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.manualSpecial) > 0 ? 'text-purple-400' : 'text-slate-500'
                            }`}
                        >
                          {item.manualSpecial || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-purple-300">
                          {item.特種金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.cashTwoDup) > 0 ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                        >
                          {item.cashTwoDup || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-emerald-300">
                          {item.收銀二聯金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.cashThreeDup) > 0 ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                        >
                          {item.cashThreeDup || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-emerald-300">
                          {item.收銀三聯金額?.toLocaleString() || 0}
                        </td>
                        <td
                          className={`p-2 text-right border-r font-bold ${Number(item.cashThreeDupSub) > 0
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                            }`}
                        >
                          {item.cashThreeDupSub || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-emerald-300">
                          {item.收銀三聯副金額?.toLocaleString() || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-yellow-400">
                          {item.公司本數 || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-amber-400">
                          {item.總金額?.toLocaleString() || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-sky-300">
                          {item.總家數 || 0}
                        </td>
                        <td className="p-2 text-right border-r font-bold text-sky-300">
                          {item.總本數 || 0}
                        </td>
                        <td className="p-2 border-r">{item.placeCode || '-'}</td>
                        <td className="p-2 border-r">{item.city || '-'}</td>
                        <td className="p-2 border-r max-w-sm truncate" title={item.companyAddr}>
                          {item.companyAddr || '-'}
                        </td>
                        <td className="p-2 border-r">{item.empCode || '-'}</td>
                        <td
                          className="p-2 font-mono text-slate-500 text-[10px] max-w-[140px] truncate"
                          title={item.guid}
                        >
                          {item.guid || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className={`px-5 py-2.5 flex items-center justify-between border-t flex-shrink-0 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
            >
              <div className="text-xs text-slate-400 font-bold flex items-center space-x-3 flex-wrap">
                <span>
                  查詢條件: {year}年{startMonth}-{endMonth}月
                </span>
                <span>|</span>
                <span>
                  模式:{' '}
                  {mode === '1'
                    ? '依地址縣市(' + cityCond + ')'
                    : '依購買地點(' + placeCond + ')'}
                </span>
                <span>|</span>
                <span>排序: {sortOrder === '1' ? '統一編號' : '稅籍編號'}</span>
                <span>|</span>
                <span>
                  表格: {reportType === '1' ? 'A4發票清單' : '中一刀發票領取簽收單'}
                </span>
                <span>|</span>
                <span className="text-amber-400">
                  💡 提示: 下方水平捲軸可向右滑動檢視全部 24 個欄位
                </span>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition shadow-sm active:scale-95 cursor-pointer"
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

