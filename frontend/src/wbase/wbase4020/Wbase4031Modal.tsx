import React, { useState, useEffect } from 'react';
import { Settings, X, Check } from 'lucide-react';
import type { AccParaVoucher } from './services/wbase4020';
import {
  fetchAccParaVoucherParams,
  updateAccParaVoucherParams,
  MONTHV_MAP,
  MEDIA_TYPE_MAP,
  TRAN_TYPE_MAP,
  TRAN_KIND_MAP,
} from './services/wbase4020';

interface Wbase4031ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const Wbase4031Modal: React.FC<Wbase4031ModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<AccParaVoucher>({
    smMonthv: '0',
    smMedia: '2',
    smType: '1',
    smKind: '2',
    smDate: 1,
    smTypeb: '1',
    smKindb: '2',
    smDateb: 1,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAccParaVoucherParams()
        .then((data) => setForm(data))
        .catch((err) => console.error('fetchAccParaVoucherParams error:', err));
    }
  }, [isOpen]);

  const handleChange = (field: keyof AccParaVoucher, val: any) => {
    setForm((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateAccParaVoucherParams(form);
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setSaving(false);
      alert('存檔失敗: ' + (err?.response?.data?.message || err.message));
    }
  };

  // 鍵盤快捷鍵 (Esc 離開, F8 存檔)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, form, saving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-2 font-bold font-mono">
            <Settings className="w-5 h-5 text-amber-300" />
            <span>標準轉傳票參數設定 (wbase4031 - accpara.dbf)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-800 rounded text-slate-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
          <div className="text-xs bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            說明：此處設定全所營業稅轉傳票之標準預設參數。於 [4-3 營業稅傳票轉檔設定]
            畫面中按下 <span className="font-bold underline">[F8] 標準參數</span>{' '}
            時，將自動套用此處設定至目前客戶。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 申報週期 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                申報週期 (sm_monthv)
              </label>
              <select
                value={form.smMonthv}
                onChange={(e) => handleChange('smMonthv', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(MONTHV_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 媒體申報方式 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                媒體申報方式 (sm_media)
              </label>
              <select
                value={form.smMedia}
                onChange={(e) => handleChange('smMedia', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(MEDIA_TYPE_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 銷項連線型態 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                銷項連線型態 (sm_type)
              </label>
              <select
                value={form.smType}
                onChange={(e) => handleChange('smType', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(TRAN_TYPE_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 銷項連線種類 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                銷項連線種類 (sm_kind)
              </label>
              <select
                value={form.smKind}
                onChange={(e) => handleChange('smKind', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(TRAN_KIND_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 銷項連線天數 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                銷項連線天數 (sm_date)
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.smDate}
                onChange={(e) => handleChange('smDate', parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* 進項連線型態 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                進項連線型態 (sm_typeb)
              </label>
              <select
                value={form.smTypeb}
                onChange={(e) => handleChange('smTypeb', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(TRAN_TYPE_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 進項連線種類 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                進項連線種類 (sm_kindb)
              </label>
              <select
                value={form.smKindb}
                onChange={(e) => handleChange('smKindb', e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              >
                {Object.entries(TRAN_KIND_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 進項連線天數 */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                進項連線天數 (sm_dateb)
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.smDateb}
                onChange={(e) => handleChange('smDateb', parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-slate-200 font-bold rounded"
          >
            取消 [Esc]
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1.5 shadow"
          >
            <Check className="w-4 h-4" />
            {saving ? '儲存中...' : '確定存檔 [F8]'}
          </button>
        </div>
      </div>
    </div>
  );
};
