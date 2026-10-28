import { create } from 'zustand';
import type {
  NoteItem,
  NoteItemPrintFilter,
  Waccrep3106bParams,
} from '../../services/wbase1070';
import {
  getNoteItemList,
  saveNoteItem,
  batchSaveNoteItems,
  deleteNoteItem,
  printNoteItemList,
  callWaccrep3106b,
} from '../../services/wbase1070';

interface Wbase1070State {
  rows: NoteItem[];
  setRows: (rows: NoteItem[]) => void;
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
  printData: NoteItem[];
  printFilter: NoteItemPrintFilter;

  // Actions
  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: NoteItem) => Promise<void>;
  handleSaveAll: () => Promise<void>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: NoteItemPrintFilter) => Promise<NoteItem[]>;
  triggerReport: (params?: Waccrep3106bParams) => Promise<boolean>;
}

export const useWbase1070 = create<Wbase1070State>((set, get) => ({
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
      const data = await getNoteItemList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });
    } catch (e: any) {
      console.error('Failed to load note items:', e);
      const msg = e?.response?.data?.message || e?.message || '載入收費備註失敗，請重新連線';
      set({ errorToast: msg, loading: false });
    }
  },

  handleSaveRow: async (updatedRow) => {
    const code = (updatedRow.noteno || updatedRow.noteCode || '').trim();
    if (!code) return;
    try {
      const isNew = !get().rows.some(
        (r) => (r.noteno || r.noteCode || '').trim().toUpperCase() === code.toUpperCase()
      );
      const success = await saveNoteItem(updatedRow, isNew);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      }
    } catch (e: any) {
      console.error('Save note item row error:', e);
      const msg = e?.response?.data?.message || e?.message || '儲存收費備註失敗';
      set({ errorToast: msg });
    }
  },

  handleSaveAll: async () => {
    set({ loading: true });
    try {
      const success = await batchSaveNoteItems(get().rows);
      if (success) {
        set({ showAutoCloseToast: true });
        setTimeout(() => set({ showAutoCloseToast: false }), 2000);
        await get().refreshData();
      } else {
        set({ errorToast: '批次儲存失敗' });
      }
    } catch (e: any) {
      console.error('Batch save error:', e);
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
    const code = (target?.noteno || target?.noteCode || '').trim();
    if (!target || !code) {
      const newRows = [...rows];
      newRows.splice(selectedIndex, 1);
      set({ rows: newRows, isDeleteConfirmOpen: false });
      return true;
    }

    try {
      const res = await deleteNoteItem(code);
      if (res) {
        set({
          selectedIndex: Math.max(0, selectedIndex - 1),
          isDeleteConfirmOpen: false,
        });
        await refreshData();
        return true;
      }
    } catch (e: any) {
      console.error('Delete note item error:', e);
      const msg = e?.response?.data?.message || e?.message || '刪除收費備註失敗';
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
      const data = await printNoteItemList(filter);
      set({ printData: data, printFilter: filter, loading: false });
      return data;
    } catch (e: any) {
      console.error('Fetch print data error:', e);
      const msg = e?.response?.data?.message || e?.message || '無法取得列印預覽資料';
      set({ errorToast: msg, loading: false });
      return [];
    }
  },

  triggerReport: async (params) => {
    set({ loading: true });
    try {
      await callWaccrep3106b(params);
      set({ loading: false });
      return true;
    } catch (e: any) {
      console.error('Trigger report error:', e);
      const msg = e?.response?.data?.message || e?.message || '列印報表失敗';
      set({ errorToast: msg, loading: false });
      return false;
    }
  },
}));
