import React, { useState } from 'react';
import {
  queryFinanceStatus,
  exportReportToXlsx,
  type FinanceStatusItem,
} from './services/wbase5010';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import { Wbase50ConditionForm, type ConditionFieldDef, type ConditionValues } from './Wbase50ConditionForm';
import { currentRocYear, isCustomerChosen, requireYear, useWbase50Customers } from './wbase50Shared';

interface Wbase5050FinanceStatusProps {
  onClose?: () => void;
}

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

const printColumns: FoxProPrintColumn<FinanceStatusItem>[] = [
  { key: 'no', label: '代號', width: '80px', align: 'center' },
  { key: 'name', label: '客戶名稱', width: '180px' },
  { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
  {
    key: 'capital',
    label: '資本額',
    width: '100px',
    align: 'right',
    render: (val) => (val ? Number(val).toLocaleString() : '-'),
  },
  { key: 'hname', label: '負責人', width: '80px' },
  { key: 'tel', label: '電話', width: '110px' },
  { key: 'addr', label: '地址', width: '260px' },
];

/** VFP wbase5050 (客戶起訖編號改由第一段選擇客戶決定)：列印結算年度 */
const FIELDS: ConditionFieldDef[] = [
  { kind: 'text', key: 'year', label: '列印結算年度：', maxLength: 3, digits: true, widthClass: 'w-20', validate: requireYear },
];

/**
 * 5-5 客戶財務狀況參考表 (VFP base50.prg wbasemenu05cmd05 → wbase5050)。
 * 第一段選擇客戶，第二段輸入列印結算年度，F7 查詢並開列印預覽。
 */
export const Wbase5050_FinanceStatus: React.FC<Wbase5050FinanceStatusProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<ConditionValues>(() => ({ year: currentRocYear() }));

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dataList, setDataList] = useState<FinanceStatusItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);
  const [printError, setPrintError] = useState('');

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const year = String(values.year).trim();

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const runQuery = async () => {
    setIsPrintLoading(true);
    setPrintError('');
    try {
      const list = await queryFinanceStatus({ year, selectedNos: chosenNos });
      setDataList(list);
    } catch (err) {
      setDataList([]);
      setPrintError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setIsPrintLoading(false);
    }
  };

  const openPrint = () => {
    setIsPrintModalOpen(true);
    void runQuery();
  };

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
        <Wbase50ConditionForm
          title="客戶財務狀況參考表列印"
          fields={FIELDS}
          values={values}
          onChange={setValues}
          chosenCount={chosenNos.length}
          active={!isPrintModalOpen}
          onPrint={openPrint}
          onCancel={() => onClose?.()}
        />
      )}

      <FoxProPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="5-5 客戶財務狀況參考表列印預覽"
        subtitle={`已選擇 ${chosenNos.length} 家客戶`}
        reportTitle={`客戶財務狀況參考表 (年度: ${year})`}
        reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  客戶: ${chosenNos.length} 家`}
        showFilter={false}
        startCodeValue=""
        onStartCodeChange={() => {}}
        endCodeValue=""
        onEndCodeChange={() => {}}
        onSearch={runQuery}
        data={dataList}
        columns={printColumns}
        loading={isPrintLoading}
        hasSearched={true}
        emptyText={printError ? `⚠️ 查詢失敗：${printError}` : '⚠️ 查無符合資料'}
        enableXlsxExport={true}
        xlsxFields={DEFAULT_FINANCE_XLSX_FIELDS}
        xlsxFileName={`客戶財務狀況參考表_${year}年度`}
        onExportXlsx={async (data, selectedFields) => {
          return await exportReportToXlsx(data, selectedFields, `客戶財務狀況參考表_${year}年度`);
        }}
      />
    </div>
  );
};
