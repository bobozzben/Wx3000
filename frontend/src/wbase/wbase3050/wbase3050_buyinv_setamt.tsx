import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DollarSign,
  X,
  Sun,
  Moon,
  Receipt,
  Calculator,
  Sparkles,
  Save,
} from 'lucide-react';
import { getBuyinvPrices, saveBuyinvPrices, type BuyinvPriceConfig } from '../../services/wbase3050';
import { useTheme } from '../menu/ThemeContext';

interface Wbase3050BuyinvSetAmtProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Wbase3050_buyinv_setamt: React.FC<Wbase3050BuyinvSetAmtProps> = ({
  isOpen = true,
  onClose,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const [config, setConfig] = useState<BuyinvPriceConfig>({
    manualTwoDup: 15,
    manualTwoDupSub: 16,
    manualThreeDup: 18,
    manualThreeDupSub: 19,
    manualSpecial: 15,
    cashTwoDup: 36,
    cashThreeDup: 85,
    cashThreeDupSub: 95,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Refs for 8 fields + Buttons
  const f1Ref = useRef<HTMLInputElement>(null);
  const f2Ref = useRef<HTMLInputElement>(null);
  const f3Ref = useRef<HTMLInputElement>(null);
  const f4Ref = useRef<HTMLInputElement>(null);
  const f5Ref = useRef<HTMLInputElement>(null);
  const f6Ref = useRef<HTMLInputElement>(null);
  const f7Ref = useRef<HTMLInputElement>(null);
  const f8Ref = useRef<HTMLInputElement>(null);
  const btnSaveRef = useRef<HTMLButtonElement>(null);
  const btnLeaveRef = useRef<HTMLButtonElement>(null);

  const fieldRefs = [f1Ref, f2Ref, f3Ref, f4Ref, f5Ref, f6Ref, f7Ref, f8Ref];

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | HTMLButtonElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if ('select' in ref.current && typeof (ref.current as any).select === 'function') {
          (ref.current as any).select();
        }
      }
    }, 50);
  };

  // 載入資料庫參數
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const data = await getBuyinvPrices();
        if (isMounted) {
          setConfig(data);
        }
      } catch (err) {
        console.error('Failed to load buyinv prices:', err);
      } finally {
        if (isMounted) {
          focusAndSelect(f1Ref);
        }
      }
    };

    if (isOpen) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 儲存並離開
  const handleSaveAndLeave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveBuyinvPrices(config);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setIsSaving(false);
      if (onClose) onClose();
    }
  }, [config, isSaving, onClose]);

  // 鍵盤導航
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < fieldRefs.length - 1) {
        focusAndSelect(fieldRefs[currentIndex + 1]);
      } else {
        focusAndSelect(btnSaveRef);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        focusAndSelect(fieldRefs[currentIndex - 1]);
      }
    } else if (e.key === 'ArrowRight' && currentIndex < 4) {
      e.preventDefault();
      focusAndSelect(fieldRefs[currentIndex + 4]);
    } else if (e.key === 'ArrowLeft' && currentIndex >= 4) {
      e.preventDefault();
      focusAndSelect(fieldRefs[currentIndex - 4]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleSaveAndLeave();
    }
  };

  // 全域 Esc 監聽
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveAndLeave();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, handleSaveAndLeave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden">
      {/* Outer Window Box matching modern aesthetic */}
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border transition-colors duration-300 max-h-[92vh] ${
          isDark
            ? 'bg-slate-900 text-white border-slate-800'
            : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
        {/* Header Bar with Gradient */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between transition-colors ${
            isDark
              ? 'bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border-b border-slate-800'
              : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md'
          }`}
        >
          <div className="flex items-center space-x-3">
            {/* Header Icon Box */}
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">
                  統購發票種類金額設定
                </h2>
                <span className="bg-amber-300 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  Enter/Esc 儲存離開
                </span>
              </div>
              <p className="text-[11px] text-amber-100/80 font-mono mt-0.5">
                FormWBase360_buyinv_SET_AMT
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button (淺色 / 深色) */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition backdrop-blur-xs cursor-pointer"
              title={isDark ? '切換至淺色主題' : '切換至深色主題'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>淺色</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-200" />
                  <span>深色</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={handleSaveAndLeave}
              className="p-1 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              title="儲存並關閉 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body Cards */}
        <div className="p-3.5 sm:p-4 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          {/* Quick Subtitle / Navigation Tag */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2 font-bold text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span>設定各種類發票之單本統一採購單價 (新台幣/元)</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                isDark ? 'bg-amber-950/60 text-amber-300' : 'bg-amber-50 text-amber-800'
              }`}
            >
              [Enter / 方向鍵 導航]
            </span>
          </div>

          {/* Two-Column Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Card 1: 手開式統一發票 */}
            <div
              className={`rounded-2xl p-4 transition-colors border shadow-xs space-y-3 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700/80'
                  : 'bg-white border-slate-200/90 shadow-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                <Receipt className="w-4 h-4 text-indigo-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>
                  手開式統一發票
                </span>
              </div>

              <div className="space-y-3">
                {/* Row 1: 二聯式發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    二聯式發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f1Ref}
                      type="number"
                      value={config.manualTwoDup}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          manualTwoDup: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 0)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 2: 二聯式發票(副) */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    二聯式發票(副)
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f2Ref}
                      type="number"
                      value={config.manualTwoDupSub}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          manualTwoDupSub: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 1)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 3: 三聯式發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    三聯式發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f3Ref}
                      type="number"
                      value={config.manualThreeDup}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          manualThreeDup: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 2)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 4: 三聯式發票(副) */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    三聯式發票(副)
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f4Ref}
                      type="number"
                      value={config.manualThreeDupSub}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          manualThreeDupSub: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 3)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: 特種與收銀機發票 */}
            <div
              className={`rounded-2xl p-4 transition-colors border shadow-xs space-y-3 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700/80'
                  : 'bg-white border-slate-200/90 shadow-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-sm sm:text-base pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>
                  特種與收銀機發票
                </span>
              </div>

              <div className="space-y-3">
                {/* Row 1: 特種發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    特種發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f5Ref}
                      type="number"
                      value={config.manualSpecial}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          manualSpecial: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 4)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 2: 二聯式收銀機發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    二聯式收銀機發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f6Ref}
                      type="number"
                      value={config.cashTwoDup}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cashTwoDup: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 5)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 3: 三聯式收銀機發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    三聯式收銀機發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f7Ref}
                      type="number"
                      value={config.cashThreeDup}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cashThreeDup: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 6)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>

                {/* Row 4: 四聯式收銀機發票 */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    四聯式收銀機發票
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400">NT$</span>
                    <input
                      ref={f8Ref}
                      type="number"
                      value={config.cashThreeDupSub}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cashThreeDupSub: Number(e.target.value) || 0,
                        }))
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, 7)}
                      className={`w-24 px-2.5 py-1.5 border-2 rounded-xl text-right font-black text-sm transition focus:outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-500">元</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tip Banner */}
          <div
            className={`p-3 rounded-xl text-xs font-bold text-center border shadow-xs ${
              isDark
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            💡 提示：輸入完成後按下 <span className="underline font-black">Enter</span> 或 <span className="underline font-black">Esc</span> 鍵將自動儲存設定並關閉視窗。
          </div>
        </div>

        {/* Footer Action Bar */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-2.5 border-t transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/90'
          }`}
        >
          <div className="text-xs font-bold text-slate-400">
            共 8 項發票種類單價設定
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5 font-bold text-xs sm:text-sm">
            {/* 儲存並離開 Button */}
            <button
              ref={btnSaveRef}
              onClick={handleSaveAndLeave}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveAndLeave();
                }
              }}
              className="flex items-center space-x-1.5 px-5 sm:px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>儲存並離開 (Enter)</span>
            </button>

            {/* Esc. 離開 Button */}
            <button
              ref={btnLeaveRef}
              onClick={handleSaveAndLeave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveAndLeave();
                }
              }}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl border-2 transition active:scale-95 shadow-xs focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              <X className="w-4 h-4 text-red-500 stroke-[3]" />
              <span>Esc. 離開</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

