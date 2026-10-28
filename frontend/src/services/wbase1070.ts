import axios from 'axios';
import { localagentApi } from './localagent';

export interface NoteItem {
  noteno: string;      // 編號 (DBF: noteno)
  note: string;        // 備註內容 (DBF: note)
  _record_number?: number;
  seq?: number;
  guid?: string;

  // 相容舊有別名 (Legacy Aliases)
  noteCode?: string;   // 同 noteno
  noteName?: string;   // 同 note
  content?: string;    // 同 note
}

export const normalizeNoteItem = (raw: any): NoteItem => {
  if (!raw) {
    return {
      noteno: '',
      note: '',
      _record_number: 0,
      noteCode: '',
      noteName: '',
      content: '',
    };
  }

  const noteno = (raw.noteno || raw.noteCode || '').trim().toUpperCase();
  const note = (raw.note || raw.content || raw.noteName || '').trim();

  return {
    noteno,
    note,
    _record_number: raw._record_number || raw.recordNumber || 0,
    seq: raw.seq,
    guid: raw.guid,

    noteCode: noteno,
    noteName: note,
    content: note,
  };
};

export const sanitizeNoteItem = (item: NoteItem): any => {
  const norm = normalizeNoteItem(item);
  return {
    noteno: norm.noteno,
    note: norm.note,
    _record_number: norm._record_number,
    noteCode: norm.noteno,
    noteName: norm.note,
    content: norm.note,
  };
};

export type NoteItemPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1070';

export const fetchNoteItems = async (keyword?: string): Promise<NoteItem[]> => {
  const response = await axios.get<any[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeNoteItem) : [];
};

export const getNoteItemList = fetchNoteItems;
export const getNoteItems = fetchNoteItems;

export const fetchNoteItemByCode = async (code: string): Promise<NoteItem> => {
  const response = await axios.get<any>(`${API_BASE}/${encodeURIComponent(code)}`);
  return normalizeNoteItem(response.data);
};

export const createNoteItem = async (item: NoteItem): Promise<NoteItem> => {
  const payload = sanitizeNoteItem(item);
  const response = await axios.post<any>(API_BASE, payload);
  return normalizeNoteItem(response.data);
};

export const updateNoteItem = async (
  code: string,
  item: NoteItem
): Promise<NoteItem> => {
  const cleanCode = (code || item.noteno || item.noteCode || '').trim();
  const payload = sanitizeNoteItem(item);
  const response = await axios.put<any>(
    `${API_BASE}/${encodeURIComponent(cleanCode)}`,
    payload
  );
  return normalizeNoteItem(response.data);
};

export const deleteNoteItem = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveNoteItem = async (item: NoteItem, isNew: boolean): Promise<boolean> => {
  try {
    const norm = normalizeNoteItem(item);
    if (isNew) {
      await createNoteItem(norm);
    } else {
      await updateNoteItem(norm.noteno, norm);
    }
    return true;
  } catch (e) {
    console.error('saveNoteItem error:', e);
    return false;
  }
};

export const batchSaveNoteItems = async (items: NoteItem[]): Promise<boolean> => {
  try {
    const payloads = items.map(sanitizeNoteItem);
    await axios.post(`${API_BASE}/batch-save`, payloads);
    return true;
  } catch (e) {
    console.error('batchSaveNoteItems error:', e);
    return false;
  }
};

export interface PrintRangeQuery {
  codeStart?: string;
  codeEnd?: string;
}

export const fetchPrintNoteItems = async (
  query: PrintRangeQuery
): Promise<NoteItem[]> => {
  const response = await axios.post<any[]>(`${API_BASE}/print`, query);
  return Array.isArray(response.data) ? response.data.map(normalizeNoteItem) : [];
};

export const printNoteItemList = fetchPrintNoteItems;

export interface Waccrep3106bParams {
  dllPath?: string;
  hs_chk?: number;
  top_mag?: number;
  left_mag?: number;
  PrtIndex?: number;
  IsPrint?: number;
  path?: string;
}

export const callWaccrep3106b = async (
  params: Waccrep3106bParams = {}
): Promise<{ success: boolean; result: string; raw?: string; error?: string }> => {
  const response = await localagentApi.post(
    '/report',
    {
      dllPath: params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
      hs_chk: params.hs_chk ?? 0.125,
      top_mag: params.top_mag ?? 0.0,
      left_mag: params.left_mag ?? 0.0,
      PrtIndex: params.PrtIndex ?? 0,
      IsPrint: params.IsPrint ?? 0,
      path: params.path ?? '',
    }
  );
  return response.data;
};
