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
import { isValidEmail, EMAIL_SAVE_WARNING_TOAST } from '../../services/validation';

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
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
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
  toastMessage: null,
  setToastMessage: (toastMessage) => set({ toastMessage }),
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
    const code = (updatedRow.no || updatedRow.empCode || '').trim();
    if (!code) return;
    try {
      const isNew = !get().rows.some(
        (r) => (r.no || r.empCode || '').trim().toUpperCase() === code.toUpperCase()
      );
      if (isNew) {
        await createEmp(updatedRow);
      } else {
        await updateEmp(code, updatedRow);
      }
      const isEmailInvalid = !isValidEmail(updatedRow.email);
      const toastMsg = isEmailInvalid
        ? EMAIL_SAVE_WARNING_TOAST
        : '已成功儲存至 PostgreSQL 資料庫！';
      set({ showAutoCloseToast: true, toastMessage: toastMsg });
      setTimeout(() => set({ showAutoCloseToast: false }), 3000);
      await get().refreshData();
    } catch (e: any) {
      console.error('Save employee row error:', e);
      const msg = e?.response?.data?.message || e?.message || '儲存員工資料失敗';
      set({ errorToast: msg });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      for (const row of get().rows) {
        const code = (row.no || row.empCode || '').trim();
        if (code) {
          await updateEmp(code, row);
        }
      }
      const hasInvalidEmail = get().rows.some((r) => !isValidEmail(r.email));
      const toastMsg = hasInvalidEmail
        ? EMAIL_SAVE_WARNING_TOAST
        : '已成功儲存至 PostgreSQL 資料庫！';
      set({ showAutoCloseToast: true, toastMessage: toastMsg });
      setTimeout(() => set({ showAutoCloseToast: false }), 3000);
      await get().refreshData();
    } catch (e: any) {
      console.error('Batch save employee error:', e);
      const msg = e?.response?.data?.message || e?.message || '儲存過程中發生例外';
      set({ errorToast: msg });
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
    const code = (target?.no || target?.empCode || '').trim();
    if (!target || !code) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteEmp(code);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e: any) {
      console.error('Delete employee error:', e);
      const msg = e?.response?.data?.message || e?.message || '刪除員工資料失敗';
      set({ errorToast: msg });
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
