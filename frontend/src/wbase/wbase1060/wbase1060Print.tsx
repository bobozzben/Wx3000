import React, { useState, useEffect } from 'react';
import { useWbase1060 } from './useWbase1060';
import type { FeeItem, FeeItemPrintFilter } from '../../services/wbase1060';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 基本收費項目清冊總表列印欄位定義
 */
const RECITEM_PRINT_COLUMNS: FoxProPrintColumn<FeeItem>[] = [
  {
    key: 'itemno',
    label: '項目',
    width: '20%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.itemno || row.feeCode}</span>,
  },
  {
    key: 'item',
    label: '項目名稱',
    width: '50%',
    render: (_, row) => <span className="font-semibold">{row.item || row.feeName}</span>,
  },
  {
    key: 'amt',
    label: '收費金額',
    width: '30%',
    align: 'right',
    render: (_, row) => (
      <span className="font-mono">
        {Number(row.amt !== undefined ? row.amt : row.price || 0).toLocaleString('zh-TW')}
      </span>
    ),
  },
];

/**
 * Wbase1060Print (收費項目資料清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選與網頁直接列印（排除所有輸入框與按鈕）。
 */
export const Wbase1060Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, loading } =
    useWbase1060();

  const [filter, setFilter] = useState<FeeItemPrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前所有收費項目
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
    <FoxProPrintModal<FeeItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="收費項目資料清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="基本收費項目清冊總表"
      startCodeLabel="起始項目代號："
      startCodePlaceholder="例如: 01 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束項目代號："
      endCodePlaceholder="例如: 99 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={RECITEM_PRINT_COLUMNS}
      getRowKey={(row, idx) => row.itemno || row.feeCode || idx}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無收費項目資料"
    />
  );
};
