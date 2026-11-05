import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, FileSpreadsheet, Hash, Layers, Moon, Printer, Sun, X } from 'lucide-react';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from '../../components/SelectXlsxField';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import {
  apiErrorMessage,
  callWbase1010Report,
  exportCstoreXlsx,
  fetchCstorePrintList,
  rocToday,
  type CstoreItem,
} from '../../services/wbase1010';

interface Wbase1010CstorePrintProps {
  /** 目前格線上的事務所資料：預設起訖統號與 F2 選單的來源 */
  rows: CstoreItem[];
  onClose: () => void;
}

const STORAGE_KEY = 'wbase1010_xlsx_export_config';

// VFP wbase1010f41.requeryother 的 Excel 欄位 (xary / xary2)；英文名稱為額外可選欄位
const DEFAULT_V_FIELD_LIST = '統號,事務所名稱,電話,傳真,負責人,聯絡人,地址,電子信箱';

const XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '統號', customTitle: '統號', selected: true },
  { key: 'name', label: '事務所名稱', customTitle: '事務所名稱', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'fax', label: '傳真', customTitle: '傳真', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'linkman', label: '聯絡人', customTitle: '聯絡人', selected: true },
  { key: 'addr', label: '地址', customTitle: '地址', selected: true },
  { key: 'email', label: '電子信箱', customTitle: '電子信箱', selected: true },
  { key: 'engname', label: '英文名稱', customTitle: '英文名稱', selected: false },
];

const loadXlsxConfig = (): XlsxSerializedConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.vFieldList) return parsed;
    }
  } catch (e) {
    console.error('Failed to load saved xlsx config from localStorage:', e);
  }
  return { vFieldList: DEFAULT_V_FIELD_LIST, vCaptionList: DEFAULT_V_FIELD_LIST, vDisplayFormat: '', vColorList: '' };
};

/**
 * 事務所資料列印 (VFP wbase1010f41「事務所資料列印」，報表 REPORTS\base111.frx)
 * 起始統編 / 結束統編 (F2 事務所選單) → F7 經 LocalAgent 呼叫 wbaseRP.dll 的 wbase1010_cstore_list，F8 匯出 Excel，F4 預覽資料
 */
