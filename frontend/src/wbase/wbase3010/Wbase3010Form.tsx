import React, { useState, useCallback, useMemo } from 'react';
import type { TicketPlaceItem } from '../../services/wbase3010';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import { AddressSelectModal } from '../../components/FoxProGrid/AddressSelectModal';

interface Wbase3010FormProps {
  rows: TicketPlaceItem[];
  onRowsChange: (newRows: TicketPlaceItem[]) => void;
  onSaveRow: (row: TicketPlaceItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: TicketPlaceItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: TicketPlaceItem | undefined, rowIndex: number) => void;
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
  onSelectRow,
  onInsertRow,
  onDeleteRow,
  onRefreshData,
  onExit,
}) => {
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [targetAddrRowIndex, setTargetAddrRowIndex] = useState<number>(-1);
  const [currentAddrValue, setCurrentAddrValue] = useState<string>('');

  const handleOpenAddrModal = useCallback((row: TicketPlaceItem, rowIndex: number, currentVal: string) => {
    setTargetAddrRowIndex(rowIndex);
    setCurrentAddrValue(currentVal || row.placeAddress || '');
    setAddrModalOpen(true);
  }, []);

  const handleAddressConfirm = useCallback(
    (selectedAddress: string) => {
      setAddrModalOpen(false);
      if (targetAddrRowIndex >= 0 && targetAddrRowIndex < rows.length) {
        const updated = [...rows];
        const targetRow = {
          ...updated[targetAddrRowIndex],
          placeAddress: selectedAddress,
        };
        updated[targetAddrRowIndex] = targetRow;
        onRowsChange(updated);
        onSaveRow(targetRow);
      }
    },
    [rows, targetAddrRowIndex, onRowsChange, onSaveRow]
  );

  const columns = useMemo<ColumnDefV2<TicketPlaceItem>[]>(() => {
    return TICKET_PLACE_COLUMNS.map((col) => {
      if (col.key === 'placeAddress') {
        return {
          ...col,
          hasEllipsis: true,
          ellipsisLabel: 'F2',
          onEllipsisClick: (row, rIdx, curVal) => {
            handleOpenAddrModal(row, rIdx, curVal);
          },
        };
      }
      return col;
    });
  }, [handleOpenAddrModal]);

  const createEmptyRow = useCallback((): TicketPlaceItem => ({
    placeCode: '',
    placeName: '',
    contactPerson: '',
    contactTel: '',
    placeAddress: '',
  }), []);

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
    <>
      <FoxProGridV2<TicketPlaceItem>
        rows={rows}
        columns={columns}
        createEmptyRow={createEmptyRow}
        onRowsChange={onRowsChange}
        onSaveRow={onSaveRow}
        onOpenPrint={onOpenPrint}
        onShowSummary={onShowSummary}
        statusBarInfo={statusBarInfo}
        onSelectRow={onSelectRow}
        onF3Search={handleF3Search}
        f3SearchTitle="購買地點開窗搜尋 [F3]"
        getRowKey={(row, idx) => row.placeCode || idx}
        onInsertRow={onInsertRow}
        onDeleteRow={onDeleteRow}
        onRefreshData={onRefreshData}
        onExit={onExit}
      />
      <AddressSelectModal
        isOpen={addrModalOpen}
        initialValue={currentAddrValue}
        onClose={() => setAddrModalOpen(false)}
        onConfirm={handleAddressConfirm}
      />
    </>
  );
};
