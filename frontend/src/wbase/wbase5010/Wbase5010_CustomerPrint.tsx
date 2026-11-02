import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  fetchCustomers,
  queryCustomerPrintData,
  exportReportToXlsx,
  type CustomerPrintItem,
  type LabelCustomerItem,
} from './services/wbase5010';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';

interface Wbase5010CustomerPrintProps {
  onClose?: () => void;
}

const DEFAULT_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '客戶代號', selected: true },
  { key: 'abbr', label: '客戶簡稱', customTitle: '簡稱', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶全稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'linkman', label: '聯絡人', customTitle: '聯絡人', selected: true },
  { key: 'tel', label: '公司電話', customTitle: '電話', selected: true },
  { key: 'mobile', label: '行動電話', customTitle: '手機', selected: true },
  { key: 'fax', label: '傳真號碼', customTitle: '傳真', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '公司地址', selected: true },
  { key: 'invaddr', label: '聯絡地址', customTitle: '聯絡地址', selected: true },
  { key: 'email', label: '電子郵件', customTitle: 'E-mail', selected: true },
  { key: 'keyin', label: '登打人員代號', customTitle: '登打人員', selected: true },
  { key: 'keyinna', label: '登打人員姓名', customTitle: '人員姓名', selected: true },
  { key: 'organame', label: '組織型態', customTitle: '組織類別', selected: true },
  { key: 'pno', label: '行業代號', customTitle: '行業代號', selected: true },
  { key: 'capital', label: '資本額', customTitle: '資本額', selected: true },
];

