import { useState, useCallback, useRef } from 'react';
import type { AccountItem } from '../../services/wbase4010';
import {
  ACCOUNT_MODES,
  getAccounts,
  getRefAccounts,
  saveAccount,
  deleteAccount,
  batchCopyAccounts,
  validateAccountRow,
} from '../../services/wbase4010';

export function useWbase4010(initialMode: number = 1) {
  const [currentMode, setCurrentMode] = useState<number>(initialMode);
  const [rows, setRows] = useState<AccountItem[]>([]);
  const [refAccounts, setRefAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Modals & Popups
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<AccountItem | null>(null);

  // Toast / Messages
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const persistedAccnosRef = useRef<Set<string>>(new Set());

  const showAutoCloseToast = useCallback((msg: string, durationMs = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, durationMs);
  }, []);

  const refreshData = useCallback(
    async (keyword?: string) => {
      try {
        setLoading(true);
        const data = await getAccounts(currentMode, keyword);
        if (!keyword?.trim()) {
          persistedAccnosRef.current = new Set(
            data.map((r) => (r.accno || '').trim().toUpperCase()).filter(Boolean)
          );
        } else {
          data.forEach((r) => {
            const c = (r.accno || '').trim().toUpperCase();
            if (c) persistedAccnosRef.current.add(c);
          });
        }
        setRows(data);
        if (data.length > 0 && selectedIndex >= data.length) {
          setSelectedIndex(0);
        }
      } catch (err: any) {
        console.error('refreshData error:', err);
        setErrorToast(`載入資料失敗: ${err.message || '未知錯誤'}`);
      } finally {
        setLoading(false);
      }
    },
    [currentMode, selectedIndex]
  );

  const loadRefAccounts = useCallback(async () => {
    try {
      const data = await getRefAccounts(currentMode);
      setRefAccounts(data);
    } catch (err: any) {
      console.error('loadRefAccounts error:', err);
    }
  }, [currentMode]);

  const switchMode = useCallback(
    (newMode: number) => {
      if (newMode !== currentMode) {
        setCurrentMode(newMode);
        setSelectedIndex(0);
      }
    },
    [currentMode]
  );

  const handleSaveRow = useCallback(
    async (row: AccountItem, rowIndex: number) => {
      const trimmedAccno = (row.accno || '').trim().toUpperCase();
      if (!trimmedAccno || trimmedAccno === '新科目') {
        return;
      }

      const isNew = Boolean(row._isNew) || !persistedAccnosRef.current.has(trimmedAccno);
      const valRes = validateAccountRow(
        row,
        currentMode,
        rows,
        isNew,
        rows[rowIndex]?.accno,
        rowIndex
      );

      if (!valRes.isValid) {
        setErrorToast(valRes.message);
        return;
      }

      // 先同步更新前端列狀態（如新增明細科目自動帶入母科目名稱與明細代碼）
      setRows((prev) => {
        const next = [...prev];
        if (rowIndex >= 0 && rowIndex < next.length) {
          next[rowIndex] = {
            ...next[rowIndex],
            ...valRes.normalizedRow,
          };
        }
        return next;
      });

      try {
        const res = await saveAccount(currentMode, valRes.normalizedRow, isNew);
        if (res.success) {
          const savedAccno = (res.accno || trimmedAccno).trim().toUpperCase();
          persistedAccnosRef.current.add(savedAccno);
          showAutoCloseToast(`科目 [${savedAccno}] 儲存成功！`);
          // 更新該列已存檔狀態與後端回傳欄位
          setRows((prev) => {
            const next = [...prev];
            if (rowIndex >= 0 && rowIndex < next.length) {
              const current = next[rowIndex];
              next[rowIndex] = {
                ...current,
                accno: savedAccno,
                accname: current.accname || res.data?.accname || valRes.normalizedRow.accname,
                dept:
                  current.dept && current.dept.trim()
                    ? current.dept
                    : res.data?.dept || valRes.normalizedRow.dept,
                serial: res.data?.serial ?? current.serial,
                _record_number:
                  res.data?._record_number ??
                  res.data?.recordNumber ??
                  current._record_number ??
                  999999,
                recordNumber:
                  res.data?.recordNumber ??
                  res.data?._record_number ??
                  current.recordNumber ??
                  999999,
                _isNew: false,
              };
            }
            return next;
          });
        }
      } catch (err: any) {
        console.error('saveAccount error:', err);
        const respData = err.response?.data;
        const msg =
          typeof respData === 'string'
            ? respData
            : respData?.message || respData?.error || err.message || '存檔失敗';
        setErrorToast(`存檔失敗: ${msg}`);
      }
    },
    [currentMode, rows, showAutoCloseToast]
  );

  const handleInsertRow = useCallback(() => {
    // 檢查是否已有暫存未完成的新科目列
    const hasTemp = rows.some((r) => !r.accno.trim() || r.accno.trim() === '新科目');
    if (hasTemp) {
      setErrorToast('已存在一筆未完成的新科目列，請先輸入科目代號與名稱！');
      return;
    }

    const newRow: AccountItem = {
      accno: '',
      accname: '',
      dept: ' ',
      taxcode: ' ',
      accnamel: '',
      engaccname: '',
      serial: rows.length + 1,
      _isNew: true,
    };

    setRows((prev) => [...prev, newRow]);
    setSelectedIndex(rows.length);
    showAutoCloseToast('已建立新列，請輸入科目代號 (5~8碼明細科目) 與名稱！');
  }, [rows, showAutoCloseToast]);

  const openDeleteConfirm = useCallback(
    (row?: AccountItem) => {
      const target = row || rows[selectedIndex];
      if (!target) return;

      const code = target.accno.trim();
      const meta = ACCOUNT_MODES[currentMode] || ACCOUNT_MODES[1];

      // 總帳科目刪除防呆
      if (code.length <= 4) {
        if (meta.isOrgGroup && code.length === 4 &&
            ((code >= '7021' && code <= '7099') || (code >= '8021' && code <= '8099'))) {
          // 團體允許刪除無子目之 7021-7099, 8021-8099
          const subCount = rows.filter((r) => r.accno.trim().startsWith(code)).length;
          if (subCount >= 2) {
            setErrorToast('此總帳科目已設立子科目，不可刪除！');
            return;
          }
        } else {
          setErrorToast('總帳科目不可刪除！');
          return;
        }
      }

      setRowToDelete(target);
      setIsDeleteConfirmOpen(true);
    },
    [rows, selectedIndex, currentMode]
  );

  const confirmDelete = useCallback(async () => {
    if (!rowToDelete) return;

    try {
      const res = await deleteAccount(currentMode, rowToDelete.accno);
      if (res.success) {
        showAutoCloseToast(`已成功刪除會計科目: [${res.deletedAccno}]`);
        setIsDeleteConfirmOpen(false);
        setRowToDelete(null);
        await refreshData();
      }
    } catch (err: any) {
      console.error('deleteAccount error:', err);
      const msg = err.response?.data?.message || err.message || '刪除失敗';
      setErrorToast(`刪除失敗: ${msg}`);
      setIsDeleteConfirmOpen(false);
    }
  }, [currentMode, rowToDelete, refreshData, showAutoCloseToast]);

  const handleBatchCopy = useCallback(
    async (accnos: string[]) => {
      try {
        const res = await batchCopyAccounts(currentMode, accnos);
        if (res.success) {
          showAutoCloseToast(`成功複製 ${res.copiedCount} 筆標準總帳科目！`);
          await refreshData();
        }
      } catch (err: any) {
        console.error('batchCopyAccounts error:', err);
        const msg = err.response?.data?.message || err.message || '批次複製失敗';
        setErrorToast(`批次複製失敗: ${msg}`);
      }
    },
    [currentMode, refreshData, showAutoCloseToast]
  );

  const openPrint = useCallback(() => setIsPrintOpen(true), []);
  const closePrint = useCallback(() => setIsPrintOpen(false), []);

  const openCopy = useCallback(async () => {
    await loadRefAccounts();
    setIsCopyOpen(true);
  }, [loadRefAccounts]);
  const closeCopy = useCallback(() => setIsCopyOpen(false), []);

  return {
    currentMode,
    switchMode,
    rows,
    setRows,
    refAccounts,
    loading,
    selectedIndex,
    setSelectedIndex,
    isPrintOpen,
    openPrint,
    closePrint,
    isCopyOpen,
    openCopy,
    closeCopy,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    rowToDelete,
    openDeleteConfirm,
    confirmDelete,
    toastMessage,
    errorToast,
    setErrorToast,
    showAutoCloseToast,
    refreshData,
    handleSaveRow,
    handleInsertRow,
    handleBatchCopy,
  };
}
