import React, { useState } from 'react';
import { Calendar, UserCheck } from 'lucide-react';
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
import { Wbase50ConditionForm, type ConditionSection, type ConditionValues } from './Wbase50ConditionForm';
import {
  currentRocYear,
  isCustomerChosen,
  requireYear,
  useWbase50Customers,
  useWbase50XlsxExport,
  validEndCode,
} from './wbase50Shared';

interface Wbase5030KeyinStatsProps {
  onClose?: () => void;
}

/** 匯出欄位設定 (第二段 F8 與列印預覽共用) */
const XLSX_STORAGE_KEY = 'wbase5030_xlsx_export_config';

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
 * 第一段選擇客戶 (取代 VFP 的客戶起訖編號)，第二段輸入登打人員起訖與資料年度，
 * F7 查詢並開列印預覽、F8 直接匯出 Excel。
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
  const fileName = `客戶登打統計表_${year}年度`;

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const sections: ConditionSection[] = [
    {
      title: '登打人員範圍',
      icon: UserCheck,
      fields: [
        {
          kind: 'text',
          key: 'startKeyin',
          label: '登打人員起始編號',
          prefix: '起始',
          maxLength: 10,
          uppercase: true,
          widthClass: 'w-36',
          placeholder: '空白=第一位',
          onF2: () => setKeyinSearch('startKeyin'),
        },
        {
          kind: 'text',
          key: 'endKeyin',
          label: '登打人員終止編號',
          prefix: '~ 終止',
          maxLength: 10,
          uppercase: true,
          widthClass: 'w-36',
          placeholder: '空白=最後一位',
          onF2: () => setKeyinSearch('endKeyin'),
          validate: validEndCode('startKeyin', '終止編號比起始編號小!'),
        },
      ],
    },
    {
      title: '資料年度',
      icon: Calendar,
      badge: `${year || '---'} 年度`,
      fields: [{ kind: 'text', key: 'year', label: '資料年度', suffix: '年', maxLength: 3, digits: true, validate: requireYear }],
    },
  ];

  const query = () =>
    queryKeyinStats({
      year,
      startKeyin: startKeyin || undefined,
      endKeyin: endKeyin || undefined,
      selectedNos: chosenNos,
    });

  const xlsx = useWbase50XlsxExport({ storageKey: XLSX_STORAGE_KEY, fields: DEFAULT_KEYIN_XLSX_FIELDS, fileName: () => fileName, load: query });

  const runQuery = async () => {
    setIsPrintLoading(true);
    setPrintError('');
    try {
      setDataList(await query());
    } catch (err) {
      setDataList([]);
      setPrintError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setIsPrintLoading(false);
    }
  };

  const openPrint = () => {
    xlsx.setStatus(null);
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
          formCode="VFP wbase5030 ‧ wbasemenu05cmd03"
          sections={sections}
          values={values}
          onChange={setValues}
          chosenCount={chosenNos.length}
          active={!isPrintModalOpen && keyinSearch === null && !xlsx.busy && !xlsx.selectorOpen}
          onPrint={openPrint}
          onExport={() => void xlsx.run()}
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={xlsx.status}
          onCancel={() => onClose?.()}
          focusRequest={focusRequest}
        />
      )}

      <SearchModal
        isOpen={keyinSearch !== null}
        title="資料處理人員選單"
        onSearch={async (q: string): Promise<SearchItem[]> => {
          const list = await fetchEmps(q.trim() || undefined);
          return list.map((e) => ({ code: e.no, name: e.name }));
        }}
        onSelect={(item) => {
          if (keyinSearch) setValues((prev) => ({ ...prev, [keyinSearch]: item.code.toUpperCase() }));
          closeKeyinSearch();
        }}
        onClose={closeKeyinSearch}
      />

      {xlsx.selectorElement}

      {isPrintModalOpen && (
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
