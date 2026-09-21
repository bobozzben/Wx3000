import React, { useState } from 'react';
import { usePurchaseStore } from '../../store/usePurchaseStore';
import { PurchaseOrderHeader } from './PurchaseOrderHeader';
import { FoxProGridBill } from '../../components/FoxProGridBill';
import { savePurchaseOrder } from '../../services/api';
import { Save, Search, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export const PurchaseOrderPage: React.FC = () => {
  const {
    billNo,
    vendorCode,
    vendorName,
    lines,
    setLines,
    resetForm,
  } = usePurchaseStore();

  const [saving, setSaving] = useState(false);
  const [modalStatus, setModalStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSave = async () => {
    // Filter non-empty valid lines
    const validLines = lines.filter((l) => l.productCode.trim() !== '' && l.qty > 0);

    if (!vendorCode.trim()) {
      setModalStatus({ type: 'error', message: '請輸入有效的廠商代號！' });
      return;
    }

    if (validLines.length === 0) {
      setModalStatus({ type: 'error', message: '請至少輸入一筆有效的產品明細（品號與數量不可為 0）！' });
      return;
    }

    const total = validLines.reduce((sum, l) => sum + (l.amount || 0), 0);

    setSaving(true);
    try {
      const res = await savePurchaseOrder({
        billNo,
        vendorCode,
        vendorName,
        total,
        lines: validLines.map((l, idx) => ({
          ...l,
          lineNo: idx + 1,
        })),
      });

      setModalStatus({
        type: 'success',
        message: `🎉 進貨單 [${res.billNo || billNo}] 存檔成功！`,
      });
      resetForm();
    } catch (err: any) {
      console.error('Save error:', err);
      const msg = err?.response?.data?.message || err?.message || '伺服器連線異常';
      setModalStatus({
        type: 'error',
        message: `❌ 存檔失敗: ${msg}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuery = () => {
    alert('F9 查詢單據功能：可依單號或廠商查詢歷程進貨單。');
  };

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col bg-gray-100 p-4 font-mono overflow-hidden">
      {/* Top Header Form */}
      <div className="shrink-0">
        <PurchaseOrderHeader />
      </div>

      {/* Detail Grid */}
      <div className="flex-1 min-h-0 mb-3 flex flex-col overflow-hidden">
        <FoxProGridBill
          rows={lines}
          onRowsChange={setLines}
          onF12Save={handleSave}
          onF9Query={handleQuery}
        />
      </div>

      {/* Action Buttons Bar */}
      <div className="shrink-0 bg-white border-2 border-blue-900 rounded-lg p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2 text-sm text-gray-700">
          <span className="font-bold">盲打提示：</span>
          <span>按 [Enter] 右移，[F2] 開窗或編輯，[F12] 一鍵存檔。</span>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={resetForm}
            className="flex items-center space-x-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded border border-gray-400 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>開新單據</span>
          </button>
          <button
            type="button"
            onClick={handleQuery}
            className="flex items-center space-x-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded border border-emerald-900 shadow transition"
          >
            <Search className="w-4 h-4 text-yellow-300" />
            <span>[F9] 查詢單據</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1 bg-blue-900 hover:bg-blue-800 text-white font-bold px-6 py-2 rounded border-2 border-yellow-400 shadow-lg transition"
          >
            <Save className="w-4 h-4 text-yellow-400" />
            <span>{saving ? '存檔中...' : '[F12] 存檔進貨單'}</span>
          </button>
        </div>
      </div>

      {/* Response Status Modal Popup */}
      {modalStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`border-4 text-white p-6 rounded-lg shadow-2xl max-w-lg text-center font-mono ${
              modalStatus.type === 'success'
                ? 'bg-blue-950 border-yellow-400'
                : 'bg-red-950 border-red-500'
            }`}
          >
            <div className="flex justify-center mb-3">
              {modalStatus.type === 'success' ? (
                <CheckCircle className="w-12 h-12 text-yellow-400" />
              ) : (
                <AlertCircle className="w-12 h-12 text-red-400" />
              )}
            </div>
            <h4 className="text-xl font-bold mb-3">
              {modalStatus.type === 'success' ? '存檔成功' : '系統提示'}
            </h4>
            <p className="text-lg font-semibold mb-6">{modalStatus.message}</p>
            <button
              onClick={() => setModalStatus(null)}
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
