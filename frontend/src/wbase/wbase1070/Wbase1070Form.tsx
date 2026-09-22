import React, { useCallback } from 'react';
import type { NoteItem } from '../../services/wbase1070';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1070FormProps {
  rows: NoteItem[];
  onRowsChange: (newRows: NoteItem[]) => void;
  onSaveRow: (row: NoteItem) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: NoteItem | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: NoteItem | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const NOTE_COLUMNS: ColumnDefV2<NoteItem>[] = [
  { key: 'noteCode', label: '備註代號', isPrimaryKey: true, width: '160px', className: 'font-bold' },
  { key: 'noteName', label: '備註說明', width: '240px', className: 'font-bold' },
  { key: 'content', label: '備註內容', width: '1fr' },
];

export const Wbase1070Form: React.FC<Wbase1070FormProps> = ({
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
  const createEmptyRow = useCallback((): NoteItem => ({
    noteCode: '',
    noteName: '',
    content: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.noteCode.toLowerCase().includes(query.toLowerCase()) ||
          x.noteName.toLowerCase().includes(query.toLowerCase()) ||
          x.content.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.noteCode,
        name: x.noteName,
        spec: x.content,
      }));
  };

  return (
    <FoxProGridV2<NoteItem>
      rows={rows}
      columns={NOTE_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="收費項目備註開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.noteCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
