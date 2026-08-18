import { create } from 'zustand';
import type {
  EmpItem,
  EmpPrintFilter,
  Waccrep3106bParams,
} from '../../services/wbase1030';
import {
  getEmpList,
  createEmp,
  updateEmp,
  deleteEmp,
  printEmpList,
  callWaccrep3106b,
} from '../../services/wbase1030';

interface Wbase1030State {
  rows: EmpItem[];
  setRows: (rows: EmpItem[]) => void;
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
  printData: EmpItem[];
  printFilter: EmpPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: EmpItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: EmpPrintFilter) => Promise<EmpItem[]>;
  fetchPrintData: (filter: EmpPrintFilter) => Promise<EmpItem[]>;
  triggerReportDll: (params?: Waccrep3106bParams) => Promise<boolean>;
}

export const useWbase1030 = create<Wbase1030State>((set, get) => ({
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
  printFilter: { empCodeStart: '', empCodeEnd: '' },

  refreshData: async (keyword) => {
    set({ loading: true });
    try {
      const data = await getEmpList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });
    } catch (e) {
      console.error('Failed to load employee items:', e);
      set({ errorToast: '載入員工資料失敗，請重新連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    if (!updatedRow.empCode || !updatedRow.empCode.trim()) return;
    try {
      const isNew = !get().rows.some((r) => r.empCode === updatedRow.empCode);
      if (isNew) {
        await createEmp(updatedRow);
      } else {
        await updateEmp(updatedRow.empCode.trim(), updatedRow);
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Save employee row error:', e);
      set({ errorToast: '儲存員工資料失敗' });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      for (const row of get().rows) {
        if (row.empCode && row.empCode.trim()) {
          await updateEmp(row.empCode.trim(), row);
        }
      }
      set({ showAutoCloseToast: true });
      setTimeout(() => set({ showAutoCloseToast: false }), 2000);
      await get().refreshData();
    } catch (e) {
      console.error('Batch save employee error:', e);
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
    if (!target || !target.empCode) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteEmp(target.empCode);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e) {
      console.error('Delete employee error:', e);
      set({ errorToast: '刪除員工資料失敗' });
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
      const data = await printEmpList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e) {
      console.error('Fetch print employee data error:', e);
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
