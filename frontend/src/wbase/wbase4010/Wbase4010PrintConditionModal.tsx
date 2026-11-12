import React, { useCallback, useMemo } from 'react';
import {
  FoxProRangePrintConditionModal,
  type FoxProRangeFieldKey,
  type FoxProRangePrintConditionStatus,
  type FoxProRangePrintConditionValues,
} from '../../components/FoxProGrid';
import type { AccountItem } from '../../services/wbase4010';

export type AccountRangeFieldKey = 'startAccno' | 'endAccno';

export interface Wbase4010PrintConditionValues {
  startAccno: string;
  endAccno: string;
}

export type Wbase4010PrintConditionStatus = FoxProRangePrintConditionStatus;

export interface Wbase4010PrintConditionModalProps {
  modeTitle: string;
  values: Wbase4010PrintConditionValues;
  onChange: (next: Wbase4010PrintConditionValues) => void;
  rows: AccountItem[];
  active: boolean;
  isSubmitting: boolean;
  isExportBusy?: boolean;
  exportConfigure: boolean;
  onExportConfigureChange: (checked: boolean) => void;
  status: Wbase4010PrintConditionStatus | null;
  focusRequest: { key: AccountRangeFieldKey } | null;
  onOpenF2: (target: AccountRangeFieldKey) => void;
  onConfirm: () => void;
  onExport: () => void;
  onCancel: () => void;
}

const normalizeAccno = (value: string): string => value.trim().toUpperCase();

/**
 * 會計科目對照表列印條件視窗 (WBASE4010P)
 * 繼承共用母版 FoxProRangePrintConditionModal，提供起始/結束科目代號輸入、右側 F2 科目選單與「匯出 xlsx 設定」。
 */
export const Wbase4010PrintConditionModal: React.FC<Wbase4010PrintConditionModalProps> = ({
  modeTitle,
  values,
  onChange,
  rows,
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
  const startNorm = normalizeAccno(values.startAccno);
  const endNorm = normalizeAccno(values.endAccno);

  const accnoNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const code = normalizeAccno(row.accno || '');
      if (code) {
        map.set(code, row.accname || '');
      }
    }
    return map;
  }, [rows]);

  const matchedPreviewCount = useMemo(() => {
    if (rows.length === 0 || (startNorm && endNorm && startNorm > endNorm)) {
      return null;
    }
    return rows.filter((row) => {
      const code = normalizeAccno(row.accno || '');
      if (startNorm && code < startNorm) return false;
      if (endNorm && code > endNorm) return false;
      return true;
    }).length;
  }, [rows, startNorm, endNorm]);

  const startMatchedName = startNorm ? accnoNameMap.get(startNorm) : undefined;
  const endMatchedName = endNorm ? accnoNameMap.get(endNorm) : undefined;

  const baseValues = useMemo<FoxProRangePrintConditionValues>(
    () => ({
      start: values.startAccno,
      end: values.endAccno,
    }),
    [values.startAccno, values.endAccno]
  );

  const baseFocusRequest = useMemo<{ key: FoxProRangeFieldKey } | null>(
    () =>
      focusRequest
        ? {
            key: focusRequest.key === 'startAccno' ? 'start' : 'end',
          }
        : null,
    [focusRequest]
  );

  const handleBaseChange = useCallback(
    (next: FoxProRangePrintConditionValues) => {
      onChange({
        startAccno: next.start,
        endAccno: next.end,
      });
    },
    [onChange]
  );

  const handleBaseOpenF2 = useCallback(
    (target: FoxProRangeFieldKey) => {
      onOpenF2(target === 'start' ? 'startAccno' : 'endAccno');
    },
    [onOpenF2]
  );

  return (
    <FoxProRangePrintConditionModal
      title={`會計科目清冊列印 - ${modeTitle}`}
      subtitle="WBASE4010P ‧ 會計科目區間設定"
      badge="F7 列印條件"
      sectionTitle="會計科目區間"
      sectionDescription="可輸入起始與結束科目代號，或點擊輸入框右側 F2 開窗選取"
      startLabel="起始科目代號"
      startHint="空白從頭"
      startPlaceholder="例如：1101"
      startEmptyHelper="未輸入（由第一個科目開始）"
      startDescription={startMatchedName ? `${startNorm} — ${startMatchedName}` : undefined}
      endLabel="結束科目代號"
      endHint="空白至尾"
      endPlaceholder="例如：9999"
      endEmptyHelper="未輸入（列印至最後一個科目）"
      endDescription={endMatchedName ? `${endNorm} — ${endMatchedName}` : undefined}
      maxLength={12}
      uppercase={true}
      rangeSummaryLabel="列印範圍："
      allRangeText="全部會計科目"
      matchedCountText={matchedPreviewCount !== null ? `目前清冊符合：${matchedPreviewCount} 筆` : null}
      fieldIdPrefix="wbase4010-print"
      f2Tooltip="按 F2 或點此開啟會計科目搜尋清單"
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
      onConfirm={onConfirm}
      onExport={onExport}
      onCancel={onCancel}
    />
  );
};

export default Wbase4010PrintConditionModal;
