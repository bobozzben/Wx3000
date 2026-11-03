import type { SearchItem } from '../../components/FoxProGrid/SearchModal';
import { fetchCustomerLookup } from '../../services/wbase2040';
import { fetchEmps } from '../../services/wbase1030';
import { fetchFeeItems } from '../../services/wbase1060';
import { fetchNoteItems } from '../../services/wbase1070';
import { fetchFeeSummaries } from '../../services/wbase1080';

/**
 * F2 開窗資料來源 (VFP sele9 選單)：
 * 客戶 customer(no, abbr)、人員 keyin(no, name)、收費項目 recitem(itemno, item)、
 * 備註 recnote(noteno, note)、摘要 recmemo(mno, tx → memo)
 */
export const searchCustomers = async (q: string): Promise<SearchItem[]> =>
  (await fetchCustomerLookup(q)).map((c) => ({ code: c.no, name: c.abbr, spec: c.name }));

export const searchStaff = async (q: string): Promise<SearchItem[]> =>
  (await fetchEmps(q)).map((e) => ({ code: e.no, name: e.name }));

export const searchFeeItems = async (q: string): Promise<SearchItem[]> =>
  (await fetchFeeItems(q)).map((f) => ({ code: f.itemno, name: f.item, price: f.amt }));

export const searchNotes = async (q: string): Promise<SearchItem[]> =>
  (await fetchNoteItems(q)).map((n) => ({ code: n.noteno, name: n.note }));

/** 摘要開窗：SearchItem 只有代號與名稱，memo 內容另存一份供選取後帶入 */
export const searchSummaries = async (q: string, contents: Map<string, string>): Promise<SearchItem[]> => {
  const list = await fetchFeeSummaries(q);
  contents.clear();
  list.forEach((s) => contents.set(s.summaryCode, s.content || ''));
  return list.map((s) => ({ code: s.summaryCode, name: s.summaryName, spec: (s.content || '').slice(0, 40) }));
};
