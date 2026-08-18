import { create } from 'zustand';
import type {
  TaxOfficerItem,
  TaxOfficerPrintFilter,
  Waccrep3106bParams,
} from '../../services/wbase1050';
import {
  getTaxOfficerList,
  createTaxOfficer,
  updateTaxOfficer,
  deleteTaxOfficer,
  printTaxOfficerList,
  callWaccrep3106b,
} from '../../services/wbase1050';

interface Wbase1050State {
  rows: TaxOfficerItem[];
  setRows: (rows: TaxOfficerItem[]) => void;
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
  printData: TaxOfficerItem[];
  printFilter: TaxOfficerPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: TaxOfficerItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: TaxOfficerPrintFilter) => Promise<TaxOfficerItem[]>;
  fetchPrintData: (filter: TaxOfficerPrintFilter) => Promise<TaxOfficerItem[]>;
  triggerReportDll: (params?: Waccrep3106bParams) => Promise<boolean>;
}

export const useWbase1050 = create<Wbase1050State>((set, get) => ({
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
  printFilter: { taxCodeStart: '', taxCodeEnd: '' },

  refreshData: async (keyword) => {
    set({ loading: true });
    try {
      const data = await getTaxOfficerList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });
    } catch (e) {
      console.error('Failed to load tax officer items:', e);
      set({ errorToast: '載入稅務人員資料失敗，請重新連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.taxCode || !updatedRow.taxCode.trim()) return;
    try {
      const isNew = !get().rows.some((r) => r.taxCode === updatedRow.taxCode);
      if (isNew) {
        await createTaxOfficer(updatedRow);
      } else {
        await updateTaxOfficer(updatedRow.taxCode.trim(), updatedRow);
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Save tax officer row error:', e);
      set({ errorToast: '儲存稅務人員資料失敗' });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      for (const row of get().rows) {
        if (row.taxCode && row.taxCode.trim()) {
          await updateTaxOfficer(row.taxCode.trim(), row);
        }
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Batch save tax officer error:', e);
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
    if (!target || !target.taxCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteTaxOfficer(target.taxCode);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e) {
      console.error('Delete tax officer error:', e);
      set({ errorToast: '刪除稅務人員資料失敗' });
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
      const data = await printTaxOfficerList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print tax officer data error:', e);
      set({ errorToast: '無法取得列印預覽資料', loading: false });
      return [];
    }
  },

  fetchPrintData: async (filter) => {
    return await get().fetchPrintDataList(filter);
  },

  triggerReportDll: async (params) => {
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
