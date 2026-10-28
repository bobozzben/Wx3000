import React, { useState, useEffect } from 'react';
import { useWbase1020 } from './useWbase1020';
import type { CpaItem, CpaPrintFilter } from '../../services/wbase1020';
import {
  FoxProPrintModal,
  type FoxProPrintColumn,
  type XlsxFieldItem,
} from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 基本會計師/記帳士名冊清冊列印欄位定義
 */
const CPA_PRINT_COLUMNS: FoxProPrintColumn<CpaItem>[] = [
  {
    key: 'cpaCode',
    label: '代號',
    width: '8%',
    className: 'font-bold font-mono',
    render: (val) => <span className="font-bold">{val}</span>,
  },
  {
    key: 'certType',
    label: '證書別',
    width: '8%',
    align: 'center',
    render: (val) => val || '-',
  },
  {
    key: 'cpaName',
    label: '姓名',
    width: '12%',
    render: (val) => <span className="font-semibold">{val}</span>,
  },
  {
    key: 'taxId',
    label: '申報ID',
    width: '10%',
    render: (val) => val || '-',
  },
  {
    key: 'tel',
    label: '電話',
    width: '12%',
    render: (val) => val || '-',
  },
  {
    key: 'mobile',
    label: '手機',
    width: '12%',
    render: (val) => val || '-',
  },
  {
    key: 'unifiedNo',
    label: '統一編號',
    width: '10%',
    render: (val) => val || '-',
  },
  {
    key: 'address',
    label: '地址',
    width: '18%',
    render: (val) => val || '-',
  },
  {
    key: 'guildNo1',
    label: '公會名稱',
    width: '10%',
    render: (val) => val || '-',
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

/**
 * Wbase1020Print (會計師/記帳士清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備與 wbase1030Print 一致的高對比現代化 UI、
 * 條件篩選、網頁直接列印（不印出輸入框與按鈕）與「匯出 xlsx 設定」欄位自訂匯出功能。
 */
export const Wbase1020Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintData, printData, loading } = useWbase1020();
  const [filter, setFilter] = useState<CpaPrintFilter>({
    cpaCodeStart: '',
    cpaCodeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽開窗時，預設自動載入所有會計師名冊
  useEffect(() => {
    if (isPrintOpen && !hasSearched) {
      handleSearch();
    }
  }, [isPrintOpen]);

  const handleSearch = async () => {
    await fetchPrintData(filter);
    setHasSearched(true);
  };

  return (
    <FoxProPrintModal<CpaItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="會計師/記帳士清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="基本會計師名冊清冊"
      maxWidth="max-w-5xl"
      startCodeLabel="起始會計師代號："
      startCodePlaceholder="例如: C001 (留空代表從頭)"
      startCodeValue={filter.cpaCodeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, cpaCodeStart: val }))}
      endCodeLabel="結束會計師代號："
      endCodePlaceholder="例如: C999 (留空代表至尾)"
      endCodeValue={filter.cpaCodeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, cpaCodeEnd: val }))}
      onSearch={handleSearch}
      data={printData}
      columns={CPA_PRINT_COLUMNS}
      getRowKey={(row) => row.cpaCode}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無會計師資料"
      xlsxStorageKey="wbase1020_xlsx_export_config"
      xlsxFields={CPA_XLSX_FIELDS}
      xlsxFileName="會計師記帳士清冊"
    />
  );
};
