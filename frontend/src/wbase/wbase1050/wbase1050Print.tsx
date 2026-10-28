import React, { useState, useEffect } from 'react';
import { useWbase1050 } from './useWbase1050';
import type { TaxOfficerItem, TaxOfficerPrintFilter } from '../../services/wbase1050';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 稅務人員清冊總表列印欄位定義
 */
const TAXNO_PRINT_COLUMNS: FoxProPrintColumn<TaxOfficerItem>[] = [
  {
    key: 'no',
    label: '代號',
    width: '10%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.no || row.taxCode}</span>,
  },
  {
    key: 'name',
    label: '姓名',
    width: '14%',
    render: (_, row) => <span className="font-semibold">{row.name || row.taxName}</span>,
  },
  {
    key: 'department',
    label: '單位',
    width: '16%',
    render: (_, row) => row.department || row.unit || '-',
  },
  {
    key: 'tel',
    label: '電話',
    width: '14%',
    render: (_, row) => row.tel || '-',
  },
  {
    key: 'helpman',
    label: '助理人員',
    width: '14%',
    render: (_, row) => row.helpman || row.taxBureau || '-',
  },
  {
    key: 'addr',
    label: '住址',
    width: '20%',
    render: (_, row) => row.addr || row.address || '-',
  },
  {
    key: 'memo',
    label: '備註',
    width: '12%',
    render: (_, row) => row.memo || '-',
  },
];

/**
 * Wbase1050Print (稅務人員資料清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選與網頁直接列印（排除所有輸入框與按鈕）。
 */
export const Wbase1050Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintData, printData, loading } =
    useWbase1050();

  const [filter, setFilter] = useState<TaxOfficerPrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前所有稅務人員清冊
  useEffect(() => {
    if (isPrintOpen && !hasSearched) {
      fetchPrintData(filter);
      setHasSearched(true);
    }
  }, [isPrintOpen]);

  const handleQuery = async () => {
    await fetchPrintData(filter);
    setHasSearched(true);
  };

  return (
    <FoxProPrintModal<TaxOfficerItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="稅務人員資料清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="基本稅務人員清冊總表"
      startCodeLabel="起始稅務人員編號："
      startCodePlaceholder="例如: T001 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束稅務人員編號："
      endCodePlaceholder="例如: T999 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={TAXNO_PRINT_COLUMNS}
      getRowKey={(row, idx) => row.no || row.taxCode || idx}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無稅務人員資料"
    />
  );
};
