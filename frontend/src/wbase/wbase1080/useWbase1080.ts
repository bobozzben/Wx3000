import { create } from 'zustand';
import type {
  FeeSummary,
  FeeSummaryPrintFilter,
  Waccrep3106bParams,
} from '../../services/wbase1080';
import {
  getFeeSummaryList,
  saveFeeSummary,
  batchSaveFeeSummaries,
  deleteFeeSummary,
  printFeeSummaryList,
  callWaccrep3106b,
} from '../../services/wbase1080';

interface Wbase1080State {
  rows: FeeSummary[];
  setRows: (rows: FeeSummary[]) => void;
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
  printData: FeeSummary[];
  printFilter: FeeSummaryPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: FeeSummary) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: FeeSummaryPrintFilter) => Promise<FeeSummary[]>;
  fetchPrintData: (filter: FeeSummaryPrintFilter) => Promise<FeeSummary[]>;
  triggerReport: (params?: Waccrep3106bParams) => Promise<boolean>;
}

export const useWbase1080 = create<Wbase1080State>((set, get) => ({
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
      const data = await getFeeSummaryList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });
    } catch (e) {
      console.error('Failed to load fee summary items:', e);
      set({ errorToast: '載入收費摘要失敗，請重新連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.summaryCode || !updatedRow.summaryCode.trim()) return;
    try {
      const isNew = !get().rows.some((r) => r.summaryCode === updatedRow.summaryCode);
      const success = await saveFeeSummary(updatedRow, isNew);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      }
    } catch (e) {
      console.error('Save fee summary row error:', e);
      set({ errorToast: '儲存收費摘要失敗' });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      const success = await batchSaveFeeSummaries(get().rows);
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
    if (!target || !target.summaryCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteFeeSummary(target.summaryCode);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e) {
      console.error('Delete fee summary error:', e);
      set({ errorToast: '刪除收費摘要失敗' });
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
      const data = await printFeeSummaryList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print data error:', e);
      set({ errorToast: '無法取得列印預覽資料', loading: false });
      return [];
    }
  },

  fetchPrintData: async (filter) => {
    return await get().fetchPrintDataList(filter);
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
      set({ errorToast: '呼叫 DLL 報表失敗', loading: false });
      return false;
    }
  },
}));
