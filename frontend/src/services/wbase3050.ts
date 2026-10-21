import axios from 'axios';
import { getSystemParam, setSystemParam } from './systemParamService';

export interface InvoicePurchaseItem {
  period: string;
  times: string;
  companyCode: string;
  companyShortName: string;
  companyName?: string;
  companyAddr?: string;
  companyTel?: string;
  companyFax?: string;
  unifiedNo: string;
  taxNo: string;
  manualTwoDup: number;
  manualTwoDupSub: number;
  manualThreeDup: number;
  manualThreeDupSub: number;
  manualSpecial: number;
  cashTwoDup: number;
  cashThreeDup: number;
  cashThreeDupSub: number;
  city?: string;
  placeCode?: string;
  empCode?: string;
  guid?: string;
  dataYear?: string;
  dataStartMonth?: string;
  dataEndMonth?: string;
  reportDate?: string;
  manualTwoDupAmt?: number;
  manualTwoDupSubAmt?: number;
  manualThreeDupAmt?: number;
  manualThreeDupSubAmt?: number;
  manualSpecialAmt?: number;
  cashTwoDupAmt?: number;
  cashThreeDupAmt?: number;
  cashThreeDupSubAmt?: number;
  totalAmt?: number;
  totalCount?: number;
  totalBooks?: number;
  companyBooks?: number;
  [key: string]: any;
}

export interface BuyinvPrintQueryRequest {
  period?: string;
  times?: string;
  year?: string;
  startMonth?: string;
  endMonth?: string;
  mode?: string; // "1": 依地址縣市, "2": 依購買地點
  cityCondition?: string;
  placeCondition?: string;
  sortOrder?: string; // "1": 依統一編號, "2": 依稅籍編號
  reportType?: string; // "1": A4發票清單, "2": 中一刀發票領取簽收單
}

export interface BuyinvPriceConfig {
  manualTwoDup: number;
  manualTwoDupSub: number;
  manualThreeDup: number;
  manualThreeDupSub: number;
  manualSpecial: number;
  cashTwoDup: number;
  cashThreeDup: number;
  cashThreeDupSub: number;
}

const API_BASE = '/api/wbase3050';

/**
 * 依條件從 PostgreSQL Database: w3000 schema: c:/w3000/comm Table: 基本發票購買 取得列印資料
 */
export const queryBuyinvPrintData = async (
  req: BuyinvPrintQueryRequest
): Promise<InvoicePurchaseItem[]> => {
  try {
    const response = await axios.post<InvoicePurchaseItem[]>(`${API_BASE}/query`, req);
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.error('queryBuyinvPrintData error:', err);
    // 若後端 API 暫時尚未重啟，降級嘗試 /api/wbase3020/buyinv-print-query
    try {
      const fallback = await axios.post<InvoicePurchaseItem[]>('/api/wbase3020/buyinv-print-query', req);
      return Array.isArray(fallback.data) ? fallback.data : [];
    } catch (fbErr) {
      console.error('Fallback query error:', fbErr);
      return [];
    }
  }
};

/**
 * 讀取發票種類金額設定
 */
export const getBuyinvPrices = async (): Promise<BuyinvPriceConfig> => {
  try {
    const res = await axios.get<BuyinvPriceConfig>(`${API_BASE}/prices`);
    if (res.data) return res.data;
  } catch (e) {
    console.warn('API /prices failed, fallback to systemParamService:', e);
  }

  // Fallback 透過 systemParamService 直接向參數設定提取
  const schema = 'c:/w3000/comm';
  const table = '參數設定';
  const [p1, p2, p3, p4, p5, p6, p7, p8] = await Promise.all([
    getSystemParam(schema, table, '手開二聯單價', '15'),
    getSystemParam(schema, table, '手開二聯副單價', '16'),
    getSystemParam(schema, table, '手開三聯單價', '18'),
    getSystemParam(schema, table, '手開三聯副單價', '19'),
    getSystemParam(schema, table, '特種單價', '15'),
    getSystemParam(schema, table, '收銀二聯單價', '36'),
    getSystemParam(schema, table, '收銀三聯單價', '85'),
    getSystemParam(schema, table, '收銀三聯副單價', '95'),
  ]);

  return {
    manualTwoDup: Number(p1) || 15,
    manualTwoDupSub: Number(p2) || 16,
    manualThreeDup: Number(p3) || 18,
    manualThreeDupSub: Number(p4) || 19,
    manualSpecial: Number(p5) || 15,
    cashTwoDup: Number(p6) || 36,
    cashThreeDup: Number(p7) || 85,
    cashThreeDupSub: Number(p8) || 95,
  };
};

/**
 * 儲存發票種類金額設定
 */
