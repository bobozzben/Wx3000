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
  validateCpaForm,
  getNextAutoNo,
} from '../../services/wbase1020';

const EMPTY_ROW: CpaItem = {
  cpaCode: '',
  certType: '',
  cpaName: '',
  taxId: '',
  licenseNo: '',
  docTrack: '',
  certNo: '',
  tel: '',
  mobile: '',
  fax: '',
  unifiedNo: '',
  address: '',
  guildNo1: '',
  guildNo2: '',
  email: '',
  officeName: '',
  memberNo: '',
  memo: '',
};

interface Wbase1020State {
  rows: CpaItem[];
  setRows: (rows: CpaItem[]) => void;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  mode: 'grid' | 'edit' | 'add';
  setMode: (mode: 'grid' | 'edit' | 'add') => void;
  formData: CpaItem;
  setFormData: (data: CpaItem | ((prev: CpaItem) => CpaItem)) => void;

  loading: boolean;
  errorToast: string | null;
  setErrorToast: (msg: string | null) => void;
  showAutoCloseToast: boolean;
  setShowAutoCloseToast: (show: boolean) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  isDeleteConfirmOpen: boolean;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isPrintOpen: boolean;
  printData: CpaItem[];
  printFilter: CpaPrintFilter;

  // Actions
  refreshData: (targetCode?: string) => Promise<void>;
  startEdit: () => void;
  startAdd: () => void;
  cancelEdit: () => void;
  saveForm: () => Promise<boolean>;
  openDeleteConfirm: (idx?: number) => void;
  confirmDelete: () => Promise<boolean>;
  openSearchModal: () => void;
  closeSearchModal: () => void;
  selectRowFromSearch: (code: string) => void;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintDataList: (filter: CpaPrintFilter) => Promise<CpaItem[]>;
  fetchPrintData: (filter: CpaPrintFilter) => Promise<CpaItem[]>;
}

