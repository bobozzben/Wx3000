import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AccountOption, DescripItem } from './services/wbase4020';
import {
  fetchDescripAccounts,
  fetchDescripList,
  createDescrip,
  updateDescrip,
  deleteDescrip,
  swapDescripOrder,
  checkBig5Compatible,
} from './services/wbase4020';
import { FoxProGridV2 } from '../../components/FoxProGrid/FoxProGridV2';
import type { ColumnDefV2 } from '../../components/FoxProGrid/FoxProGridV2';
import { Plus, Trash2, ArrowUp, ArrowDown, Search } from 'lucide-react';

interface Wbase4050FormProps {
  onExit?: () => void;
}

export const Wbase4050Form: React.FC<Wbase4050FormProps> = ({ onExit }) => {
  // 左側科目清單
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccno, setSelectedAccno] = useState<string>('');
  const [accountKeyword, setAccountKeyword] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);

  // 右側摘要清單
  const [descripRows, setDescripRows] = useState<DescripItem[]>([]);
  const [selectedDescripIndex, setSelectedDescripIndex] = useState<number>(0);
  const [loadingDescrip, setLoadingDescrip] = useState<boolean>(false);

  // 1. 載入科目清單
  useEffect(() => {
    setLoadingAccounts(true);
    fetchDescripAccounts()
      .then((data) => {
        setAccounts(data);
        if (data.length > 0) {
          setSelectedAccno(data[0].accno);
        }
        setLoadingAccounts(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingAccounts(false);
      });
  }, []);

  // 2. 當選取科目變更時，載入該科目之共用摘要
  useEffect(() => {
    if (!selectedAccno) {
      setDescripRows([]);
      return;
    }
    setLoadingDescrip(true);
    fetchDescripList(selectedAccno)
      .then((data) => {
        setDescripRows(data);
        setSelectedDescripIndex(0);
        setLoadingDescrip(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingDescrip(false);
      });
  }, [selectedAccno]);

  // 過濾左側科目
  const filteredAccounts = useMemo(() => {
    if (!accountKeyword.trim()) return accounts;
    const kw = accountKeyword.trim().toLowerCase();
    return accounts.filter(
      (a) => a.accno.toLowerCase().includes(kw) || a.accname.toLowerCase().includes(kw)
    );
  }, [accounts, accountKeyword]);

  const createEmptyRow = useCallback(
    (): DescripItem => ({
      accno: selectedAccno,
      descrip: '',
    }),
    [selectedAccno]
  );

  // 右側 Grid 定義
  const columns: ColumnDefV2<DescripItem>[] = useMemo(() => {
    return [
      {
        key: 'serial',
        label: '序號',
        width: '70px',
        editable: false,
        align: 'center',
        className: 'font-mono text-center font-bold text-slate-500 dark:text-slate-400',
        renderCell: (_val, _row, rIdx) => <span>{rIdx + 1}</span>,
      },
      {
        key: 'descrip',
        label: '常用摘要內容 (Big5 60位元組)',
        width: '450px',
        maxLength: 60,
        maxBytes: 60,
        className: 'font-medium',
        validate: (val) => {
          const b5 = checkBig5Compatible(val || '');
          if (!b5.valid) return { valid: false, message: b5.message };
          return { valid: true, message: '' };
        },
      },
    ];
  }, []);

  // 新增摘要
  const handleInsertDescrip = useCallback(async () => {
    if (!selectedAccno) return;
    try {
      const newItem = await createDescrip({
        accno: selectedAccno,
        descrip: '',
      });
      setDescripRows((prev) => [...prev, newItem]);
      setSelectedDescripIndex(descripRows.length);
    } catch (err: any) {
      alert('新增摘要失敗: ' + (err?.response?.data?.message || err.message));
    }
  }, [selectedAccno, descripRows.length]);

  // 儲存列
  const handleSaveRow = useCallback(
    async (row: DescripItem, rowIndex: number) => {
      try {
        const recno = row.recordNumber || row._record_number;
        if (recno && recno > 0) {
          await updateDescrip(recno, row);
        } else {
          const created = await createDescrip(row);
          const updated = [...descripRows];
          updated[rowIndex] = created;
          setDescripRows(updated);
        }
      } catch (err: any) {
        console.error('儲存摘要失敗:', err);
      }
    },
    [descripRows]
  );

  // 刪除摘要
  const handleDeleteDescrip = useCallback(
    async (row?: DescripItem, rowIndex?: number) => {
      const targetIdx = rowIndex !== undefined ? rowIndex : selectedDescripIndex;
      const target = row || descripRows[targetIdx];
      if (!target) return;

      const recno = target.recordNumber || target._record_number;
      if (!recno) return;

      if (!window.confirm(`確定要刪除此筆摘要「${target.descrip || '(空白)'}」嗎？`)) {
        return;
      }

      try {
        await deleteDescrip(recno);
        setDescripRows((prev) => prev.filter((_, idx) => idx !== targetIdx));
      } catch (err: any) {
        alert('刪除摘要失敗: ' + (err?.response?.data?.message || err.message));
      }
    },
    [selectedDescripIndex, descripRows]
  );

  // 上移
  const handleMoveUp = async () => {
    if (selectedDescripIndex <= 0) return;
    const cur = descripRows[selectedDescripIndex];
    const prev = descripRows[selectedDescripIndex - 1];
    const r1 = cur.recordNumber || cur._record_number;
    const r2 = prev.recordNumber || prev._record_number;
    if (!r1 || !r2) return;

    try {
      await swapDescripOrder(r1, cur.serial || 0, r2, prev.serial || 0);
      const updated = [...descripRows];
      updated[selectedDescripIndex - 1] = cur;
      updated[selectedDescripIndex] = prev;
      setDescripRows(updated);
      setSelectedDescripIndex(selectedDescripIndex - 1);
    } catch (err: any) {
      alert('上移失敗: ' + (err?.response?.data?.message || err.message));
    }
  };

  // 下移
  const handleMoveDown = async () => {
    if (selectedDescripIndex >= descripRows.length - 1) return;
    const cur = descripRows[selectedDescripIndex];
    const next = descripRows[selectedDescripIndex + 1];
    const r1 = cur.recordNumber || cur._record_number;
    const r2 = next.recordNumber || next._record_number;
    if (!r1 || !r2) return;

    try {
      await swapDescripOrder(r1, cur.serial || 0, r2, next.serial || 0);
      const updated = [...descripRows];
      updated[selectedDescripIndex + 1] = cur;
      updated[selectedDescripIndex] = next;
      setDescripRows(updated);
      setSelectedDescripIndex(selectedDescripIndex + 1);
    } catch (err: any) {
      alert('下移失敗: ' + (err?.response?.data?.message || err.message));
    }
  };

  const selectedAccountInfo = accounts.find((a) => a.accno === selectedAccno);

  return (
    <div className="flex h-full bg-slate-100 dark:bg-slate-900 overflow-hidden font-mono text-sm">
      {/* 左側：會計科目清單 */}
      <div className="w-80 md:w-96 flex flex-col border-r border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
        <div className="p-2.5 bg-[#1e3a8a] text-white flex items-center justify-between">
          <div className="font-bold flex items-center gap-1.5">
            <span>會計科目清單</span>
            <span className="text-xs text-blue-200">({filteredAccounts.length})</span>
          </div>
        </div>

        {/* 搜尋列 */}
        <div className="p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
          <div className="relative">
            <input
              type="text"
              value={accountKeyword}
              onChange={(e) => setAccountKeyword(e.target.value)}
              placeholder="搜尋代號或名稱..."
              className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* 科目列表 */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {loadingAccounts ? (
            <div className="py-8 text-center text-slate-500 text-xs">載入科目清單中...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">查無符合科目</div>
          ) : (
            filteredAccounts.map((item) => {
              const isSelected = item.accno === selectedAccno;
              return (
                <div
                  key={item.accno}
                  onClick={() => setSelectedAccno(item.accno)}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-amber-100 dark:bg-amber-950/70 border-l-4 border-l-amber-500 font-bold text-amber-900 dark:text-amber-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-wider">{item.accno}</span>
                    <span className="truncate max-w-[150px] font-sans">{item.accname}</span>
                  </div>
                  {item.dept && (
                    <span className="text-[10px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                      {item.dept}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右側：共用摘要表格與操作按鈕 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900">
        {/* 目標科目抬頭列 */}
        <div className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">目前維護科目：</span>
            {selectedAccountInfo ? (
              <span className="font-bold text-base text-blue-900 dark:text-amber-300">
                [{selectedAccountInfo.accno}] {selectedAccountInfo.accname}
              </span>
            ) : (
              <span className="text-slate-400">尚未選取科目</span>
            )}
          </div>

          {/* 工具列按鈕 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleInsertDescrip}
              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> 新增 [Ins]
            </button>
            <button
              onClick={() => handleDeleteDescrip()}
              disabled={descripRows.length === 0}
              className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> 刪除 [Del]
            </button>
            <button
              onClick={handleMoveUp}
              disabled={selectedDescripIndex <= 0}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            >
              <ArrowUp className="w-3.5 h-3.5" /> 上移
            </button>
            <button
              onClick={handleMoveDown}
              disabled={selectedDescripIndex >= descripRows.length - 1}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded flex items-center gap-1 shadow-xs"
            >
              <ArrowDown className="w-3.5 h-3.5" /> 下移
            </button>
          </div>
        </div>

        {/* 摘要 Grid */}
        <div className="flex-1 min-h-0 relative">
          {loadingDescrip ? (
            <div className="py-16 text-center text-slate-500">載入共用摘要中...</div>
          ) : descripRows.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              此會計科目目前尚無共用摘要，請按右上角「新增 [Ins]」建立摘要
            </div>
          ) : (
            <FoxProGridV2<DescripItem>
              gridId="wbase4050_grid"
              rows={descripRows}
              columns={columns}
              createEmptyRow={createEmptyRow}
              onRowsChange={setDescripRows}
              onSaveRow={handleSaveRow}
              onInsertRow={handleInsertDescrip}
              onDeleteRow={handleDeleteDescrip}
              onSelectRow={(_row, rIdx) => setSelectedDescripIndex(rIdx)}
              onExit={onExit}
              minRows={0}
            />
          )}
        </div>

        {/* 底部狀態說明 */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 text-xs font-mono">
          <div className="text-blue-800 dark:text-amber-300 font-bold">
            提示：[Ins]新增摘要列，[Del]刪除摘要，直接打字編輯，[Esc]離開
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            摘要筆數: <strong className="text-slate-900 dark:text-slate-100">{descripRows.length}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
