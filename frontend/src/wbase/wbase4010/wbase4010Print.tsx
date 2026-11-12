import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccountItem } from '../../services/wbase4010';
import { getDeptDescription } from '../../services/wbase4010';
import { SearchModal, useFoxProPrintXlsxExport, type SearchItem } from '../../components/FoxProGrid';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import {
  ReportPreviewModal,
  type ReportExportType,
  type ReportPreviewColumn,
} from '../../components/ReportPreview';
import {
  Wbase4010PrintConditionModal,
  type AccountRangeFieldKey,
  type Wbase4010PrintConditionStatus,
  type Wbase4010PrintConditionValues,
} from './Wbase4010PrintConditionModal';

const ACCOUNT_PRINT_COLUMNS: ReportPreviewColumn<AccountItem>[] = [
  {
    key: 'serial',
    label: '序號',
    width: 64,
    align: 'center',
    formatText: (val, _, idx) => String(val || idx + 1),
  },
  {
    key: 'accno',
    label: '科目代號',
    width: 110,
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.accno}</span>,
    formatText: (val) => String(val || ''),
  },
  {
    key: 'accname',
    label: '科目名稱',
    width: 210,
    formatText: (val) => String(val || ''),
  },
  {
    key: 'dept',
    label: '科目明細',
    width: 120,
    render: (_, row) => <span>{getDeptDescription(row.dept)}</span>,
    formatText: (_, row) => getDeptDescription(row.dept) || '',
  },
  {
    key: 'taxcode',
    label: '稅額',
    width: 64,
    align: 'center',
    render: (_, row) => (
      <span className="font-bold text-amber-600">{row.taxcode?.trim() === '*' ? '*' : ''}</span>
    ),
    formatText: (_, row) => (row.taxcode?.trim() === '*' ? '*' : ''),
  },
  {
    key: 'accnamel',
    label: '長科目名稱',
    width: 260,
    formatText: (val) => String(val || ''),
  },
];

const ACCOUNT_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'serial', label: '序號', customTitle: '序號', selected: true },
  { key: 'accno', label: '科目代號', customTitle: '科目代號', selected: true },
  { key: 'accname', label: '科目名稱', customTitle: '科目名稱', selected: true },
  { key: 'dept', label: '科目明細', customTitle: '科目明細', selected: true },
  { key: 'taxcode', label: '稅額', customTitle: '稅額', selected: true },
  { key: 'accnamel', label: '長科目名稱', customTitle: '長科目名稱', selected: true },
  { key: 'engaccname', label: '英文名稱', customTitle: '英文名稱', selected: false },
  { key: 'clsaccno', label: '歸屬科目', customTitle: '歸屬科目', selected: false },
  { key: 'clsaccname', label: '歸屬名稱', customTitle: '歸屬名稱', selected: false },
];

const INITIAL_VALUES: Wbase4010PrintConditionValues = {
  startAccno: '',
  endAccno: '',
};

const normalizeAccno = (value: string): string => value.trim().toUpperCase();

interface Wbase4010PrintProps {
  isOpen: boolean;
  onClose: () => void;
  data: AccountItem[];
  modeTitle: string;
  showExport?: boolean;
  exportOptions?: ReportExportType[];
}

