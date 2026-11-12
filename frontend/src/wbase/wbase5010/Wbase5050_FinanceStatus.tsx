import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  queryFinanceStatus,
  type FinanceStatusItem,
} from './services/wbase5010';
import { ReportPreviewModal, type ReportPreviewColumn } from '../../components/ReportPreview';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import {
  FoxProPrintModalv2,
  type PrintConditionSection,
  type PrintConditionStatus,
  type PrintConditionValues,
} from '../../components/FoxProGrid/FoxProPrintModalv2';
import { useFoxProPrintXlsxExport } from '../../components/FoxProGrid/useFoxProPrintXlsxExport';
import { currentRocYear, requireYear } from '../../components/FoxProGrid/foxProPrintValidators';
import { chosenSummary, isCustomerChosen, useWbase50Customers } from './wbase50Shared';

interface Wbase5050FinanceStatusProps {
  onClose?: () => void;
}

/** 匯出欄位設定 (第二段 F8 與列印預覽共用) */
const XLSX_STORAGE_KEY = 'wbase5050_xlsx_export_config';

const DEFAULT_FINANCE_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'capital', label: '資本額', customTitle: '資本額', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
  { key: 'year', label: '結算年度', customTitle: '年度', selected: true },
];

const printColumns: ReportPreviewColumn<FinanceStatusItem>[] = [
  { key: 'no', label: '代號', width: 80, align: 'center' },
  { key: 'name', label: '客戶名稱', width: 180 },
  { key: 'unino', label: '統一編號', width: 90, align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: 95, align: 'center' },
  {
    key: 'capital',
    label: '資本額',
    width: 100,
    align: 'right',
    render: (val) => (val ? Number(val).toLocaleString() : '-'),
    formatText: (val) => (val ? Number(val).toLocaleString() : '-'),
  },
  { key: 'hname', label: '負責人', width: 80 },
  { key: 'tel', label: '電話', width: 110 },
  { key: 'addr', label: '地址', width: 260 },
];

/**
 * 5-5 客戶財務狀況參考表 (VFP base50.prg wbasemenu05cmd05 → wbase5050)。
 * 第一段選擇客戶，第二段輸入列印結算年度，F7 查詢並開列印預覽、F8 直接匯出 Excel。
 */
export const Wbase5050_FinanceStatus: React.FC<Wbase5050FinanceStatusProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<PrintConditionValues>(() => ({ year: currentRocYear() }));

  const [isQuerying, setIsQuerying] = useState(false);
  const [queryStatus, setQueryStatus] = useState<PrintConditionStatus | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dataList, setDataList] = useState<FinanceStatusItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const year = String(values.year).trim();
  const fileName = `客戶財務狀況參考表_${year}年度`;

  /** VFP wbase5050 (客戶起訖編號改由第一段選擇客戶決定)：列印結算年度 */
  const sections: PrintConditionSection[] = [
    {
      title: '列印結算年度',
      icon: Calendar,
      badge: `${year || '---'} 年度`,
      fields: [{ kind: 'text', key: 'year', label: '列印結算年度', suffix: '年', maxLength: 3, digits: true, validate: requireYear }],
    },
  ];

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const query = () => queryFinanceStatus({ year, selectedNos: chosenNos });

  const xlsx = useFoxProPrintXlsxExport({ storageKey: XLSX_STORAGE_KEY, fields: DEFAULT_FINANCE_XLSX_FIELDS, fileName: () => fileName, load: query });

  const openPrint = async () => {
    xlsx.setStatus(null);
    setQueryStatus(null);
    setIsQuerying(true);
    try {
      const list = await query();
      setDataList(list);
      setIsPrintModalOpen(true);
    } catch (err) {
      setQueryStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '查詢財務狀況資料失敗',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const refreshPreview = async () => {
    setIsPrintLoading(true);
    try {
      setDataList(await query());
    } finally {
      setIsPrintLoading(false);
    }
  };

  const activeStatus: PrintConditionStatus | null = isQuerying
    ? { type: 'info', text: '正在查詢客戶財務狀況資料...' }
    : queryStatus ?? xlsx.status;

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {phase === 'select' ? (
        <Wbase50CustomerSelect
          mode="select"
          rows={rows}
          onRowsChange={setRows}
          loading={loading}
          error={error}
          gridId="wbase5050_cust_grid"
          hint="選好要列印的客戶後按 Esc 離開，再輸入列印結算年度 (沒有選擇任何客戶時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <FoxProPrintModalv2
          title="客戶財務狀況參考表列印"
          formCode="VFP wbase5050 ‧ wbasemenu05cmd05"
          sections={sections}
          values={values}
          onChange={(next) => {
            setQueryStatus(null);
            setValues(next);
          }}
          summary={chosenSummary(chosenNos.length)}
          active={!isPrintModalOpen && !isQuerying && !xlsx.busy && !xlsx.selectorOpen}
          onPrint={() => void openPrint()}
          onExport={() => {
            setQueryStatus(null);
            void xlsx.run();
          }}
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={activeStatus}
          onCancel={() => onClose?.()}
        />
      )}

      {xlsx.selectorElement}

      <ReportPreviewModal<FinanceStatusItem>
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportId="wbase5050_finance_status"
        companyName="奇勝資訊 Wx3000"
        reportTitle={`客戶財務狀況參考表 (年度: ${year})`}
        subHeaderLeft={`製表日期：${new Date().toLocaleDateString('zh-TW')}　客戶：${chosenNos.length} 家`}
        subHeaderCenter={`已選擇 ${chosenNos.length} 家客戶`}
        data={dataList}
        columns={printColumns}
        getRowKey={(row, idx) => row.no || idx}
        loading={isPrintLoading}
        emptyText="⚠️ 查無符合資料"
        defaultOrientation="landscape"
        enableEdit={true}
        onRefresh={refreshPreview}
        showExport={true}
        exportOptions={['pdf', 'jpg', 'word']}
        exportFileName={fileName}
      />
    </div>
  );
};
