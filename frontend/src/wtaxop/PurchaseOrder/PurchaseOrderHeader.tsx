import React, { useState } from 'react';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { SearchModal } from '../../components/FoxProGrid/SearchModal';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import { searchVendors } from '../../services/api';
import { Calendar, Building, FileText, Search } from 'lucide-react';

export const PurchaseOrderHeader: React.FC = () => {
  const {
    billNo,
    vendorCode,
    vendorName,
    purchaseDate,
    setBillNo,
    setVendor,
    setPurchaseDate,
  } = usePurchaseStore();

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorAlert, setVendorAlert] = useState<string | null>(null);

  const handleVendorCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'F2') {
      e.preventDefault();
      setVendorModalOpen(true);
    }
  };

  const handleVendorCodeBlur = async () => {
    if (!vendorCode.trim()) {
      setVendor('', '');
      return;
    }

    const results = await searchVendors(vendorCode);
    const match = results.find(
      (v) => v.code.toLowerCase() === vendorCode.trim().toLowerCase()
    );

    if (match) {
      setVendor(match.code, match.name);
    } else {
      setVendor('', '');
      setVendorAlert(`⚠️ 廠商代號 [${vendorCode}] 不存在，請按 F2 開窗搜尋！`);
    }
  };

  const handleVendorSelect = (item: SearchItem) => {
    setVendor(item.code, item.name);
    setVendorModalOpen(false);
  };

  return (
    <div className="bg-white border-2 border-blue-900 rounded-lg p-4 mb-3 shadow-md font-mono">
      <div className="flex items-center justify-between border-b-2 border-blue-900 pb-2 mb-3">
        <div className="flex items-center space-x-2 text-blue-950 font-bold text-xl">
          <FileText className="h-6 w-6 text-blue-800" />
          <h2>進貨單作業 (Purchase Order Entry)</h2>
        </div>
        <div className="text-xs bg-blue-100 text-blue-900 font-bold px-3 py-1 rounded border border-blue-300">
          系統代號: wtaxop/PurchaseOrder
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm font-bold">
        <div>
          <label className="block text-gray-700 mb-1 flex items-center">
            <FileText className="w-4 h-4 mr-1 text-blue-800" /> 進貨單號
          </label>
          <input
            type="text"
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            className="w-full border-2 border-gray-400 rounded px-3 py-1.5 bg-gray-100 font-bold text-blue-900 focus:border-yellow-500 focus:bg-yellow-50"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1 flex items-center justify-between">
            <span className="flex items-center">
              <Building className="w-4 h-4 mr-1 text-blue-800" /> 廠商代號 (按 F2 開窗)
            </span>
          </label>
          <div className="relative flex">
            <input
              type="text"
              value={vendorCode}
              onChange={(e) => setVendor(e.target.value, vendorName)}
              onKeyDown={handleVendorCodeKeyDown}
              onBlur={handleVendorCodeBlur}
              placeholder="F2 開窗搜尋"
              className="w-full border-2 border-blue-800 rounded-l px-3 py-1.5 bg-yellow-50 font-bold text-blue-900 focus:border-yellow-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVendorModalOpen(true)}
              className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-r border-2 border-l-0 border-blue-900 flex items-center space-x-1"
            >
              <Search className="w-4 h-4 text-yellow-400" />
              <span>F2</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 mb-1">廠商名稱 (自動帶出)</label>
          <input
            type="text"
            readOnly
            value={vendorName}
            className="w-full border-2 border-gray-300 rounded px-3 py-1.5 bg-gray-200 font-bold text-gray-800"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1 flex items-center">
            <Calendar className="w-4 h-4 mr-1 text-blue-800" /> 進貨日期
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full border-2 border-gray-400 rounded px-3 py-1.5 bg-white font-bold text-blue-900 focus:border-yellow-500"
          />
        </div>
      </div>

      <SearchModal
        isOpen={vendorModalOpen}
        title="廠商主檔搜尋"
        onSearch={searchVendors}
        onSelect={handleVendorSelect}
        onClose={() => setVendorModalOpen(false)}
      />

      {vendorAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-red-900 border-4 border-yellow-400 text-white p-6 rounded-lg shadow-2xl max-w-lg text-center font-mono">
            <h4 className="text-xl font-bold text-yellow-300 mb-3">廠商代號無效</h4>
            <p className="text-lg font-semibold mb-6">{vendorAlert}</p>
            <button
              onClick={() => setVendorAlert(null)}
              className="bg-yellow-400 text-black px-6 py-2 rounded font-bold text-lg hover:bg-yellow-300 transition"
            >
              確定 (Enter / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
