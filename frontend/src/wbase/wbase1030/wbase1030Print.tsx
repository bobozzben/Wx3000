import React, { useState, useEffect } from 'react';
import { useWbase1030 } from './useWbase1030';
import type { EmpItem, EmpPrintFilter } from '../../services/wbase1030';
import {
  FoxProPrintModal,
  type FoxProPrintColumn,
  type XlsxFieldItem,
} from '../../components/FoxProGrid/FoxProPrintModal';

/**
 * 建檔人員清冊總表列印欄位定義
 */
const KEYIN_PRINT_COLUMNS: FoxProPrintColumn<EmpItem>[] = [
  {
    key: 'no',
    label: '編號',
    width: '15%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.no || row.empCode}</span>,
  },
  {
    key: 'name',
    label: '姓名',
    width: '15%',
    render: (_, row) => <span className="font-semibold">{row.name || row.empName}</span>,
  },
  {
    key: 'tel',
    label: '電話',
    width: '15%',
    render: (_, row) => row.tel || '-',
  },
  {
    key: 'phone',
    label: '手機',
    width: '15%',
    render: (_, row) => row.phone || row.mobile || '-',
  },
  {
    key: 'addr',
    label: '住址',
    width: '25%',
    render: (_, row) => row.addr || row.address || '-',
  },
  {
    key: 'memo',
    label: '備註',
    width: '15%',
    render: (_, row) => row.memo || row.depName || '-',
  },
];

/**
 * 建檔人員 XLSX 候選匯出欄位清單 (供 FormUtilSelectXlsxFieldsList 選擇)
 */
const KEYIN_XLSX_FIELDS: XlsxFieldItem[] = [
  { key: 'no', label: '編號', customTitle: '編號', selected: true },
  { key: 'name', label: '姓名', customTitle: '姓名', selected: true },
  { key: 'tel', label: '電話', customTitle: '電話', selected: true },
  { key: 'phone', label: '手機', customTitle: '手機', selected: true },
  { key: 'addr', label: '住址', customTitle: '住址', selected: true },
  { key: 'memo', label: '備註', customTitle: '備註', selected: true },
  { key: 'email', label: '電子郵件', customTitle: '電子郵件', selected: false },
  { key: 'birthday', label: '出生日期', customTitle: '出生日期', selected: false },
  { key: 'id', label: '身分證號', customTitle: '身分證號', selected: false },
  { key: 'oneuserid', label: '單一簽入代號', customTitle: '單一簽入代號', selected: false },
];

/**
 * Wbase1030Print (建檔人員資料清冊列印)
 * 繼承共用母版 FoxProPrintModal，具備標準 FoxPro 高對比 UI、
 * 條件篩選、網頁直接列印（排除所有輸入框與按鈕）與「匯出 xlsx 設定」欄位自訂匯出。
 */
export const Wbase1030Print: React.FC = () => {
  const { isPrintOpen, closePrint, fetchPrintData, printData, loading } =
    useWbase1030();

  const [filter, setFilter] = useState<EmpPrintFilter>({
    codeStart: '',
    codeEnd: '',
  });
  const [hasSearched, setHasSearched] = useState(false);

  // 當開啟列印預覽時，自動預設載入目前所有人員清冊
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
    <FoxProPrintModal<EmpItem>
      isOpen={isPrintOpen}
      onClose={closePrint}
      title="人員資料清冊列印 [F7/F8]"
      subtitle="選擇列印範圍區間並進行預覽"
      reportTitle="建檔人員清冊總表"
      startCodeLabel="起始人員編號："
      startCodePlaceholder="例如: E001 (留空代表從頭)"
      startCodeValue={filter.codeStart || ''}
      onStartCodeChange={(val) => setFilter((prev) => ({ ...prev, codeStart: val }))}
      endCodeLabel="結束人員編號："
      endCodePlaceholder="例如: E999 (留空代表至尾)"
      endCodeValue={filter.codeEnd || ''}
      onEndCodeChange={(val) => setFilter((prev) => ({ ...prev, codeEnd: val }))}
      onSearch={handleQuery}
      data={printData}
      columns={KEYIN_PRINT_COLUMNS}
      getRowKey={(row, idx) => row.no || row.empCode || idx}
      loading={loading}
      hasSearched={hasSearched}
      emptyText="⚠️ 該區間內查無人員資料"
      xlsxStorageKey="wbase1030_xlsx_export_config"
      xlsxFields={KEYIN_XLSX_FIELDS}
      xlsxFileName="建檔人員清冊"
    />
  );
};
