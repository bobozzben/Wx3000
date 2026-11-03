import { create } from 'zustand';
import {
  apiErrorMessage,
  createReceipt,
  createReceiptLine,
  deleteReceipt,
  deleteReceiptLine,
  fetchReceiptDetail,
  fetchReceipts,
  fetchSharedMemo,
  recalcReceipt,
  renameReceipt,
  rocToIso,
  saveSharedMemo,
  toReceiptRow,
  toggleReceiptLinePaid,
  updateReceipt,
  updateReceiptLine,
  type FeeReceipt,
  type FeeReceiptDetail,
  type FeeReceiptLineRow,
  type FeeReceiptLineUpdate,
  type FeeReceiptRow,
  type FeeReceiptUpdate,
} from '../../services/wbase2040';

export type Wbase2040Modal = 'detail' | 'receiptMemo' | 'sharedMemo' | 'batch' | 'printReceipt' | 'printBill' | 'stats' | null;

export interface Wbase2040Toast {
  message: string;
  type: 'error' | 'warning' | 'success';
}

export type Wbase2040Confirm =
  | { kind: 'deleteReceipt'; row: FeeReceiptRow }
  | { kind: 'deleteLine'; line: FeeReceiptLineRow }
  | null;

interface Wbase2040State {
  rows: FeeReceiptRow[];
  serverRows: FeeReceiptRow[];
  sortNo: number;
  /** 格線目前所在列 (由 onSelectRow 回報，只用來追蹤) */
  selectedKey?: number;
  /** 要求格線移到的列 (新增、刪除、子視窗關閉後重新掛載時使用)；與 selectedKey 分開，避免兩者互相觸發 */
  focusKey?: number;
  enterDirection: 'right' | 'down';
  loading: boolean;
  /** 子視窗資料載入中：期間的按鍵一律攔下，避免落到主格線 (例如按 Space 後立刻按 Ins 會新增收費單) */
  opening: boolean;
  toast: Wbase2040Toast | null;
  modal: Wbase2040Modal;
  confirm: Wbase2040Confirm;

  // 明細 (客戶收費明細登錄)
  detail: FeeReceipt | null;
  lines: FeeReceiptLineRow[];
  serverLines: FeeReceiptLineRow[];
  lineSelectedKey?: number;
  lineFocusKey?: number;

  // 收據摘要 / 共用說明
  memoText: string;

  setRows: (rows: FeeReceiptRow[]) => void;
  setLines: (lines: FeeReceiptLineRow[]) => void;
  setSelectedKey: (key?: number) => void;
  setFocusKey: (key?: number) => void;
  setLineSelectedKey: (key?: number) => void;
  setModal: (modal: Wbase2040Modal) => void;
  setConfirm: (confirm: Wbase2040Confirm) => void;
  setMemoText: (text: string) => void;
  showToast: (message: string, type?: Wbase2040Toast['type']) => void;
  clearToast: () => void;
  toggleDirection: () => void;

  refresh: (sortNo?: number) => Promise<void>;
  cycleSort: () => Promise<void>;
  addReceipt: () => Promise<void>;
  saveReceiptRow: (row: FeeReceiptRow) => Promise<void>;
  patchReceipt: (rno: string, patch: FeeReceiptUpdate) => Promise<boolean>;
  removeReceipt: (row: FeeReceiptRow) => Promise<void>;

  openDetail: (row: FeeReceiptRow) => Promise<void>;
  closeDetail: () => Promise<void>;
  addLine: () => Promise<void>;
  saveLineRow: (line: FeeReceiptLineRow) => Promise<void>;
  patchLine: (line: FeeReceiptLineRow, patch: FeeReceiptLineUpdate) => Promise<void>;
  toggleLinePaid: (line: FeeReceiptLineRow) => Promise<void>;
  removeLine: (line: FeeReceiptLineRow) => Promise<void>;

  openReceiptMemo: (row: FeeReceiptRow) => Promise<void>;
  saveReceiptMemo: () => Promise<boolean>;
  openSharedMemo: () => Promise<void>;
  saveSharedMemoText: () => Promise<boolean>;
}

const PAID = '*';

