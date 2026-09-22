import React, { useCallback } from 'react';
import type { FeeSummary } from '../../services/wbase1080';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { SearchItem } from '../../components/FoxProGrid/SearchModal';

interface Wbase1080FormProps {
  rows: FeeSummary[];
  onRowsChange: (newRows: FeeSummary[]) => void;
  onSaveRow: (row: FeeSummary) => Promise<void>;
  onOpenPrint: () => void;
  onShowSummary: (hasModified: boolean) => void;
  statusBarInfo?: React.ReactNode | ((row: FeeSummary | undefined, rowIndex: number) => React.ReactNode);
  onSelectRow?: (row: FeeSummary | undefined, rowIndex: number) => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onRefreshData?: () => void;
  onExit?: () => void;
}

const SUMMARY_COLUMNS: ColumnDefV2<FeeSummary>[] = [
  { key: 'summaryCode', label: '摘要代號', isPrimaryKey: true, width: '160px', className: 'font-bold' },
  { key: 'summaryName', label: '摘要說明', width: '240px', className: 'font-bold' },
  { key: 'content', label: '摘要內容', width: '1fr' },
];

export const Wbase1080Form: React.FC<Wbase1080FormProps> = ({
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
  const createEmptyRow = useCallback((): FeeSummary => ({
    summaryCode: '',
    summaryName: '',
    content: '',
  }), []);

  const handleF3Search = async (query: string): Promise<SearchItem[]> => {
    return rows
      .filter(
        (x) =>
          x.summaryCode.toLowerCase().includes(query.toLowerCase()) ||
          x.summaryName.toLowerCase().includes(query.toLowerCase()) ||
          x.content.toLowerCase().includes(query.toLowerCase())
      )
      .map((x) => ({
        code: x.summaryCode,
        name: x.summaryName,
        spec: x.content,
      }));
  };

  return (
    <FoxProGridV2<FeeSummary>
      rows={rows}
      columns={SUMMARY_COLUMNS}
      createEmptyRow={createEmptyRow}
      onRowsChange={onRowsChange}
      onSaveRow={onSaveRow}
      onOpenPrint={onOpenPrint}
      onShowSummary={onShowSummary}
      statusBarInfo={statusBarInfo}
      onSelectRow={onSelectRow}
      onF3Search={handleF3Search}
      f3SearchTitle="基本收費摘要開窗搜尋 [F3]"
      getRowKey={(row, idx) => row.summaryCode || idx}
      onInsertRow={onInsertRow}
      onDeleteRow={onDeleteRow}
      onRefreshData={onRefreshData}
      onExit={onExit}
    />
  );
};
