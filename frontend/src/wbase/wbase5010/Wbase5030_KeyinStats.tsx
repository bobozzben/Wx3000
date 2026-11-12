import React, { useState } from 'react';
import { queryKeyinStats, type KeyinStatsItem } from './services/wbase5010';
import {
  SearchModal,
  useFoxProPrintXlsxExport,
  currentRocYear,
  type SearchItem,
} from '../../components/FoxProGrid';
import { ReportPreviewModal, type ReportPreviewColumn } from '../../components/ReportPreview';
import { fetchEmps } from '../../services/wbase1030';
import { useTheme } from '../menu/ThemeContext';
import type { XlsxFieldItem } from '../../components/SelectXlsxField';
import { Wbase50CustomerSelect } from './Wbase50CustomerSelect';
import {
  Wbase5030PrintConditionModal,
  type KeyinRangeFieldKey,
  type Wbase5030PrintConditionStatus,
  type Wbase5030PrintConditionValues,
} from './Wbase5030PrintConditionModal';
import { isCustomerChosen, useWbase50Customers } from './wbase50Shared';

interface Wbase5030KeyinStatsProps {
  onClose?: () => void;
}

/** 匯出欄位設定 (第二段 F8 與列印條件共用) */
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

const printColumns: ReportPreviewColumn<KeyinStatsItem>[] = [
  { key: 'keyin', label: '人員代號', width: 80, align: 'center' },
  { key: 'keyinna', label: '人員姓名', width: 90 },
  { key: 'custNo', label: '客戶代號', width: 80, align: 'center' },
  { key: 'custName', label: '客戶名稱', width: 180 },
  { key: 'unino', label: '統一編號', width: 90, align: 'center' },
  { key: 'taxno', label: '稅籍編號', width: 95, align: 'center' },
  { key: 'tel', label: '電話', width: 110 },
  { key: 'addr', label: '地址', width: 260 },
];

/**
 * 5-3 客戶登打統計表 (VFP base50.prg wbasemenu05cmd03 → wbase5030)。
 * 第一段選擇客戶 (取代 VFP 的客戶起訖編號)，第二段顯示列印條件視窗 (繼承 FoxProRangePrintConditionModal)，
 * 按 F7 確定後才取資料並呼叫 ReportPreviewModal 預覽；F8 直接匯出 Excel。
 */
export const Wbase5030_KeyinStats: React.FC<Wbase5030KeyinStatsProps> = ({ onClose }) => {
  const { isDark } = useTheme();
  const { rows, setRows, loading, error } = useWbase50Customers();
  const [phase, setPhase] = useState<'select' | 'condition'>('select');
  const [values, setValues] = useState<Wbase5030PrintConditionValues>(() => ({
    startKeyin: '',
    endKeyin: '',
    year: currentRocYear(),
  }));
  const [keyinSearch, setKeyinSearch] = useState<KeyinRangeFieldKey | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: KeyinRangeFieldKey } | null>(null);

  const [isQuerying, setIsQuerying] = useState(false);
  const [queryStatus, setQueryStatus] = useState<Wbase5030PrintConditionStatus | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [dataList, setDataList] = useState<KeyinStatsItem[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  const chosenNos = rows.filter((r) => isCustomerChosen(r, 'select')).map((r) => r.no);
  const year = values.year.trim();
  const startKeyin = values.startKeyin.trim();
  const endKeyin = values.endKeyin.trim();
  const fileName = `客戶登打統計表_${year}年度`;

  const leaveSelect = () => {
    if (chosenNos.length === 0) onClose?.();
    else setPhase('condition');
  };

  const query = () =>
    queryKeyinStats({
      year,
      startKeyin: startKeyin || undefined,
      endKeyin: endKeyin || undefined,
      selectedNos: chosenNos,
    });

  const xlsx = useFoxProPrintXlsxExport({
    storageKey: XLSX_STORAGE_KEY,
    fields: DEFAULT_KEYIN_XLSX_FIELDS,
    fileName: () => fileName,
    load: query,
  });

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
        text: err instanceof Error ? err.message : '查詢登打統計資料失敗',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const refreshPreview = async () => {
    setIsPrintLoading(true);
    try {
      const list = await query();
      setDataList(list);
    } finally {
      setIsPrintLoading(false);
    }
  };

  const closeKeyinSearch = () => {
    const target = keyinSearch;
    setKeyinSearch(null);
    if (target) setFocusRequest({ key: target });
  };

  const activeStatus: Wbase5030PrintConditionStatus | null = isQuerying
    ? { type: 'info', text: '正在查詢登打統計資料...' }
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
          gridId="wbase5030_cust_grid"
          hint="選好要統計的客戶後按 Esc 離開，再輸入登打人員與資料年度 (沒有選擇任何客戶時直接回主選單)。"
          onExit={leaveSelect}
        />
      ) : (
        <Wbase5030PrintConditionModal
          values={values}
          onChange={(next) => {
            setQueryStatus(null);
            setValues(next);
          }}
          chosenCount={chosenNos.length}
          active={!isPrintModalOpen && keyinSearch === null && !isQuerying && !xlsx.busy && !xlsx.selectorOpen}
          isSubmitting={isQuerying}
          isExportBusy={xlsx.busy}
          exportConfigure={xlsx.configure}
          onExportConfigureChange={xlsx.setConfigure}
          status={activeStatus}
          focusRequest={focusRequest}
          onOpenF2={(target) => setKeyinSearch(target)}
          onConfirm={() => void openPrint()}
          onExport={() => {
            setQueryStatus(null);
            void xlsx.run();
          }}
          onCancel={() => onClose?.()}
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
          if (keyinSearch) {
            setQueryStatus(null);
            setValues((prev) => ({ ...prev, [keyinSearch]: item.code.toUpperCase() }));
          }
          closeKeyinSearch();
        }}
        onClose={closeKeyinSearch}
      />

      {xlsx.selectorElement}

      <ReportPreviewModal<KeyinStatsItem>
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportId="wbase5030_keyin_stats"
        companyName="奇勝資訊 Wx3000"
        reportTitle={`客戶登打統計表 (年度: ${year})`}
        subHeaderLeft={`製表日期：${new Date().toLocaleDateString('zh-TW')}　人員：${startKeyin || '全部'} ~ ${endKeyin || '全部'}`}
        subHeaderCenter={`已選擇 ${chosenNos.length} 家客戶`}
        data={dataList}
        columns={printColumns}
        getRowKey={(row, idx) => `${row.keyin}-${row.custNo}-${idx}`}
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
