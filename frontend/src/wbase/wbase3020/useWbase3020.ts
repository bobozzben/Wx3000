import { create } from 'zustand';
import type { InvoicePurchaseItem, PrintRangeQuery } from '../../services/wbase3020';
import {
  fetchInvoicePurchaseList,
  saveInvoicePurchaseItem,
  batchSaveInvoicePurchaseItems,
  deleteInvoicePurchaseItem,
  fetchPrintInvoicePurchaseList,
} from '../../services/wbase3020';

interface Wbase3020State {
  period: string;
  times: string;
  inputMode: string;
  inputCondition: string;
  setSearchParams: (params: { period: string; times: string; inputMode: string; inputCondition: string }) => void;

  rows: InvoicePurchaseItem[];
  setRows: (rows: InvoicePurchaseItem[]) => void;
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
  printData: InvoicePurchaseItem[];

  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: InvoicePurchaseItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: PrintRangeQuery) => Promise<InvoicePurchaseItem[]>;
}

export const useWbase3020 = create<Wbase3020State>((set, get) => ({
  period: '11505-06',
  times: '1',
  inputMode: '1',
  inputCondition: '',

  setSearchParams: ({ period, times, inputMode, inputCondition }) => {
    set({ period, times, inputMode, inputCondition });
  },

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

  refreshData: async (keyword) => {
    set({ loading: true });
    try {
      const { period, times, inputMode, inputCondition } = get();
      const data = await fetchInvoicePurchaseList(period, times, keyword, inputMode, inputCondition);
      const uniqueMap = new Map<string, InvoicePurchaseItem>();
      data.forEach((item) => {
        const key = (item.companyCode || '').trim().toUpperCase();
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });
      set({ rows: Array.from(uniqueMap.values()), loading: false });
    } catch (e) {
      console.error('Failed to load invoice purchase items:', e);
      set({ errorToast: '載入發票購買資料失敗，請確認連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.companyCode.trim()) return;
    try {
      const { rows, period, times } = get();
      const isNew = !rows.some((r) => r.companyCode === updatedRow.companyCode);
      const rowToSave = { ...updatedRow, period, times };
      const success = await saveInvoicePurchaseItem(rowToSave, isNew);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      }
    } catch (e) {
      console.error('Save row error:', e);
      set({ errorToast: '儲存發票購買資料失敗' });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      const success = await batchSaveInvoicePurchaseItems(get().rows);
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
    const { rows, selectedIndex, period, times, refreshData } = get();
    const target = rows[selectedIndex];
    if (!target || !target.companyCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteInvoicePurchaseItem(period, times, target.companyCode);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e) {
      console.error('Delete invoice purchase error:', e);
      set({ errorToast: '刪除紀錄失敗' });
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
      const { period, times } = get();
      const data = await fetchPrintInvoicePurchaseList({ ...filter, period, times });
      set({ printData: data, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print data error:', e);
      set({ errorToast: '無法取得列印預覽資料', loading: false });
      return [];
    }
  },
}));
