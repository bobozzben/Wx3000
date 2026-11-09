import React, { useState } from 'react';
import { FileText, Layers, ListOrdered, MapPin } from 'lucide-react';
import {
  queryCustomerPrintData,
  exportReportToXlsx,
  type CustomerPrintItem,
} from './services/wbase5010';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import { useFoxProPrintXlsxExport } from '../../components/FoxProGrid/useFoxProPrintXlsxExport';
import { chosenSummary, isCustomerChosen, useWbase50Customers } from './wbase50Shared';
import { FoxProPrintModalv2, type PrintConditionSection, type PrintConditionValues } from '../../components/FoxProGrid/FoxProPrintModalv2';

interface Wbase5010CustomerPrintProps {
  onClose?: () => void;
}

/** 匯出欄位設定 (第二段 F8 與列印預覽共用) */
const XLSX_STORAGE_KEY = 'wbase5010_xlsx_export_config';

const DEFAULT_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '客戶代號', customTitle: '客戶代號', selected: true },
  { key: 'abbr', label: '客戶簡稱', customTitle: '簡稱', selected: true },
  { key: 'name', label: '客戶名稱', customTitle: '客戶全稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'hname', label: '負責人', customTitle: '負責人', selected: true },
  { key: 'linkman', label: '聯絡人', customTitle: '聯絡人', selected: true },
  { key: 'tel', label: '公司電話', customTitle: '電話', selected: true },
  { key: 'mobile', label: '行動電話', customTitle: '手機', selected: true },
  { key: 'fax', label: '傳真號碼', customTitle: '傳真', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '公司地址', selected: true },
  { key: 'invaddr', label: '聯絡地址', customTitle: '聯絡地址', selected: true },
  { key: 'email', label: '電子郵件', customTitle: 'E-mail', selected: true },
  { key: 'keyin', label: '登打人員代號', customTitle: '登打人員', selected: true },
  { key: 'keyinna', label: '登打人員姓名', customTitle: '人員姓名', selected: true },
  { key: 'organame', label: '組織型態', customTitle: '組織類別', selected: true },
  { key: 'pno', label: '行業代號', customTitle: '行業代號', selected: true },
  { key: 'capital', label: '資本額', customTitle: '資本額', selected: true },
];

/** VFP wbase2011 的四組選項 (依 TabIndex 順序：ordertype、mtype、opaddr、Optiongroup1) */
const SECTIONS: PrintConditionSection[] = [
  {
    title: '排列順序',
    icon: ListOrdered,
    fields: [
      {
        kind: 'options',
        key: 'orderType',
        label: '排列順序',
        options: [
          { value: 1, label: '依客戶編號' },
          { value: 2, label: '依統一編號' },
          { value: 3, label: '依稅籍編號' },
        ],
      },
    ],
  },
  {
    title: '報表種類',
    icon: FileText,
    fields: [
      {
        kind: 'options',
        key: 'reportType',
        label: '報表種類',
        options: [
          { value: 1, label: '基本資料' },
          { value: 2, label: '詳細資料' },
        ],
      },
    ],
  },
  {
    // VFP 第三個選項「公司.聯絡地址」隱藏且停用，只留兩個
    title: '列印地址',
    icon: MapPin,
    fields: [
      {
        kind: 'options',
        key: 'addrType',
        label: '列印地址',
        options: [
          { value: 1, label: '公司地址' },
          { value: 2, label: '聯絡地址' },
        ],
      },
    ],
  },
  {
    title: '分組排序',
    icon: Layers,
    fields: [
      {
        kind: 'options',
        key: 'groupType',
        label: '分組排序',
        options: [
          { value: 1, label: '依客戶編號排序' },
          { value: 2, label: '依登打人員排序' },
        ],
      },
    ],
  },
];

/**
 * 5-1 客戶資料列印 (VFP base50.prg wbasemenu05cmd01)。
 * 第一段選擇客戶 (wbase4000)，Esc 離開後有選擇才進入第二段列印條件 (wbase2011)，
 * F7 查詢並開列印預覽、F8 直接匯出 Excel。
 */
