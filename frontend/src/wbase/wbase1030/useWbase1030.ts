import { create } from 'zustand';
import type { EmpItem, EmpPrintFilter, Waccrep3101bParams } from '../../services/wbase1030';
import {
  getEmpList,
  deleteEmp,
  printEmpList,
  callWaccrep3101b,
} from '../../services/wbase1030';

interface Wbase1030State {
  list: EmpItem[];
  selectedItem: EmpItem | null;
  searchKeyword: string;
  isDeleteConfirmOpen: boolean;
  isPrintOpen: boolean;
  printFilter: EmpPrintFilter;
  printData: EmpItem[];
  loading: boolean;
  actionMessage: { type: 'success' | 'error'; text: string } | null;

  // Actions
  setSearchKeyword: (keyword: string) => void;
  fetchList: (kw?: string) => Promise<void>;
  selectItem: (item: EmpItem | null) => void;
  openDeleteConfirm: (item?: EmpItem) => void;
  closeDeleteConfirm: () => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintData: (filter: EmpPrintFilter) => Promise<EmpItem[]>;
  triggerReportDll: (params?: Waccrep3101bParams) => Promise<boolean>;
  clearActionMessage: () => void;
}

export const useWbase1030 = create<Wbase1030State>((set, get) => ({
  list: [],
  selectedItem: null,
  searchKeyword: '',
  isDeleteConfirmOpen: false,
  isPrintOpen: false,
  printFilter: { codeStart: '', codeEnd: '' },
  printData: [],
  loading: false,
  actionMessage: null,

  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),

  fetchList: async (kw) => {
    const keyword = kw !== undefined ? kw : get().searchKeyword;
    set({ loading: true });
    try {
      const data = await getEmpList(keyword);
      set({
        list: data,
        selectedItem: data.length > 0 ? data[0] : null,
        loading: false,
      });
    } catch (err: any) {
      console.error('Fetch emp list error:', err);
      set({
        loading: false,
        actionMessage: { type: 'error', text: '載入人員資料失敗，請確認後端服務。' },
      });
    }
  },

  selectItem: (selectedItem) => set({ selectedItem }),

  openDeleteConfirm: (item) => {
    const target = item || get().selectedItem;
    if (!target) return;
    set({ selectedItem: target, isDeleteConfirmOpen: true });
  },

  closeDeleteConfirm: () => set({ isDeleteConfirmOpen: false }),

  confirmDelete: async () => {
    const { selectedItem, fetchList } = get();
    if (!selectedItem) return false;

    set({ loading: true });
    try {
      await deleteEmp(selectedItem.empCode);
      set({
        isDeleteConfirmOpen: false,
        loading: false,
        actionMessage: { type: 'success', text: `🗑️ 人員 [${selectedItem.empCode}] 已刪除！` },
      });
      await fetchList();
      return true;
    } catch (err: any) {
      console.error('Delete error:', err);
      const msg = err?.response?.data?.message || err?.message || '刪除失敗';
      set({
        loading: false,
        actionMessage: { type: 'error', text: `❌ 刪除失敗: ${msg}` },
      });
      return false;
    }
  },

  openPrint: () => set({ isPrintOpen: true }),
  closePrint: () => set({ isPrintOpen: false }),

  fetchPrintData: async (filter) => {
    try {
      const data = await printEmpList(filter);
      set({ printData: data, printFilter: filter });
      return data;
    } catch (err: any) {
      console.error('Print fetch error:', err);
      set({ actionMessage: { type: 'error', text: '取得列印資料失敗' } });
      return [];
    }
  },

  triggerReportDll: async (params) => {
    set({ loading: true });
    try {
      const res = await callWaccrep3101b(params);
      set({
        loading: false,
        actionMessage: {
          type: 'success',
          text: `🖨️ 成功呼叫 DLL 報表 (waccrep3101_b)！傳回碼: ${res.result}`,
        },
      });
      return true;
    } catch (err: any) {
      console.error('Call waccrep3101_b error:', err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        '無法連線至 LocalAgent (http://localhost:18889/report)';
      set({
        loading: false,
        actionMessage: {
          type: 'error',
          text: `❌ 呼叫 DLL 報表失敗: ${msg}`,
        },
      });
      return false;
    }
  },

  clearActionMessage: () => set({ actionMessage: null }),
}));

