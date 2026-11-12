import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWbase1020 } from './useWbase1020';
import { getCpaList, type CpaItem, type CpaPrintFilter } from '../../services/wbase1020';
import { SearchModal, useFoxProPrintXlsxExport, type SearchItem } from '../../components/FoxProGrid';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import {
  Wbase1020PrintConditionModal,
  type CpaRangeFieldKey,
  type Wbase1020PrintConditionStatus,
  type Wbase1020PrintConditionValues,
} from './Wbase1020PrintConditionModal';
import {
  ReportPreviewModal,
  type ReportDrillDownContext,
  type ReportExportType,
  type ReportPreviewColumn,
} from '../../components/ReportPreview';

export interface Wbase1020PrintProps {
  /** 是否顯示「匯出」按鈕 (預設 true) */
  showExport?: boolean;
  /** 決定「匯出」下拉框顯示哪些項目 (預設 ['pdf', 'jpg', 'word']) */
  exportOptions?: ReportExportType[];
  /** 自訂報表追追追（雙擊列資料）處理；未傳入時預設跳轉回會計師/記帳士維護畫面進行編修 */
  onRowDrillDown?: (context: ReportDrillDownContext<CpaItem>) => void;
}

/**
 * 基本會計師/記帳士名冊清冊列印欄位定義
 */
const CPA_PRINT_COLUMNS: ReportPreviewColumn<CpaItem>[] = [
  {
    key: 'cpaCode',
    label: '代號',
    width: 65,
    className: 'font-bold font-mono',
    formatText: (val) => String(val ?? ''),
  },
  {
    key: 'certType',
    label: '證書別',
    width: 65,
    align: 'center',
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'cpaName',
    label: '姓名',
    width: 95,
    className: 'font-semibold',
    formatText: (val) => String(val ?? ''),
  },
  {
    key: 'taxId',
    label: '申報ID',
    width: 95,
    className: 'font-mono',
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'tel',
    label: '電話',
    width: 110,
    className: 'font-mono',
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'mobile',
    label: '手機',
    width: 105,
    className: 'font-mono',
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'unifiedNo',
    label: '統一編號',
    width: 85,
    className: 'font-mono',
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'address',
    label: '地址',
    width: 195,
    formatText: (val) => String(val || '-'),
  },
  {
    key: 'guildNo1',
    label: '公會名稱',
    width: 110,
    formatText: (val) => String(val || '-'),
  },
];

/**
 * 會計師/記帳士名冊 XLSX 候選匯出欄位清單 (供 FormUtilSelectXlsxFieldsList 選擇)
 */
const CPA_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'cpaCode', label: '代號', customTitle: '代號', selected: true },
  { key: 'certType', label: '證書別', customTitle: '證書別', selected: true },
  { key: 'cpaName', label: '姓名', customTitle: '姓名', selected: true },
  { key: 'taxId', label: '申報ID', customTitle: '申報ID', selected: true },
  { key: 'licenseNo', label: '證書年度或國稅別', customTitle: '證書年度或國稅別', selected: true },
  { key: 'docTrack', label: '發文字軌', customTitle: '發文字軌', selected: true },
  { key: 'certNo', label: '證書編號', customTitle: '證書編號', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'mobile', label: '手機', customTitle: '手機', selected: true },
  { key: 'fax', label: '傳真', customTitle: '傳真', selected: true },
  { key: 'unifiedNo', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'address', label: '地址', customTitle: '地址', selected: true },
  { key: 'guildNo1', label: '公會名稱', customTitle: '公會名稱', selected: true },
  { key: 'memberNo', label: '會員證號', customTitle: '會員證號', selected: true },
  { key: 'email', label: 'E-MAIL', customTitle: 'E-MAIL', selected: true },
  { key: 'officeName', label: '事務所名稱', customTitle: '事務所名稱', selected: false },
  { key: 'memo', label: '備註', customTitle: '備註', selected: false },
];

const CPA_XLSX_STORAGE_KEY = 'wbase1020_xlsx_export_config';
const CPA_XLSX_FILE_NAME = '會計師記帳士清冊';

