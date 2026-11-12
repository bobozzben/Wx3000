import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  queryBusinessStatus,
  type BusinessStatusItem,
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
import { currentRocYear, requireYear, validEndMonth, validMonth } from '../../components/FoxProGrid/foxProPrintValidators';
import { chosenSummary, isCustomerChosen, useWbase50Customers } from './wbase50Shared';

interface Wbase5040BusinessStatusProps {
  onClose?: () => void;
}

/** 匯出欄位設定 (第二段 F8 與列印預覽共用) */
const XLSX_STORAGE_KEY = 'wbase5040_xlsx_export_config';

const DEFAULT_BUSINESS_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '代號', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
  { key: 'pno', label: '行業代號', customTitle: '行業代號', selected: true },
  { key: 'capital', label: '資本額', customTitle: '資本額', selected: true },
  { key: 'startMonth', label: '起始月', customTitle: '起月', selected: true },
  { key: 'endMonth', label: '結束月', customTitle: '迄月', selected: true },
];

const printColumns: ReportPreviewColumn<BusinessStatusItem>[] = [
  { key: 'no', label: '代號', width: 80, align: 'center' },
  { key: 'name', label: '客戶名稱', width: 180 },
  { key: 'unino', label: '統一編號', width: 90, align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: 95, align: 'center' },
  { key: 'hname', label: '負責人', width: 80 },
  { key: 'tel', label: '電話', width: 110 },
  { key: 'pno', label: '行業代碼', width: 85, align: 'center' },
  {
    key: 'capital',
    label: '資本額',
    width: 100,
    align: 'right',
    render: (val) => (val ? Number(val).toLocaleString() : '-'),
    formatText: (val) => (val ? Number(val).toLocaleString() : '-'),
  },
  { key: 'addr', label: '地址', width: 260 },
];

const pad2 = (v: string) => v.trim().padStart(2, '0');

/**
 * 5-4 客戶營業狀況表 (VFP base50.prg wbasemenu05cmd04 → wbase5040)。
 * 第一段選擇客戶，第二段輸入資料年度與營業月份區間，F7 查詢並開列印預覽、F8 直接匯出 Excel。
 */
export const Wbase5040_BusinessStatus: React.FC<Wbase5040BusinessStatusProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<PrintConditionValues>(() => ({ year: currentRocYear(), startMonth: '01', endMonth: '12' }));

  const [isQuerying, setIsQuerying] = useState(false);
  const [queryStatus, setQueryStatus] = useState<PrintConditionStatus | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dataList, setDataList] = useState<BusinessStatusItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const year = String(values.year).trim();
  const startMonth = pad2(String(values.startMonth));
  const endMonth = pad2(String(values.endMonth));
  const fileName = `客戶營業狀況統計表_${year}年_${startMonth}-${endMonth}月`;

  /** VFP wbase5040 (客戶起訖編號改由第一段選擇客戶決定)：資料年度、營業起始月份、結束月份 */
  const sections: PrintConditionSection[] = [
    {
      title: '資料年度與營業月份',
      icon: Calendar,
      badge: `${year || '---'}${startMonth}-${endMonth}`,
      fields: [
        { kind: 'text', key: 'year', label: '資料年度', suffix: '年', maxLength: 3, digits: true, validate: requireYear },
        { kind: 'text', key: 'startMonth', label: '營業起始月份', maxLength: 2, digits: true, widthClass: 'w-16', validate: validMonth },
        {
          kind: 'text',
          key: 'endMonth',
          label: '結束月份',
          prefix: '-',
          suffix: '月',
          maxLength: 2,
          digits: true,
          widthClass: 'w-16',
          validate: validEndMonth('startMonth'),
        },
      ],
    },
  ];

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const query = () => queryBusinessStatus({ year, startMonth, endMonth, selectedNos: chosenNos });

  const xlsx = useFoxProPrintXlsxExport({ storageKey: XLSX_STORAGE_KEY, fields: DEFAULT_BUSINESS_XLSX_FIELDS, fileName: () => fileName, load: query });

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
        text: err instanceof Error ? err.message : '查詢營業狀況資料失敗',
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
    ? { type: 'info', text: '正在查詢客戶營業狀況資料...' }
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
          gridId="wbase5040_cust_grid"
          hint="選好要列印的客戶後按 Esc 離開，再輸入資料年度與月份區間 (沒有選擇任何客戶時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <FoxProPrintModalv2
          title="客戶營業狀況統計表列印"
          formCode="VFP wbase5040 ‧ wbasemenu05cmd04"
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

      <ReportPreviewModal<BusinessStatusItem>
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportId="wbase5040_business_status"
        companyName="奇勝資訊 Wx3000"
        reportTitle={`客戶營業狀況統計表 (年度: ${year} 月份: ${startMonth} ~ ${endMonth})`}
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
