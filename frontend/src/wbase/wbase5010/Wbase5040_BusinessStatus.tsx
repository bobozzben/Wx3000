import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Search,
} from 'lucide-react';
import {
  queryBusinessStatus,
  exportReportToXlsx,
  type BusinessStatusItem,
} from './services/wbase5010';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';

interface Wbase5040BusinessStatusProps {
  onClose?: () => void;
}

const DEFAULT_BUSINESS_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
  { key: 'pno', label: '行業代號', customTitle: '行業代號', selected: true },
  { key: 'capital', label: '資本額', customTitle: '資本額', selected: true },
  { key: 'startMonth', label: '起始月', customTitle: '起月', selected: true },
  { key: 'endMonth', label: '結束月', customTitle: '迄月', selected: true },
];

export const Wbase5040_BusinessStatus: React.FC<Wbase5040BusinessStatusProps> = ({ onClose }) => {
  const { isDark } = useTheme();

  // 查詢參數
  const [year, setYear] = useState('115');
  const [startMonth, setStartMonth] = useState('01');
  const [endMonth, setEndMonth] = useState('12');
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');

  // 資料狀態
  const [dataList, setDataList] = useState<BusinessStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // F7 列印 Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 查詢資料
  const handleQuery = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMsg('查詢客戶營業狀況資料中...');
      const list = await queryBusinessStatus({
        year,
        startMonth,
        endMonth,
        startNo: startNo.trim() || undefined,
        endNo: endNo.trim() || undefined,
      });
      setDataList(list);
      setStatusMsg(`已載入 ${list.length} 筆客戶營業狀況資料`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`查詢失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [year, startMonth, endMonth, startNo, endNo]);

  useEffect(() => {
    handleQuery();
  }, []);

  // F7 開啟列印預覽
  const handleOpenPrintModal = () => {
    setIsPrintModalOpen(true);
  };

  // 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrintModalOpen) return;
      if (e.key === 'F7') {
        e.preventDefault();
        handleOpenPrintModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen, onClose]);

  // 表格欄位定義 (FoxProGridV2)
  const columns: ColumnDefV2<BusinessStatusItem>[] = [
    {
      key: 'no',
      label: '客戶代號',
      width: '100px',
      editable: false,
      align: 'center',
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
      key: 'taxno',
      label: '稅籍編號',
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
      width: '130px',
      editable: false,
    },
    {
      key: 'pno',
      label: '行業代號',
      width: '100px',
      editable: false,
      align: 'center',
    },
    {
      key: 'capital',
      label: '資本額',
      width: '120px',
      editable: false,
      align: 'right',
      renderCell: val => (val ? Number(val).toLocaleString() : '-'),
    },
    {
      key: 'addr',
      label: '公司地址',
      width: '320px',
      editable: false,
    },
  ];

  // 列印預覽欄位
  const printColumns: FoxProPrintColumn<BusinessStatusItem>[] = [
    { key: 'no', label: '代號', width: '80px', align: 'center' },
    { key: 'name', label: '客戶名稱', width: '180px' },
    { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
    { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
    { key: 'hname', label: '負責人', width: '80px' },
    { key: 'tel', label: '電話', width: '110px' },
    { key: 'pno', label: '行業代碼', width: '85px', align: 'center' },
    {
      key: 'capital',
      label: '資本額',
      width: '100px',
      align: 'right',
      render: val => (val ? Number(val).toLocaleString() : '-'),
    },
    { key: 'addr', label: '地址', width: '260px' },
  ];

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-900'}`}>
      {/* 頂部搜尋條件面板 */}
      <div className={`p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-6">
          {/* 資料年度 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-500">年度:</span>
            <input
              type="text"
              value={year}
              onChange={e => setYear(e.target.value)}
              className={`w-20 px-2 py-1 text-sm border rounded text-center ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {/* 營業月份起訖 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">月份:</span>
            <input
              type="text"
              maxLength={2}
              value={startMonth}
              onChange={e => setStartMonth(e.target.value)}
              className={`w-14 px-2 py-1 text-sm border rounded text-center ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
            <span className="text-gray-400">~</span>
            <input
              type="text"
              maxLength={2}
              value={endMonth}
              onChange={e => setEndMonth(e.target.value)}
              className={`w-14 px-2 py-1 text-sm border rounded text-center ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {/* 客戶編號起訖 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">客戶起訖:</span>
            <input
              type="text"
              value={startNo}
              onChange={e => setStartNo(e.target.value.toUpperCase())}
              placeholder="起始客戶"
              className={`w-24 px-2 py-1 text-sm border rounded uppercase ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
            <span className="text-gray-400">~</span>
            <input
              type="text"
              value={endNo}
              onChange={e => setEndNo(e.target.value.toUpperCase())}
              placeholder="終止客戶"
              className={`w-24 px-2 py-1 text-sm border rounded uppercase ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {/* 按鈕組 */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleQuery}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
            >
              <Search className="w-4 h-4" />
              重新查詢
            </button>
            <button
              type="button"
              onClick={handleOpenPrintModal}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-all focus:ring-2 focus:ring-yellow-400"
              title="F7 列印預覽"
            >
              <Printer className="w-4 h-4" />
              F7 列印預覽
            </button>
          </div>
        </div>
      </div>

      {/* 主體表格 (FoxProGridV2) */}
      <div className="flex-1 overflow-hidden p-2">
        <FoxProGridV2
          rows={dataList}
          columns={columns}
          createEmptyRow={() => ({
            no: '',
            name: '',
            unino: '',
            taxno: '',
            hname: '',
            tel: '',
            addr: '',
            pno: '',
            capital: null,
            startMonth: '01',
            endMonth: '12',
          })}
          onRowsChange={newRows => setDataList(newRows)}
          onOpenPrint={handleOpenPrintModal}
          gridId="wbase5040_business_grid"
        />
      </div>

      {/* 底部狀態列 */}
      <div className={`px-4 py-1.5 text-xs flex justify-between items-center border-t ${
        isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-200 border-slate-300 text-gray-600'
      }`}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            [Enter] 導覽 | [F7] 列印預覽 | [Esc] 離開
          </span>
          <span>{statusMsg}</span>
        </div>
        <div>
          共 <strong className="text-yellow-600">{dataList.length}</strong> 家客戶資料
        </div>
      </div>

      {/* F7 列印與匯出對話盒 */}
      <FoxProPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="5-4 客戶營業狀況統計表列印預覽"
        reportTitle={`客戶營業狀況統計表 (年度: ${year} 月份: ${startMonth} ~ ${endMonth})`}
        reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  客戶區間: ${startNo || '全部'} ~ ${endNo || '全部'}`}
        startCodeLabel="起始客戶"
        startCodeValue={startNo}
        onStartCodeChange={setStartNo}
        endCodeLabel="終止客戶"
        endCodeValue={endNo}
        onEndCodeChange={setEndNo}
        onSearch={handleQuery}
        data={dataList}
        columns={printColumns}
        loading={loading}
        hasSearched={true}
        enableXlsxExport={true}
        xlsxFields={DEFAULT_BUSINESS_XLSX_FIELDS}
        xlsxFileName={`客戶營業狀況統計表_${year}年_${startMonth}-${endMonth}月`}
        onExportXlsx={async (data, selectedFields) => {
          return await exportReportToXlsx(data, selectedFields, `客戶營業狀況統計表_${year}年_${startMonth}-${endMonth}月`);
        }}
      />
    </div>
  );
};
