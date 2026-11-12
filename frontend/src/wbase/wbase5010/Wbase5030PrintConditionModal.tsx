import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  FoxProRangePrintConditionModal,
  requireYear,
  type FoxProRangeFieldKey,
  type FoxProRangePrintConditionStatus,
  type FoxProRangePrintConditionValues,
} from '../../components/FoxProGrid';
import { foxProFocusAndSelect } from '../../components/FoxProGridCard/FoxProGridCard';
import { fetchEmps } from '../../services/wbase1030';
import { useTheme } from '../menu/ThemeContext';
import { chosenSummary } from './wbase50Shared';

export type KeyinRangeFieldKey = 'startKeyin' | 'endKeyin';

export interface Wbase5030PrintConditionValues {
  startKeyin: string;
  endKeyin: string;
  year: string;
}

export type Wbase5030PrintConditionStatus = FoxProRangePrintConditionStatus;

export interface Wbase5030PrintConditionModalProps {
  values: Wbase5030PrintConditionValues;
  onChange: (next: Wbase5030PrintConditionValues) => void;
  chosenCount: number;
  active: boolean;
  isSubmitting: boolean;
  isExportBusy?: boolean;
  exportConfigure: boolean;
  onExportConfigureChange: (checked: boolean) => void;
  status: Wbase5030PrintConditionStatus | null;
  focusRequest: { key: KeyinRangeFieldKey } | null;
  onOpenF2: (target: KeyinRangeFieldKey) => void;
  onConfirm: () => void;
  onExport: () => void;
  onCancel: () => void;
}

const normalizeCode = (value: string): string => value.trim().toUpperCase();

/**
 * 5-3 客戶登打統計表列印條件畫面 (wbase5030)
 * 繼承共用區間型母版 FoxProRangePrintConditionModal，提供登打人員起始/終止編號 (F2 開窗)、
 * 資料年度輸入與「匯出 xlsx 設定」。
 */
