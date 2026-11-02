import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Printer,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Tag,
  X,
} from 'lucide-react';
import {
  fetchCustomers,
  generateLabels,
  exportReportToXlsx,
  type LabelCustomerItem,
} from './services/wbase5010';
import { FoxProGridV2, type ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { printElement } from '../../utils/printUtil';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';

interface Wbase5020LabelPrintProps {
  onClose?: () => void;
}

const DEFAULT_LABEL_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'abbr', label: '簡稱', customTitle: '簡稱', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'linkman', label: '聯絡人', customTitle: '聯絡人', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
  { key: 'prn', label: '列印份數', customTitle: '份數', selected: true },
];

export const Wbase5020_LabelPrint: React.FC<Wbase5020LabelPrintProps> = ({ onClose }) => {
  const { isDark } = useTheme();

  // 標籤參數狀態
  const [labelType, setLabelType] = useState<1 | 2>(2); // 1: 磁片標籤, 2: 郵遞標籤
  const [layoutType, setLayoutType] = useState<1 | 2>(1); // 1: 橫式, 2: 直式
  const [addrType, setAddrType] = useState<1 | 2>(1); // 1: 公司地址, 2: 聯絡地址
  const [recipientType, setRecipientType] = useState<1 | 2>(1); // 1: 負責人, 2: 聯絡人
  const [defaultCopies, setDefaultCopies] = useState<number>(1);
  const [isA4, setIsA4] = useState<boolean>(true);
  const [isKaohsiungFormat, setIsKaohsiungFormat] = useState<boolean>(false);

  // 客戶表格資料
  const [customerRows, setCustomerRows] = useState<LabelCustomerItem[]>([]);
  const [, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 標籤視覺預覽 Modal
  const [isLabelPreviewOpen, setIsLabelPreviewOpen] = useState(false);
  const [expandedLabels, setExpandedLabels] = useState<LabelCustomerItem[]>([]);
  const labelPrintContainerRef = useRef<HTMLDivElement>(null);

  // 區間選取彈窗
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeCopies, setRangeCopies] = useState(1);

  // 載入客戶資料
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMsg('載入客戶標籤資料中...');
      const list = await fetchCustomers();
      const mapped = list.map(c => ({
        ...c,
        prn: 0,
        selected: false,
      }));
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
    setCustomerRows(prev =>
      prev.map(r => ({
        ...r,
        selected: true,
        prn: defaultCopies > 0 ? defaultCopies : 1,
      }))
    );
    setStatusMsg(`已全部勾選 (每家 ${defaultCopies} 張)`);
  }, [defaultCopies]);

  const handleDeselectAll = useCallback(() => {
    setCustomerRows(prev =>
      prev.map(r => ({
        ...r,
        selected: false,
        prn: 0,
      }))
    );
    setStatusMsg('已全部取消選取');
  }, []);

  // 執行區間批次設定
  const handleApplyRange = () => {
    const s = rangeStart.trim().toUpperCase();
    const e = rangeEnd.trim().toUpperCase();
    const copies = rangeCopies > 0 ? rangeCopies : 1;

    setCustomerRows(prev =>
      prev.map(r => {
        const no = r.no.trim().toUpperCase();
        let inRange = true;
        if (s && no < s) inRange = false;
        if (e && no > e) inRange = false;

        if (inRange) {
          return { ...r, selected: true, prn: copies };
        }
        return r;
      })
    );
    setIsRangeModalOpen(false);
    setStatusMsg(`已套用區間 ${s || '起'} ~ ${e || '迄'}，份數: ${copies}`);
  };

  // 產生標籤資料並開啟標籤視覺預覽 (F7)
  const handleGenerateLabels = useCallback(async () => {
    const selectedItems = customerRows.filter(c => c.selected && c.prn > 0);
    if (selectedItems.length === 0) {
      alert('請先勾選至少一家客戶並設定列印張數！');
      return;
    }

    try {
      setStatusMsg('產生標籤資料中...');
      const data = await generateLabels({
        labelType,
        layoutType,
        addrType,
        recipientType,
        isA4,
        isKaohsiungFormat,
        items: selectedItems,
      });

      setExpandedLabels(data);
      setIsLabelPreviewOpen(true);
      setStatusMsg(`共產生 ${data.length} 張標籤`);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`產生標籤失敗: ${err.message}`);
    }
  }, [customerRows, labelType, layoutType, addrType, recipientType, isA4, isKaohsiungFormat]);

  // 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLabelPreviewOpen || isRangeModalOpen) return;

      if (e.key === 'F7') {
        e.preventDefault();
        handleGenerateLabels();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleDeselectAll();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsRangeModalOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLabelPreviewOpen, isRangeModalOpen, handleGenerateLabels, handleSelectAll, handleDeselectAll, onClose]);

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
            const nextSel = !row.selected;
            next[rIdx] = {
              ...row,
              selected: nextSel,
              prn: nextSel ? (row.prn > 0 ? row.prn : defaultCopies) : 0,
            };
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
      key: 'hname',
      label: '負責人',
      width: '100px',
      editable: false,
    },
    {
      key: 'linkman',
      label: '聯絡人',
      width: '100px',
      editable: false,
    },
    {
      key: 'prn',
      label: '列印張數',
      width: '90px',
      editable: true,
      digitOnly: true,
      align: 'right',
      validate: val => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0) return { valid: false, message: '張數必須 >= 0' };
        return { valid: true, message: '' };
      },
    },
    {
      key: 'addr',
      label: '公司地址',
      width: '320px',
      editable: false,
    },
  ];

  // 列印標籤紙張
  const handlePrintLabelsPaper = () => {
    if (labelPrintContainerRef.current) {
      printElement(labelPrintContainerRef.current, '郵寄標籤列印');
    }
  };

  // 匯出標籤清冊為 Excel
  const handleExportLabelsXlsx = async () => {
    return await exportReportToXlsx(
      customerRows.filter(c => c.selected && c.prn > 0),
      DEFAULT_LABEL_XLSX_FIELDS,
      '郵寄標籤列印名冊'
    );
  };

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-900'}`}>
      {/* 頂部標籤參數設定面板 */}
      <div className={`p-4 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'} shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-center">
          {/* 標籤種類 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-blue-500">標籤種類:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="labelType"
                  checked={labelType === 2}
                  onChange={() => setLabelType(2)}
                  className="text-blue-600"
                />
                郵遞標籤
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="labelType"
                  checked={labelType === 1}
                  onChange={() => setLabelType(1)}
                  className="text-blue-600"
                />
                磁片標籤
              </label>
            </div>
          </div>

          {/* 列印樣式 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-blue-500">列印樣式:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="layoutType"
                  checked={layoutType === 1}
                  onChange={() => setLayoutType(1)}
                  className="text-blue-600"
                />
                橫式 (2欄)
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="layoutType"
                  checked={layoutType === 2}
                  onChange={() => setLayoutType(2)}
                  className="text-blue-600"
                />
                直式 (3欄)
              </label>
            </div>
          </div>

          {/* 列印地址 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-blue-500">列印地址:</span>
            <div className="flex items-center gap-3">
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
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="addrType"
                  checked={addrType === 2}
                  onChange={() => setAddrType(2)}
                  className="text-blue-600"
                />
                聯絡地址
              </label>
            </div>
          </div>

          {/* 收件人 */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-blue-500">收件人:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 1}
                  onChange={() => setRecipientType(1)}
                  className="text-blue-600"
                />
                負責人
              </label>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === 2}
                  onChange={() => setRecipientType(2)}
                  className="text-blue-600"
                />
                聯絡人
              </label>
            </div>
          </div>

          {/* 預設份數 & 起始行數 */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-blue-500">預設份數:</span>
              <input
                type="number"
                min={1}
                max={99}
                value={defaultCopies}
                onChange={e => setDefaultCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={`w-16 px-2 py-1 text-sm border rounded ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-blue-500">紙張規格:</span>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isA4}
                    onChange={e => setIsA4(e.target.checked)}
                    className="text-blue-600"
                  />
                  A4
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isKaohsiungFormat}
                    onChange={e => setIsKaohsiungFormat(e.target.checked)}
                    className="text-blue-600"
                  />
                  大張(高雄)
                </label>
              </div>
            </div>
          </div>

          {/* 操作按鈕群 */}
          <div className="flex items-center justify-end gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setIsRangeModalOpen(true)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F8 區間選擇"
            >
              F8 區間
            </button>
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F3 全選"
            >
              F3 全選
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-800 dark:text-gray-200"
              title="F4 全不選"
            >
              F4 全不選
            </button>
            <button
              type="button"
              onClick={handleGenerateLabels}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-all focus:ring-2 focus:ring-yellow-400"
              title="F7 標籤列印預覽"
            >
              <Printer className="w-4 h-4" />
              F7 標籤列印
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
            prn: 0,
            selected: false,
          })}
          onRowsChange={newRows => setCustomerRows(newRows)}
          onOpenPrint={handleGenerateLabels}
          gridId="wbase5020_label_grid"
        />
      </div>

      {/* 底部狀態列 */}
      <div className={`px-4 py-1.5 text-xs flex justify-between items-center border-t ${
        isDark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-200 border-slate-300 text-gray-600'
      }`}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            [F8] 區間選取 | [F3] 全選 | [F4] 全不選 | [Space] 勾選/取消 | [Enter] 修改張數 | [F7] 標籤列印預覽 | [Esc] 離開
          </span>
          <span>{statusMsg}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>已選客戶: <strong className="text-yellow-600">{customerRows.filter(c => c.selected && c.prn > 0).length}</strong> 家</span>
          <span>總標籤數: <strong className="text-green-600">{customerRows.reduce((acc, c) => acc + (c.selected ? c.prn : 0), 0)}</strong> 張</span>
        </div>
      </div>

      {/* 區間設定彈窗 (F8) */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`w-96 p-5 rounded-lg border shadow-2xl ${
            isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
          }`}>
            <h3 className="text-base font-bold text-blue-500 mb-4 pb-2 border-b">
              區間設定客戶標籤份數
            </h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span>起始客戶代號:</span>
                <input
                  type="text"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value.toUpperCase())}
                  placeholder="空白代表第一筆"
                  className={`w-44 px-2 py-1 text-sm border rounded font-mono uppercase ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>終止客戶代號:</span>
                <input
                  type="text"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value.toUpperCase())}
                  placeholder="空白代表最後一筆"
                  className={`w-44 px-2 py-1 text-sm border rounded font-mono uppercase ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>列印標籤張數:</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={rangeCopies}
                  onChange={e => setRangeCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className={`w-44 px-2 py-1 text-sm border rounded ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setIsRangeModalOpen(false)}
                className="px-3 py-1 text-sm rounded bg-gray-500 hover:bg-gray-600 text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyRange}
                className="px-4 py-1 text-sm font-bold rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                套用勾選
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 標籤視覺預覽與列印彈窗 */}
      {isLabelPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className={`flex flex-col w-full max-w-5xl h-[90vh] rounded-lg border shadow-2xl overflow-hidden ${
            isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-3 border-b ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-gray-300'
            }`}>
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">
                  郵寄標籤排版預覽 (共 {expandedLabels.length} 張標籤，{layoutType === 1 ? '橫式 2 欄' : '直式 3 欄'})
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportLabelsXlsx}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  匯出 Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintLabelsPaper}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow focus:ring-2 focus:ring-yellow-400"
                >
                  <Printer className="w-4 h-4" />
                  紙張直接列印
                </button>
                <button
                  type="button"
                  onClick={() => setIsLabelPreviewOpen(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 標籤排版視覺展示區 */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-950">
              <div
                ref={labelPrintContainerRef}
                className={`max-w-4xl mx-auto p-8 bg-white text-black shadow-lg ${
                  layoutType === 1 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-3 gap-3'
                }`}
                style={{ fontFamily: 'Consolas, "Microsoft JhengHei", monospace' }}
              >
                {expandedLabels.map((lbl, idx) => {
                  const targetAddr = addrType === 2 ? lbl.invaddr || lbl.addr : lbl.addr;
                  const recipient = recipientType === 2 ? lbl.linkman || lbl.hname : lbl.hname;

                  return (
                    <div
                      key={idx}
                      className="border border-dashed border-gray-400 p-4 rounded bg-white flex flex-col justify-between h-44 text-xs leading-relaxed"
                    >
                      <div>
                        {/* 頂部：代號與郵遞標記 */}
                        <div className="flex justify-between items-center text-gray-500 text-[11px] mb-1">
                          <span className="font-mono font-bold text-blue-800">[{lbl.no}]</span>
                          <span>國內郵資已付</span>
                        </div>
                        {/* 地址 */}
                        <div className="text-sm font-bold text-gray-800 line-clamp-2 mt-1">
                          {targetAddr || '（無地址）'}
                        </div>
                      </div>

                      {/* 收件公司與收件人 */}
                      <div className="mt-2 border-t pt-2 border-gray-200">
                        <div className="font-bold text-sm text-gray-900 truncate">
                          {lbl.name}
                        </div>
                        <div className="flex items-center justify-between text-gray-700 mt-1">
                          <span className="text-sm font-semibold">{recipient ? `${recipient} 先生/女士 收` : '負責人 收'}</span>
                          <span className="text-[11px] text-gray-500 font-mono">{lbl.tel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