export const saveBuyinvPrices = async (config: BuyinvPriceConfig): Promise<boolean> => {
  try {
    await axios.post(`${API_BASE}/prices`, config);
    return true;
  } catch (e) {
    console.warn('API save prices failed, fallback to systemParamService:', e);
    const schema = 'c:/w3000/comm';
    const table = '參數設定';
    try {
      await Promise.all([
        setSystemParam(schema, table, '手開二聯單價', String(config.manualTwoDup)),
        setSystemParam(schema, table, '手開二聯副單價', String(config.manualTwoDupSub)),
        setSystemParam(schema, table, '手開三聯單價', String(config.manualThreeDup)),
        setSystemParam(schema, table, '手開三聯副單價', String(config.manualThreeDupSub)),
        setSystemParam(schema, table, '特種單價', String(config.manualSpecial)),
        setSystemParam(schema, table, '收銀二聯單價', String(config.cashTwoDup)),
        setSystemParam(schema, table, '收銀三聯單價', String(config.cashThreeDup)),
        setSystemParam(schema, table, '收銀三聯副單價', String(config.cashThreeDupSub)),
        setSystemParam(schema, table, '四聯式收銀機發票單價', String(config.cashThreeDupSub)),
      ]);
      return true;
    } catch (err) {
      console.error('saveBuyinvPrices fallback error:', err);
      return false;
    }
  }
};

/**
 * 呼叫 localagent 透過 JSON 暫存檔傳遞資料給 wbaseRP.dll 的 wbase350_buyinv_list
 * @param reportData 包含計算欄位之發票購買資料清單
 * @param reportType 1: A4發票清單 (frxReport_3501_buyinv), 2: 中一刀發票領取簽收單 (frxReport_3502_buyinv)
 */
export const callLocalagentWbase350BuyinvList = async (
  reportData: InvoicePurchaseItem[],
  reportType: number = 1,
  hs_chk: number = 0.125,
  top_mag: number = 0.0,
  left_mag: number = 0.0,
  prtIndex: number = 0,
  isPrint: number = 0
): Promise<{ success: boolean; message?: string; retCode?: number; error?: string }> => {
  try {
    const response = await axios.post(
      'http://localhost:18889/api/call',
      {
        dll: 'wbaseRP',
        func: 'wbase350_buyinv_list',
        args: [hs_chk, top_mag, left_mag, prtIndex, isPrint, reportType, 'C:\\temp\\buyinv_list_data.json'],
        jsonData: reportData,
      },
      { timeout: 15000 }
    );
    return response.data;
  } catch (err: any) {
    console.error('callLocalagentWbase350BuyinvList error:', err);
    return {
      success: false,
      error: err?.response?.data?.error || err?.message || '呼叫 LocalAgent 本地列印服務失敗 (http://localhost:18889)',
    };
  }
};

/**
 * 呼叫 localagent_koffi 裡的 wbaseRP.dll 的 waccrep3101_b 函數顯示報表預覽畫面 (相容舊版)
 */
export const callLocalagentWaccrep3101b = async (
  reportData: InvoicePurchaseItem[],
  hs_chk: number = 0.125,
  top_mag: number = 0.0,
  left_mag: number = 0.0,
  prtIndex: number = 0,
  isPrint: number = 0
): Promise<{ success: boolean; message?: string; retCode?: number; error?: string }> => {
  return callLocalagentWbase350BuyinvList(reportData, 1, hs_chk, top_mag, left_mag, prtIndex, isPrint);
};

/**
 * 將資料匯出至 EXCEL (.xlsx)
 */
