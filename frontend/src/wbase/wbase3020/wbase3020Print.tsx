import React, { useState, useEffect } from 'react';
import { useWbase3020 } from './useWbase3020';
import type { InvoicePurchaseItem, PrintRangeQuery } from '../../services/wbase3020';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 統一發票預購份數清冊總表列印欄位定義
 */
const INVOICE_PREORDER_PRINT_COLUMNS: FoxProPrintColumn<InvoicePurchaseItem>[] = [
  {
    key: 'companyCode',
    label: '公司編號',
    width: '12%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.companyCode}</span>,
  },
  {
    key: 'companyShortName',
    label: '公司簡稱',
    width: '15%',
    render: (_, row) => <span className="font-semibold">{row.companyShortName}</span>,
  },
  {
    key: 'unifiedNo',
    label: '統編',
    width: '11%',
    render: (_, row) => row.unifiedNo || '-',
  },
  {
    key: 'manualTwoDup',
    label: '二聯',
    width: '7%',
    align: 'center',
    render: (_, row) => row.manualTwoDup || 0,
  },
  {
    key: 'manualTwoDupSub',
    label: '二副',
    width: '7%',
    align: 'center',
    render: (_, row) => row.manualTwoDupSub || 0,
  },
  {
    key: 'manualThreeDup',
    label: '三聯',
    width: '7%',
    align: 'center',
    render: (_, row) => row.manualThreeDup || 0,
  },
  {
    key: 'manualThreeDupSub',
    label: '三副',
    width: '7%',
    align: 'center',
    render: (_, row) => row.manualThreeDupSub || 0,
  },
  {
    key: 'manualSpecial',
    label: '特聯',
    width: '7%',
    align: 'center',
    render: (_, row) => row.manualSpecial || 0,
  },
  {
    key: 'cashTwoDup',
    label: '收銀二',
    width: '9%',
    align: 'center',
    render: (_, row) => row.cashTwoDup || 0,
  },
  {
    key: 'cashThreeDup',
    label: '收銀三',
    width: '9%',
    align: 'center',
    render: (_, row) => row.cashThreeDup || 0,
  },
  {
    key: 'cashThreeDupSub',
    label: '收銀三副',
    width: '9%',
    align: 'center',
    render: (_, row) => row.cashThreeDupSub || 0,
  },
];

/**
 * Wbase3020Print (統一發票預購份數清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選與網頁直接列印（排除所有輸入框與按鈕）。
 */
export const Wbase3020Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, period, times } =
    useWbase3020();

  const [filter, setFilter] = useState<PrintRangeQuery>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前期別之預購資料
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

  const reportSubtitle = `期別：${period} | 次數：${times === '1' ? '本期首次購買' : '本期追加購買'} | 列印日期: ${new Date().toLocaleDateString('zh-TW')}`;

  return (
    <FoxProPrintModal<InvoicePurchaseItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="統一發票預購份數清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="統一發票預購份數清冊總表"
      reportSubtitle={reportSubtitle}
      maxWidth="max-w-5xl"
      startCodeLabel="起始公司編號："
      startCodePlaceholder="例如: 001 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束公司編號："
      endCodePlaceholder="例如: 999 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={INVOICE_PREORDER_PRINT_COLUMNS}
      getRowKey={(row) => row.companyCode}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無統一發票預購份數紀錄"
    />
  );
};
