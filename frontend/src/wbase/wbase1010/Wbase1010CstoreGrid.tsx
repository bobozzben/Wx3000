import React, { useMemo } from 'react';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { CSTORE_BYTES, checkCstoreNo, type CstoreItem } from '../../services/wbase1010';
import { EMAIL_WARNING_TEXT, checkBig5Compatible, isValidEmail } from '../../services/validation';
import { emptyCstoreRow } from './useWbase1010';

interface Wbase1010CstoreGridProps {
  rows: CstoreItem[];
  onRowsChange: (rows: CstoreItem[]) => void;
  onSaveRow: (row: CstoreItem) => void;
  onInsertRow: () => void;
  onDeleteRow: (row?: CstoreItem) => void;
  onSelectRow: (row?: CstoreItem) => void;
  onPickAddr: (row: CstoreItem, currentValue: string) => void;
  onExit: () => void;
  activeRowKey?: string;
  enterDirection: 'right' | 'down';
}

type Check = { valid: boolean; message: string; isWarning?: boolean };
const OK: Check = { valid: true, message: '' };

const big5 = (val: string): Check => {
  const res = checkBig5Compatible(val);
  return res.valid ? OK : { valid: false, message: res.message };
};

/**
 * F4 事務所資料 (VFP wbase1010f4 Grid1，RecordSource cstore，依 tag no 排序)
 * 欄位與 InputMask 長度同 VFP Grid1.Init；地址欄 F2 開地址選單；每個儲存格確認時即存檔 (VFP Text1.LostFocus)
 */
export const Wbase1010CstoreGrid: React.FC<Wbase1010CstoreGridProps> = ({
  rows,
  onRowsChange,
  onSaveRow,
  onInsertRow,
  onDeleteRow,
  onSelectRow,
  onPickAddr,
  onExit,
  activeRowKey,
  enterDirection,
}) => {
  const columns = useMemo<ColumnDefV2<CstoreItem>[]>(
    () => [
      {
        key: 'no',
        label: '統號',
        width: '115px',
        isPrimaryKey: true,
        maxBytes: CSTORE_BYTES.no,
        className: 'font-bold text-blue-900 dark:text-sky-300',
        // 統號要通過統編檢查碼才寫入 (VFP buynochk)；未修改的既有統號 (例如舊資料) 照常放行
        validate: (val, row) => {
          const code = val.trim();
          if (!code || code === row.origNo.trim()) return OK;
          const msg = checkCstoreNo(code);
          return msg ? { valid: false, message: msg } : OK;
        },
      },
      { key: 'name', label: '名稱', width: '290px', maxBytes: CSTORE_BYTES.name, validate: big5 },
      { key: 'tel', label: '電話', width: '130px', maxBytes: CSTORE_BYTES.tel, validate: big5 },
      { key: 'fax', label: '傳真', width: '130px', maxBytes: CSTORE_BYTES.fax, validate: big5 },
      { key: 'hname', label: '負責人', width: '115px', maxBytes: CSTORE_BYTES.hname, validate: big5 },
      { key: 'linkman', label: '聯絡人', width: '115px', maxBytes: CSTORE_BYTES.linkman, validate: big5 },
      {
        key: 'addr',
        label: '地址',
        width: '340px',
        maxBytes: CSTORE_BYTES.addr,
        validate: big5,
        hasEllipsis: true,
        ellipsisLabel: 'F2',
        onEllipsisClick: (row, _rIdx, currentValue) => onPickAddr(row, currentValue),
      },
      {
        key: 'email',
        label: '電子信箱',
        width: '300px',
        maxBytes: CSTORE_BYTES.email,
        validate: (val) => {
          const res = big5(val);
          if (!res.valid) return res;
          return val.trim() && !isValidEmail(val) ? { valid: false, isWarning: true, message: EMAIL_WARNING_TEXT } : OK;
        },
      },
      { key: 'engname', label: '英文名稱', width: '340px', maxBytes: CSTORE_BYTES.engname, validate: big5 },
    ],
    [onPickAddr]
  );

  return (
    <FoxProGridV2<CstoreItem>
      gridId="wbase1010_cstore"
      rows={rows}
      columns={columns}
      createEmptyRow={emptyCstoreRow}
      onRowsChange={onRowsChange}
      onSaveRow={(row) => onSaveRow(row)}
      onInsertRow={onInsertRow}
      onDeleteRow={(row) => onDeleteRow(row)}
      onSelectRow={(row) => onSelectRow(row)}
      onShowSummary={onExit}
      onExit={onExit}
      escLabel="離開"
      getRowKey={(row) => row._key}
      activeRowKey={activeRowKey}
      enterDirection={enterDirection}
      statusBarInfo={(row) =>
        row && row.no ? (
          <span className="text-xs">
            目前選取：[{row.no}] {row.name}
          </span>
        ) : null
      }
    />
  );
};
