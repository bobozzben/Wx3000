import React, { useState, useEffect } from 'react';
import { Settings, Check, X } from 'lucide-react';
import { fetchPubPara, updatePubPara, QQSEL_MAP } from './services/wbase4020';

interface Wbase4060FormProps {
  onExit?: () => void;
}

export const Wbase4060Form: React.FC<Wbase4060FormProps> = ({ onExit }) => {
  const [qqsel, setQqsel] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    fetchPubPara()
      .then((data) => {
        setQqsel(data.qqsel || '0');
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePubPara({ qqsel });
      setSaving(false);
      setStatusMessage('共用參數已成功更新至 pub_para.dbf！');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setSaving(false);
      alert('存檔失敗: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F8') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onExit?.();
    } else if (e.key === '0' || e.key === '1') {
      setQqsel(e.key);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 font-mono">
        載入共用參數設定中...
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex flex-col items-center justify-center h-full p-6 outline-none bg-slate-50 dark:bg-slate-900 select-none"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-800 border-2 border-blue-600 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-2 font-bold font-mono text-base">
            <Settings className="w-5 h-5 text-amber-300" />
            <span>4-6 共用參數設定 (wbase4060 - pub_para.dbf)</span>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="p-1 hover:bg-blue-800 rounded text-slate-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Box (對齊 VFP Shape1) */}
        <div className="p-8 space-y-6">
          <div className="border border-slate-300 dark:border-slate-700 rounded-lg p-6 bg-slate-50 dark:bg-slate-900/50 space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-base font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                多家列印作業模式：
              </label>

              {/* Input Box for blind typing 0 or 1 */}
              <input
                type="text"
                value={qqsel}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === '0' || val === '1') setQqsel(val);
                }}
                maxLength={1}
                className="w-16 px-3 py-1.5 text-center font-mono text-lg font-bold bg-white dark:bg-slate-950 border-2 border-amber-500 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />

              <span className="text-xs text-slate-500 dark:text-slate-400">
                (直接輸入 0 或 1)
              </span>
            </div>

            {/* Option descriptions (對齊 VFP lblQQSEL and Label2) */}
            <div className="space-y-2.5 pt-2 pl-4 border-l-2 border-amber-400">
              {Object.entries(QQSEL_MAP).map(([code, text]) => {
                const isSelected = qqsel === code;
                return (
                  <div
                    key={code}
                    onClick={() => setQqsel(code)}
                    className={`cursor-pointer px-3 py-2 rounded text-sm font-mono flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-amber-100 dark:bg-amber-950/80 font-bold text-amber-900 dark:text-amber-200 border border-amber-400'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="qqsel"
                      checked={isSelected}
                      onChange={() => setQqsel(code)}
                      className="cursor-pointer text-amber-600 focus:ring-amber-500"
                    />
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-sm font-bold rounded text-center border border-emerald-400">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700">
          <div className="text-xs font-mono text-slate-500">
            提示：可按 <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-bold">F8</kbd> 儲存，<kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-bold">Esc</kbd> 離開
          </div>
          <div className="flex gap-3">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-4 py-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-slate-200 font-bold rounded text-sm"
              >
                離開 [Esc]
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1.5 text-sm shadow"
            >
              <Check className="w-4 h-4" />
              {saving ? '存檔中...' : '確定存檔 [F8]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
