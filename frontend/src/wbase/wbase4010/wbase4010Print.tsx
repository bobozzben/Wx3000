import React, { useState, useEffect } from 'react';
import type { AccountItem } from '../../services/wbase4010';
import { getDeptDescription } from '../../services/wbase4010';
import { FoxProPrintModal, type FoxProPrintColumn } from '../../components/FoxProGrid/FoxProPrintModal';

const ACCOUNT_PRINT_COLUMNS: FoxProPrintColumn<AccountItem>[] = [
  {
    key: 'serial',
    label: '序號',
    width: '8%',
    align: 'center',
    render: (_, row, idx) => row.serial || idx + 1,
  },
  {
    key: 'accno',
    label: '科目代號',
    width: '14%',
    className: 'font-bold font-mono',
    render: (_, row) => <span className="font-bold">{row.accno}</span>,
  },
  {
    key: 'accname',
    label: '科目名稱',
    width: '24%',
    render: (_, row) => <span>{row.accname}</span>,
  },
  {
    key: 'dept',
    label: '科目明細',
    width: '14%',
    render: (_, row) => <span>{getDeptDescription(row.dept)}</span>,
  },
  {
    key: 'taxcode',
    label: '稅額',
    width: '8%',
    align: 'center',
    render: (_, row) => (
      <span className="font-bold text-amber-600">{row.taxcode?.trim() === '*' ? '*' : ''}</span>
    ),
  },
  {
    key: 'accnamel',
    label: '長科目名稱',
    width: '32%',
    render: (_, row) => <span>{row.accnamel || ''}</span>,
  },
];

interface Wbase4010PrintProps {
  isOpen: boolean;
  onClose: () => void;
  data: AccountItem[];
  modeTitle: string;
}

export const Wbase4010Print: React.FC<Wbase4010PrintProps> = ({
  isOpen,
  onClose,
  data,
  modeTitle,
}) => {
  const [startAccno, setStartAccno] = useState('');
  const [endAccno, setEndAccno] = useState('');
  const [filteredData, setFilteredData] = useState<AccountItem[]>(data);

  useEffect(() => {
    if (isOpen) {
      setStartAccno('');
      setEndAccno('');
      setFilteredData(data);
    }
  }, [isOpen, data]);

  const handleSearch = () => {
    let result = [...data];
    if (startAccno.trim()) {
      const s = startAccno.trim().toUpperCase();
      result = result.filter((a) => a.accno.trim().toUpperCase() >= s);
    }
    if (endAccno.trim()) {
      const e = endAccno.trim().toUpperCase();
      result = result.filter((a) => a.accno.trim().toUpperCase() <= e);
    }
    setFilteredData(result);
  };

  return (
    <FoxProPrintModal<AccountItem>
      isOpen={isOpen}
      onClose={onClose}
      title={`會計科目清冊列印 [F4/F7] - ${modeTitle}`}
      subtitle="設定起始與結束科目代號以篩選預覽列印或匯出"
      reportTitle={`${modeTitle} - 會計科目對照表`}
      startCodeLabel="起始科目代號："
      startCodePlaceholder="例如: 1101 (留空代表從頭)"
      startCodeValue={startAccno}
      onStartCodeChange={setStartAccno}
      endCodeLabel="結束科目代號："
      endCodePlaceholder="例如: 9999 (留空代表至尾)"
      endCodeValue={endAccno}
      onEndCodeChange={setEndAccno}
      onSearch={handleSearch}
      data={filteredData}
      columns={ACCOUNT_PRINT_COLUMNS}
      getRowKey={(row, idx) => row.accno || idx}
      hasSearched={true}
      emptyText="⚠️ 該區間內查無符合之會計科目資料"
    />
  );
};