export const Wbase4010Print: React.FC<Wbase4010PrintProps> = ({
  isOpen,
  onClose,
  data,
  modeTitle,
  showExport = true,
  exportOptions = ['pdf', 'jpg', 'word'],
}) => {
  const [values, setValues] = useState<Wbase4010PrintConditionValues>(INITIAL_VALUES);
  const [activeFilter, setActiveFilter] = useState<Wbase4010PrintConditionValues>(INITIAL_VALUES);
  const [filteredData, setFilteredData] = useState<AccountItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [f2Target, setF2Target] = useState<AccountRangeFieldKey | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: AccountRangeFieldKey } | null>(null);
  const [status, setStatus] = useState<Wbase4010PrintConditionStatus | null>(null);

  const filterAccounts = useCallback(
    (range: Wbase4010PrintConditionValues): AccountItem[] => {
      const s = normalizeAccno(range.startAccno);
      const e = normalizeAccno(range.endAccno);
      return data.filter((item) => {
        const code = normalizeAccno(item.accno || '');
        if (s && code < s) return false;
        if (e && code > e) return false;
        return true;
      });
    },
    [data]
  );

  const xlsx = useFoxProPrintXlsxExport({
    storageKey: 'wbase4010_xlsx_export_config',
    fields: ACCOUNT_XLSX_FIELDS,
    fileName: () => `${modeTitle}_會計科目對照表`,
    load: async () => filterAccounts(values) as Array<AccountItem & Record<string, unknown>>,
  });
  const { setStatus: setXlsxStatus } = xlsx;

  useEffect(() => {
    if (isOpen) {
      setValues(INITIAL_VALUES);
      setActiveFilter(INITIAL_VALUES);
      setFilteredData([]);
      setIsPreviewOpen(false);
      setF2Target(null);
      setStatus(null);
      setXlsxStatus(null);
      setFocusRequest({ key: 'startAccno' });
    }
  }, [isOpen, setXlsxStatus]);

  const handleValuesChange = useCallback(
    (next: Wbase4010PrintConditionValues) => {
      setValues(next);
      setStatus(null);
      setXlsxStatus(null);
    },
    [setXlsxStatus]
  );

  const handleConfirmPrint = useCallback(() => {
    const normalized: Wbase4010PrintConditionValues = {
      startAccno: normalizeAccno(values.startAccno),
      endAccno: normalizeAccno(values.endAccno),
    };
    if (normalized.startAccno && normalized.endAccno && normalized.startAccno > normalized.endAccno) {
      setStatus({ type: 'error', text: '結束科目代號不可小於起始科目代號' });
      setFocusRequest({ key: 'endAccno' });
      return;
    }

    const result = filterAccounts(normalized);
    setActiveFilter(normalized);
    setFilteredData(result);
    setStatus(null);
    setXlsxStatus(null);
    setIsPreviewOpen(true);
  }, [filterAccounts, setXlsxStatus, values]);

  const handleRefreshPreview = useCallback(() => {
    setFilteredData(filterAccounts(activeFilter));
  }, [activeFilter, filterAccounts]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setFocusRequest({ key: 'startAccno' });
  }, []);

  const handleSearchAccount = useCallback(
    async (query: string): Promise<SearchItem[]> => {
      const q = query.trim().toLowerCase();
      return data
        .filter(
          (item) =>
            !q ||
            (item.accno || '').toLowerCase().includes(q) ||
            (item.accname || '').toLowerCase().includes(q) ||
            (item.accnamel || '').toLowerCase().includes(q)
        )
        .map((item) => ({
          code: item.accno,
          name: item.accname,
          spec: item.dept ? `明細:${getDeptDescription(item.dept)}` : undefined,
        }));
    },
    [data]
  );

  const handleSelectSearchItem = useCallback(
    (item: SearchItem) => {
      if (!f2Target) return;
      const target = f2Target;
      setValues((prev) => ({
        ...prev,
        [target]: item.code.trim().toUpperCase(),
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

  const rangeLabel = useMemo(() => {
    if (!activeFilter.startAccno && !activeFilter.endAccno) {
      return '全部';
    }
    return `${activeFilter.startAccno || '起'} ~ ${activeFilter.endAccno || '迄'}`;
  }, [activeFilter]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {!isPreviewOpen && (
        <Wbase4010PrintConditionModal
          modeTitle={modeTitle}
          values={values}
          onChange={handleValuesChange}
          rows={data}
          active={!isPreviewOpen && f2Target === null && !xlsx.busy && !xlsx.selectorOpen}
          isSubmitting={false}
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
          onCancel={onClose}
        />
      )}

      {xlsx.selectorElement}

      <SearchModal
        isOpen={f2Target !== null}
        title={f2Target === 'startAccno' ? `選擇起始會計科目 - ${modeTitle}` : `選擇結束會計科目 - ${modeTitle}`}
        onSearch={handleSearchAccount}
        onSelect={handleSelectSearchItem}
        onClose={handleCloseSearchModal}
      />

      <ReportPreviewModal<AccountItem>
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        reportId="wbase4010_account_list"
        companyName="奇勝資訊 Wx3000"
        reportTitle={`${modeTitle} - 會計科目對照表`}
        subHeaderLeft={`科目區間：${rangeLabel}　製表日期：${new Date().toLocaleDateString('zh-TW')}`}
        subHeaderCenter={modeTitle}
        data={filteredData}
        columns={ACCOUNT_PRINT_COLUMNS}
        getRowKey={(row, idx) => row.accno || idx}
        loading={false}
        emptyText="⚠️ 該區間內查無符合之會計科目資料"
        defaultOrientation="portrait"
        enableEdit={true}
        onRefresh={handleRefreshPreview}
        showExport={showExport}
        exportOptions={exportOptions}
        exportFileName={`${modeTitle}-會計科目對照表`}
      />
    </>
  );
};
