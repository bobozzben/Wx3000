import { create } from 'zustand';
import {
  apiErrorMessage,
  checkBranchCode,
  deleteBranch,
  duplicateMessage,
  fetchBranches,
  fetchCustomers,
  fetchHeadquarters,
  hqMediatype,
  needsNormalize,
  newBranchRow,
  saveBranches,
  toBranchRow,
  updateHeadquarter,
  type BranchRow,
  type CustomerPick,
  type HqItem,
} from '../../services/wbase2050';

export type Wbase2050View = 'hq' | 'branches';

export interface Wbase2050Toast {
  message: string;
  type: 'error' | 'warning' | 'success';
}

export type Wbase2050Confirm =
  | { kind: 'deleteBranch'; row: BranchRow }
  | { kind: 'moveBranch'; uid: string; customer: CustomerPick }
  | { kind: 'leaveHq'; lines: string[] }
  | { kind: 'leaveBranches'; lines: string[] }
  | null;

interface Wbase2050State {
  view: Wbase2050View;
  loading: boolean;
  /** 讀取或存檔中：期間的按鍵一律攔下，避免落到格線 */
  busy: boolean;
  toast: Wbase2050Toast | null;
  confirm: Wbase2050Confirm;

  // 總機構清單 (wbase2050)
  hqRows: HqItem[];
  /** 伺服器端的值 (依客戶代號)，用來判斷哪些欄位有修改 */
  hqServer: Record<string, HqItem>;
  hqSelectedNo?: string;
  /** 要求格線移到的列 (從分公司資料維護返回時使用)；與 hqSelectedNo 分開，避免兩者互相觸發 */
  hqFocusNo?: string;
  hqDirection: 'right' | 'down';

  // 分公司資料維護 (wbase2050f8)
  branchHq: HqItem | null;
  branchRows: BranchRow[];
  branchFocusUid?: string;
  /** 遞增時重新掛載分支格線 (F2 選單關閉後清掉格線殘留的編輯狀態) */
  branchGridEpoch: number;
  branchDirection: 'right' | 'down';
  customers: CustomerPick[];
  /** F2 客戶選單開啟中的列 */
  picker: { uid: string } | null;

  setHqRows: (rows: HqItem[]) => void;
  setHqSelectedNo: (no?: string) => void;
  setBranchRows: (rows: BranchRow[]) => void;
  setConfirm: (confirm: Wbase2050Confirm) => void;
  showToast: (message: string, type?: Wbase2050Toast['type']) => void;
  clearToast: () => void;
  toggleDirection: () => void;

  loadHq: (focusNo?: string) => Promise<void>;
  saveHqRow: (row: HqItem) => Promise<void>;
  /** 離開前回寫需要正規化的總機構；全部成功回傳 true，失敗時開啟確認框並回傳 false */
  exitHq: () => Promise<boolean>;

  openBranches: () => Promise<void>;
  addBranchRow: () => void;
  saveBranchRow: (row: BranchRow) => void;
  openPicker: (row: BranchRow) => void;
  pickCustomer: (code: string) => void;
  closePicker: () => void;
  resolveMove: (uid: string, customer: CustomerPick, accept: boolean) => void;
  askDeleteBranch: (row?: BranchRow) => void;
  removeBranch: (row: BranchRow) => Promise<void>;
  saveAndCloseBranches: () => Promise<void>;
  backToHq: () => Promise<void>;
}

const byNo = (list: HqItem[]) => Object.fromEntries(list.map((h) => [h.no, h]));

const hqChanged = (a: HqItem, b: HqItem) => a.tchk !== b.tchk || a.tzero !== b.tzero || a.tflog !== b.tflog || a.tnot !== b.tnot;

const hqPatch = (h: HqItem) => ({ tchk: h.tchk, tzero: h.tzero, tflog: h.tflog, tnot: h.tnot });

/** 總機構逐列存檔依序執行，F8 與 Esc 先等前面的存檔完成 */
let hqSaveChain: Promise<void> = Promise.resolve();

