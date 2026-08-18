import { create } from 'zustand';
import type {
  FeeItem,
  FeeItemPrintFilter,
  Waccrep3106bParams,
} from '../../services/wbase1060';
import {
  getFeeItemList,
  saveFeeItem,
  batchSaveFeeItems,
  deleteFeeItem,
  printFeeItemList,
  callWaccrep3106b,
} from '../../services/wbase1060';

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
  triggerReport: (params?: Waccrep3106bParams) => Promise<boolean>;
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
      set({ rows: data, loading: false });
    } catch (e) {
      console.error('Failed to load fee items:', e);
      set({ errorToast: '載入收費項目失敗，請重新連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.feeCode.trim()) return;
    try {
      const isNew = !get().rows.some((r) => r.feeCode === updatedRow.feeCode);
      const success = await saveFeeItem(updatedRow, isNew);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      }
    } catch (e) {
      console.error('Save row error:', e);
      set({ errorToast: '儲存收費項目失敗' });
    }
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
    if (!target || !target.feeCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteFeeItem(target.feeCode);
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
      await callWaccrep3106b(params);
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
