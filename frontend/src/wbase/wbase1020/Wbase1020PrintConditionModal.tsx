import React, { useCallback, useMemo } from 'react';
import {
  FoxProRangePrintConditionModal,
  type FoxProRangeFieldKey,
  type FoxProRangePrintConditionStatus,
  type FoxProRangePrintConditionValues,
} from '../../components/FoxProGrid';
import type { CpaItem } from '../../services/wbase1020';

export type CpaRangeFieldKey = 'cpaCodeStart' | 'cpaCodeEnd';

export interface Wbase1020PrintConditionValues {
  cpaCodeStart: string;
  cpaCodeEnd: string;
}

export type Wbase1020PrintConditionStatus = FoxProRangePrintConditionStatus;

export interface Wbase1020PrintConditionModalProps {
  values: Wbase1020PrintConditionValues;
  onChange: (next: Wbase1020PrintConditionValues) => void;
  rows: CpaItem[];
  active: boolean;
  isSubmitting: boolean;
  isExportBusy?: boolean;
  exportConfigure: boolean;
  onExportConfigureChange: (checked: boolean) => void;
  status: Wbase1020PrintConditionStatus | null;
  focusRequest: { key: CpaRangeFieldKey } | null;
  onOpenF2: (target: CpaRangeFieldKey) => void;
  onConfirm: () => void;
  onExport: () => void;
  onCancel: () => void;
}

const normalizeCode = (value: string): string => value.trim().toUpperCase();

/**
 * 會計師/記帳士清冊列印條件視窗 (WBASE1020P)
 * 繼承共用母版 FoxProRangePrintConditionModal，擴充會計師/記帳士編號區間名稱對照與預估符合筆數提示。
 */
export const Wbase1020PrintConditionModal: React.FC<Wbase1020PrintConditionModalProps> = ({
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
  const startNorm = normalizeCode(values.cpaCodeStart);
  const endNorm = normalizeCode(values.cpaCodeEnd);

  // 對應載入資料中的會計師/記帳士名稱預覽與符合筆數估算
  const codeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const code = normalizeCode(row.cpaCode);
      if (code) {
        map.set(code, row.cpaName || '');
      }
    }
    return map;
  }, [rows]);

  const matchedPreviewCount = useMemo(() => {
    if (rows.length === 0 || (startNorm && endNorm && startNorm > endNorm)) {
      return null;
    }
    return rows.filter((row) => {
      const code = normalizeCode(row.cpaCode);
      if (startNorm && code < startNorm) return false;
      if (endNorm && code > endNorm) return false;
      return true;
    }).length;
  }, [rows, startNorm, endNorm]);

  const startMatchedName = startNorm ? codeNameMap.get(startNorm) : undefined;
  const endMatchedName = endNorm ? codeNameMap.get(endNorm) : undefined;

  const baseValues = useMemo<FoxProRangePrintConditionValues>(
    () => ({
      start: values.cpaCodeStart,
      end: values.cpaCodeEnd,
    }),
    [values.cpaCodeStart, values.cpaCodeEnd]
  );

  const baseFocusRequest = useMemo<{ key: FoxProRangeFieldKey } | null>(
    () =>
      focusRequest
        ? {
            key: focusRequest.key === 'cpaCodeStart' ? 'start' : 'end',
          }
        : null,
    [focusRequest]
  );

  const handleBaseChange = useCallback(
    (next: FoxProRangePrintConditionValues) => {
      onChange({
        cpaCodeStart: next.start,
        cpaCodeEnd: next.end,
      });
    },
    [onChange]
  );

  const handleBaseOpenF2 = useCallback(
    (target: FoxProRangeFieldKey) => {
      onOpenF2(target === 'start' ? 'cpaCodeStart' : 'cpaCodeEnd');
    },
    [onOpenF2]
  );

  return (
    <FoxProRangePrintConditionModal
      title="會計師 / 記帳士清冊列印"
      subtitle="WBASE1020P ‧ 編號區間設定"
      badge="F7 列印條件"
      sectionTitle="列印編號區間"
      sectionDescription="可輸入起始與結束代號，或點擊輸入框右側 F2 開窗選取"
      startLabel="起始編號"
      startHint="空白從頭"
      startPlaceholder="例如：01"
      startEmptyHelper="未輸入（由第一筆開始）"
      startDescription={startMatchedName ? `${startNorm} — ${startMatchedName}` : undefined}
      endLabel="結束編號"
      endHint="空白至尾"
      endPlaceholder="例如：99"
      endEmptyHelper="未輸入（列印至最後一筆）"
      endDescription={endMatchedName ? `${endNorm} — ${endMatchedName}` : undefined}
      maxLength={10}
      uppercase={true}
      rangeSummaryLabel="列印範圍："
      allRangeText="全部會計師 / 記帳士資料"
      matchedCountText={matchedPreviewCount !== null ? `目前清冊符合：${matchedPreviewCount} 筆` : null}
      fieldIdPrefix="wbase1020-print"
      f2Tooltip="按 F2 或點此開啟會計師/記帳士搜尋清單"
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

export default Wbase1020PrintConditionModal;
