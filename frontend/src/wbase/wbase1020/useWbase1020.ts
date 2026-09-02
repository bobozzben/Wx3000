import { create } from 'zustand';
import type {
  CpaItem,
  CpaPrintFilter,
} from '../../services/wbase1020';
import {
  getCpaList,
  createCpa,
  updateCpa,
  deleteCpa,
  printCpaList,
} from '../../services/wbase1020';

interface Wbase1020State {
  rows: CpaItem[];
  setRows: (rows: CpaItem[]) => void;
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
  printData: CpaItem[];
  printFilter: CpaPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: CpaItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: CpaPrintFilter) => Promise<CpaItem[]>;
  fetchPrintData: (filter: CpaPrintFilter) => Promise<CpaItem[]>;
}

export const useWbase1020 = create<Wbase1020State>((set, get) => ({
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
  printFilter: { cpaCodeStart: '', cpaCodeEnd: '' },

  refreshData: async (keyword) => {
    set({ loading: true });
    try {
      const data = await getCpaList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });
    } catch (e) {
      console.error('Failed to load CPA items:', e);
      set({ errorToast: '載入會計師資料失敗，請重新連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.cpaCode || !updatedRow.cpaCode.trim()) return;
    try {
      const isNew = !get().rows.some((r) => r.cpaCode === updatedRow.cpaCode);
      if (isNew) {
        await createCpa(updatedRow);
      } else {
        await updateCpa(updatedRow.cpaCode.trim(), updatedRow);
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Save CPA row error:', e);
      set({ errorToast: '儲存會計師資料失敗' });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      for (const row of get().rows) {
        if (row.cpaCode && row.cpaCode.trim()) {
          await updateCpa(row.cpaCode.trim(), row);
        }
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Batch save CPA error:', e);
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
    if (!target || !target.cpaCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      await deleteCpa(target.cpaCode);
      set({
        selectedIndex: Math.max(0, selectedIndex - 1),
        isDeleteConfirmOpen: false,
      });
      await refreshData();
      return true;
    } catch (e) {
      console.error('Delete CPA error:', e);
      set({ errorToast: '刪除會計師資料失敗' });
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
      const data = await printCpaList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print CPA data error:', e);
      set({ errorToast: '無法取得列印預覽資料', loading: false });
      return [];
    }
  },

  fetchPrintData: async (filter) => {
    return await get().fetchPrintDataList(filter);
  },
}));