export const Wbase1010_cstore_print: React.FC<Wbase1010CstorePrintProps> = ({ rows, onClose }) => {
  const { isDark, toggleTheme } = useTheme();

  const [xlsxConfig, setXlsxConfig] = useState<XlsxSerializedConfig>(loadXlsxConfig);

  // VFP Init：GO TOP 帶起始統編、GO BOTTOM 帶結束統編 (cstore 依 tag no 排序)
  const [noStart, setNoStart] = useState(() => rows[0]?.no ?? '');
  const [noEnd, setNoEnd] = useState(() => rows[rows.length - 1]?.no ?? '');
  const [exportXlsxConfig, setExportXlsxConfig] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isXlsxModalOpen, setIsXlsxModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [queriedData, setQueriedData] = useState<CstoreItem[]>([]);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const noStartRef = useRef<HTMLInputElement>(null);
  const noEndRef = useRef<HTMLInputElement>(null);
  const exportConfigRef = useRef<HTMLInputElement>(null);
  const btnPrintRef = useRef<HTMLButtonElement>(null);

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | HTMLButtonElement | null>) => {
    setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (el instanceof HTMLInputElement && el.type === 'text') el.select();
    }, 50);
  };

  useEffect(() => {
    focusAndSelect(noStartRef);
  }, []);

  /** VFP mbno.Valid / meno.Valid：查無此統號時提示，不阻擋 */
  const warnIfMissing = (value: string) => {
    const code = value.trim();
    if (code && !rows.some((r) => r.no.trim() === code)) setStatusMessage(`⚠️ 無此編號!! (${code})`);
    else setStatusMessage('');
  };

  // VFP requery：SELECT * FROM cstore WHERE no >= 起始 AND no <= 結束 ORDER BY no
  const QueryData = useCallback(async (): Promise<CstoreItem[] | null> => {
    setIsLoading(true);
    setStatusMessage('正在讀取事務所資料檔 (cstore.dbf)...');
    try {
      const data = await fetchCstorePrintList({ noStart, noEnd });
      setQueriedData(data);
      setStatusMessage(`資料查詢完成，共 ${data.length} 筆紀錄。`);
      return data;
    } catch (err) {
      setStatusMessage(`❌ ${apiErrorMessage(err, '讀取列印資料失敗')}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [noStart, noEnd]);

  // F4. 預覽資料
  const handlePreviewData = useCallback(async () => {
    if (await QueryData()) setIsPreviewModalOpen(true);
  }, [QueryData]);

  // F7. 列印
  const handlePrint = useCallback(async () => {
    const data = await QueryData();
    if (!data) return;
    if (data.length === 0) {
      setStatusMessage('⚠️ 無資料可列印!!');
      return;
    }
    setStatusMessage('正在透過 LocalAgent 產生 JSON 暫存檔並呼叫 wbase1010_cstore_list 報表...');
    const res = await callWbase1010Report(data);
    if (res.success) {
      setStatusMessage(`🎉 報表預覽已開啟 (wbaseRP.dll -> wbase1010_cstore_list，回傳碼: ${res.retCode ?? 0})`);
    } else {
      setStatusMessage(`⚠️ 報表呼叫失敗: ${res.error || 'LocalAgent 服務未啟動'}`);
    }
  }, [QueryData]);

  const executeExportExcel = useCallback(async (data: CstoreItem[], fields: XlsxFieldItem[]) => {
    const selected = fields.filter((f) => f.selected);
    if (selected.length === 0) {
      setStatusMessage('⚠️ 請至少選擇一個匯出欄位！');
      return;
    }
    setStatusMessage('正在匯出資料至 EXCEL (.xlsx)...');
    const ok = await exportCstoreXlsx(data, selected, `事務所資料表_${rocToday().replace(/\//g, '')}.xlsx`);
    setStatusMessage(ok ? '🎉 EXCEL 檔案已匯出。' : '❌ EXCEL 匯出失敗，請檢查權限或瀏覽器設定。');
  }, []);

  // F8. 匯出
  const handleExport = useCallback(async () => {
    const data = await QueryData();
    if (!data) return;
    if (data.length === 0) {
      setStatusMessage('⚠️ 查無符合條件之資料可供匯出！');
      return;
    }
    if (exportXlsxConfig) {
      setIsXlsxModalOpen(true);
      return;
    }
    const configured = parseXlsxConfigParams(
      XLSX_FIELDS,
      xlsxConfig.vFieldList,
      xlsxConfig.vCaptionList,
      xlsxConfig.vDisplayFormat,
      xlsxConfig.vColorList
    );
    await executeExportExcel(data, configured);
  }, [QueryData, exportXlsxConfig, xlsxConfig, executeExportExcel]);

  const handleConfirmXlsxFields = (updatedFields: XlsxFieldItem[], savedConfig?: XlsxSerializedConfig) => {
    if (savedConfig) {
      setXlsxConfig(savedConfig);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
      } catch (e) {
        console.error('Failed to save xlsx export config to localStorage:', e);
      }
    }
    setIsXlsxModalOpen(false);
    void executeExportExcel(queriedData, updatedFields);
  };

  const handleSelectPickerItem = (item: SearchItem) => {
    if (picker === 'start') {
      setNoStart(item.code);
      focusAndSelect(noEndRef);
    } else if (picker === 'end') {
      setNoEnd(item.code);
      focusAndSelect(exportConfigRef);
    }
    setPicker(null);
  };

  const closePicker = () => {
    const target = picker === 'end' ? noEndRef : noStartRef;
    setPicker(null);
    focusAndSelect(target);
  };

  // VFP mbno.RightClick：事務所選單 (統編、事務所名稱)，從輸入值往後定位
  const searchOffices = useCallback(
    async (q: string): Promise<SearchItem[]> => {
      const kw = q.trim().toLowerCase();
      return rows
        .filter((r) => r.no.trim())
        .filter((r) => !kw || r.no.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw))
        .map((r) => ({ code: r.no, name: r.name }));
    },
    [rows]
  );

  // 全域快速鍵 (子視窗開啟時交給子視窗處理)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isXlsxModalOpen || picker) return;
      if (isPreviewModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPreviewModalOpen(false);
        }
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        void handlePreviewData();
      } else if (e.key === 'F7') {
        e.preventDefault();
        void handlePrint();
      } else if (e.key === 'F8') {
        e.preventDefault();
        void handleExport();
      } else if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isXlsxModalOpen, isPreviewModalOpen, picker, handlePreviewData, handlePrint, handleExport, onClose]);

  const inputClass = `w-40 px-3 py-1.5 border-2 rounded-xl font-black text-base font-mono transition focus:outline-none ${
    isDark
      ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-yellow-50 focus:ring-2 focus:ring-indigo-200'
  }`;

  const cardClass = `rounded-2xl p-3.5 sm:p-4 transition-colors border shadow-xs ${
    isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90 shadow-slate-100'
  }`;

  const hintClass = `text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-lg ${
    isDark ? 'bg-indigo-950/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
  }`;

  const renderNoInput = (
    which: 'start' | 'end',
    label: string,
    ref: React.RefObject<HTMLInputElement | null>,
    value: string,
    onChange: (v: string) => void,
    next: React.RefObject<HTMLInputElement | HTMLButtonElement | null>
  ) => (
    <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
      <span className={`w-24 text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      <input
        ref={ref}
        type="text"
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            setPicker(which);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            warnIfMissing(value);
            focusAndSelect(next);
          }
        }}
        className={inputClass}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setPicker(which)}
        className="px-2 py-1 text-[11px] font-black rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs"
        title="按 F2 開啟事務所選單"
      >
        F2
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden">
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors duration-300 max-h-[92vh] ${
          isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-200'
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
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">事務所資料列印</h2>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  Enter/F7 列印
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80 font-mono mt-0.5">wbase1010f41 (base111)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              tabIndex={-1}
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
            <button
              type="button"
              tabIndex={-1}
              onClick={onClose}
              className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body Cards Container */}
        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
          {/* Card 1: 統號區間 */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
                <Hash className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>列印統號區間</span>
              </div>
              <span className={hintClass}>[Enter] 下一欄　[F2] 事務所選單</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {renderNoInput('start', '起始統編 :', noStartRef, noStart, setNoStart, noEndRef)}
              {renderNoInput('end', '結束統編 :', noEndRef, noEnd, setNoEnd, exportConfigRef)}
              <p className="text-[11px] font-semibold text-slate-400">
                (空白代表不設限；結束統編比對前段，例如輸入 1234 時 12345678 也會列印)
              </p>
            </div>
          </div>

          {/* Card 2: 匯出設定 */}
          <div className={`${cardClass} space-y-2.5`}>
            <div className="flex items-center space-x-2 font-bold text-sm sm:text-base">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
              <span className={isDark ? 'text-white' : 'text-slate-800'}>匯出設定</span>
            </div>
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
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setExportXlsxConfig(e.target.checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusAndSelect(btnPrintRef);
                  }
                }}
                className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                isDark ? 'bg-indigo-950/80 border-indigo-800 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
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
          <button
            type="button"
            onClick={() => void handlePreviewData()}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handlePreviewData();
              }
            }}
            className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 text-xs sm:text-sm"
          >
            <Eye className="w-4 h-4 text-white" />
            <span>F4. 預覽資料</span>
          </button>

          <div className="flex items-center space-x-2.5 font-bold text-xs sm:text-sm">
            <button
              ref={btnPrintRef}
              type="button"
              onClick={() => void handlePrint()}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handlePrint();
                }
              }}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>F7. 列印</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleExport();
                }
              }}
              className="flex items-center space-x-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>F8. 匯出</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onClose();
                }
              }}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl border-2 transition active:scale-95 shadow-xs focus:outline-none focus:ring-4 focus:ring-amber-400 ${
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

      {/* Excel 匯出欄位選擇 (FormUtilSelectXlsxFieldsList) */}
      <FormUtilSelectXlsxFieldsList
        isOpen={isXlsxModalOpen}
        fields={XLSX_FIELDS}
        defaultFields={XLSX_FIELDS}
        vFieldList={xlsxConfig.vFieldList}
        vCaptionList={xlsxConfig.vCaptionList}
        vDisplayFormat={xlsxConfig.vDisplayFormat}
        vColorList={xlsxConfig.vColorList}
        onConfirm={handleConfirmXlsxFields}
        onClose={() => setIsXlsxModalOpen(false)}
      />

      {/* F2 事務所選單 (VFP selectlist「事務所選單」) */}
      <SearchModal
        isOpen={picker !== null}
        title="事務所選單"
        onSearch={searchOffices}
        onSelect={handleSelectPickerItem}
        onClose={closePicker}
      />

      {/* F4 預覽資料 */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 font-mono select-none">
          <div
            className={`w-full max-w-[96vw] xl:max-w-7xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
              isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-300'
            }`}
          >
            <div
              className={`px-5 py-3 flex items-center justify-between border-b flex-shrink-0 ${
                isDark
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
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`flex-1 min-h-0 overflow-auto p-2 border-b ${
                isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              {queriedData.length === 0 ? (
                <div className="py-24 text-center text-slate-500 font-bold text-base">⚠️ 無資料可列印!!</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap min-w-[1500px]">
                  <thead>
                    <tr
                      className={`border-b sticky top-0 z-20 shadow-xs ${
                        isDark ? 'bg-[#1e3a8a] text-amber-300 border-slate-700' : 'bg-indigo-900 text-amber-300 border-indigo-950'
                      }`}
                    >
                      <th className="p-2.5 font-bold border-r text-center w-12">#</th>
                      <th className="p-2.5 font-bold border-r w-24">統號</th>
                      <th className="p-2.5 font-bold border-r w-64">事務所名稱</th>
                      <th className="p-2.5 font-bold border-r w-28">電話</th>
                      <th className="p-2.5 font-bold border-r w-28">傳真</th>
                      <th className="p-2.5 font-bold border-r w-24">負責人</th>
                      <th className="p-2.5 font-bold border-r w-24">聯絡人</th>
                      <th className="p-2.5 font-bold border-r w-72">地址</th>
                      <th className="p-2.5 font-bold border-r w-56">電子信箱</th>
                      <th className="p-2.5 font-bold border-r w-64">英文名稱</th>
                      <th className="p-2.5 font-bold border-r text-right w-16">序號</th>
                      <th className="p-2.5 font-bold text-right w-16">RECNO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                    {queriedData.map((item, idx) => (
                      <tr
                        key={`${item.recordNumber}_${idx}`}
                        className={`hover:bg-amber-400/20 transition ${
                          idx % 2 === 0 ? (isDark ? 'bg-slate-900/80' : 'bg-white') : isDark ? 'bg-slate-800/60' : 'bg-slate-50'
                        }`}
                      >
                        <td className="p-2 text-center border-r font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 border-r font-bold text-sky-400">{item.no}</td>
                        <td className="p-2 border-r font-bold">{item.name}</td>
                        <td className="p-2 border-r">{item.tel}</td>
                        <td className="p-2 border-r">{item.fax}</td>
                        <td className="p-2 border-r">{item.hname}</td>
                        <td className="p-2 border-r">{item.linkman}</td>
                        <td className="p-2 border-r">{item.addr}</td>
                        <td className="p-2 border-r">{item.email}</td>
                        <td className="p-2 border-r">{item.engname}</td>
                        <td className="p-2 border-r text-right">{item.serial}</td>
                        <td className="p-2 text-right text-slate-500">{item.recordNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div
              className={`px-5 py-2.5 flex items-center justify-between border-t flex-shrink-0 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className="text-xs text-slate-400 font-bold">
                查詢條件: 統號 {noStart || '(不限)'} ~ {noEnd || '(不限)'}
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition shadow-sm active:scale-95"
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
