import React, { useState, useEffect } from 'react';
import { useWbase3010 } from './useWbase3010';
import type { TicketPlaceItem, TicketPlacePrintFilter } from '../../services/wbase3010';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 統一發票購買地點清冊總表列印欄位定義
 */
const TICKET_PLACE_PRINT_COLUMNS: FoxProPrintColumn<TicketPlaceItem>[] = [
  {
    key: '_seq',
    label: '序次',
    width: '8%',
    align: 'center',
    render: (_, __, idx) => idx + 1,
  },
  {
    key: 'placeCode',
    label: '編號',
    width: '12%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.placeCode}</span>,
  },
  {
    key: 'placeName',
    label: '購買地點',
    width: '24%',
    render: (_, row) => <span className="font-semibold">{row.placeName}</span>,
  },
  {
    key: 'contactPerson',
    label: '連絡人',
    width: '16%',
    render: (_, row) => row.contactPerson || '-',
  },
  {
    key: 'contactTel',
    label: '連絡電話',
    width: '16%',
    render: (_, row) => row.contactTel || '-',
  },
  {
    key: 'placeAddress',
    label: '購買地址',
    width: '24%',
    render: (_, row) => <span className="whitespace-pre-wrap">{row.placeAddress || '-'}</span>,
  },
];

/**
 * Wbase3010Print (統一發票購買地點清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選與網頁直接列印（排除所有輸入框與按鈕）。
 */
export const Wbase3010Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, loading } =
    useWbase3010();

  const [filter, setFilter] = useState<TicketPlacePrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前所有購票地點
  useEffect(() => {
    if (isPrintOpen && !hasSearched) {
      fetchPrintDataList(filter);
      setHasSearched(true);
    }
  }, [isPrintOpen]);

  const handleQuery = async () => {
    await fetchPrintDataList(filter);
    setHasSearched(true);
  };

  return (
    <FoxProPrintModal<TicketPlaceItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="統一發票購買地點清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="統一發票購買地點清冊總表"
      maxWidth="max-w-5xl"
      startCodeLabel="起始地點代號："
      startCodePlaceholder="例如: 01 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束地點代號："
      endCodePlaceholder="例如: 99 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={TICKET_PLACE_PRINT_COLUMNS}
      getRowKey={(row) => row.placeCode}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無任何購買地點資料"
    />
  );
};