export const useWbase2050 = create<Wbase2050State>((set, get) => {
  const fail = (err: any, fallback: string) => get().showToast(apiErrorMessage(err, fallback), 'error');

  /** 套用伺服器回傳的總機構：更新伺服器快照；畫面上的列只更新 DBF 原值，避免蓋掉存檔期間使用者又改的欄位 */
  const applySavedHq = (saved: HqItem) => {
    set((s) => ({
      hqServer: { ...s.hqServer, [saved.no]: saved },
      hqRows: s.hqRows.map((r) =>
        r.no === saved.no
          ? { ...r, abbr: saved.abbr, unino: saved.unino, dbMediatype: saved.dbMediatype, dbT401: saved.dbT401, recordNumber: saved.recordNumber }
          : r
      ),
    }));
  };

  const updateBranch = (uid: string, patch: Partial<BranchRow>) =>
    set((s) => ({ branchRows: s.branchRows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) }));

  /** 代號通過檢查：帶入 no, abbr, unino, tzero, tnot, tflog (VFP Text1.LostFocus；F2 也帶 tflog，修正 VFP 漏帶) */
  const acceptCode = (uid: string, customer: CustomerPick, allowMove: boolean) =>
    updateBranch(uid, {
      no: customer.no,
      abbr: customer.abbr,
      unino: customer.unino,
      tzero: customer.tzero,
      tnot: customer.tnot,
      tflog: customer.tflog,
      acceptedNo: customer.no,
      allowMove,
    });

  /** 代號不採用：還原為最後一次通過檢查的代號，並讓格線回到該列 */
  const rejectCode = (uid: string) => {
    const row = get().branchRows.find((r) => r.uid === uid);
    if (row && row.no !== row.acceptedNo) updateBranch(uid, { no: row.acceptedNo });
    set((s) => ({ branchFocusUid: uid, branchGridEpoch: s.branchGridEpoch + 1 }));
  };

  const applyCode = (uid: string, code: string) => {
    const { branchHq, customers } = get();
    if (!branchHq) return;
    const result = checkBranchCode(code, branchHq, customers);
    if (result.kind === 'block') {
      get().showToast(result.message, 'error');
      rejectCode(uid);
    } else if (result.kind === 'move') {
      set({ confirm: { kind: 'moveBranch', uid, customer: result.customer } });
    } else {
      acceptCode(uid, result.customer, false);
    }
  };

  return {
    view: 'hq',
    loading: false,
    busy: false,
    toast: null,
    confirm: null,
    hqRows: [],
    hqServer: {},
    hqSelectedNo: undefined,
    hqFocusNo: undefined,
    hqDirection: 'down', // VFP Grid 預設往右，但表單 Init 先切換一次，所以初始為往下
    branchHq: null,
    branchRows: [],
    branchFocusUid: undefined,
    branchGridEpoch: 0,
    branchDirection: 'right',
    customers: [],
    picker: null,

    setHqRows: (hqRows) => set({ hqRows }),
    setHqSelectedNo: (hqSelectedNo) => {
      if (get().hqSelectedNo !== hqSelectedNo) set({ hqSelectedNo });
    },
    setBranchRows: (branchRows) => set({ branchRows }),
    setConfirm: (confirm) => set({ confirm }),
    showToast: (message, type = 'error') => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null }),
    toggleDirection: () =>
      set((s) =>
        s.view === 'hq'
          ? { hqDirection: s.hqDirection === 'right' ? 'down' : 'right' }
          : { branchDirection: s.branchDirection === 'right' ? 'down' : 'right' }
      ),

    // ------------------------------------------------------------ 總機構清單

    loadHq: async (focusNo) => {
      set({ loading: true });
      try {
        const list = await fetchHeadquarters();
        set({ hqRows: list, hqServer: byNo(list), ...(focusNo ? { hqFocusNo: focusNo } : {}) });
      } catch (err) {
        fail(err, '讀取總機構資料失敗');
      } finally {
        set({ loading: false });
      }
    },

    saveHqRow: (row) => {
      // 進銷項合併設定連動：1 → 進銷項媒體 2、2 → 3，申報書媒體固定 Y (VFP Text1.LostFocus)
      const mediatype = hqMediatype(row.tchk);
      if (row.mediatype !== mediatype || row.t401 !== 'Y') {
        set((s) => ({ hqRows: s.hqRows.map((r) => (r.no === row.no ? { ...r, mediatype, t401: 'Y' } : r)) }));
      }

      const run = async () => {
        const cur = get().hqRows.find((r) => r.no === row.no);
        const server = get().hqServer[row.no];
        if (!cur || !server || !hqChanged(cur, server)) return; // 格線每次確認都會呼叫，值沒變就不存
        try {
          applySavedHq(await updateHeadquarter(cur.no, hqPatch(cur)));
        } catch (err) {
          fail(err, '儲存總機構設定失敗');
          set((s) => ({ hqRows: s.hqRows.map((r) => (r.no === server.no ? server : r)) }));
        }
      };
      hqSaveChain = hqSaveChain.then(run, run);
      return hqSaveChain;
    },

    exitHq: async () => {
      set({ busy: true });
      try {
        await hqSaveChain;
        const failed: string[] = [];
        for (const row of get().hqRows.filter(needsNormalize)) {
          try {
            applySavedHq(await updateHeadquarter(row.no, hqPatch(row)));
          } catch (err) {
            failed.push(`${row.no} ${row.abbr}：${apiErrorMessage(err, '回寫失敗')}`);
          }
        }
        if (failed.length === 0) return true;
        set({ confirm: { kind: 'leaveHq', lines: failed } });
        return false;
      } finally {
        set({ busy: false });
      }
    },

    // ------------------------------------------------------------ 分公司資料維護

    openBranches: async () => {
      const no = get().hqSelectedNo;
      if (!no || get().busy) return;
      set({ busy: true });
      try {
        await hqSaveChain; // F8 讀的是畫面上的 tchk，先等目前列存檔完成
        const hq = get().hqRows.find((r) => r.no === no);
        if (!hq) return;
        if (!hq.unino) return get().showToast('公司統編尚未輸入,請先輸入後再執行此功能', 'error');
        if (!hq.tchk) return get().showToast('尚未設定進銷存合併方式', 'error');
        const [list, customers] = await Promise.all([fetchBranches(hq.no), fetchCustomers()]);
        set({
          view: 'branches',
          branchHq: list.hq,
          branchRows: list.branches.map(toBranchRow),
          branchFocusUid: undefined,
          branchDirection: 'right',
          customers,
          picker: null,
          hqFocusNo: hq.no,
        });
      } catch (err) {
        fail(err, '讀取分支機構資料失敗');
      } finally {
        set({ busy: false });
      }
    },

    addBranchRow: () => {
      const hq = get().branchHq;
      if (hq) set((s) => ({ branchRows: [...s.branchRows, newBranchRow(hq)] }));
    },

    saveBranchRow: (row) => {
      if (get().picker) return; // F2 選單開啟時格線失焦送出的暫存值，等選單結果再處理
      const cur = get().branchRows.find((r) => r.uid === row.uid);
      if (!cur || !cur.no || cur.no === cur.acceptedNo) return; // 其他欄位只改畫面，離開時整批存檔
      applyCode(cur.uid, cur.no);
    },

    openPicker: (row) => set({ picker: { uid: row.uid } }),

    pickCustomer: (code) => {
      const picker = get().picker;
      if (!picker) return;
      set({ picker: null });
      const dup = get().branchRows.some((r) => r.uid !== picker.uid && r.no === code);
      if (dup) {
        get().showToast(duplicateMessage(code), 'error');
        rejectCode(picker.uid);
        return;
      }
      rejectCode(picker.uid); // 先清掉格線失焦時送出的暫存值，再套用選取的代號
      applyCode(picker.uid, code);
    },

    closePicker: () => {
      const picker = get().picker;
      set({ picker: null });
      if (picker) rejectCode(picker.uid);
    },

    resolveMove: (uid, customer, accept) => {
      if (accept) acceptCode(uid, customer, true);
      else rejectCode(uid);
    },

    askDeleteBranch: (row) => {
      if (row) set({ confirm: { kind: 'deleteBranch', row } });
    },

    // 刪除立即生效 (VFP Delete.Click)；改過代號的列，DBF 裡代表的是原本的客戶
    removeBranch: async (row) => {
      const hq = get().branchHq;
      if (!hq) return;
      const target = row.origNo;
      if (target) {
        set({ busy: true });
        try {
          await deleteBranch(hq.no, target);
          set((s) => ({ customers: s.customers.map((c) => (c.no === target ? { ...c, mainunino: '' } : c)) }));
        } catch (err) {
          fail(err, '刪除分支機構失敗');
          return;
        } finally {
          set({ busy: false });
        }
      }
      set((s) => ({ branchRows: s.branchRows.filter((r) => r.uid !== row.uid) }));
    },

    saveAndCloseBranches: async () => {
      const hq = get().branchHq;
      if (!hq || get().busy) return;
      // 空白代號的新列直接丟棄 (VFP 回寫時 seek 不到「新代號N」自然略過)
      const items = get()
        .branchRows.filter((r) => r.no.trim())
        .map((r) => ({ no: r.no, origNo: r.origNo, mediatype: r.mediatype, tzero: r.tzero, tflog: r.tflog, tnot: r.tnot, allowMove: r.allowMove }));
      set({ busy: true });
      try {
        const res = await saveBranches(hq.no, items);
        if (res.success) {
          set({ busy: false });
          await get().backToHq();
          return;
        }
        // 部分失敗：成功的列視為已存檔，失敗的留在畫面上讓使用者修正後再按 Esc 重送
        const saved = new Set(res.results.filter((r) => r.success).map((r) => r.no));
        const recnos = new Map(res.branches.map((b) => [b.no, b.recordNumber]));
        set((s) => ({
          branchRows: s.branchRows.map((r) =>
            saved.has(r.no) ? { ...r, origNo: r.no, allowMove: false, recordNumber: recnos.get(r.no) ?? r.recordNumber } : r
          ),
          confirm: {
            kind: 'leaveBranches',
            lines: res.results.filter((r) => !r.success).map((r) => `${r.no}：${r.message || '存檔失敗'}`),
          },
        }));
        fetchCustomers().then((customers) => set({ customers }), () => undefined);
      } catch (err) {
        fail(err, '儲存分支機構失敗');
      } finally {
        set({ busy: false });
      }
    },

    backToHq: async () => {
      const hq = get().branchHq;
      set({ view: 'hq', branchHq: null, branchRows: [], customers: [], picker: null });
      await get().loadHq(hq?.no);
    },
  };
});
