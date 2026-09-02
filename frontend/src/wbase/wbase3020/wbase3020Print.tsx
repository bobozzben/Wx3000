import React, { useState } from 'react';
import { useWbase3020 } from './useWbase3020';
import { Printer, X } from 'lucide-react';
import type { PrintRangeQuery } from '../../services/wbase3020';
import { useTheme } from '../menu/ThemeContext';

export const Wbase3020Print: React.FC = () => {
  const { isDark } = useTheme();
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, period, times } =
    useWbase3020();

  const [filter, setFilter] = useState<PrintRangeQuery>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  if (!isPrintOpen) return null;

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchPrintDataList(filter);
    setHasSearched(true);
  };

  const handleWebPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono select-none">
      <div
        className={`border-4 rounded-lg p-6 max-w-5xl w-full shadow-2xl flex flex-col max-h-[90vh] transition-colors ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-4 border-b transition-colors ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-400 text-black rounded font-bold">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-yellow-300' : 'text-blue-900'}`}>
                統一發票預購份數清冊列印 [F7/F8]
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-500'}`}>
                期別：{period} | 次數：{times === '1' ? '1.首次' : '2.追加'}
              </p>
            </div>
          </div>
          <button
            onClick={closePrint}
            className="p-1 rounded hover:bg-slate-800 text-gray-300 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Area */}
        <form
          onSubmit={handleQuery}
          className={`py-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4 items-end transition-colors ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-yellow-400' : 'text-blue-900'}`}>
              起始公司編號：
            </label>
            <input
              type="text"
              value={filter.codeStart}
              onChange={(e) => setFilter({ ...filter, codeStart: e.target.value })}
              placeholder="例如: H-002 (留空代表從頭)"
              className={`w-full px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-yellow-400' : 'text-blue-900'}`}>
              結束公司編號：
            </label>
            <input
              type="text"
              value={filter.codeEnd}
              onChange={(e) => setFilter({ ...filter, codeEnd: e.target.value })}
              placeholder="例如: Z-999 (留空代表至尾)"
              className={`w-full px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-1 bg-blue-800 hover:bg-blue-700 text-white font-bold py-1.5 rounded border border-blue-600 text-sm transition"
            >
              搜尋清冊資料
            </button>
          </div>
        </form>

        {/* Print Preview Content */}
        <div className="flex-1 overflow-y-auto py-4 font-mono">
          {!hasSearched ? (
            <div className={`p-12 text-center font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              請輸入區間條件後按「搜尋清冊資料」進行列印預覽
            </div>
          ) : printData.length === 0 ? (
            <div className="p-12 text-center text-red-400 font-bold">
              ⚠️ 該區間內查無統一發票預購份數紀錄
            </div>
          ) : (
            <div className="bg-white text-black p-6 rounded shadow max-w-4xl mx-auto print:max-w-none print:shadow-none">
              <div className="text-center mb-6 pb-2 border-b-2 border-black">
                <h1 className="text-2xl font-black tracking-widest">統一發票預購份數清冊總表</h1>
                <p className="text-xs text-gray-600 mt-1">
                  期別：{period} | 次數：{times === '1' ? '本期首次購買' : '本期追加購買'} | 列印日期: {new Date().toLocaleDateString('zh-TW')}
                </p>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="p-2 font-bold">公司編號</th>
                    <th className="p-2 font-bold">公司簡稱</th>
                    <th className="p-2 font-bold">公司統編</th>
                    <th className="p-2 font-bold text-center" colSpan={5}>手開式發票 (二/二副/三/三副/特)</th>
                    <th className="p-2 font-bold text-center" colSpan={3}>收銀機專用 (二/三/三副)</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((row) => (
                    <tr key={row.companyCode} className="border-b border-gray-300">
                      <td className="p-2 font-bold">{row.companyCode}</td>
                      <td className="p-2 font-semibold">{row.companyShortName}</td>
                      <td className="p-2">{row.unifiedNo}</td>
                      <td className="p-2 text-center">{row.manualTwoDup}</td>
                      <td className="p-2 text-center">{row.manualTwoDupSub}</td>
                      <td className="p-2 text-center">{row.manualThreeDup}</td>
                      <td className="p-2 text-center">{row.manualThreeDupSub}</td>
                      <td className="p-2 text-center">{row.manualSpecial}</td>
                      <td className="p-2 text-center">{row.cashTwoDup}</td>
                      <td className="p-2 text-center">{row.cashThreeDup}</td>
                      <td className="p-2 text-center">{row.cashThreeDupSub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-2 border-t border-black flex justify-between text-xs text-gray-700">
                <span>總計筆數: {printData.length} 筆</span>
                <span>頁碼: 1 / 1</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`pt-4 border-t flex justify-between items-center transition-colors ${
            isDark ? 'border-slate-700 text-gray-400' : 'border-slate-200 text-gray-600'
          }`}
        >
          <span className="text-xs">[Esc] 關閉預覽</span>
          <div className="flex space-x-3">
            <button
              onClick={closePrint}
              className={`px-4 py-1.5 font-bold rounded text-sm transition ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'
              }`}
            >
              取消
            </button>
            <button
              onClick={handleWebPrint}
              disabled={printData.length === 0}
              className="flex items-center space-x-1 px-6 py-1.5 bg-blue-800 hover:bg-blue-700 text-white font-bold rounded text-sm shadow transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>網頁直接列印</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
