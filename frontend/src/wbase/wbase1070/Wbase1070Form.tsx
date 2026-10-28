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

// 依據 recnote.dbf 規格：只有 "編號 (noteno)"、"備註內容 (note)" 2 個欄位
const NOTE_COLUMNS: ColumnDefV2<NoteItem>[] = [
  {
    key: 'noteno',
    label: '編號',
    isPrimaryKey: true,
    width: '130px',
    align: 'left',
    className: 'text-blue-900 dark:text-sky-300 font-bold',
  },
  {
    key: 'note',
    label: '備註內容',
    width: '1fr',
    align: 'left',
    className: 'font-semibold',
  },
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
    noteno: '',
    note: '',
    _record_number: 0,
    noteCode: '',
    noteName: '',
    content: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          (x.noteno || x.noteCode || '').toLowerCase().includes(query.toLowerCase()) ||
          (x.note || x.content || '').toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.noteno || x.noteCode || '',
        name: x.note || x.content || '',
        spec: '',
      }));
  };

  return (
    <FoxProGridV2<NoteItem>
      gridId="wbase1070_grid"
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
      f3SearchTitle="收費備註資料開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.noteno || row.noteCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