export const useWbase1020 = create<Wbase1020State>((set, get) => ({
  rows: [],
  setRows: (rows) => set({ rows }),
  selectedIndex: 0,
  setSelectedIndex: (selectedIndex) => {
    const { rows, mode } = get();
    set({ selectedIndex });
    if (mode === 'grid') {
      const selectedRow = rows[selectedIndex];
      if (selectedRow) {
        set({ formData: { ...selectedRow } });
      }
    }
  },
  mode: 'grid',
  setMode: (mode) => set({ mode }),
  formData: { ...EMPTY_ROW },
  setFormData: (data) =>
    set((state) => ({
      formData: typeof data === 'function' ? data(state.formData) : data,
    })),

  loading: false,
  errorToast: null,
  setErrorToast: (errorToast) => set({ errorToast }),
  showAutoCloseToast: false,
  setShowAutoCloseToast: (showAutoCloseToast) => set({ showAutoCloseToast }),
  toastMessage: null,
  setToastMessage: (toastMessage) => set({ toastMessage }),
  isDeleteConfirmOpen: false,
  setIsDeleteConfirmOpen: (isDeleteConfirmOpen) => set({ isDeleteConfirmOpen }),
  isSearchOpen: false,
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  isPrintOpen: false,
  printData: [],
  printFilter: { cpaCodeStart: '', cpaCodeEnd: '' },

  refreshData: async (targetCode?: string) => {
    set({ loading: true });
    try {
      const data = await getCpaList();
      const safeData = Array.isArray(data) ? data : [];
      set({ rows: safeData, loading: false });

      if (safeData.length > 0) {
        let nextIdx = 0;
        if (targetCode) {
          const foundIdx = safeData.findIndex(
            (r) => r.cpaCode.toLowerCase() === targetCode.toLowerCase()
          );
          if (foundIdx !== -1) nextIdx = foundIdx;
        } else {
          const curIdx = get().selectedIndex;
          nextIdx = curIdx < safeData.length ? curIdx : 0;
        }
        set({ selectedIndex: nextIdx, formData: { ...safeData[nextIdx] } });
      } else {
        set({ selectedIndex: 0, formData: { ...EMPTY_ROW } });
      }
    } catch (e) {
      console.error('Failed to load CPA items:', e);
      set({ errorToast: '載入會計師/記帳士資料失敗，請重新連線', loading: false });
    }
  },

  startEdit: () => {
    const { rows, selectedIndex } = get();
    const current = rows[selectedIndex];
    if (!current) return;
    set({ mode: 'edit', formData: { ...current } });
  },

  startAdd: () => {
    const { rows } = get();
    const newCode = getNextAutoNo(rows.map((r) => r.cpaCode));
    set({
      mode: 'add',
      formData: {
        ...EMPTY_ROW,
        cpaCode: newCode,
        certType: '1',
      },
    });
  },

  cancelEdit: () => {
    const { rows, selectedIndex } = get();
    const current = rows[selectedIndex];
    set({
      mode: 'grid',
      formData: current ? { ...current } : { ...EMPTY_ROW },
    });
  },

  saveForm: async () => {
    const { mode, formData, rows, selectedIndex, refreshData } = get();
    const originalRow = mode === 'edit' ? rows[selectedIndex] : undefined;
    const originalCode = originalRow?.cpaCode;

    // 前置欄位驗證 (必填、唯一性、Big5 哨兵、提示性檢查)
    const valResult = validateCpaForm(formData, rows, mode, originalCode);
    if (!valResult.isValid) {
      set({ errorToast: valResult.blockingErrors[0] || '欄位驗證未通過' });
      return false;
    }

    // 正規化欄位 (代號、申報ID、統編自動大寫截白)
    const payload: CpaItem = {
      ...formData,
      cpaCode: (formData.cpaCode || '').trim().toUpperCase(),
      cpaName: (formData.cpaName || '').trim(),
      taxId: (formData.taxId || '').trim().toUpperCase(),
      unifiedNo: (formData.unifiedNo || '').trim().toUpperCase(),
      certType: (formData.certType || '').trim(),
      docTrack: (formData.docTrack || '').trim(),
      email: (formData.email || '').trim(),
    };

    try {
      if (mode === 'add') {
        await createCpa(payload);
      } else {
        await updateCpa(originalCode ? originalCode.trim() : payload.cpaCode, payload);
      }

      // 產生存檔提示訊息 (若有非阻斷提示性警告，呈現友善提示)
      let saveMsg = '資料已成功儲存至 DBF 與 PostgreSQL！';
      if (valResult.warnings.length > 0) {
        saveMsg = `已成功儲存！(⚠️ 提示：${valResult.warnings.join('、')}，已照常存檔)`;
      }

      set({
        showAutoCloseToast: true,
        toastMessage: saveMsg,
        mode: 'grid',
      });
      setTimeout(() => set({ showAutoCloseToast: false }), 4000);
      await refreshData(payload.cpaCode);
      return true;
    } catch (e: any) {
      console.error('Save CPA error:', e);
      const errMsg = e.response?.data?.message || '儲存資料失敗';
      set({ errorToast: errMsg });
      return false;
    }
  },

  openDeleteConfirm: (idx) => {
    if (idx !== undefined) {
      get().setSelectedIndex(idx);
    }
    set({ isDeleteConfirmOpen: true });
  },

  confirmDelete: async () => {
    const { rows, selectedIndex, refreshData } = get();
    const target = rows[selectedIndex];
    if (!target || !target.cpaCode) {
      set({ isDeleteConfirmOpen: false });
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

  openSearchModal: () => {
    set({ searchQuery: '', isSearchOpen: true });
  },

  closeSearchModal: () => {
    set({ searchQuery: '', isSearchOpen: false });
  },

  selectRowFromSearch: (code: string) => {
    const { rows, setSelectedIndex } = get();
    const idx = rows.findIndex((r) => r.cpaCode.toLowerCase() === code.toLowerCase());
    if (idx !== -1) {
      setSelectedIndex(idx);
    }
    set({ isSearchOpen: false, searchQuery: '' });
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
