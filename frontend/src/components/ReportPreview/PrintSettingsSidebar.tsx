import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Printer } from 'lucide-react';
import type {
  MarginPreset,
  PageOrientation,
  PageRangeMode,
  PaperSizeOption,
  PrintSettingsState,
  SystemPrinterInfo,
} from './types';

interface PrintSettingsSidebarProps {
  settings: PrintSettingsState;
  onChange: (next: Partial<PrintSettingsState>) => void;
  printers: SystemPrinterInfo[];
  sheetCount: number;
  totalPages: number;
  printing: boolean;
  onPrint: () => void;
  onSystemPrintDialog: () => void;
  onCancel: () => void;
}

const MARGIN_PRESET_VALUES: Record<Exclude<MarginPreset, 'custom'>, { top: number; bottom: number; left: number; right: number }> = {
  default: { top: 12, bottom: 12, left: 10, right: 10 },
  none: { top: 0, bottom: 0, left: 0, right: 0 },
  minimum: { top: 5, bottom: 5, left: 5, right: 5 },
};

export const PrintSettingsSidebar: React.FC<PrintSettingsSidebarProps> = ({
  settings,
  onChange,
  printers,
  sheetCount,
  totalPages,
  printing,
  onPrint,
  onSystemPrintDialog,
  onCancel,
}) => {
  const [moreExpanded, setMoreExpanded] = useState(true);

  const selectClass =
    'w-full bg-[#2b2b2b] border border-[#6b7280] text-[#f3f4f6] rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#93c5fd] cursor-pointer';
  const inputClass =
    'w-full bg-[#1f1f1f] border border-[#6b7280] text-[#f3f4f6] rounded-md px-2.5 py-1 text-xs outline-none focus:border-[#93c5fd]';

  const handleMarginPresetChange = (preset: MarginPreset) => {
    if (preset === 'custom') {
      onChange({ marginPreset: 'custom' });
    } else {
      const vals = MARGIN_PRESET_VALUES[preset];
      onChange({
        marginPreset: preset,
        marginTopMm: vals.top,
        marginBottomMm: vals.bottom,
        marginLeftMm: vals.left,
        marginRightMm: vals.right,
      });
    }
  };

  return (
    <aside className="w-[300px] shrink-0 bg-[#2b2b2b] text-gray-100 border-l border-[#3f3f3f] flex flex-col justify-between select-none">
      {/* Header + Scrollable Settings */}
      <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base font-bold tracking-wide text-white">列印</h3>
          <span className="text-xs font-semibold text-gray-200">{sheetCount} 張紙</span>
        </div>

        {/* 目的地 */}
        <div className="grid grid-cols-[72px_1fr] items-center gap-2">
          <label className="text-gray-300">目的地</label>
          <div className="relative flex items-center">
            <Printer className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
            <select
              value={settings.destination}
              onChange={(e) => onChange({ destination: e.target.value })}
              className={`${selectClass} pl-7`}
            >
              {printers.length > 0 ? (
                <>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name}
                      {p.isDefault ? ' (預設)' : ''}
                    </option>
                  ))}
                  <option value="__SAVE_PDF__">另存為 PDF</option>
                </>
              ) : (
                <>
                  <option value="Microsoft Print to PDF">Microsoft Print to PDF</option>
                  <option value="__SAVE_PDF__">另存為 PDF</option>
                  <option value="__BROWSER_DEFAULT__">系統預設印表機</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* 頁面 */}
        <div className="space-y-2">
          <div className="grid grid-cols-[72px_1fr] items-center gap-2">
            <label className="text-gray-300">頁面</label>
            <select
              value={settings.pageRangeMode}
              onChange={(e) => onChange({ pageRangeMode: e.target.value as PageRangeMode })}
              className={selectClass}
            >
              <option value="all">全部 ({totalPages} 頁)</option>
              <option value="current">目前頁面</option>
              <option value="custom">自訂</option>
            </select>
          </div>

          {settings.pageRangeMode === 'custom' && (
            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <span />
              <input
                type="text"
                value={settings.customPages}
                onChange={(e) => onChange({ customPages: e.target.value })}
                placeholder={`例如 1-3, 5 (共 ${totalPages} 頁)`}
                className={inputClass}
              />
            </div>
          )}
        </div>

        {/* 配置 */}
        <div className="grid grid-cols-[72px_1fr] items-center gap-2">
          <label className="text-gray-300">配置</label>
          <select
            value={settings.orientation}
            onChange={(e) => onChange({ orientation: e.target.value as PageOrientation })}
            className={selectClass}
          >
            <option value="portrait">直向</option>
            <option value="landscape">橫向</option>
          </select>
        </div>

        {/* 彩色 */}
        <div className="grid grid-cols-[72px_1fr] items-center gap-2">
          <label className="text-gray-300">彩色</label>
          <select
            value={settings.colorMode}
            onChange={(e) => onChange({ colorMode: e.target.value as 'color' | 'bw' })}
            className={selectClass}
          >
            <option value="color">彩色</option>
            <option value="bw">黑白</option>
          </select>
        </div>

        {/* 顯示更多設定 */}
        <div className="border-t border-[#444] pt-2.5">
          <button
            type="button"
            onClick={() => setMoreExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-gray-200 hover:text-white py-1 cursor-pointer"
          >
            <span className="font-medium">顯示更多設定</span>
            <span className="w-6 h-6 rounded-full border border-gray-500 flex items-center justify-center">
              {moreExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {moreExpanded && (
            <div className="space-y-3 pt-2.5">
              {/* 紙張大小 */}
              <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                <label className="text-gray-300">紙張大小</label>
                <select
                  value={settings.paperSize}
                  onChange={(e) => onChange({ paperSize: e.target.value as PaperSizeOption })}
                  className={selectClass}
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="HalfLetter">中一刀</option>
                  <option value="B4">B4</option>
                </select>
              </div>

              {/* 每張工作表頁數 */}
              <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                <label className="text-gray-300">每張工作表頁數</label>
                <select
                  value={settings.pagesPerSheet}
                  onChange={(e) => onChange({ pagesPerSheet: Number(e.target.value) as 1 | 2 | 4 })}
                  className={selectClass}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                </select>
              </div>

              {/* 邊界 */}
              <div className="space-y-2">
                <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                  <label className="text-gray-300">邊界</label>
                  <select
                    value={settings.marginPreset}
                    onChange={(e) => handleMarginPresetChange(e.target.value as MarginPreset)}
                    className={selectClass}
                  >
                    <option value="default">預設值</option>
                    <option value="none">無</option>
                    <option value="minimum">最小</option>
                    <option value="custom">自訂 (mm)</option>
                  </select>
                </div>

                {settings.marginPreset === 'custom' && (
                  <div className="grid grid-cols-4 gap-1.5 pl-1">
                    <div>
                      <span className="block text-[10px] text-gray-400">上(mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={settings.marginTopMm}
                        onChange={(e) => onChange({ marginTopMm: Math.max(0, Number(e.target.value) || 0) })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">下(mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={settings.marginBottomMm}
                        onChange={(e) => onChange({ marginBottomMm: Math.max(0, Number(e.target.value) || 0) })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">左(mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={settings.marginLeftMm}
                        onChange={(e) => onChange({ marginLeftMm: Math.max(0, Number(e.target.value) || 0) })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">右(mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={settings.marginRightMm}
                        onChange={(e) => onChange({ marginRightMm: Math.max(0, Number(e.target.value) || 0) })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 縮放比例 */}
              <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                <label className="text-gray-300">縮放比例</label>
                <select
                  value={settings.printScaleMode}
                  onChange={(e) => onChange({ printScaleMode: e.target.value as 'default' | 'fit' })}
                  className={selectClass}
                >
                  <option value="default">預設</option>
                  <option value="fit">符合可列印區域</option>
                </select>
              </div>

              {/* 選項 */}
              <div className="grid grid-cols-[96px_1fr] items-start gap-2 pt-0.5">
                <label className="text-gray-300 pt-0.5">選項</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-200">
                    <input
                      type="checkbox"
                      checked={settings.includeHeaderFooter}
                      onChange={(e) => onChange({ includeHeaderFooter: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#93c5fd] rounded cursor-pointer"
                    />
                    <span>頁首及頁尾</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-200">
                    <input
                      type="checkbox"
                      checked={settings.includeBackgroundGraphics}
                      onChange={(e) => onChange({ includeBackgroundGraphics: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#93c5fd] rounded cursor-pointer"
                    />
                    <span>背景圖形</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 使用系統對話方塊進行列印 */}
        <div className="border-t border-[#444] pt-2.5">
          <button
            type="button"
            onClick={onSystemPrintDialog}
            className="w-full flex items-center justify-between text-gray-300 hover:text-white py-1 text-left cursor-pointer transition"
          >
            <span>使用系統對話方塊進行列印... (Ctrl+Shift+P)</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-1" />
          </button>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-3.5 border-t border-[#3f3f3f] bg-[#242424] flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onPrint}
          disabled={printing || totalPages === 0}
          className="px-6 py-1.5 rounded-full bg-[#a8c7fa] hover:bg-[#8ab4f8] disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer transition"
        >
          {printing ? '處理中...' : '列印'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-1.5 rounded-full bg-transparent hover:bg-white/10 text-[#a8c7fa] border border-[#5f6368] font-bold text-xs cursor-pointer transition"
        >
          取消
        </button>
      </div>
    </aside>
  );
};
