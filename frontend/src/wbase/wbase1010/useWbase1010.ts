import { create } from 'zustand';
import {
  CSTORE_BYTES,
  EMPTY_OFFICE,
  apiErrorMessage,
  deleteCstore,
  fetchCstoreList,
  fetchOffice,
  newCstoreKey,
  saveCstore,
  saveOffice,
  type CstoreItem,
  type OfficeInfo,
} from '../../services/wbase1010';
import { checkBig5Compatible, truncateBig5 } from '../../services/validation';

export type Wbase1010View = 'office' | 'cstore';

export interface Wbase1010Toast {
  message: string;
  type: 'error' | 'warning' | 'success';
}

export type Wbase1010Confirm =
  | { kind: 'deleteCstore'; row: CstoreItem }
  | { kind: 'leaveOffice' }
  | null;

/** 開啟中的選單：地址選單 (預設事務所或格線的列) / F8 尋找 */
export type Wbase1010Picker =
  | { kind: 'officeAddr' }
  | { kind: 'cstoreAddr'; rowKey: string; value: string }
  | { kind: 'cstoreSearch' }
  | null;

interface Wbase1010State {
  view: Wbase1010View;
  loading: boolean;
  /** 存檔或刪除中：期間的按鍵一律攔下，避免落到格線 */
  busy: boolean;
  toast: Wbase1010Toast | null;
  confirm: Wbase1010Confirm;
  picker: Wbase1010Picker;

  // 預設事務所資料 (wbase1010)
  office: OfficeInfo;
  form: OfficeInfo;

  // F4 事務所資料 (wbase1010f4)
  cstoreRows: CstoreItem[];
  /** 要求格線移到的列 (F8 尋找)；搭配 cstoreGridEpoch 重新掛載格線，同一列也能再次定位 */
  cstoreFocusKey?: string;
  cstoreGridEpoch: number;
  cstoreSelectedKey?: string;
  cstoreDirection: 'right' | 'down';
  isPrintOpen: boolean;

  reset: () => void;
  showToast: (message: string, type?: Wbase1010Toast['type']) => void;
  clearToast: () => void;
  setConfirm: (confirm: Wbase1010Confirm) => void;
  setPicker: (picker: Wbase1010Picker) => void;
  isDirty: () => boolean;

  loadOffice: () => Promise<void>;
  setField: (field: keyof OfficeInfo, value: string) => void;
  saveOfficeForm: () => Promise<boolean>;

  openCstore: () => Promise<void>;
  closeCstore: () => Promise<void>;
  loadCstore: () => Promise<void>;
  setCstoreRows: (rows: CstoreItem[]) => void;
  setCstoreSelectedKey: (key?: string) => void;
  addCstoreRow: () => void;
  saveCstoreRow: (row: CstoreItem) => Promise<void>;
  askDeleteCstore: (row?: CstoreItem) => void;
  removeCstore: (row: CstoreItem) => Promise<void>;
  /** F5 轉入預設：把目前列帶入預設事務所資料 (尚未存檔) */
  transferToOffice: () => void;
  /** 格線地址選單關閉：選定時寫入該列並存檔 (addr 為 null 表示取消) */
  pickCstoreAddr: (addr: string | null) => void;
  locateCstore: (no: string) => void;
  toggleDirection: () => void;
  /** VFP f4.Click：沒有資料時提示，否則開啟列印視窗 (格線會卸載，兩者都監聽 window 按鍵) */
  openPrint: () => Promise<void>;
  /** 關閉列印視窗，重新掛載格線並回到原本的列 */
  closePrint: () => void;
}

const OFFICE_LABELS: Record<keyof OfficeInfo, string> = {
  name: '事務所名稱',
  taxNo: '事務所統編',
  engName: '英文名稱',
  addr: '事務所地址',
  tel: '事務所電話',
  fax: '事務所傳真',
  boss: '負責人',
  email: '電子郵件',
  contact: '聯絡人',
  pubImgPath: '數位憑證公用目錄',
};

const sameOffice = (a: OfficeInfo, b: OfficeInfo) =>
  (Object.keys(OFFICE_LABELS) as (keyof OfficeInfo)[]).every((k) => a[k].trim() === b[k].trim());

export const emptyCstoreRow = (): CstoreItem => ({
  _key: newCstoreKey(),
  origNo: '',
  recordNumber: 0,
  serial: 0,
  no: '',
  name: '',
  tel: '',
  fax: '',
  addr: '',
  hname: '',
  linkman: '',
  email: '',
  engname: '',
});

