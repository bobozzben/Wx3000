import { create } from 'zustand';
import type {
  CpaItem,
  CpaFormInput,
  CpaPrintFilter,
} from '../../services/wbase1020';
import {
  getCpaList,
  createCpa,
  updateCpa,
  deleteCpa,
  printCpaList,
} from '../../services/wbase1020';

export const initialFormState: CpaFormInput = {
  cpaCode: '',
  cpaName: '',
  licenseNo: '',
  officeName: '',
  tel: '',
  fax: '',
  address: '',
  memo: '',
};

interface Wbase1020State {
  list: CpaItem[];
  selectedItem: CpaItem | null;
  searchKeyword: string;
  isFormOpen: boolean;
  formMode: 'add' | 'edit';
  formData: CpaFormInput;
  isDeleteConfirmOpen: boolean;
  isPrintOpen: boolean;
  printFilter: CpaPrintFilter;
  printData: CpaItem[];
  loading: boolean;
  actionMessage: { type: 'success' | 'error'; text: string } | null;

  // Actions
  setSearchKeyword: (keyword: string) => void;
  fetchList: (kw?: string) => Promise<void>;
  selectItem: (item: CpaItem | null) => void;
  openAddForm: () => void;
  openEditForm: (item?: CpaItem) => void;
  closeForm: () => void;
  setFormData: (data: Partial<CpaFormInput>) => void;
  saveForm: () => Promise<boolean>;
  openDeleteConfirm: (item?: CpaItem) => void;
  closeDeleteConfirm: () => void;
  confirmDelete: () => Promise<boolean>;
  openPrint: () => void;
  closePrint: () => void;
  fetchPrintData: (filter: CpaPrintFilter) => Promise<CpaItem[]>;
  clearActionMessage: () => void;
}

export const useWbase1020 = create<Wbase1020State>((set, get) => ({
  list: [],
  selectedItem: null,
  searchKeyword: '',
  isFormOpen: false,
  formMode: 'add',
  formData: { ...initialFormState },
  isDeleteConfirmOpen: false,
  isPrintOpen: false,
  printFilter: { cpaCodeStart: '', cpaCodeEnd: '' },
  printData: [],
  loading: false,
  actionMessage: null,

  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),

  fetchList: async (kw) => {
    const keyword = kw !== undefined ? kw : get().searchKeyword;
    set({ loading: true });
    try {
      const data = await getCpaList(keyword);
      const safeData = Array.isArray(data) ? data : [];
      set({
        list: safeData,
        selectedItem: safeData.length > 0 ? safeData[0] : null,
        loading: false,
      });
    } catch (err: any) {
      console.error('Fetch list error:', err);
      set({
        loading: false,
        actionMessage: { type: 'error', text: '載入會計師資料失敗，請確認後端服務。' },
      });
    }
  },

  selectItem: (selectedItem) => set({ selectedItem }),

  openAddForm: () => {
    set({
      isFormOpen: true,
      formMode: 'add',
      formData: { ...initialFormState },
    });
  },

  openEditForm: (item) => {
    const target = item || get().selectedItem;
    if (!target) return;
    set({
      isFormOpen: true,
      formMode: 'edit',
      formData: {
        cpaCode: target.cpaCode,
        cpaName: target.cpaName,
        licenseNo: target.licenseNo || '',
        officeName: target.officeName || '',
        tel: target.tel || '',
        fax: target.fax || '',
        address: target.address || '',
        memo: target.memo || '',
      },
    });
  },

  closeForm: () => set({ isFormOpen: false }),

  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),

  saveForm: async () => {
    const { formMode, formData, fetchList } = get();
    if (!formData.cpaCode.trim()) {
      set({ actionMessage: { type: 'error', text: '「會計師代號」不可為空！' } });
      return false;
    }
    if (!formData.cpaName.trim()) {
      set({ actionMessage: { type: 'error', text: '「會計師姓名」不可為空！' } });
      return false;
    }

    set({ loading: true });
    try {
      const payload: CpaFormInput = {
        ...formData,
        cpaCode: formData.cpaCode.trim().toUpperCase(),
      };

      if (formMode === 'add') {
        await createCpa(payload);
        set({ actionMessage: { type: 'success', text: `🎉 會計師 [${payload.cpaCode}] 新增成功！` } });
      } else {
        await updateCpa(payload.cpaCode, payload);
        set({ actionMessage: { type: 'success', text: `🎉 會計師 [${payload.cpaCode}] 更新成功！` } });
      }

      set({ isFormOpen: false, loading: false });
      await fetchList();
      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      const msg = err?.response?.data?.message || err?.message || '儲存失敗';
      set({
        loading: false,
        actionMessage: { type: 'error', text: `❌ 儲存失敗: ${msg}` },
      });
      return false;
    }
  },

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
      await deleteCpa(selectedItem.cpaCode);
      set({
        isDeleteConfirmOpen: false,
        loading: false,
        actionMessage: { type: 'success', text: `🗑️ 會計師 [${selectedItem.cpaCode}] 已刪除！` },
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
      const data = await printCpaList(filter);
      set({ printData: data, printFilter: filter });
      return data;
    } catch (err: any) {
      console.error('Print fetch error:', err);
      set({ actionMessage: { type: 'error', text: '取得列印資料失敗' } });
      return [];
    }
  },

  clearActionMessage: () => set({ actionMessage: null }),
}));