export const Wbase5010_CustomerPrint: React.FC<Wbase5010CustomerPrintProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<PrintConditionValues>({ orderType: 1, reportType: 1, addrType: 1, groupType: 1 });

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState<CustomerPrintItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);
  const [printError, setPrintError] = useState('');

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const reportType = Number(values.reportType);
  const addrType = Number(values.addrType);
  const orderType = Number(values.orderType);
  const kindLabel = reportType === 1 ? '基本' : '詳細';
  const fileName = `客戶資料清單_${kindLabel}`;

  /** VFP：tmpcust 刪除未選擇後沒有資料就直接回選單，不開 wbase2011 */
  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const query = () =>
    queryCustomerPrintData({
      reportType,
      addrType,
      groupType: Number(values.groupType),
      orderType,
      selectedNos: chosenNos,
    });

  const xlsx = useFoxProPrintXlsxExport({ storageKey: XLSX_STORAGE_KEY, fields: DEFAULT_XLSX_FIELDS, fileName: () => fileName, load: query });

  const runQuery = async () => {
    setIsPrintLoading(true);
    setPrintError('');
    try {
      setPrintData(await query());
    } catch (err) {
      setPrintData([]);
      setPrintError(err instanceof Error ? err.message : '查詢列印資料失敗');
    } finally {
      setIsPrintLoading(false);
    }
  };

  const openPrint = () => {
    xlsx.setStatus(null);
    setIsPrintModalOpen(true);
    void runQuery();
  };

  const printColumns: FoxProPrintColumn<CustomerPrintItem>[] = [
    { key: 'no', label: '代號', width: '70px', align: 'center' },
    { key: 'abbr', label: '簡稱', width: '90px' },
    { key: 'name', label: '客戶名稱', width: '180px' },
    { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
    { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
    { key: 'hname', label: '負責人', width: '80px' },
    { key: 'tel', label: '公司電話', width: '110px' },
    {
      key: 'addr',
      label: addrType === 2 ? '聯絡地址' : '公司地址',
      width: '260px',
      render: (_, r) => (addrType === 2 ? r.invaddr || r.addr : r.addr),
    },
    { key: 'keyinna', label: '登打人員', width: '90px' },
  ];

  return (
    <div className={`flex flex-col h-full font-mono select-none ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {phase === 'select' ? (
        <Wbase50CustomerSelect
          mode="select"
          rows={rows}
          onRowsChange={setRows}
          loading={loading}
          error={error}
          gridId="wbase5010_cust_grid"
          hint="選好要列印的客戶後按 Esc 離開，再設定列印條件 (沒有選擇任何客戶時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <FoxProPrintModalv2
          title="客戶資料列印"
          formCode="VFP wbase2011 ‧ wbasemenu05cmd01"
          sections={SECTIONS}
          values={values}
          onChange={setValues}
          summary={chosenSummary(chosenNos.length)}
          active={!isPrintModalOpen && !xlsx.busy && !xlsx.selectorOpen}
          onPrint={openPrint}
          onExport={() => void xlsx.run()}
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={xlsx.status}
          onCancel={() => onClose?.()}
        />
      )}

      {xlsx.selectorElement}

      {isPrintModalOpen && (
        <FoxProPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="5-1 客戶資料列印預覽"
          subtitle={`已選擇 ${chosenNos.length} 家客戶`}
          reportTitle={`客戶管理資料表 (${reportType === 1 ? '基本資料' : '詳細資料'})`}
          reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  排序: 依${orderType === 1 ? '客戶編號' : orderType === 2 ? '統一編號' : '稅籍編號'}`}
          showFilter={false}
          startCodeValue=""
          onStartCodeChange={() => {}}
          endCodeValue=""
          onEndCodeChange={() => {}}
          onSearch={runQuery}
          data={printData}
          columns={printColumns}
          loading={isPrintLoading}
          hasSearched={true}
          emptyText={printError ? `⚠️ 查詢列印資料失敗：${printError}` : '⚠️ 查無符合資料'}
          enableXlsxExport={true}
          xlsxFields={DEFAULT_XLSX_FIELDS}
          xlsxStorageKey={XLSX_STORAGE_KEY}
          xlsxFileName={fileName}
          onExportXlsx={async (data, selectedFields) => {
            return await exportReportToXlsx(data, selectedFields, fileName);
          }}
        />
      )}
    </div>
  );
};
