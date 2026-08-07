import React, { useState, useEffect } from 'react';
import { useWbase1020 } from './useWbase1020';
import { Printer, X, Download, Eye } from 'lucide-react';
import type { CpaItem } from '../../services/wbase1020';

export const Wbase1020Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintData } = useWbase1020();
  const [cpaCodeStart, setCpaCodeStart] = useState('');
  const [cpaCodeEnd, setCpaCodeEnd] = useState('');
  const [reportList, setReportList] = useState<CpaItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPrintOpen) {
      setCpaCodeStart('');
      setCpaCodeEnd('');
      setReportList(null);
    }
  }, [isPrintOpen]);

  if (!isPrintOpen) return null;

  const handleFetchReport = async () => {
    setLoading(true);
    const data = await fetchPrintData({
      cpaCodeStart: cpaCodeStart.trim().toUpperCase(),
      cpaCodeEnd: cpaCodeEnd.trim().toUpperCase(),
    });
    setReportList(data);
    setLoading(false);
  };

  const handleTriggerBrowserPrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportList || reportList.length === 0) return;
    const headers = ['會計師代號', '會計師姓名', '證照字號', '事務所名稱', '電話', '傳真', '通訊地址', '備註'];
    const rows = reportList.map((item) => [
      `"${item.cpaCode}"`,
      `"${item.cpaName}"`,
      `"${item.licenseNo || ''}"`,
      `"${item.officeName || ''}"`,
      `"${item.tel || ''}"`,
      `"${item.fax || ''}"`,
      `"${item.address || ''}"`,
      `"${item.memo || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `會計師清冊_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
      <div className="bg-slate-900 border-4 border-blue-600 rounded-lg shadow-2xl w-full max-w-4xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-blue-950 px-6 py-3 border-b-2 border-yellow-400 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold tracking-wide text-yellow-300">
              會計師清冊列印與設定 [F8]
            </h3>
          </div>
          <button
            onClick={closePrint}
            className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-blue-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-800 p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center space-x-3 text-sm">
            <span className="font-bold text-yellow-300">會計師代號區間：</span>
            <input
              type="text"
              placeholder="起始代號 (如: C001)"
              value={cpaCodeStart}
              onChange={(e) => setCpaCodeStart(e.target.value.toUpperCase())}
              className="bg-slate-900 border border-gray-600 px-3 py-1.5 rounded text-white font-mono w-40 focus:border-yellow-400 focus:outline-none"
            />
            <span className="text-gray-400">至</span>
            <input
              type="text"
              placeholder="結束代號 (如: C999)"
              value={cpaCodeEnd}
              onChange={(e) => setCpaCodeEnd(e.target.value.toUpperCase())}
              className="bg-slate-900 border border-gray-600 px-3 py-1.5 rounded text-white font-mono w-40 focus:border-yellow-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleFetchReport}
              disabled={loading}
              className="bg-blue-800 hover:bg-blue-700 border border-blue-500 text-yellow-300 px-4 py-1.5 rounded font-bold transition flex items-center space-x-1"
            >
              <Eye className="w-4 h-4" />
              <span>{loading ? '載入中...' : '產生預覽'}</span>
            </button>
          </div>

          {reportList && (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-emerald-800 hover:bg-emerald-700 border border-emerald-500 text-white px-3 py-1.5 rounded font-bold text-xs flex items-center space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>匯出 CSV</span>
              </button>
              <button
                type="button"
                onClick={handleTriggerBrowserPrint}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded font-bold text-xs flex items-center space-x-1 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>列印 / 存為 PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Printable Report Document Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-white text-black font-serif print:p-0 print:overflow-visible">
          {!reportList ? (
            <div className="text-center py-16 text-gray-500 font-mono">
              <Printer className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg">請點擊上方「產生預覽」以載入報表清冊資料。</p>
            </div>
          ) : reportList.length === 0 ? (
            <div className="text-center py-16 text-red-500 font-mono">
              <p className="text-lg font-bold">⚠️ 指定區間內查無會計師資料。</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Report Header */}
              <div className="text-center border-b-2 border-black pb-4 mb-4">
                <h1 className="text-2xl font-bold tracking-widest font-mono">Wx3000 會計進銷存管理系統</h1>
                <h2 className="text-xl font-bold tracking-wider mt-1 font-mono">基本會計師名冊清冊</h2>
                <div className="flex justify-between text-xs text-gray-600 mt-3 font-mono">
                  <span>列印日期：{new Date().toLocaleString('zh-TW')}</span>
                  <span>
                    代號篩選：{cpaCodeStart || '全部'} ~ {cpaCodeEnd || '全部'}
                  </span>
                  <span>總筆數：{reportList.length} 筆</span>
                </div>
              </div>

              {/* Report Table */}
              <table className="w-full text-xs border-collapse border border-black font-mono">
                <thead>
                  <tr className="bg-gray-200 border-b border-black">
                    <th className="border border-black p-2 text-left w-20">代號</th>
                    <th className="border border-black p-2 text-left w-28">會計師姓名</th>
                    <th className="border border-black p-2 text-left w-36">證照字號</th>
                    <th className="border border-black p-2 text-left w-44">事務所名稱</th>
                    <th className="border border-black p-2 text-left w-28">電話</th>
                    <th className="border border-black p-2 text-left">通訊地址</th>
                  </tr>
                </thead>
                <tbody>
                  {reportList.map((item, idx) => (
                    <tr key={item.cpaCode} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="border border-black p-2 font-bold">{item.cpaCode}</td>
                      <td className="border border-black p-2">{item.cpaName}</td>
                      <td className="border border-black p-2">{item.licenseNo || '-'}</td>
                      <td className="border border-black p-2">{item.officeName || '-'}</td>
                      <td className="border border-black p-2">{item.tel || '-'}</td>
                      <td className="border border-black p-2">{item.address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Report Footer */}
              <div className="mt-6 flex justify-between text-xs text-gray-600 border-t border-gray-400 pt-2 font-mono">
                <span>製表人員：系統管理者</span>
                <span>頁碼：1 / 1</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="bg-slate-950 px-6 py-3 border-t border-gray-800 flex justify-end print:hidden">
          <button
            type="button"
            onClick={closePrint}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold transition text-sm"
          >
            關閉 (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