/** cstore 逐列存檔依序執行：新列的第一次存檔 (新增) 完成前，後續欄位的存檔要等它拿到統號與 RECNO */
let cstoreSaveChain: Promise<void> = Promise.resolve();

export const useWbase1010 = create<Wbase1010State>((set, get) => {
  const fail = (err: unknown, fallback: string) => get().showToast(apiErrorMessage(err, fallback), 'error');

  return {
    view: 'office',
    loading: false,
    busy: false,
    toast: null,
    confirm: null,
    picker: null,
    office: EMPTY_OFFICE,
    form: EMPTY_OFFICE,
    cstoreRows: [],
    cstoreFocusKey: undefined,
    cstoreGridEpoch: 0,
    cstoreSelectedKey: undefined,
    cstoreDirection: 'right',
    isPrintOpen: false,

    // store 是模組層級的單例，重新進入時回到初始狀態 (VFP 每次 newobj 重建表單)
    reset: () =>
      set({
        view: 'office',
        loading: false,
        busy: false,
        toast: null,
        confirm: null,
        picker: null,
        office: EMPTY_OFFICE,
        form: EMPTY_OFFICE,
        cstoreRows: [],
        cstoreFocusKey: undefined,
        cstoreSelectedKey: undefined,
        cstoreDirection: 'right',
        isPrintOpen: false,
      }),
    showToast: (message, type = 'error') => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null }),
    setConfirm: (confirm) => set({ confirm }),
    setPicker: (picker) => set({ picker }),
    isDirty: () => !sameOffice(get().form, get().office),

    // ------------------------------------------------------------ 預設事務所資料

    loadOffice: async () => {
      set({ loading: true });
      try {
        const office = await fetchOffice();
        set({ office, form: office });
      } catch (err) {
        fail(err, '讀取事務所資料失敗');
      } finally {
        set({ loading: false });
      }
    },

    setField: (field, value) => set((s) => ({ form: { ...s.form, [field]: value } })),

    // F8 確定 (VFP f8.Click 存檔後顯示「設定完成!!」，表單不關閉)
    saveOfficeForm: async () => {
      if (get().busy) return false;
      const form = get().form;
      for (const key of Object.keys(OFFICE_LABELS) as (keyof OfficeInfo)[]) {
        const b5 = checkBig5Compatible(form[key]);
        if (!b5.valid) {
          get().showToast(`${OFFICE_LABELS[key]}：${b5.message}`, 'error');
          return false;
        }
      }
      set({ busy: true });
      try {
        const office = await saveOffice(form);
        set({ office, form: office });
        get().showToast('設定完成!!', 'success');
        return true;
      } catch (err) {
        fail(err, '儲存事務所資料失敗');
        return false;
      } finally {
        set({ busy: false });
      }
    },

    // ------------------------------------------------------------ F4 事務所資料

    openCstore: async () => {
      if (get().busy) return;
      set({
        view: 'cstore',
        cstoreRows: [],
        cstoreFocusKey: undefined,
        cstoreSelectedKey: undefined,
        cstoreDirection: 'right',
        isPrintOpen: false,
      });
      await get().loadCstore();
    },

    closeCstore: async () => {
      set({ busy: true });
      try {
        await cstoreSaveChain;
      } finally {
        set({ busy: false, view: 'office', isPrintOpen: false, cstoreRows: [] });
      }
    },

    loadCstore: async () => {
      set({ loading: true });
      try {
        // 格線不重新掛載，游標留在原本的列號 (刪除後停在下一筆，同 VFP SKIP)
        set({ cstoreRows: await fetchCstoreList() });
      } catch (err) {
        fail(err, '讀取事務所資料檔失敗');
      } finally {
        set({ loading: false });
      }
    },

    setCstoreRows: (cstoreRows) => set({ cstoreRows }),

    setCstoreSelectedKey: (key) => {
      if (get().cstoreSelectedKey !== key) set({ cstoreSelectedKey: key });
    },

    addCstoreRow: () => set((s) => ({ cstoreRows: [...s.cstoreRows, emptyCstoreRow()] })),

    saveCstoreRow: (row) => {
      const run = async () => {
        const cur = get().cstoreRows.find((r) => r._key === row._key);
        if (!cur) return; // 已刪除或已重新載入
        // 統號等欄位用格線送來的值，origNo / RECNO 用目前狀態 (前一次新增可能剛完成)
        const target: CstoreItem = { ...row, origNo: cur.origNo, recordNumber: cur.recordNumber };
        if (!target.no.trim()) return;
        try {
          const saved = await saveCstore(target);
          if (!saved.recordNumber) throw new Error('伺服器沒有回傳存檔後的資料');
          set((s) => ({
            cstoreRows: s.cstoreRows.map((r) =>
              r._key === row._key
                ? { ...r, origNo: saved.origNo, recordNumber: saved.recordNumber, serial: saved.serial }
                : r
            ),
          }));
        } catch (err) {
          fail(err, '儲存事務所資料失敗');
          await get().loadCstore(); // 以 DBF 為準重新載入，畫面不留未存檔的值
        }
      };
      cstoreSaveChain = cstoreSaveChain.then(run, run);
      return cstoreSaveChain;
    },

    askDeleteCstore: (row) => {
      if (row) set({ confirm: { kind: 'deleteCstore', row } });
    },

    // VFP Delete.Click：確認後立即刪除並重編序號
    removeCstore: async (row) => {
      set({ busy: true });
      try {
        await cstoreSaveChain;
        const cur = get().cstoreRows.find((r) => r._key === row._key);
        if (!cur) return;
        if (!cur.origNo) {
          set((s) => ({ cstoreRows: s.cstoreRows.filter((r) => r._key !== row._key) }));
          return;
        }
        const warning = await deleteCstore(cur);
        await get().loadCstore();
        if (warning) get().showToast(warning, 'warning');
      } catch (err) {
        fail(err, '刪除事務所資料失敗');
      } finally {
        set({ busy: false });
      }
    },

    transferToOffice: () => {
      const { cstoreRows, cstoreSelectedKey } = get();
      const row = cstoreRows.find((r) => r._key === cstoreSelectedKey);
      if (!row || !row.no.trim()) {
        get().showToast('請先選擇要轉入的事務所', 'warning');
        return;
      }
      set((s) => ({
        form: {
          ...s.form,
          name: row.name,
          taxNo: row.no,
          addr: row.addr,
          tel: row.tel,
          fax: row.fax,
          boss: row.hname,
          email: row.email,
          contact: row.linkman,
          engName: row.engname,
        },
      }));
      get().showToast('已轉入預設，離開後請再按 F8 確定儲存', 'success');
    },

    pickCstoreAddr: (addr) => {
      const picker = get().picker;
      if (picker?.kind !== 'cstoreAddr') return;
      // 重新掛載格線：清掉按 F2 前殘留的編輯狀態，避免之後 Enter 把舊值蓋回去
      set((s) => ({ picker: null, cstoreFocusKey: picker.rowKey, cstoreGridEpoch: s.cstoreGridEpoch + 1 }));
      if (addr === null) return;
      const row = get().cstoreRows.find((r) => r._key === picker.rowKey);
      if (!row) return;
      if (!row.no.trim()) {
        get().showToast('請先輸入統號再選擇地址', 'error');
        return;
      }
      const updated = { ...row, addr: truncateBig5(addr, CSTORE_BYTES.addr) };
      set((s) => ({ cstoreRows: s.cstoreRows.map((r) => (r._key === picker.rowKey ? updated : r)) }));
      void get().saveCstoreRow(updated);
    },

    locateCstore: (no) => {
      const row = get().cstoreRows.find((r) => r.no.trim() === no.trim());
      if (row) set((s) => ({ cstoreFocusKey: row._key, cstoreGridEpoch: s.cstoreGridEpoch + 1 }));
    },

    toggleDirection: () => set((s) => ({ cstoreDirection: s.cstoreDirection === 'right' ? 'down' : 'right' })),

    openPrint: async () => {
      if (get().busy) return;
      set({ busy: true });
      try {
        await cstoreSaveChain; // 列印讀的是伺服器資料，先等格線的存檔完成
      } finally {
        set({ busy: false });
      }
      if (!get().cstoreRows.some((r) => r.origNo)) {
        get().showToast('無資料,請按任一鍵繼續...', 'warning');
        return;
      }
      set({ isPrintOpen: true });
    },

    closePrint: () =>
      set((s) => ({ isPrintOpen: false, cstoreFocusKey: s.cstoreSelectedKey, cstoreGridEpoch: s.cstoreGridEpoch + 1 })),
  };
});
