import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TAIWAN_CITIES,
  getRoadsForZip,
  digToBig,
  parseTaiwanAddress,
  type TaiwanDistrict,
} from '../../services/addressService';
import { useTheme } from '../../wbase/menu/ThemeContext';

export interface AddressSelectModalProps {
  isOpen: boolean;
  initialValue?: string;
  onClose: () => void;
  onConfirm: (selectedAddress: string) => void;
}

/**
 * 常用門牌/樓層速選按鈕定義 (對齊 util_hi_addr_form.pas SpeedButtons)
 */
const NUM_BUTTONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '之'];
const CH_NUM_BUTTONS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const UNIT_BUTTONS = ['段', '巷', '弄', '號', '樓', '室', '鄰', '衖', '棟', '附', 'F'];

export const AddressSelectModal: React.FC<AddressSelectModalProps> = ({
  isOpen,
  initialValue = '',
  onClose,
  onConfirm,
}) => {
  const { isDark } = useTheme();

  const [selectedCityName, setSelectedCityName] = useState<string>('新北市');
  const [selectedDistrict, setSelectedDistrict] = useState<TaiwanDistrict | null>(null);
  const [roadList, setRoadList] = useState<string[]>([]);
  const [roadSearch, setRoadSearch] = useState<string>('');
  const [selectedRoad, setSelectedRoad] = useState<string>('');
  const [addressText, setAddressText] = useState<string>('');
  const [includeZip, setIncludeZip] = useState<boolean>(false);
  const [loadingRoads, setLoadingRoads] = useState<boolean>(false);

  const addrInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 當前選取的縣市物件
  const currentCity = useMemo(() => {
    return (
      TAIWAN_CITIES.find(
        (c) =>
          c.name === selectedCityName ||
          c.name.replace(/臺/g, '台') === selectedCityName ||
          c.name.replace(/台/g, '臺') === selectedCityName
      ) || TAIWAN_CITIES[0]
    );
  }, [selectedCityName]);

  // 開啟視窗時初始化
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = (initialValue || '').trim();
    if (trimmed) {
      setAddressText(trimmed);
      const parsed = parseTaiwanAddress(trimmed);
      if (parsed.city) {
        setSelectedCityName(parsed.city);
        const cityObj = TAIWAN_CITIES.find((c) => c.name === parsed.city);
        if (cityObj) {
          const distObj =
            cityObj.districts.find((d) => d.name === parsed.district || d.zip === parsed.zip) ||
            cityObj.districts[0];
          setSelectedDistrict(distObj);
          if (parsed.road) setSelectedRoad(parsed.road);
        }
      } else {
        setSelectedCityName('新北市');
        setSelectedDistrict(TAIWAN_CITIES.find((c) => c.name === '新北市')?.districts[0] || null);
      }
      setIncludeZip(/^\d{3,6}/.test(trimmed));
    } else {
      setSelectedCityName('新北市');
      const defaultDist =
        TAIWAN_CITIES.find((c) => c.name === '新北市')?.districts.find((d) => d.name === '板橋區') ||
        TAIWAN_CITIES[0].districts[0];
      setSelectedDistrict(defaultDist);
      setSelectedRoad('');
      setAddressText(defaultDist ? `新北市${defaultDist.name}` : '新北市');
      setIncludeZip(false);
    }

    setRoadSearch('');
    setTimeout(() => {
      addrInputRef.current?.focus();
    }, 100);
  }, [isOpen, initialValue]);

  // 當行政區變更時，非同步載入對應路名
  useEffect(() => {
    if (!selectedDistrict?.zip) {
      setRoadList([]);
      return;
    }
    let isCancelled = false;
    setLoadingRoads(true);
    getRoadsForZip(selectedDistrict.zip).then((roads) => {
      if (!isCancelled) {
        setRoadList(roads);
        setLoadingRoads(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [selectedDistrict]);

  // 依關鍵字篩選該區路名
  const filteredRoads = useMemo(() => {
    if (!roadSearch.trim()) return roadList;
    const kw = roadSearch.trim().toLowerCase();
    return roadList.filter((r) => r.toLowerCase().includes(kw));
  }, [roadList, roadSearch]);

  // 切換縣市
  const handleCityChange = (cityName: string) => {
    setSelectedCityName(cityName);
    const cityObj = TAIWAN_CITIES.find((c) => c.name === cityName);
    const firstDist = cityObj?.districts[0] || null;
    setSelectedDistrict(firstDist);
    setSelectedRoad('');

    // 更新地址文字框前綴
    const newPrefix = firstDist ? `${cityName}${firstDist.name}` : cityName;
    setAddressText(includeZip && firstDist ? `${firstDist.zip}${newPrefix}` : newPrefix);
  };

  // 切換行政區
  const handleDistrictChange = (dist: TaiwanDistrict) => {
    setSelectedDistrict(dist);
    setSelectedRoad('');

    const basePrefix = `${selectedCityName}${dist.name}`;
    const newAddr = includeZip ? `${dist.zip}${basePrefix}` : basePrefix;
    setAddressText(newAddr);
  };

  // 點選路名
  const handleRoadSelect = (road: string) => {
    setSelectedRoad(road);
    const distName = selectedDistrict?.name || '';
    const prefix = `${selectedCityName}${distName}`;
    const zipPrefix = includeZip && selectedDistrict?.zip ? `${selectedDistrict.zip}` : '';

    // 若地址文字框開頭已有縣市行政區，直接補上路名
    const matchPrefix = addressText.replace(/^\d{3,6}/, '');
    if (matchPrefix.startsWith(prefix)) {
      setAddressText(`${zipPrefix}${prefix}${road}`);
    } else {
      setAddressText(`${zipPrefix}${prefix}${road}`);
    }
    addrInputRef.current?.focus();
  };

  // 附加按鍵字符 (SpeedButtons)
  const handleAppendChar = (ch: string) => {
    setAddressText((prev) => prev + ch);
    addrInputRef.current?.focus();
  };

  // 退格刪除一字
  const handleBackspace = () => {
    setAddressText((prev) => (prev.length > 0 ? prev.slice(0, prev.length - 1) : ''));
    addrInputRef.current?.focus();
  };

  // 切換是否加上郵遞區號
  const handleToggleZip = (checked: boolean) => {
    setIncludeZip(checked);
    const zip = selectedDistrict?.zip || '';
    if (!zip) return;

    if (checked) {
      if (!/^\d{3}/.test(addressText)) {
        setAddressText(`${zip}${addressText}`);
      }
    } else {
      setAddressText(addressText.replace(/^\d{3,6}\s*/, ''));
    }
    addrInputRef.current?.focus();
  };

  // 轉為全形
  const handleConvertToFullWidth = () => {
    setAddressText((prev) => digToBig(prev));
    addrInputRef.current?.focus();
  };

  // 複製到剪貼簿
  const handleCopy = () => {
    if (addressText) {
      navigator.clipboard.writeText(addressText);
    }
  };

  // 鍵盤快捷鍵 F8, Enter, Esc
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F8') {
      e.preventDefault();
      onConfirm(addressText.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && e.target === addrInputRef.current) {
      e.preventDefault();
      onConfirm(addressText.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-3xl rounded shadow-2xl border flex flex-col text-sm overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 font-sans ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-sky-50 border-sky-300 text-slate-900'
        }`}
      >
        {/* Header (FoxPro Style) */}
        <div className="bg-linear-to-r from-blue-900 to-indigo-900 text-white px-4 py-2 flex items-center justify-between border-b border-blue-950 font-bold tracking-wide">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">📍</span>
            <span className="font-bold text-base">地址選單 (util_hi_addr)</span>
            <span className="text-xs bg-blue-950 px-2 py-0.5 rounded text-sky-300 border border-blue-800 font-mono">
              F8.確定 / Esc.取消
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white px-2 py-0.5 rounded text-sm hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5">
          {/* Row 1: 縣市、鄉鎮市區、郵遞區號 */}
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-4">
              <label className="block text-xs font-bold mb-1 text-blue-900 dark:text-sky-300">
                1. 縣市
              </label>
              <select
                value={selectedCityName}
                onChange={(e) => handleCityChange(e.target.value)}
                className={`w-full h-8 px-2 rounded border text-sm font-semibold outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {TAIWAN_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-5">
              <label className="block text-xs font-bold mb-1 text-blue-900 dark:text-sky-300">
                2. 鄉鎮市區 (郵遞區號)
              </label>
              <select
                value={selectedDistrict?.zip || ''}
                onChange={(e) => {
                  const d = currentCity.districts.find((item) => item.zip === e.target.value);
                  if (d) handleDistrictChange(d);
                }}
                className={`w-full h-8 px-2 rounded border text-sm font-semibold outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {currentCity.districts.map((d) => (
                  <option key={d.zip} value={d.zip}>
                    {d.name} ({d.zip})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-3 flex flex-col justify-end">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold pt-4 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeZip}
                  onChange={(e) => handleToggleZip(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-yellow-400 w-4 h-4 cursor-pointer"
                />
                <span>加上郵遞區號</span>
              </label>
            </div>
          </div>

          {/* Row 2: 街路 (支援即時篩選與清單快選) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-blue-900 dark:text-sky-300 flex items-center gap-1.5">
                <span>3. 街路名稱</span>
                {selectedDistrict && (
                  <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">
                    {roadSearch.trim()
                      ? `(${selectedDistrict.name} 符合 ${filteredRoads.length} / ${roadList.length} 條道路)`
                      : `(${selectedDistrict.name} 共 ${roadList.length} 條道路)`}
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="輸入路名關鍵字速查 (如: 中山、文化)..."
                value={roadSearch}
                onChange={(e) => setRoadSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredRoads.length > 0) {
                      handleRoadSelect(filteredRoads[0]);
                    }
                  } else if (e.key === 'Escape' && roadSearch) {
                    e.preventDefault();
                    e.stopPropagation();
                    setRoadSearch('');
                  }
                }}
                className={`w-64 h-7 px-2.5 text-xs rounded border outline-none focus:ring-2 focus:ring-yellow-400 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* 道路捲動清單：外層為固定高度捲動容器，內層獨立 Grid 避免 Blink / Chromium 壓縮列高 */}
            <div
              className={`h-44 overflow-y-auto rounded border p-2 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
              }`}
            >
              {loadingRoads ? (
                <div className="py-8 text-center text-slate-400 font-medium">道路資料載入中...</div>
              ) : filteredRoads.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-medium">
                  {roadSearch ? '查無符合的路名' : '本區無內建路名，可直接於下方輸入'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 auto-rows-[34px]">
                  {filteredRoads.map((road) => {
                    const isSelected = selectedRoad === road;
                    return (
                      <button
                        key={road}
                        type="button"
                        onClick={() => handleRoadSelect(road)}
                        className={`h-[34px] min-h-[34px] px-2.5 rounded text-[13px] font-sans font-medium flex items-center justify-between border transition-all text-left truncate cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-700 text-white font-bold shadow-xs'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-100 hover:text-white'
                            : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-400 text-slate-800 hover:text-blue-900'
                        }`}
                        title={road}
                      >
                        <span className="truncate">{road}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: 常用速選按鍵盤 (SpeedButtons) */}
          <div
            className={`p-2.5 rounded border space-y-1.5 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-blue-50/70 border-blue-200'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              速選按鍵盤 (點擊自動附加至地址末端)：
            </div>
            {/* 數字盤 */}
            <div className="flex flex-wrap gap-1">
              {NUM_BUTTONS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => handleAppendChar(ch)}
                  className={`w-7 h-7 rounded font-bold text-xs flex items-center justify-center border shadow-xs transition-colors font-mono cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'
                      : 'bg-white border-slate-300 hover:bg-blue-100 text-blue-950'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* 國字大寫數字盤 */}
            <div className="flex flex-wrap gap-1">
              {CH_NUM_BUTTONS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => handleAppendChar(ch)}
                  className={`w-7 h-7 rounded font-bold text-xs flex items-center justify-center border shadow-xs transition-colors ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-300'
                      : 'bg-white border-slate-300 hover:bg-amber-100 text-amber-900'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* 地址單位盤 (段/巷/弄/號/樓...) */}
            <div className="flex flex-wrap gap-1">
              {UNIT_BUTTONS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => handleAppendChar(ch)}
                  className={`px-2 h-7 rounded font-bold text-xs flex items-center justify-center border shadow-xs transition-colors ${
                    isDark
                      ? 'bg-indigo-950 border-indigo-800 hover:bg-indigo-900 text-indigo-200'
                      : 'bg-indigo-50 border-indigo-300 hover:bg-indigo-100 text-indigo-950'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: 地址完整預覽與編輯框 (Edit1) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-blue-900 dark:text-sky-300 flex items-center gap-1">
                <span>4. 完整地址 (可直接編輯或點按鍵盤組合)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs"
                  title="刪除最後一個字元"
                >
                  ← 退格
                </button>
                <button
                  type="button"
                  onClick={handleConvertToFullWidth}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white shadow-xs"
                  title="將數字轉換為全形數字 (如 1 -> １)"
                >
                  全形數字
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white shadow-xs"
                  title="複製地址至剪貼簿"
                >
                  複製
                </button>
                <button
                  type="button"
                  onClick={() => setAddressText('')}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-xs"
                >
                  清空
                </button>
              </div>
            </div>

            <input
              ref={addrInputRef}
              type="text"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              className={`w-full h-9 px-3 rounded border text-base font-bold font-mono outline-none focus:ring-2 focus:ring-yellow-400 ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-yellow-300'
                  : 'bg-white border-blue-400 text-blue-950'
              }`}
              placeholder="請組合或輸入完整地址..."
            />
          </div>
        </div>

        {/* Footer (Buttons: F8.確定 / Esc.取消) */}
        <div
          className={`px-4 py-2.5 flex items-center justify-end gap-2 border-t ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded font-bold text-sm cursor-pointer transition-colors border ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            Esc. 取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(addressText.trim())}
            className="px-5 py-1.5 rounded font-bold text-sm cursor-pointer bg-blue-700 hover:bg-blue-600 text-white shadow-md border border-blue-900 transition-colors flex items-center gap-1.5"
          >
            <span>F8. 確定帶入</span>
          </button>
        </div>
      </div>
    </div>
  );
};