export const Wbase5010_CustomerPrint: React.FC<Wbase5010CustomerPrintProps> = ({ onClose }) => {
  const { isDark } = useTheme();

  // 查詢參數狀態
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [reportType, setReportType] = useState<1 | 2>(1); // 1: 基本資料, 2: 詳細資料
  const [addrType, setAddrType] = useState<1 | 2 | 3>(1); // 1: 公司地址, 2: 聯絡地址, 3: 公司.聯絡地址
  const [orderType, setOrderType] = useState<1 | 2 | 3>(1); // 1: 客戶編號, 2: 統一編號, 3: 稅籍編號
  const [groupType, setGroupType] = useState<1 | 2>(1); // 1: 依客戶編號排序, 2: 依登打人員排序

  // 客戶列表與勾選
  const [customerRows, setCustomerRows] = useState<LabelCustomerItem[]>([]);
  const [, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // F2 查詢開窗
  const [searchTarget, setSearchTarget] = useState<'start' | 'end' | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // F7 列印預覽 Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState<CustomerPrintItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  // 載入客戶資料
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMsg('載入客戶資料中...');
      const list = await fetchCustomers();
      // 預設全選
      const mapped = list.map(c => ({ ...c, selected: true }));
      setCustomerRows(mapped);
      setStatusMsg(`已載入 ${mapped.length} 筆客戶資料`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`載入失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // 全選 / 全不選
  const handleSelectAll = useCallback(() => {
    setCustomerRows(prev => prev.map(r => ({ ...r, selected: true })));
    setStatusMsg('已全部勾選');
  }, []);

  const handleDeselectAll = useCallback(() => {
    setCustomerRows(prev => prev.map(r => ({ ...r, selected: false })));
    setStatusMsg('已全部取消勾選');
  }, []);

  // F2 開窗處理
  const handleOpenSearch = (target: 'start' | 'end') => {
    setSearchTarget(target);
    setIsSearchOpen(true);
  };

  const handleSelectCustomer = (item: SearchItem) => {
    if (searchTarget === 'start') {
      setStartNo(item.code);
    } else if (searchTarget === 'end') {
      setEndNo(item.code);
    }
    setIsSearchOpen(false);
    setSearchTarget(null);
  };

  const searchOptions: SearchItem[] = customerRows.map(c => ({
    code: c.no,
    name: c.name,
    abbr: c.abbr,
  }));

  // F7 執行查詢並開啟列印對話盒
  const handleExecutePrintQuery = useCallback(async () => {
    try {
      setIsPrintLoading(true);
      setIsPrintModalOpen(true);

      const selectedNos = customerRows.filter(c => c.selected).map(c => c.no);

      const data = await queryCustomerPrintData({
        startNo: startNo.trim() || undefined,
        endNo: endNo.trim() || undefined,
        reportType,
        addrType,
        groupType,
        orderType,
        selectedNos: selectedNos.length > 0 && selectedNos.length < customerRows.length ? selectedNos : undefined,
      });

      setPrintData(data);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`查詢列印資料失敗: ${err.message}`);
    } finally {
      setIsPrintLoading(false);
    }
  }, [customerRows, startNo, endNo, reportType, addrType, groupType, orderType]);

  // 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrintModalOpen || isSearchOpen) return;

      if (e.key === 'F7') {
        e.preventDefault();
        handleExecutePrintQuery();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleDeselectAll();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen, isSearchOpen, handleExecutePrintQuery, handleSelectAll, handleDeselectAll, onClose]);

  // FoxProGridV2 欄位定義
  const columns: ColumnDefV2<LabelCustomerItem>[] = [
    {
      key: 'selected',
      label: '選取',
      width: '60px',
      align: 'center',
      renderCell: (val, row, rIdx) => (
        <button
          type="button"
          onClick={() => {
            const next = [...customerRows];
            next[rIdx] = { ...row, selected: !row.selected };
            setCustomerRows(next);
          }}
          className="flex items-center justify-center w-full h-full text-blue-600 hover:text-blue-800"
        >
          {val ? <CheckSquare className="w-5 h-5 text-yellow-500 fill-current" /> : <Square className="w-5 h-5 text-gray-400" />}
        </button>
      ),
    },
    {
      key: 'no',
      label: '客戶代號',
      width: '100px',
      editable: false,
      align: 'center',
    },
    {
      key: 'abbr',
      label: '客戶簡稱',
      width: '120px',
      editable: false,
    },
    {
      key: 'name',
      label: '客戶全稱',
      width: '240px',
      editable: false,
    },
    {
      key: 'unino',
      label: '統一編號',
      width: '110px',
      editable: false,
      align: 'center',
    },
    {
      key: 'hname',
      label: '負責人',
      width: '100px',
      editable: false,
    },
    {
      key: 'tel',
      label: '公司電話',
      width: '140px',
      editable: false,
    },
    {
      key: 'addr',
      label: '公司地址',
      width: '320px',
      editable: false,
    },
  ];

  // 列印預覽欄位
  const printColumns: FoxProPrintColumn<CustomerPrintItem>[] = [
    { key: 'no', label: '代號', width: '70px', align: 'center' },
    { key: 'abbr', label: '簡稱', width: '90px' },
    { key: 'name', label: '客戶名稱', width: '180px' },
    { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
    { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
    { key: 'hname', label: '負責人', width: '80px' },
    { key: 'tel', label: '公司電話', width: '110px' },
    {
      key: 'addr',
      label: addrType === 2 ? '聯絡地址' : addrType === 3 ? '公司/聯絡地址' : '公司地址',
      width: '260px',
      render: (_, r) => {
        if (addrType === 2) return r.invaddr || r.addr;
        if (addrType === 3) return `${r.addr} / ${r.invaddr}`.trim();
        return r.addr;
      },
    },
    { key: 'keyinna', label: '登打人員', width: '90px' },
  ];

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-900'}`}>
      {/* 頂部條件面板 */}
      <div className={`p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-6">
          {/* 客戶編號起訖 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-500">客戶起訖:</span>
            <div className="relative">
              <input
                type="text"
                value={startNo}
                onChange={e => setStartNo(e.target.value.toUpperCase())}
                placeholder="起始客戶 (F2)"
                className={`w-28 px-2 py-1 text-sm border rounded font-mono uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => handleOpenSearch('start')}
                className="absolute right-1 top-1.5 text-gray-400 hover:text-blue-500"
                title="F2 查詢"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-gray-400">~</span>
            <div className="relative">
              <input
                type="text"
                value={endNo}
                onChange={e => setEndNo(e.target.value.toUpperCase())}
                placeholder="終止客戶 (F2)"
                className={`w-28 px-2 py-1 text-sm border rounded font-mono uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => handleOpenSearch('end')}
                className="absolute right-1 top-1.5 text-gray-400 hover:text-blue-500"
                title="F2 查詢"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 報表種類 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">種類:</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                name="reportType"
                checked={reportType === 1}
                onChange={() => setReportType(1)}
                className="text-blue-600"
              />
              基本資料
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer ml-2">
              <input
                type="radio"
                name="reportType"
                checked={reportType === 2}
                onChange={() => setReportType(2)}
                className="text-blue-600"
              />
              詳細資料
            </label>
          </div>

          {/* 列印地址 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">地址:</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                name="addrType"
                checked={addrType === 1}
                onChange={() => setAddrType(1)}
                className="text-blue-600"
              />
              公司地址
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer ml-2">
              <input
                type="radio"
                name="addrType"
                checked={addrType === 2}
                onChange={() => setAddrType(2)}
                className="text-blue-600"
              />
              聯絡地址
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer ml-2">
              <input
                type="radio"
                name="addrType"
                checked={addrType === 3}
                onChange={() => setAddrType(3)}
                className="text-blue-600"
              />
              公司.聯絡
            </label>
          </div>

          {/* 排列順序 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">排序:</span>
            <select
              value={orderType}
              onChange={e => setOrderType(Number(e.target.value) as 1 | 2 | 3)}
              className={`px-2 py-1 text-sm border rounded focus:outline-none ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              <option value={1}>1. 依客戶編號</option>
              <option value={2}>2. 依統一編號</option>
              <option value={3}>3. 依稅籍編號</option>
            </select>
          </div>

          {/* 分組方式 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">分組:</span>
            <select
              value={groupType}
              onChange={e => setGroupType(Number(e.target.value) as 1 | 2)}
              className={`px-2 py-1 text-sm border rounded focus:outline-none ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              <option value={1}>1. 客戶編號排序</option>
              <option value={2}>2. 依登打人員分組</option>
            </select>
          </div>

          {/* 操作按鈕組 */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F3 全選"
            >
              F3 全選
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F4 全不選"
            >
              F4 全不選
            </button>
            <button
              type="button"
              onClick={handleExecutePrintQuery}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-all focus:ring-2 focus:ring-yellow-400"
              title="F7 列印預覽"
            >
              <Printer className="w-4 h-4" />
              F7 列印預覽
            </button>
          </div>
        </div>
      </div>

      {/* 主體客戶表格 (FoxProGridV2) */}
      <div className="flex-1 overflow-hidden p-2">
        <FoxProGridV2
          rows={customerRows}
          columns={columns}
          createEmptyRow={() => ({
            no: '',
            abbr: '',
            name: '',
            unino: '',
            hname: '',
            linkman: '',
            tel: '',
            addr: '',
            invaddr: '',
            prn: 1,
            selected: true,
          })}
          onRowsChange={newRows => setCustomerRows(newRows)}
          onOpenPrint={handleExecutePrintQuery}
          gridId="wbase5010_cust_grid"
        />
      </div>

      {/* 底部狀態列 */}
      <div className={`px-4 py-1.5 text-xs flex justify-between items-center border-t ${
        isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-200 border-slate-300 text-gray-600'
      }`}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            [F2] 查詢客戶 | [F3] 全選 | [F4] 全不選 | [Space] 勾選/取消 | [F7] 列印預覽 | [Esc] 離開
          </span>
          <span>{statusMsg}</span>
        </div>
        <div>
          勾選: <span className="font-bold text-yellow-600">{customerRows.filter(c => c.selected).length}</span> / {customerRows.length} 筆
        </div>
      </div>

      {/* F2 Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchTarget(null);
        }}
        title="客戶基本資料選單"
        onSearch={async (query: string) => {
          const kw = query.trim().toLowerCase();
          if (!kw) return searchOptions;
          return searchOptions.filter(
            item => item.code.toLowerCase().includes(kw) || item.name.toLowerCase().includes(kw)
          );
        }}
        onSelect={handleSelectCustomer}
      />

      {/* F7 列印與匯出對話盒 */}
      <FoxProPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="5-1 客戶資料列印預覽"
        reportTitle={`客戶管理資料表 (${reportType === 1 ? '基本資料' : '詳細資料'})`}
        reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  排序: 依${orderType === 1 ? '客戶編號' : orderType === 2 ? '統一編號' : '稅籍編號'}`}
        startCodeLabel="起始客戶"
        startCodeValue={startNo}
        onStartCodeChange={setStartNo}
        endCodeLabel="終止客戶"
        endCodeValue={endNo}
        onEndCodeChange={setEndNo}
        onSearch={handleExecutePrintQuery}
        data={printData}
        columns={printColumns}
        loading={isPrintLoading}
        hasSearched={true}
        enableXlsxExport={true}
        xlsxFields={DEFAULT_XLSX_FIELDS}
        xlsxFileName={`客戶資料清單_${reportType === 1 ? '基本' : '詳細'}`}
        onExportXlsx={async (data, selectedFields) => {
          return await exportReportToXlsx(data, selectedFields, `客戶資料清單_${reportType === 1 ? '基本' : '詳細'}`);
        }}
      />
    </div>
  );
};
