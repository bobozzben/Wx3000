import React, { useState, useEffect } from 'react';
import { Settings, X, Check, Search } from 'lucide-react';
import type { AccParaTax } from './services/wbase4020';
import { fetchAccParaTaxAccounts, updateAccParaTaxAccounts } from './services/wbase4020';
import { AccountSearchModal } from './AccountSearchModal';

interface Wbase4021ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const Wbase4021Modal: React.FC<Wbase4021ModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<AccParaTax>({
    bydno: '',
    bycno: '',
    bybkdno: '',
    bybkcno: '',
    sadno: '',
    sacno: '',
    sabkdno: '',
    sabkcno: '',
    casaccno: '',
  });

  const [saving, setSaving] = useState(false);
  const [searchTarget, setSearchTarget] = useState<keyof AccParaTax | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAccParaTaxAccounts()
        .then((data) => setForm(data))
        .catch((err) => console.error('fetchAccParaTaxAccounts error:', err));
    }
  }, [isOpen]);

  const handleChange = (field: keyof AccParaTax, val: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: val.toUpperCase(),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateAccParaTaxAccounts(form);
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setSaving(false);
      alert('存檔失敗: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleSelectAccount = (accno: string) => {
    if (searchTarget) {
      handleChange(searchTarget, accno);
      setSearchTarget(null);
    }
  };

  // 鍵盤快捷鍵 (Esc 離開, F8 存檔)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 若子開窗 (AccountSearchModal) 開啟中，由子開窗優先處理
      if (searchTarget) return;

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
  }, [isOpen, searchTarget, onClose, form, saving]);

  if (!isOpen) return null;

  const fields: { key: keyof AccParaTax; label: string; desc: string }[] = [
    { key: 'bydno', label: '進項借方科目', desc: '預設進項扣抵之會計借方科目 (如 1261/1268)' },
    { key: 'bycno', label: '進項貸方科目', desc: '預設進項付款之會計貸方科目 (如 2141/1111)' },
    { key: 'bybkdno', label: '進項退出借方科目', desc: '進貨退出或折讓之借方科目' },
    { key: 'bybkcno', label: '進項退出貸方科目', desc: '進貨退出或折讓之貸方科目' },
    { key: 'sadno', label: '銷項借方科目', desc: '預設銷項收入之借方科目 (如 1111/1191)' },
    { key: 'sacno', label: '銷項貸方科目', desc: '預設銷項營業收入科目 (如 4101)' },
    { key: 'sabkdno', label: '銷項退回借方科目', desc: '銷貨退回或折讓之借方科目 (如 4201)' },
    { key: 'sabkcno', label: '銷項退回貸方科目', desc: '銷貨退回或折讓之貸方科目' },
    { key: 'casaccno', label: '收銀機會計科目', desc: '收銀機二聯發票營業收入對應科目' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-2 font-bold font-mono">
            <Settings className="w-5 h-5 text-amber-300" />
            <span>標準會計科目設定 (wbase4021 - accpara.dbf)</span>
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
            說明：此處設定事務所全系統共用之「標準營業稅會計科目」。於 [4-2 營業稅設定]
            畫面中按下 <span className="font-bold underline">[F8] 標準參數</span>{' '}
            時，將自動套用此處設定至目前客戶。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div
                key={f.key}
                className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {f.label}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSearchTarget(f.key)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    <Search className="w-3 h-3" /> F2 快選
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    maxLength={8}
                    placeholder="8碼科目代號"
                    className="w-full px-2.5 py-1.5 font-mono text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-wider"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {f.desc}
                </span>
              </div>
            ))}
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

      {/* F2 Search Modal */}
      {searchTarget && (
        <AccountSearchModal
          isOpen={true}
          onClose={() => setSearchTarget(null)}
          onSelect={handleSelectAccount}
          title={`選取「${fields.find((f) => f.key === searchTarget)?.label}」`}
        />
      )}
    </div>
  );
};
