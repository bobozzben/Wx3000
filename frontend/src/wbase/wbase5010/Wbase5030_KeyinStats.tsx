import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Search,
} from 'lucide-react';
import {
  queryKeyinStats,
  exportReportToXlsx,
  type KeyinStatsItem,
} from './services/wbase5010';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';

interface Wbase5030KeyinStatsProps {
  onClose?: () => void;
}

const DEFAULT_KEYIN_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'keyin', label: '登打人員代號', customTitle: '人員代號', selected: true },
  { key: 'keyinna', label: '登打人員姓名', customTitle: '人員姓名', selected: true },
  { key: 'custNo', label: '客戶代號', customTitle: '客戶代號', selected: true },
  { key: 'custName', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'tel', label: '公司電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
];

export const Wbase5030_KeyinStats: React.FC<Wbase5030KeyinStatsProps> = ({ onClose }) => {
  const { isDark } = useTheme();

  // 查詢參數
  const [year, setYear] = useState('115');
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [startKeyin, setStartKeyin] = useState('');
  const [endKeyin, setEndKeyin] = useState('');

  // 資料狀態
  const [dataList, setDataList] = useState<KeyinStatsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // F7 列印 Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 查詢資料
  const handleQuery = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMsg('查詢客戶登打統計資料中...');
      const list = await queryKeyinStats({
        year,
        startNo: startNo.trim() || undefined,
        endNo: endNo.trim() || undefined,
        startKeyin: startKeyin.trim() || undefined,
        endKeyin: endKeyin.trim() || undefined,
      });
      setDataList(list);
      setStatusMsg(`已載入 ${list.length} 筆客戶登打資料`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`查詢失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [year, startNo, endNo, startKeyin, endKeyin]);

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
  const columns: ColumnDefV2<KeyinStatsItem>[] = [
    {
      key: 'keyin',
      label: '登打人員',
      width: '100px',
      editable: false,
      align: 'center',
    },
    {
      key: 'keyinna',
      label: '人員姓名',
      width: '110px',
      editable: false,
    },
    {
      key: 'custNo',
      label: '客戶代號',
      width: '100px',
      editable: false,
      align: 'center',
    },
    {
      key: 'custName',
      label: '客戶名稱',
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
  const printColumns: FoxProPrintColumn<KeyinStatsItem>[] = [
    { key: 'keyin', label: '人員代號', width: '80px', align: 'center' },
    { key: 'keyinna', label: '人員姓名', width: '90px' },
    { key: 'custNo', label: '客戶代號', width: '80px', align: 'center' },
    { key: 'custName', label: '客戶名稱', width: '180px' },
    { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
    { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
    { key: 'tel', label: '電話', width: '110px' },
    { key: 'addr', label: '地址', width: '260px' },
  ];

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-900'}`}>
      {/* 頂部搜尋條件面板 */}
      <div className={`p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-6">
          {/* 資料年度 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-500">資料年度:</span>
            <input
              type="text"
              value={year}
              onChange={e => setYear(e.target.value)}
              className={`w-20 px-2 py-1 text-sm border rounded text-center ${
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

          {/* 登打人員起訖 */}
          <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-700">
            <span className="text-sm font-bold text-blue-500">人員起訖:</span>
            <input
              type="text"
              value={startKeyin}
              onChange={e => setStartKeyin(e.target.value.toUpperCase())}
              placeholder="起始人員"
              className={`w-24 px-2 py-1 text-sm border rounded uppercase ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
            <span className="text-gray-400">~</span>
            <input
              type="text"
              value={endKeyin}
              onChange={e => setEndKeyin(e.target.value.toUpperCase())}
              placeholder="終止人員"
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
            custNo: '',
            custName: '',
            unino: '',
            taxno: '',
            keyin: '',
            keyinna: '',
            tel: '',
            addr: '',
            pno: '',
          })}
          onRowsChange={newRows => setDataList(newRows)}
          onOpenPrint={handleOpenPrintModal}
          gridId="wbase5030_keyin_grid"
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
          共 <strong className="text-yellow-600">{dataList.length}</strong> 筆登打紀錄
        </div>
      </div>

      {/* F7 列印與匯出對話盒 */}
      <FoxProPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="5-3 客戶登打統計表列印預覽"
        reportTitle={`客戶登打統計表 (年度: ${year})`}
        reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  人員: ${startKeyin || '全部'} ~ ${endKeyin || '全部'}`}
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
        xlsxFields={DEFAULT_KEYIN_XLSX_FIELDS}
        xlsxFileName={`客戶登打統計表_${year}年度`}
        onExportXlsx={async (data, selectedFields) => {
          return await exportReportToXlsx(data, selectedFields, `客戶登打統計表_${year}年度`);
        }}
      />
    </div>
  );
};
