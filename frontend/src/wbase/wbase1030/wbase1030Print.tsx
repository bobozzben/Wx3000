import React, { useState } from 'react';
import { useWbase1030 } from './useWbase1030';
import { Printer, X, FileText } from 'lucide-react';
import type { EmpPrintFilter } from '../../services/wbase1030';

export const Wbase1030Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintData, printData } = useWbase1030();

  const [filter, setFilter] = useState<EmpPrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  if (!isPrintOpen) return null;

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchPrintData(filter);
    setHasSearched(true);
  };

  const handlePrintTrigger = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
      <div className="bg-slate-900 border-4 border-blue-600 rounded-lg p-6 max-w-4xl w-full text-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-400 text-black rounded font-bold">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-yellow-300">人員資料清冊列印 [F7/F8]</h2>
              <p className="text-xs text-gray-300">選擇列印範圍區間並進行預覽</p>
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
        <form onSubmit={handleQuery} className="py-4 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs text-yellow-400 font-bold mb-1">起始人員編號：</label>
            <input
              type="text"
              value={filter.codeStart}
              onChange={(e) => setFilter({ ...filter, codeStart: e.target.value })}
              placeholder="例如: E001 (留空代表從頭)"
              className="w-full bg-slate-950 border border-blue-500 px-3 py-1.5 rounded text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-yellow-400 font-bold mb-1">結束人員編號：</label>
            <input
              type="text"
              value={filter.codeEnd}
              onChange={(e) => setFilter({ ...filter, codeEnd: e.target.value })}
              placeholder="例如: E999 (留空代表至尾)"
              className="w-full bg-slate-950 border border-blue-500 px-3 py-1.5 rounded text-sm text-white focus:outline-none focus:border-yellow-400"
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
            <div className="p-12 text-center text-gray-400 font-bold">
              請輸入區間條件後按「搜尋清冊資料」進行列印預覽
            </div>
          ) : printData.length === 0 ? (
            <div className="p-12 text-center text-red-400 font-bold">
              ⚠️ 該區間內查無人員資料
            </div>
          ) : (
            <div className="bg-white text-black p-6 rounded shadow max-w-3xl mx-auto print:max-w-none print:shadow-none">
              <div className="text-center mb-6 pb-2 border-b-2 border-black">
                <h1 className="text-2xl font-black tracking-widest">建檔人員清冊總表</h1>
                <p className="text-xs text-gray-600 mt-1">
                  列印日期: {new Date().toLocaleDateString('zh-TW')}
                </p>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="p-2 font-bold">編號</th>
                    <th className="p-2 font-bold">姓名</th>
                    <th className="p-2 font-bold">部門</th>
                    <th className="p-2 font-bold">電話</th>
                    <th className="p-2 font-bold">手機</th>
                    <th className="p-2 font-bold">地址</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((row) => (
                    <tr key={row.empCode} className="border-b border-gray-300">
                      <td className="p-2 font-bold">{row.empCode}</td>
                      <td className="p-2 font-semibold">{row.empName}</td>
                      <td className="p-2">{row.depName || '-'}</td>
                      <td className="p-2">{row.tel || '-'}</td>
                      <td className="p-2">{row.mobile || '-'}</td>
                      <td className="p-2">{row.address || '-'}</td>
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
        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
          <span className="text-xs text-gray-400">[Esc] 關閉預覽</span>
          <div className="flex space-x-3">
            <button
              onClick={closePrint}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded text-sm transition"
            >
              取消
            </button>
            <button
              onClick={handlePrintTrigger}
              disabled={printData.length === 0}
              className="flex items-center space-x-1 px-6 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded text-sm shadow transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>確認列印</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
