import React, { useState } from 'react';
import { useWbase1060 } from './useWbase1060';
import { Printer, X, FileText } from 'lucide-react';
import type { FeeItemPrintFilter } from '../../services/wbase1060';
import { useTheme } from '../menu/ThemeContext';

export const Wbase1060Print: React.FC = () => {
  const { isDark } = useTheme();
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, triggerReport, loading } =
    useWbase1060();

  const [filter, setFilter] = useState<FeeItemPrintFilter>({
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
                基本收費項目清冊列印 [F7/F8]
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-500'}`}>
                選擇列印範圍區間並進行預覽
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
              起始項目代號：
            </label>
            <input
              type="text"
              value={filter.codeStart}
              onChange={(e) => setFilter({ ...filter, codeStart: e.target.value })}
              placeholder="例如: 01 (留空代表從頭)"
              className={`w-full px-3 py-1.5 rounded text-sm focus:outline-none border ${
                isDark
                  ? 'bg-slate-950 border-blue-500 text-white focus:border-yellow-400'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-yellow-400' : 'text-blue-900'}`}>
              結束項目代號：
            </label>
            <input
              type="text"
              value={filter.codeEnd}
              onChange={(e) => setFilter({ ...filter, codeEnd: e.target.value })}
              placeholder="例如: 99 (留空代表至尾)"
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
              ⚠️ 該區間內查無收費項目資料
            </div>
          ) : (
            <div className="bg-white text-black p-6 rounded shadow max-w-3xl mx-auto print:max-w-none print:shadow-none">
              <div className="text-center mb-6 pb-2 border-b-2 border-black">
                <h1 className="text-2xl font-black tracking-widest">基本收費項目清冊總表</h1>
                <p className="text-xs text-gray-600 mt-1">
                  列印日期: {new Date().toLocaleDateString('zh-TW')}
                </p>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="p-2 font-bold w-1/4">項目代號</th>
                    <th className="p-2 font-bold w-1/2">項目名稱</th>
                    <th className="p-2 font-bold text-right w-1/4">收費金額</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((row) => (
                    <tr key={row.feeCode} className="border-b border-gray-300">
                      <td className="p-2 font-bold">{row.feeCode}</td>
                      <td className="p-2 font-semibold">{row.feeName}</td>
                      <td className="p-2 text-right font-mono">
                        NT$ {Number(row.price || 0).toLocaleString('zh-TW', { minimumFractionDigits: 2 })}
                      </td>
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
              className={`flex items-center space-x-1 px-4 py-1.5 font-bold rounded text-sm border transition disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-slate-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>網頁直接列印</span>
            </button>
            <button
              onClick={handlePrintTrigger}
              disabled={loading}
              className="flex items-center space-x-1 px-6 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded text-sm shadow transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{loading ? '傳送中...' : '呼叫 DLL 報表 (waccrep3106_b)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
