import { create } from 'zustand';
import type {
  FeeItem,
  FeeItemPrintFilter,
} from '../../services/wbase1060';
import type { WbaseReportParams } from '../../services/localagent';
import {
  getFeeItemList,
  saveFeeItem,
  batchSaveFeeItems,
  deleteFeeItem,
  printFeeItemList,
  callWbase1060Report,
  fetchDuplicateFeeCodes,
} from '../../services/wbase1060';

// 載入時各列 (_record_number) 的代號；Grid 改代號時 onSaveRow 只拿得到新代號，要靠這裡找回原代號
const loadedCodes = new Map<number, string>();
// 依序存檔：改代號後緊接著改名稱時，要等前一筆完成並記下新代號，才知道要更新哪一筆
let saveQueue: Promise<void> = Promise.resolve();
let lastDuplicateWarning = '';

interface Wbase1060State {
  rows: FeeItem[];
  setRows: (rows: FeeItem[]) => void;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  loading: boolean;
  errorToast: string | null;
  setErrorToast: (msg: string | null) => void;
  showAutoCloseToast: boolean;
  setShowAutoCloseToast: (show: boolean) => void;
  isDeleteConfirmOpen: boolean;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  isPrintOpen: boolean;
  printData: FeeItem[];
  printFilter: FeeItemPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: FeeItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: FeeItemPrintFilter) => Promise<FeeItem[]>;
  triggerReport: (params?: WbaseReportParams) => Promise<boolean>;
}

export const useWbase1060 = create<Wbase1060State>((set, get) => ({
  rows: [],
  setRows: (rows) => set({ rows }),
  selectedIndex: 0,
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
  loading: false,
  errorToast: null,
  setErrorToast: (errorToast) => set({ errorToast }),
  showAutoCloseToast: false,
  setShowAutoCloseToast: (showAutoCloseToast) => set({ showAutoCloseToast }),
  isDeleteConfirmOpen: false,
  setIsDeleteConfirmOpen: (isDeleteConfirmOpen) => set({ isDeleteConfirmOpen }),
  isPrintOpen: false,
  printData: [],
  printFilter: { codeStart: '', codeEnd: '' },

  refreshData: async (keyword) => {
    set({ loading: true });
    try {
      const data = await getFeeItemList(keyword);
      loadedCodes.clear();
      data.forEach((r) => {
        if (r._record_number) loadedCodes.set(r._record_number, r.itemno);
      });
      set({ rows: data, loading: false });
    } catch (e) {
      console.error('Failed to load fee items:', e);
      set({ errorToast: '載入收費項目失敗，請重新連線', loading: false });
      return;
    }

    try {
      const duplicates = await fetchDuplicateFeeCodes();
      const warning = duplicates
        .map((d) => `${d.key} (第 ${d.recordNumbers.join('、')} 筆)`)
        .join('；');
      if (warning && warning !== lastDuplicateWarning) {
        set({ errorToast: `地端收費項目代號重複：${warning}。畫面只顯示每個代號的第一筆，請洽系統管理員清理 recitem.dbf` });
      }
      lastDuplicateWarning = warning;
    } catch (e) {
      console.error('Failed to load duplicate fee codes:', e);
    }
  },

  handleSaveRow: (updatedRow) => {
    const code = (updatedRow.itemno || updatedRow.feeCode || '').trim().toUpperCase();
    if (!code) return Promise.resolve();
    const run = async () => {
      const recno = updatedRow._record_number || 0;
      try {
        await saveFeeItem(updatedRow, recno ? loadedCodes.get(recno) : undefined);
        if (recno) loadedCodes.set(recno, code);
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      } catch (e: any) {
        console.error('Save row error:', e);
        set({ errorToast: e?.response?.data?.message || e?.message || '儲存收費項目失敗' });
      }
      // 失敗時也重新載入，讓 Grid 回到地端實際內容 (例如代號重複被拒時還原舊代號)
      await get().refreshData();
    };
    saveQueue = saveQueue.then(run, run);
    return saveQueue;
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      const success = await batchSaveFeeItems(get().rows);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      } else {
        set({ errorToast: '批次儲存失敗' });
      }
    } catch (e) {
      console.error('Batch save error:', e);
      set({ errorToast: '儲存過程中發生例外' });
    } finally {
      set({ loading: false });
    }
  },

  openDeleteConfirm: (idx) => {
    if (idx !== undefined) set({ selectedIndex: idx });
    set({ isDeleteConfirmOpen: true });
  },

  confirmDelete: async () => {
    const { rows, selectedIndex, refreshData } = get();
    const target = rows[selectedIndex];
    const code = (target?.itemno || target?.feeCode || '').trim();
    if (!target || !code) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteFeeItem(code);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e) {
      console.error('Delete fee item error:', e);
      set({ errorToast: '刪除收費項目失敗' });
    } finally {
      set({ isDeleteConfirmOpen: false });
    }
    return false;
  },

  openPrint: () => set({ isPrintOpen: true }),
  closePrint: () => set({ isPrintOpen: false }),

  fetchPrintDataList: async (filter) => {
    set({ loading: true });
    try {
      const data = await printFeeItemList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print data error:', e);
      set({ errorToast: '無法取得列印預覽資料', loading: false });
      return [];
    }
  },

  triggerReport: async (params) => {
    set({ loading: true });
    try {
      const res = await callWbase1060Report(get().printData, params);
      if (!res.success) {
        set({ errorToast: res.error || '呼叫 DLL 報表失敗', loading: false });
        return false;
      }
      set({ showAutoCloseToast: true, loading: false });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      return true;
    } catch (e) {
      console.error('Trigger DLL report error:', e);
      set({ errorToast: '呼叫 DLL 報表失敗，請確認 LocalAgent 是否已啟動', loading: false });
      return false;
    }
  },
}));