export const Wbase5030PrintConditionModal: React.FC<Wbase5030PrintConditionModalProps> = ({
  values,
  onChange,
  chosenCount,
  active,
  isSubmitting,
  isExportBusy = false,
  exportConfigure,
  onExportConfigureChange,
  status,
  focusRequest,
  onOpenF2,
  onConfirm,
  onExport,
  onCancel,
}) => {
  const { isDark } = useTheme();
  const yearInputRef = useRef<HTMLInputElement>(null);
  const [empNameMap, setEmpNameMap] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    fetchEmps()
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const emp of list) {
          const code = normalizeCode(emp.no || '');
          if (code) map.set(code, emp.name || '');
        }
        setEmpNameMap(map);
      })
      .catch(() => {
        // 載入人員名稱提示失敗不影響條件輸入與查詢
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startNorm = normalizeCode(values.startKeyin);
  const endNorm = normalizeCode(values.endKeyin);
  const yearTrim = values.year.trim();

  const startMatchedName = startNorm ? empNameMap.get(startNorm) : undefined;
  const endMatchedName = endNorm ? empNameMap.get(endNorm) : undefined;

  const baseValues = useMemo<FoxProRangePrintConditionValues>(
    () => ({
      start: values.startKeyin,
      end: values.endKeyin,
    }),
    [values.startKeyin, values.endKeyin]
  );

  const baseFocusRequest = useMemo<{ key: FoxProRangeFieldKey } | null>(
    () =>
      focusRequest
        ? {
            key: focusRequest.key === 'startKeyin' ? 'start' : 'end',
          }
        : null,
    [focusRequest]
  );

  const handleBaseChange = useCallback(
    (next: FoxProRangePrintConditionValues) => {
      onChange({
        ...values,
        startKeyin: next.start,
        endKeyin: next.end,
      });
    },
    [onChange, values]
  );

  const handleBaseOpenF2 = useCallback(
    (target: FoxProRangeFieldKey) => {
      onOpenF2(target === 'start' ? 'startKeyin' : 'endKeyin');
    },
    [onOpenF2]
  );

  const focusYearInput = useCallback(() => {
    const el = yearInputRef.current;
    if (!el) return false;
    el.focus();
    foxProFocusAndSelect(el);
    return true;
  }, []);

  const validateBeforeAction = useCallback(() => {
    const msg = requireYear(values.year);
    if (msg) {
      return { text: msg, focus: () => void focusYearInput() };
    }
    return null;
  }, [focusYearInput, values.year]);

  return (
    <FoxProRangePrintConditionModal
      title="客戶登打統計表列印"
      subtitle="VFP wbase5030 ‧ wbasemenu05cmd03"
      badge="5-3 統計條件"
      overlay={false}
      summary={chosenSummary(chosenCount)}
      sectionTitle="登打人員範圍"
      sectionDescription="可輸入登打人員起始與終止編號，或點擊輸入框右側 F2 開窗選取"
      startLabel="登打人員起始編號"
      startHint="空白=第一位"
      startPlaceholder="空白=第一位"
      startEmptyHelper="未輸入（由第一位人員開始）"
      startDescription={startMatchedName ? `${startNorm} — ${startMatchedName}` : undefined}
      endLabel="登打人員終止編號"
      endHint="空白=最後一位"
      endPlaceholder="空白=最後一位"
      endEmptyHelper="未輸入（統計至最後一位人員）"
      endDescription={endMatchedName ? `${endNorm} — ${endMatchedName}` : undefined}
      maxLength={10}
      uppercase={true}
      rangeSummaryLabel="人員範圍："
      allRangeText="全部登打人員"
      fieldIdPrefix="wbase5030-print"
      f2Tooltip="按 F2 或點此開啟資料處理人員選單"
      values={baseValues}
      onChange={handleBaseChange}
      active={active}
      isSubmitting={isSubmitting}
      isExportBusy={isExportBusy}
      exportConfigure={exportConfigure}
      onExportConfigureChange={onExportConfigureChange}
      status={status}
      focusRequest={baseFocusRequest}
      onOpenF2={handleBaseOpenF2}
      onFocusExtra={focusYearInput}
      validateBeforeAction={validateBeforeAction}
      renderExtraContent={(nav) => (
        <div
          className={`rounded-xl p-4 sm:p-5 border shadow-xs space-y-3 transition-colors ${
            isDark ? 'bg-slate-800/85 border-slate-700' : 'bg-white border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b pb-2.5 border-slate-200/70 dark:border-slate-700/70">
            <div className="flex items-center gap-2 font-black text-sm sm:text-base">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className={isDark ? 'text-white' : 'text-slate-800'}>資料年度</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                isDark ? 'bg-blue-950/70 text-blue-300' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {yearTrim || '---'} 年度
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="wbase5030-print-year"
              className={`text-xs sm:text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
            >
              民國年度
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={yearInputRef}
                id="wbase5030-print-year"
                type="text"
                inputMode="numeric"
                maxLength={3}
                disabled={!active || isSubmitting || isExportBusy}
                value={values.year}
                onChange={(e) => {
                  nav.clearValidationError();
                  const nextYear = e.target.value.replace(/\D/g, '').slice(0, 3);
                  onChange({ ...values, year: nextYear });
                }}
                onFocus={(e) => foxProFocusAndSelect(e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    nav.focusNextAfterExtra();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    nav.focusRangeEnd();
                  }
                }}
                className={`w-28 px-3 py-2 text-sm font-mono font-bold text-center rounded-xl border-2 focus:outline-none transition ${
                  isDark
                    ? 'bg-slate-900 border-slate-600 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-amber-300/60'
                }`}
              />
              <span className={`text-xs sm:text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                年
              </span>
            </div>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              請輸入 3 碼民國年度 (例: 114)
            </span>
          </div>
        </div>
      )}
      onConfirm={onConfirm}
      onExport={onExport}
      onCancel={onCancel}
    />
  );
};

export default Wbase5030PrintConditionModal;
