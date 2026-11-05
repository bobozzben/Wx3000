import axios from 'axios';

/**
 * 5-7 碳健檢企業名單匯出 (VFP base50.prg wbasemenu05cmd07 → wbase4000 選擇客戶 + wbase5070 條件、F8 轉出)。
 * 選擇狀態只存在前端 state，不讀也不寫 customer.sel。
 * 年度銷售額合計由後端讀各客戶 <資料磁碟機>:\w3000\data\<客戶代號>\<年末 2 碼>\t403.dbf 加總 t025；
 * 轉檔列印密碼只在後端比對，每個計算請求都要再帶一次。Excel 在瀏覽器產生 (VFP data2excl)。
 */
const API_BASE = '/api/wbase5070';

/** 每次計算請求的客戶數 (後端上限 Wbase5070Controller.MaxBatch = 50) */
export const SALES_BATCH_SIZE = 20;

export interface CarbonCustomer {
  no: string;
  name: string;
  selected: boolean; // VFP tmpcust.mselect = "→"
}

export interface CarbonSalesRow {
  no: string;
  name: string;
  linkman: string;
  linktel: string;
  email: string;
  unino: string;
  addr: string;
  capital: number;
  t025: number;
  pnostd: string;
  /** ok：已加總；nofile：該年度沒有 t403.dbf (以 0 計)；error：讀取失敗 (以 0 計) */
  source: 'ok' | 'nofile' | 'error';
  message?: string | null;
}

export interface CarbonSalesResult {
  rows: CarbonSalesRow[];
  missing: string[];
}

export interface CarbonCondition {
  year: string;
  startMonth: number;
  endMonth: number;
}

/** 從 axios 錯誤取出後端訊息 */
export const apiErrorMessage = (err: any, fallback = '操作失敗'): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

/** 錯誤是否為密碼錯誤 (後端 403) */
export const isWrongPassword = (err: any): boolean => err?.response?.status === 403;

export const fetchCarbonCustomers = async (): Promise<CarbonCustomer[]> =>
  (await axios.get<CarbonCustomer[]>(`${API_BASE}/customers`)).data;

export const verifyCarbonPassword = async (password: string): Promise<boolean> =>
  (await axios.post<{ ok: boolean }>(`${API_BASE}/verify-password`, { password })).data.ok;

/**
 * 依序分批計算勾選客戶的年度銷售額 (每家至少一次 LocalAgent 呼叫，上百家時需要一些時間)。
 * 回傳的列依 nos 的順序；onProgress(已完成家數, 總家數)
 */
export const fetchCarbonSales = async (
  password: string,
  cond: CarbonCondition,
  nos: string[],
  onProgress?: (done: number, total: number) => void
): Promise<CarbonSalesResult> => {
  const result: CarbonSalesResult = { rows: [], missing: [] };
  onProgress?.(0, nos.length);
  for (let i = 0; i < nos.length; i += SALES_BATCH_SIZE) {
    const batch = nos.slice(i, i + SALES_BATCH_SIZE);
    const res = await axios.post<CarbonSalesResult>(`${API_BASE}/sales`, { password, ...cond, nos: batch });
    result.rows.push(...res.data.rows);
    result.missing.push(...res.data.missing);
    onProgress?.(Math.min(nos.length, i + batch.length), nos.length);
  }
  return result;
};

/** VFP oengfield / otwnfield：匯出欄位與 Excel 欄名 (順序不可變) */
export const CARBON_EXCEL_FIELDS: { key: keyof CarbonSalesRow; title: string }[] = [
  { key: 'no', title: '客戶代號' },
  { key: 'name', title: '客戶名稱' },
  { key: 'linkman', title: '聯絡人姓名' },
  { key: 'linktel', title: '聯絡人電話' },
  { key: 'email', title: '聯絡人E-mail' },
  { key: 'unino', title: '統一編號' },
  { key: 'addr', title: '地址' },
  { key: 'capital', title: '資本額' },
  { key: 't025', title: '年度銷售額合計' },
  { key: 'pnostd', title: '行業代號' },
];

/** 今天的民國年 (3 碼)，VFP 預設 yy3(m.meyear) */
export const currentRocYear = (): string => String(new Date().getFullYear() - 1911).padStart(3, '0');

/**
 * 產生 Excel (VFP data2excl：第 1 列是中文欄名，之後每家客戶一列；資本額、年度銷售額為數值)。
 * VFP 的頁首「印表日期、碳健檢企業名單」是 Excel 列印頁首，不在儲存格內，這裡不輸出
 */
export const exportCarbonExcel = async (rows: CarbonSalesRow[], fileName: string): Promise<string> => {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    CARBON_EXCEL_FIELDS.map((f) => f.title),
    ...rows.map((r) => CARBON_EXCEL_FIELDS.map((f) => {
      const v = r[f.key];
      return typeof v === 'number' ? v : String(v ?? '');
    })),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // 依內容估算欄寬 (中文字算 2 個字元寬，對應 VFP 的 AutoFit)
  const charWidth = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0);
  ws['!cols'] = CARBON_EXCEL_FIELDS.map((_, c) => ({
    wch: Math.min(60, Math.max(8, ...aoa.map((row) => charWidth(String(row[c] ?? ''))))) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '碳健檢企業名單');
  const finalName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, finalName);
  return finalName;
};