export const exportToXlsx = async (
  data: InvoicePurchaseItem[],
  selectedFields: Array<{ key: string; label: string; customTitle: string }>,
  fileName: string = '購買統一發票清單.xlsx'
): Promise<boolean> => {
  try {
    const XLSX = await import('xlsx');

    // 建立映射欄位資料
    const exportRows = data.map((item: any, index: number) => {
      const rowObj: Record<string, any> = {};
      selectedFields.forEach((field) => {
        const title = field.customTitle || field.label;
        switch (field.key) {
          case 'seq':
            rowObj[title] = index + 1;
            break;
          case 'serialNo':
            rowObj[title] = item.guid || index + 1;
            break;
          case 'companyCode':
            rowObj[title] = item.companyCode || '';
            break;
          case 'companyShortName':
            rowObj[title] = item.companyShortName || item.companyName || '';
            break;
          case 'companyName':
            rowObj[title] = item.companyName || item.companyShortName || '';
            break;
          case 'companyAddr':
          case 'address':
            rowObj[title] = item.companyAddr || item.city || '';
            break;
          case 'unifiedNo':
            rowObj[title] = item.unifiedNo || '';
            break;
          case 'taxNo':
            rowObj[title] = item.taxNo || '';
            break;
          case 'manualTwoDup':
            rowObj[title] = item.manualTwoDup || 0;
            break;
          case 'manualTwoDupSub':
            rowObj[title] = item.manualTwoDupSub || 0;
            break;
          case 'manualThreeDup':
            rowObj[title] = item.manualThreeDup || 0;
            break;
          case 'manualThreeDupSub':
            rowObj[title] = item.manualThreeDupSub || 0;
            break;
          case 'manualSpecial':
            rowObj[title] = item.manualSpecial || 0;
            break;
          case 'cashTwoDup':
            rowObj[title] = item.cashTwoDup || 0;
            break;
          case 'cashThreeDup':
            rowObj[title] = item.cashThreeDup || 0;
            break;
          case 'cashThreeDupSub':
            rowObj[title] = item.cashThreeDupSub || 0;
            break;
          case 'city':
            rowObj[title] = item.city || '';
            break;
          case 'placeCode':
            rowObj[title] = item.placeCode || '';
            break;
          case 'empCode':
            rowObj[title] = item.empCode || '';
            break;
          case 'period':
            rowObj[title] = item.period || '';
            break;
          case 'times':
            rowObj[title] = item.times || '1';
            break;
          case 'dataYear':
            rowObj[title] = item.dataYear || '';
            break;
          case 'dataStartMonth':
            rowObj[title] = item.dataStartMonth || '';
            break;
          case 'dataEndMonth':
            rowObj[title] = item.dataEndMonth || '';
            break;
          case 'reportDate':
            rowObj[title] = item.reportDate || item['製表日期'] || '';
            break;
          case 'manualTwoDupAmt':
            rowObj[title] = item.manualTwoDupAmt ?? item['手開二聯金額'] ?? 0;
            break;
          case 'manualTwoDupSubAmt':
            rowObj[title] = item.manualTwoDupSubAmt ?? item['手開二聯副金額'] ?? 0;
            break;
          case 'manualThreeDupAmt':
            rowObj[title] = item.manualThreeDupAmt ?? item['手開三聯金額'] ?? 0;
            break;
          case 'manualThreeDupSubAmt':
            rowObj[title] = item.manualThreeDupSubAmt ?? item['手開三聯副金額'] ?? 0;
            break;
          case 'manualSpecialAmt':
            rowObj[title] = item.manualSpecialAmt ?? item['特種金額'] ?? 0;
            break;
          case 'cashTwoDupAmt':
            rowObj[title] = item.cashTwoDupAmt ?? item['收銀二聯金額'] ?? 0;
            break;
          case 'cashThreeDupAmt':
            rowObj[title] = item.cashThreeDupAmt ?? item['收銀三聯金額'] ?? 0;
            break;
          case 'cashThreeDupSubAmt':
            rowObj[title] = item.cashThreeDupSubAmt ?? item['收銀三聯副金額'] ?? 0;
            break;
          case 'totalAmt':
            rowObj[title] = item.totalAmt ?? item['總金額'] ?? 0;
            break;
          case 'totalCount':
            rowObj[title] = item.totalCount ?? item['總家數'] ?? 0;
            break;
          case 'totalBooks':
            rowObj[title] = item.totalBooks ?? item['總本數'] ?? 0;
            break;
          case 'companyBooks':
            rowObj[title] = item.companyBooks ?? item['公司本數'] ?? 0;
            break;
          case 'companyTel':
            rowObj[title] = item.companyTel ?? item['公司電話'] ?? '';
            break;
          case 'companyFax':
            rowObj[title] = item.companyFax ?? item['公司傳真'] ?? '';
            break;
          default:
            rowObj[title] = item[field.key] ?? '';
            break;
        }
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // 計算自動欄寬 (最寬欄寬不超過 557 像素)
    const MAX_PX = 557;
    const MIN_PX = 60;

    const colWidths = selectedFields.map((field) => {
      const title = field.customTitle || field.label;

      const calcPx = (str: any): number => {
        const text = str != null ? String(str) : '';
        let len = 0;
        for (let i = 0; i < text.length; i++) {
          len += text.charCodeAt(i) > 255 ? 2 : 1;
        }
        return len * 8 + 16;
      };

      let maxPx = calcPx(title);

      exportRows.forEach((row) => {
        const valPx = calcPx(row[title]);
        if (valPx > maxPx) maxPx = valPx;
      });

      const finalPx = Math.max(MIN_PX, Math.min(maxPx, MAX_PX));
      return {
        wpx: finalPx,
        wch: Math.round(finalPx / 8),
      };
    });

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '購買統一發票清單');

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('exportToXlsx error:', err);
    return false;
  }
};