export const useWbase2040 = create<Wbase2040State>((set, get) => {
  /** 以後端回傳的表頭取代清單中同一筆 (依 recordNumber)，並同步伺服器快照 */
  const applyReceipt = (receipt: FeeReceipt) => {
    const row = toReceiptRow(receipt);
    const replace = (list: FeeReceiptRow[]) => {
      const idx = list.findIndex((r) => r.recordNumber === row.recordNumber);
      if (idx < 0) return [...list, row];
      const next = [...list];
      next[idx] = row;
      return next;
    };
    set((s) => ({ rows: replace(s.rows), serverRows: replace(s.serverRows) }));
  };

  /** 明細操作的回傳：更新表頭與明細；focusLine 指定游標要移到的明細 (只有新增、刪除需要) */
  const applyDetail = (d: FeeReceiptDetail, focusLine?: number) => {
    applyReceipt(d.receipt);
    set({
      detail: d.receipt,
      lines: d.lines,
      serverLines: d.lines,
      ...(focusLine ? { lineFocusKey: focusLine } : {}),
    });
    if (d.warning) get().showToast(d.warning, 'warning');
  };

  const fail = (err: any, fallback: string) => get().showToast(apiErrorMessage(err, fallback), 'error');

  return {
    rows: [],
    serverRows: [],
    sortNo: 1,
    selectedKey: undefined,
    focusKey: undefined,
    enterDirection: 'right',
    loading: false,
    opening: false,
    toast: null,
    modal: null,
    confirm: null,
    detail: null,
    lines: [],
    serverLines: [],
    lineSelectedKey: undefined,
    lineFocusKey: undefined,
    memoText: '',

    setRows: (rows) => set({ rows }),
    setLines: (lines) => set({ lines }),
    setSelectedKey: (selectedKey) => {
      if (get().selectedKey !== selectedKey) set({ selectedKey });
    },
    setFocusKey: (focusKey) => set({ focusKey }),
    setLineSelectedKey: (lineSelectedKey) => {
      if (get().lineSelectedKey !== lineSelectedKey) set({ lineSelectedKey });
    },
    setModal: (modal) => set({ modal }),
    setConfirm: (confirm) => set({ confirm }),
    setMemoText: (memoText) => set({ memoText }),
    showToast: (message, type = 'error') => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null }),
    toggleDirection: () => set((s) => ({ enterDirection: s.enterDirection === 'right' ? 'down' : 'right' })),

    refresh: async (sortNo) => {
      const sort = sortNo ?? get().sortNo;
      set({ loading: true });
      try {
        const list = (await fetchReceipts(sort)).map(toReceiptRow);
        set({ rows: list, serverRows: list, sortNo: sort });
      } catch (err) {
        fail(err, '讀取收費資料失敗');
      } finally {
        set({ loading: false });
      }
    },

    // F7 排序：1→2→…→7→1，保留目前這一筆 (格線以 sortNo 為 key 重新掛載後定位到 focusKey)
    cycleSort: async () => {
      const next = get().sortNo >= 7 ? 1 : get().sortNo + 1;
      set({ focusKey: get().selectedKey });
      await get().refresh(next);
    },

    // Ins 新增：單號、日期、預設摘要由後端產生 (VFP recmom.insert.Click)
    addReceipt: async () => {
      try {
        const d = await createReceipt();
        applyReceipt(d.receipt);
        set({ focusKey: d.receipt.recordNumber });
      } catch (err) {
        fail(err, '新增收費單失敗');
      }
    },

    // 格線寫回：比對伺服器快照找出異動欄位 (單號走 rename，其餘走 PUT)
    saveReceiptRow: async (row) => {
      const server = get().serverRows.find((r) => r.recordNumber === row.recordNumber);
      if (!server) return;
      const revert = () =>
        set((s) => ({ rows: s.rows.map((r) => (r.recordNumber === server.recordNumber ? server : r)) }));
      try {
        const newRno = (row.rno || '').trim();
        if (newRno !== server.rno) {
          const d = await renameReceipt(server.rno, newRno);
          applyReceipt(d.receipt);
          return;
        }
        const patch: FeeReceiptUpdate = {};
        if (row.recdate !== server.recdate) {
          const iso = rocToIso(row.recdate);
          if (!iso) throw new Error('請款日格式錯誤');
          patch.recdate = iso;
        }
        if ((row.cno || '').trim().toUpperCase() !== server.cno) patch.cno = (row.cno || '').trim().toUpperCase();
        if ((row.recman || '').trim() !== server.recman) patch.recman = (row.recman || '').trim();
        if ((row.note || '').trim() !== server.note) patch.note = (row.note || '').trim();
        if (Object.keys(patch).length === 0) return;
        const d = await updateReceipt(server.rno, patch);
        applyReceipt(d.receipt);
        if (d.warning) get().showToast(d.warning, 'warning');
      } catch (err) {
        revert();
        fail(err, '儲存收費單失敗');
      }
    },

    patchReceipt: async (rno, patch) => {
      try {
        const d = await updateReceipt(rno, patch);
        applyReceipt(d.receipt);
        if (d.warning) get().showToast(d.warning, 'warning');
        return true;
      } catch (err) {
        fail(err, '儲存收費單失敗');
        return false;
      }
    },

    removeReceipt: async (row) => {
      try {
        await deleteReceipt(row.rno);
        set((s) => {
          const idx = s.rows.findIndex((r) => r.recordNumber === row.recordNumber);
          const rows = s.rows.filter((r) => r.recordNumber !== row.recordNumber);
          // VFP：delete 後 skip，若到底則 skip -1
          const next = rows[Math.min(idx, rows.length - 1)];
          return {
            rows,
            serverRows: s.serverRows.filter((r) => r.recordNumber !== row.recordNumber),
            focusKey: next?.recordNumber,
          };
        });
      } catch (err) {
        fail(err, '刪除收費單失敗');
      }
    },

    // Space 輸入明細
    openDetail: async (row) => {
      if (get().opening) return;
      set({ opening: true });
      try {
        const d = await fetchReceiptDetail(row.rno);
        set({
          modal: 'detail',
          detail: d.receipt,
          lines: d.lines,
          serverLines: d.lines,
          lineFocusKey: d.lines[0]?.recordNumber,
          focusKey: row.recordNumber,
        });
      } catch (err) {
        fail(err, '讀取收費明細失敗');
      } finally {
        set({ opening: false });
      }
    },

    // Esc 離開明細：重算表頭已收、未收 (VFP recmoney Destroy)
    closeDetail: async () => {
      const detail = get().detail;
      set({ modal: null });
      if (!detail) return;
      try {
        const d = await recalcReceipt(detail.rno);
        applyReceipt(d.receipt);
      } catch (err) {
        fail(err, '重算收費單合計失敗');
      }
      set({ detail: null, lines: [], serverLines: [] });
    },

    addLine: async () => {
      const detail = get().detail;
      if (!detail) return;
      try {
        const d = await createReceiptLine(detail.rno);
        applyDetail(d, d.focusRecordNumber ?? undefined);
      } catch (err) {
        fail(err, '新增收費明細失敗');
      }
    },

    saveLineRow: async (line) => {
      const server = get().serverLines.find((l) => l.recordNumber === line.recordNumber);
      if (!server) return;
      const patch: FeeReceiptLineUpdate = {};
      if ((line.itemno || '').trim().toUpperCase() !== server.itemno) patch.itemno = (line.itemno || '').trim().toUpperCase();
      if ((line.item || '').trim() !== server.item) patch.item = (line.item || '').trim();
      const money = Number(String(line.money ?? '').replace(/,/g, '')) || 0;
      if (money !== server.money) patch.money = money;
      if ((line.note || '').trim() !== server.note) patch.note = (line.note || '').trim();
      if (Object.keys(patch).length === 0) return;
      await get().patchLine(server, patch);
    },

    patchLine: async (line, patch) => {
      const detail = get().detail;
      if (!detail) return;
      try {
        applyDetail(await updateReceiptLine(detail.rno, line.recordNumber, patch));
      } catch (err) {
        set((s) => ({ lines: s.serverLines }));
        fail(err, '儲存收費明細失敗');
      }
    },

    // Space 收費：切換已收註記 (不受已收清鎖定限制，同 VFP)
    toggleLinePaid: async (line) => {
      const detail = get().detail;
      if (!detail) return;
      try {
        applyDetail(await toggleReceiptLinePaid(detail.rno, line.recordNumber));
      } catch (err) {
        fail(err, '切換已收註記失敗');
      }
    },

    removeLine: async (line) => {
      const detail = get().detail;
      if (!detail) return;
      try {
        const lines = get().lines;
        const idx = lines.findIndex((l) => l.recordNumber === line.recordNumber);
        const d = await deleteReceiptLine(detail.rno, line.recordNumber);
        applyDetail(d, d.lines[Math.min(idx, d.lines.length - 1)]?.recordNumber);
      } catch (err) {
        fail(err, '刪除收費明細失敗');
      }
    },

    // F3 收據摘要：編輯本單 recmom.memo
    openReceiptMemo: async (row) => {
      if (get().opening) return;
      set({ opening: true });
      try {
        const d = await fetchReceiptDetail(row.rno);
        set({ modal: 'receiptMemo', detail: d.receipt, memoText: d.receipt.memo || '', focusKey: row.recordNumber });
      } catch (err) {
        fail(err, '讀取收據摘要失敗');
      } finally {
        set({ opening: false });
      }
    },

    saveReceiptMemo: async () => {
      const detail = get().detail;
      if (!detail) return true;
      if ((detail.memo || '') === get().memoText) return true;
      const ok = await get().patchReceipt(detail.rno, { memo: get().memoText });
      if (ok) set({ detail: { ...detail, memo: get().memoText } });
      return ok;
    },

    // F8 共用說明：recsmemo 唯一一筆
    openSharedMemo: async () => {
      if (get().opening) return;
      set({ opening: true });
      try {
        set({ modal: 'sharedMemo', memoText: await fetchSharedMemo() });
      } catch (err) {
        fail(err, '讀取共用說明失敗');
      } finally {
        set({ opening: false });
      }
    },

    saveSharedMemoText: async () => {
      try {
        await saveSharedMemo(get().memoText);
        return true;
      } catch (err) {
        fail(err, '儲存共用說明失敗');
        return false;
      }
    },
  };
});

export const isReceiptLocked = (r?: { isover?: string } | null) => (r?.isover || '').trim() === PAID;