/**
 * Wbase1020Print (會計師/記帳士清冊列印)
 * 呼叫共用報表預覽及列印模組 ReportPreviewModal，
 * 支援調整欄寬/列高、顯示比例縮放、編修預覽內容、更新重抓資料、匯出 PDF/JPG/WORD、雙擊列報表追追追與條件畫面「匯出 xlsx 設定」。
 */
const INITIAL_CONDITION_VALUES: Wbase1020PrintConditionValues = {
  cpaCodeStart: '',
  cpaCodeEnd: '',
};

const normalizeCode = (value: unknown): string => String(value ?? '').trim().toUpperCase();

const toFilter = (values: Wbase1020PrintConditionValues): CpaPrintFilter => ({
  cpaCodeStart: normalizeCode(values.cpaCodeStart),
  cpaCodeEnd: normalizeCode(values.cpaCodeEnd),
});

export const Wbase1020Print: React.FC<Wbase1020PrintProps> = ({
  showExport = true,
  exportOptions = ['pdf', 'jpg', 'word'],
  onRowDrillDown,
}) => {
  const {
    rows,
    isPrintOpen,
    closePrint,
    fetchPrintData,
    printData,
    loading,
    selectRowFromSearch,
    startEdit,
  } = useWbase1020();

  const [values, setValues] = useState<Wbase1020PrintConditionValues>(INITIAL_CONDITION_VALUES);
  const [activeFilter, setActiveFilter] = useState<CpaPrintFilter>({ cpaCodeStart: '', cpaCodeEnd: '' });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [f2Target, setF2Target] = useState<CpaRangeFieldKey | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: CpaRangeFieldKey } | null>(null);
  const [status, setStatus] = useState<Wbase1020PrintConditionStatus | null>(null);

  const xlsx = useFoxProPrintXlsxExport({
    storageKey: CPA_XLSX_STORAGE_KEY,
    fields: CPA_XLSX_FIELDS,
    fileName: () => CPA_XLSX_FILE_NAME,
    load: async () => {
      const data = await fetchPrintData(toFilter(values));
      return data as Array<CpaItem & Record<string, unknown>>;
    },
  });
  const { setStatus: setXlsxStatus } = xlsx;

  useEffect(() => {
    if (isPrintOpen) {
      setValues(INITIAL_CONDITION_VALUES);
      setActiveFilter({ cpaCodeStart: '', cpaCodeEnd: '' });
      setIsPreviewOpen(false);
      setIsSubmitting(false);
      setF2Target(null);
      setStatus(null);
      setXlsxStatus(null);
      setFocusRequest({ key: 'cpaCodeStart' });
    }
  }, [isPrintOpen, setXlsxStatus]);

  const handleValuesChange = useCallback(
    (next: Wbase1020PrintConditionValues) => {
      setValues(next);
      setStatus(null);
      setXlsxStatus(null);
    },
    [setXlsxStatus]
  );

  const handleConfirmPrint = useCallback(async () => {
    const filter = toFilter(values);
    if (filter.cpaCodeStart && filter.cpaCodeEnd && filter.cpaCodeStart > filter.cpaCodeEnd) {
      setStatus({ type: 'error', text: '結束編號不可小於起始編號' });
      setFocusRequest({ key: 'cpaCodeEnd' });
      return;
    }

    setIsSubmitting(true);
    setXlsxStatus(null);
    setStatus({ type: 'info', text: '正在查詢符合條件之資料...' });
    try {
      await fetchPrintData(filter);
      setActiveFilter(filter);
      setStatus(null);
      setIsPreviewOpen(true);
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '取得列印資料失敗，請重試',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchPrintData, setXlsxStatus, values]);

  const handleRefreshPreview = useCallback(async () => {
    await fetchPrintData(activeFilter);
  }, [activeFilter, fetchPrintData]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setFocusRequest({ key: 'cpaCodeStart' });
  }, []);

  const handleSearchCpa = useCallback(
    async (query: string): Promise<SearchItem[]> => {
      const q = query.trim().toLowerCase();
      const source = rows.length > 0 ? rows : await getCpaList(query);
      return source
        .filter(
          (item) =>
            !q ||
            item.cpaCode.toLowerCase().includes(q) ||
            item.cpaName.toLowerCase().includes(q) ||
            (item.unifiedNo ?? '').toLowerCase().includes(q)
        )
        .map((item) => ({
          code: item.cpaCode,
          name: item.cpaName,
          spec: item.unifiedNo ? `統編: ${item.unifiedNo}` : undefined,
        }));
    },
    [rows]
  );

  const handleSelectSearchItem = useCallback(
    (item: SearchItem) => {
      if (!f2Target) return;
      const target = f2Target;
      setValues((prev) => ({
        ...prev,
        [target]: item.code.toUpperCase(),
      }));
      setF2Target(null);
      setStatus(null);
      setXlsxStatus(null);
      setFocusRequest({ key: target });
    },
    [f2Target, setXlsxStatus]
  );

  const handleCloseSearchModal = useCallback(() => {
    const target = f2Target;
    setF2Target(null);
    if (target) {
      setFocusRequest({ key: target });
    }
  }, [f2Target]);

  const handleDrillDown = (ctx: ReportDrillDownContext<CpaItem>) => {
    if (onRowDrillDown) {
      onRowDrillDown(ctx);
      return;
    }
    // 預設報表追追追：關閉預覽與列印條件並帶入該筆會計師/記帳士進入編修表單
    if (ctx.row?.cpaCode) {
      selectRowFromSearch(ctx.row.cpaCode);
      setIsPreviewOpen(false);
      closePrint();
      startEdit();
    }
  };

  const rangeLabel = useMemo(() => {
    if (!activeFilter.cpaCodeStart && !activeFilter.cpaCodeEnd) {
      return '全部';
    }
    return `${activeFilter.cpaCodeStart || '起'} ~ ${activeFilter.cpaCodeEnd || '迄'}`;
  }, [activeFilter]);

  if (!isPrintOpen) {
    return null;
  }

  return (
    <>
      {!isPreviewOpen && (
        <Wbase1020PrintConditionModal
          values={values}
          onChange={handleValuesChange}
          rows={rows}
          active={!isPreviewOpen && f2Target === null && !isSubmitting && !xlsx.busy && !xlsx.selectorOpen}
          isSubmitting={isSubmitting}
          isExportBusy={xlsx.busy}
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={status ?? xlsx.status}
          focusRequest={focusRequest}
          onOpenF2={setF2Target}
          onConfirm={handleConfirmPrint}
          onExport={() => {
            setStatus(null);
            void xlsx.run();
          }}
          onCancel={closePrint}
        />
      )}

      {xlsx.selectorElement}

      <SearchModal
        isOpen={f2Target !== null}
        title={f2Target === 'cpaCodeStart' ? '選擇起始會計師/記帳士編號' : '選擇結束會計師/記帳士編號'}
        onSearch={handleSearchCpa}
        onSelect={handleSelectSearchItem}
        onClose={handleCloseSearchModal}
      />

      <ReportPreviewModal<CpaItem>
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        reportId="wbase1020_cpa_list"
        companyName="奇勝資訊 Wx3000"
        reportTitle="基本會計師/記帳士名冊清冊"
        subHeaderLeft={`編號區間：${rangeLabel}　製表日期：${new Date().toLocaleDateString('zh-TW')}`}
        subHeaderCenter="會計師/記帳士清冊"
        data={printData}
        columns={CPA_PRINT_COLUMNS}
        getRowKey={(row) => row.cpaCode}
        loading={loading || isSubmitting}
        emptyText="⚠️ 指定編號區間查無會計師/記帳士資料"
        defaultOrientation="landscape"
        enableEdit={true}
        onRefresh={handleRefreshPreview}
        showExport={showExport}
        exportOptions={exportOptions}
        exportFileName="會計師記帳士清冊"
        onRowDrillDown={handleDrillDown}
      />
    </>
  );
};
