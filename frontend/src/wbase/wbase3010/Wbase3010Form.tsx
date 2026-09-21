import React from 'react';
import type { TicketPlaceItem } from '../../services/wbase3010';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase3010FormProps {
  rows: TicketPlaceItem[];
  onRowsChange: (newRows: TicketPlaceItem[]) => void;
  onSaveRow: (row: TicketPlaceItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const TICKET_PLACE_COLUMNS: ColumnDefV2<TicketPlaceItem>[] = [
  { key: 'placeCode', label: '編號', isPrimaryKey: true, width: '130px', className: 'font-bold' },
  { key: 'placeName', label: '購買地點', width: '220px', className: 'font-bold' },
  { key: 'contactPerson', label: '連絡人', width: '150px' },
  { key: 'contactTel', label: '連絡電話', width: '160px' },
  { key: 'placeAddress', label: '購買地址', width: '1fr' },
];

export const Wbase3010Form: React.FC<Wbase3010FormProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onOpenPrint,
  onShowSummary,
  statusBarInfo,
  onInsertRow,
  onDeleteRow,
  onRefreshData,
  onExit,
}) => {
  const createEmptyRow = (): TicketPlaceItem => ({
    placeCode: '',
    placeName: '',
    contactPerson: '',
    contactTel: '',
    placeAddress: '',
  });

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    const q = query.toLowerCase();
    return rows
      .filter(
        (x) =>
          x.placeCode.toLowerCase().includes(q) ||
          x.placeName.toLowerCase().includes(q) ||
          x.contactPerson.toLowerCase().includes(q) ||
          x.contactTel.toLowerCase().includes(q) ||
          x.placeAddress.toLowerCase().includes(q)
      )
      .map((x) => ({
        code: x.placeCode,
        name: x.placeName,
        spec: `連絡人: ${x.contactPerson} | 電話: ${x.contactTel} | 地址: ${x.placeAddress}`,
      }));
  };

  return (
    <FoxProGridV2<TicketPlaceItem>
      rows={rows}
      columns={TICKET_PLACE_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onF3Search={handleF3Search}
      f3SearchTitle="購買地點開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.placeCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
