import axios from 'axios';

export interface NoteItem {
  seq?: number;
  noteCode: string;   // 編號 / 備註代號
  noteName: string;   // 說明 / 備註說明
  content: string;    // 備註 / 備註內容
  guid?: string;      // guid
}

export type NoteItemPrintFilter = PrintRangeQuery;

const API_BASE = '/api/wbase1070';

export const fetchNoteItems = async (keyword?: string): Promise<NoteItem[]> => {
  const response = await axios.get<NoteItem[]>(API_BASE, {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const getNoteItemList = fetchNoteItems;
export const getNoteItems = fetchNoteItems;

export const fetchNoteItemByCode = async (code: string): Promise<NoteItem> => {
  const response = await axios.get<NoteItem>(`${API_BASE}/${encodeURIComponent(code)}`);
  return response.data;
};

export const sanitizeNoteItem = (item: NoteItem): NoteItem => ({
  ...item,
  noteCode: (item.noteCode || '').trim().toUpperCase(),
  noteName: (item.noteName || '').trim(),
  content: (item.content || '').trim(),
});

export const createNoteItem = async (item: NoteItem): Promise<NoteItem> => {
  const payload = sanitizeNoteItem(item);
  const response = await axios.post<NoteItem>(API_BASE, payload);
  return response.data;
};

export const updateNoteItem = async (
  code: string,
  item: NoteItem
): Promise<NoteItem> => {
  const payload = sanitizeNoteItem(item);
  const response = await axios.put<NoteItem>(
    `${API_BASE}/${encodeURIComponent(code)}`,
    payload
  );
  return response.data;
};

export const deleteNoteItem = async (code: string): Promise<{ message: string }> => {
  const response = await axios.delete<{ message: string }>(
    `${API_BASE}/${encodeURIComponent(code)}`
  );
  return response.data;
};

export const saveNoteItem = async (item: NoteItem, isNew: boolean): Promise<boolean> => {
  try {
    const payload = sanitizeNoteItem(item);
    if (isNew) {
      await createNoteItem(payload);
    } else {
      await updateNoteItem(payload.noteCode, payload);
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
  const response = await axios.post<NoteItem[]>(`${API_BASE}/print`, query);
  return response.data;
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
  const response = await axios.post(
    'http://localhost:18889/report',
    {
      dllPath: params.dllPath || 'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll',
      hs_chk: params.hs_chk ?? 0.125,
      top_mag: params.top_mag ?? 0.0,
      left_mag: params.left_mag ?? 0.0,
      PrtIndex: params.PrtIndex ?? 0,
      IsPrint: params.IsPrint ?? 0,
      path: params.path ?? '',
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};
