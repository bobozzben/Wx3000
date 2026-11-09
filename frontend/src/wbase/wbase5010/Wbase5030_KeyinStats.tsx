import React, { useState } from 'react';
import {
  queryKeyinStats,
  exportReportToXlsx,
  type KeyinStatsItem,
} from './services/wbase5010';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';
import { SearchModal, type SearchItem } from '../../components/FoxProGrid/SearchModal';
import { fetchEmps } from '../../services/wbase1030';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import { Wbase50ConditionForm, type ConditionFieldDef, type ConditionValues } from './Wbase50ConditionForm';
import { currentRocYear, isCustomerChosen, requireYear, useWbase50Customers, validEndCode } from './wbase50Shared';

interface Wbase5030KeyinStatsProps {
  onClose?: () => void;
}

const DEFAULT_KEYIN_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'keyin', label: '登打人員代號', customTitle: '人員代號', selected: true },
  { key: 'keyinna', label: '登打人員姓名', customTitle: '人員姓名', selected: true },
  { key: 'custNo', label: '客戶代號', customTitle: '客戶代號', selected: true },
  { key: 'custName', label: '客戶名稱', customTitle: '客戶名稱', selected: true },
  { key: 'unino', label: '統一編號', customTitle: '統一編號', selected: true },
  { key: 'taxno', label: '稅籍編號', customTitle: '稅籍編號', selected: true },
  { key: 'tel', label: '公司電話', customTitle: '電話', selected: true },
  { key: 'addr', label: '公司地址', customTitle: '地址', selected: true },
];

const printColumns: FoxProPrintColumn<KeyinStatsItem>[] = [
  { key: 'keyin', label: '人員代號', width: '80px', align: 'center' },
  { key: 'keyinna', label: '人員姓名', width: '90px' },
  { key: 'custNo', label: '客戶代號', width: '80px', align: 'center' },
  { key: 'custName', label: '客戶名稱', width: '180px' },
  { key: 'unino', label: '統一編號', width: '90px', align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: '95px', align: 'center' },
  { key: 'tel', label: '電話', width: '110px' },
  { key: 'addr', label: '地址', width: '260px' },
];

/**
 * 5-3 客戶登打統計表 (VFP base50.prg wbasemenu05cmd03 → wbase5030)。
 * 第一段選擇客戶 (取代 VFP 的客戶起訖編號)，第二段輸入登打人員起訖與資料年度，F7 查詢並開列印預覽。
 */
export const Wbase5030_KeyinStats: React.FC<Wbase5030KeyinStatsProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<ConditionValues>(() => ({ startKeyin: '', endKeyin: '', year: currentRocYear() }));
  const [keyinSearch, setKeyinSearch] = useState<'startKeyin' | 'endKeyin' | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: string } | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dataList, setDataList] = useState<KeyinStatsItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);
  const [printError, setPrintError] = useState('');

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const year = String(values.year).trim();
  const startKeyin = String(values.startKeyin).trim();
  const endKeyin = String(values.endKeyin).trim();

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const fields: ConditionFieldDef[] = [
    {
      kind: 'text',
      key: 'startKeyin',
      label: '登打人員起始編號：',
      maxLength: 10,
      uppercase: true,
      widthClass: 'w-32',
      placeholder: '空白=第一位',
      onF2: () => setKeyinSearch('startKeyin'),
    },
    {
      kind: 'text',
      key: 'endKeyin',
      label: '終止編號：',
      maxLength: 10,
      uppercase: true,
      widthClass: 'w-32',
      placeholder: '空白=最後一位',
      onF2: () => setKeyinSearch('endKeyin'),
      validate: validEndCode('startKeyin', '終止編號比起始編號小!'),
    },
    { kind: 'text', key: 'year', label: '資料年度：', maxLength: 3, digits: true, widthClass: 'w-20', validate: requireYear },
  ];

  const runQuery = async () => {
    setIsPrintLoading(true);
    setPrintError('');
    try {
      const list = await queryKeyinStats({
        year,
        startKeyin: startKeyin || undefined,
        endKeyin: endKeyin || undefined,
        selectedNos: chosenNos,
      });
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

  const closeKeyinSearch = () => {
    const target = keyinSearch;
    setKeyinSearch(null);
    if (target) setFocusRequest({ key: target });
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
          gridId="wbase5030_cust_grid"
          hint="選好要統計的客戶後按 Esc 離開，再輸入登打人員與資料年度 (沒有選擇任何客戶時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <Wbase50ConditionForm
          title="客戶登打統計表列印"
          fields={fields}
          values={values}
          onChange={setValues}
          chosenCount={chosenNos.length}
          active={!isPrintModalOpen && keyinSearch === null}
          onPrint={openPrint}
          onCancel={() => onClose?.()}
          focusRequest={focusRequest}
        />
      )}

      <SearchModal
        isOpen={keyinSearch !== null}
        title="資料處理人員選單"
        onSearch={async (query: string): Promise<SearchItem[]> => {
          const list = await fetchEmps(query.trim() || undefined);
          return list.map((e) => ({ code: e.no, name: e.name }));
        }}
        onSelect={(item) => {
          if (keyinSearch) setValues((prev) => ({ ...prev, [keyinSearch]: item.code.toUpperCase() }));
          closeKeyinSearch();
        }}
        onClose={closeKeyinSearch}
      />

      <FoxProPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="5-3 客戶登打統計表列印預覽"
        subtitle={`已選擇 ${chosenNos.length} 家客戶`}
        reportTitle={`客戶登打統計表 (年度: ${year})`}
        reportSubtitle={`製表日期: ${new Date().toLocaleDateString('zh-TW')}  人員: ${startKeyin || '全部'} ~ ${endKeyin || '全部'}`}
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
        xlsxFields={DEFAULT_KEYIN_XLSX_FIELDS}
        xlsxFileName={`客戶登打統計表_${year}年度`}
        onExportXlsx={async (data, selectedFields) => {
          return await exportReportToXlsx(data, selectedFields, `客戶登打統計表_${year}年度`);
        }}
      />
    </div>
  );
};
