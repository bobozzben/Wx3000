import React, { useState } from 'react';
import { useWbase1080 } from './useWbase1080';
import { Printer, X, FileText } from 'lucide-react';
import type { FeeSummaryPrintFilter } from '../../services/wbase1080';
import { useTheme } from '../menu/ThemeContext';

export const Wbase1080Print: React.FC = () => {
  const { isDark } = useTheme();
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, triggerReport, loading } =
    useWbase1080();

  const [filter, setFilter] = useState<FeeSummaryPrintFilter>({
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

  const handlePrintTrigger = async () => {
    const success = await triggerReport({
      dllPath: 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
      hs_chk: 0.125,
      top_mag: 0.0,
      left_mag: 0.0,
      PrtIndex: 0,
      IsPrint: 1,
      path: '',
    });
    if (success) {
      closePrint();
    }
  };

  const handleWebPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
      <div
        className={`border-4 rounded-lg p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] transition-colors ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-blue-900 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Printer className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold">基本收費摘要名冊列印 [wbase1080]</h3>
          </div>
          <button
            onClick={closePrint}
            className="p-1 rounded hover:bg-red-500 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Form */}
        <form onSubmit={handleQuery} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold mb-1">起始摘要代號：</label>
            <input
              type="text"
              value={filter.codeStart || ''}
              onChange={(e) => setFilter({ ...filter, codeStart: e.target.value })}
              placeholder="空白代表不限"
              className={`w-full px-3 py-1.5 rounded text-sm font-bold border focus:outline-none ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300 text-slate-800'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">結束摘要代號：</label>
            <input
              type="text"
              value={filter.codeEnd || ''}
              onChange={(e) => setFilter({ ...filter, codeEnd: e.target.value })}
              placeholder="空白代表不限"
              className={`w-full px-3 py-1.5 rounded text-sm font-bold border focus:outline-none ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300 text-slate-800'
              }`}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-1.5 bg-blue-800 hover:bg-blue-700 text-white font-bold rounded text-sm border border-blue-600 transition flex items-center justify-center space-x-1"
            >
              <FileText className="w-4 h-4" />
              <span>{loading ? '查詢中...' : '產生預覽清冊 (F8)'}</span>
            </button>
          </div>
        </form>

        {/* Preview Area */}
        <div
          className={`flex-1 overflow-y-auto border-2 rounded p-4 mb-4 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-gray-50 border-gray-300'
          }`}
        >
          {printData && printData.length > 0 ? (
            <div className="bg-white text-slate-900 p-6 rounded shadow max-w-3xl mx-auto text-sm selection:bg-yellow-200">
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-xl font-bold tracking-widest">基本收費摘要清冊名冊</h2>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>列印日期：{new Date().toLocaleDateString('zh-TW')}</span>
                  <span>總筆數：{printData.length} 筆</span>
                </div>
              </div>
              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100 border-b border-black">
                    <th className="border border-black p-2 text-left w-16">序次</th>
                    <th className="border border-black p-2 text-left w-24">摘要代號</th>
                    <th className="border border-black p-2 text-left w-36">摘要說明</th>
                    <th className="border border-black p-2 text-left">摘要內容</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((item, idx) => (
                    <tr key={item.summaryCode} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="border border-black p-2 text-center">{idx + 1}</td>
                      <td className="border border-black p-2 font-bold">{item.summaryCode}</td>
                      <td className="border border-black p-2">{item.summaryName}</td>
                      <td className="border border-black p-2 whitespace-pre-wrap">{item.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              {hasSearched ? '符合條件之清冊無任何收費摘要資料' : '請設定條件後點擊「產生預覽清冊」按鈕'}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center border-t pt-4">
          <div className="text-xs text-gray-400">
            按下 Esc 或點擊關閉按鈕可離開列印模式
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={closePrint}
              className={`px-4 py-1.5 rounded font-bold text-sm transition ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'
              }`}
            >
              關閉 (Esc)
            </button>
            <button
              type="button"
              onClick={handleWebPrint}
              disabled={!printData || printData.length === 0}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-sm shadow transition disabled:opacity-50"
            >
              網頁直接列印
            </button>
            <button
              type="button"
              onClick={handlePrintTrigger}
              disabled={!printData || printData.length === 0}
              className="px-5 py-1.5 bg-blue-800 hover:bg-blue-700 text-white font-bold rounded text-sm shadow transition border border-blue-600 disabled:opacity-50"
            >
              驅動 DLL 報表列印
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
