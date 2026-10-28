import React, { useState, useEffect } from 'react';
import { useWbase1070 } from './useWbase1070';
import type { NoteItem, NoteItemPrintFilter } from '../../services/wbase1070';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 收費備註名冊列印欄位定義
 */
const RECNOTE_PRINT_COLUMNS: FoxProPrintColumn<NoteItem>[] = [
  {
    key: '_seq',
    label: '序次',
    width: '12%',
    align: 'center',
    render: (_, __, idx) => idx + 1,
  },
  {
    key: 'noteno',
    label: '編號',
    width: '20%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.noteno || row.noteCode}</span>,
  },
  {
    key: 'note',
    label: '備註內容',
    width: '68%',
    render: (_, row) => <span className="whitespace-pre-wrap">{row.note || row.content}</span>,
  },
];

/**
 * Wbase1070Print (收費備註資料清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選與網頁直接列印（排除所有輸入框與按鈕）。
 */
export const Wbase1070Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintDataList, printData, loading } =
    useWbase1070();

  const [filter, setFilter] = useState<NoteItemPrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前所有收費備註
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
    <FoxProPrintModal<NoteItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="收費備註名冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="收費備註名冊"
      startCodeLabel="起始備註編號："
      startCodePlaceholder="例如: 01 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束備註編號："
      endCodePlaceholder="例如: 99 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={RECNOTE_PRINT_COLUMNS}
      getRowKey={(row, idx) => row.noteno || row.noteCode || idx}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無收費備註資料"
    />
  );
};
