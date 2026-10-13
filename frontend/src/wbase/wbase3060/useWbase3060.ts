import { create } from 'zustand';
import type { InvoiceTrackRecord, UpdateTrackItem } from '../../services/wbase3060';
import {
  getInvoiceTracks,
  updateInvoiceTracksBatch,
  clearInvoiceTracks,
} from '../../services/wbase3060';
import * as XLSX from 'xlsx';

interface Wbase3060State {
  period: string;
  times: string;
  sortOrder: '1' | '2' | '3';
  setSearchParams: (params: { period: string; times: string; sortOrder: '1' | '2' | '3' }) => void;

  rows: InvoiceTrackRecord[];
  setRows: (rows: InvoiceTrackRecord[]) => void;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  loading: boolean;
  errorToast: string | null;
  setErrorToast: (msg: string | null) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  showAutoCloseToast: boolean;
  setShowAutoCloseToast: (show: boolean) => void;

  refreshData: (keyword?: string) => Promise<void>;
  handleSaveRow: (updatedRow: InvoiceTrackRecord) => Promise<void>;
  handleClearTracks: () => Promise<boolean>;
  handleExportExcel: () => void;
  handlePreview: () => void;
}

export const useWbase3060 = create<Wbase3060State>((set, get) => ({
  period: '11505-06',
  times: '1',
  sortOrder: '1',

  setSearchParams: ({ period, times, sortOrder }) => {
    set({ period, times, sortOrder });
  },

  rows: [],
  setRows: (rows) => set({ rows }),
  selectedIndex: 0,
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
  loading: false,
  errorToast: null,
  setErrorToast: (errorToast) => set({ errorToast }),
  toastMessage: null,
  setToastMessage: (toastMessage) => set({ toastMessage }),
  showAutoCloseToast: false,
  setShowAutoCloseToast: (showAutoCloseToast) => set({ showAutoCloseToast }),

  refreshData: async (keyword?: string) => {
    set({ loading: true });
    try {
      const { period, times, sortOrder } = get();
      const data = await getInvoiceTracks(period, times, sortOrder, keyword || '');
      set({ rows: data, loading: false, errorToast: null });
    } catch (e: any) {
      console.error('Failed to load invoice track data:', e);
      set({ errorToast: '載入發票字軌資料失敗，請確認連線', loading: false });
    }
  },

  handleSaveRow: async (updatedRow: InvoiceTrackRecord) => {
    try {
      const dto: UpdateTrackItem = {
        period: updatedRow.period,
        times: updatedRow.times,
        companyCode: updatedRow.companyCode,
        manualTwoTrack: updatedRow.manualTwoTrack,
        manualTwoStartNo: updatedRow.manualTwoStartNo,
        manualTwoEndNo: updatedRow.manualTwoEndNo,
        manualTwoSubTrack: updatedRow.manualTwoSubTrack,
        manualTwoSubStartNo: updatedRow.manualTwoSubStartNo,
        manualTwoSubEndNo: updatedRow.manualTwoSubEndNo,
        manualThreeTrack: updatedRow.manualThreeTrack,
        manualThreeStartNo: updatedRow.manualThreeStartNo,
        manualThreeEndNo: updatedRow.manualThreeEndNo,
        manualThreeSubTrack: updatedRow.manualThreeSubTrack,
        manualThreeSubStartNo: updatedRow.manualThreeSubStartNo,
        manualThreeSubEndNo: updatedRow.manualThreeSubEndNo,
        specialTrack: updatedRow.specialTrack,
        specialStartNo: updatedRow.specialStartNo,
        specialEndNo: updatedRow.specialEndNo,
        cashTwoTrack: updatedRow.cashTwoTrack,
        cashTwoStartNo: updatedRow.cashTwoStartNo,
        cashTwoEndNo: updatedRow.cashTwoEndNo,
        cashThreeTrack: updatedRow.cashThreeTrack,
        cashThreeStartNo: updatedRow.cashThreeStartNo,
        cashThreeEndNo: updatedRow.cashThreeEndNo,
        cashThreeSubTrack: updatedRow.cashThreeSubTrack,
        cashThreeSubStartNo: updatedRow.cashThreeSubStartNo,
        cashThreeSubEndNo: updatedRow.cashThreeSubEndNo,
      };

      await updateInvoiceTracksBatch([dto]);

      const currentRows = get().rows;
      const idx = currentRows.findIndex((r) => r.companyCode === updatedRow.companyCode);
      if (idx !== -1) {
        const nextRows = [...currentRows];
        nextRows[idx] = updatedRow;
        set({ rows: nextRows });
      }

      set({
        toastMessage: `已儲存公司 [${updatedRow.companyCode}] 字軌資料`,
        showAutoCloseToast: true,
      });

      setTimeout(() => {
        set({ showAutoCloseToast: false });
      }, 2500);
    } catch (e: any) {
      console.error('Failed to save invoice track row:', e);
      set({ errorToast: `儲存公司 [${updatedRow.companyCode}] 失敗：${e.message || '連線錯誤'}` });
    }
  },

  handleClearTracks: async () => {
    const { period, times } = get();
    if (!window.confirm(`確定要清除期別 [${period}] 次數 [${times}] 的所有字軌與起訖號資料嗎？\n(注意：只清除字軌起訖號，保留發票購買本數)`)) {
      return false;
    }

    set({ loading: true });
    try {
      await clearInvoiceTracks(period, times);
      await get().refreshData();
      set({
        toastMessage: '已成功清除當前期別所有字軌資料！',
        showAutoCloseToast: true,
        loading: false,
      });
      setTimeout(() => {
        set({ showAutoCloseToast: false });
      }, 2500);
      return true;
    } catch (e: any) {
      console.error('Clear tracks error:', e);
      set({ errorToast: `清除失敗：${e.message || '未知錯誤'}`, loading: false });
      return false;
    }
  },

  handleExportExcel: () => {
    const { rows, period, times } = get();
    if (rows.length === 0) {
      alert('無資料可匯出！');
      return;
    }

    const exportRows = rows.map((item) => ({
      公司編號: item.companyCode,
      公司簡稱: item.companyShortName || '',
      公司統編: item.unifiedNo || '',
      稅籍編號: item.taxNo || '',
      '二聯(手)': item.manualTwoDup,
      二聯字軌: item.manualTwoTrack || '',
      二聯起號: item.manualTwoStartNo || '',
      二聯迄號: item.manualTwoEndNo || '',
      '二聯副(手)': item.manualTwoDupSub,
      二聯副字軌: item.manualTwoSubTrack || '',
      二聯副起號: item.manualTwoSubStartNo || '',
      二聯副迄號: item.manualTwoSubEndNo || '',
      '三聯(手)': item.manualThreeDup,
      三聯字軌: item.manualThreeTrack || '',
      三聯起號: item.manualThreeStartNo || '',
      三聯迄號: item.manualThreeEndNo || '',
      '三聯副(手)': item.manualThreeDupSub,
      三聯副字軌: item.manualThreeSubTrack || '',
      三聯副起號: item.manualThreeSubStartNo || '',
      三聯副迄號: item.manualThreeSubEndNo || '',
      特種: item.manualSpecial,
      特種字軌: item.specialTrack || '',
      特種起號: item.specialStartNo || '',
      特種迄號: item.specialEndNo || '',
      收銀二聯: item.cashTwoDup,
      二收字軌: item.cashTwoTrack || '',
      二收起號: item.cashTwoStartNo || '',
      二收迄號: item.cashTwoEndNo || '',
      收銀三聯: item.cashThreeDup,
      三收字軌: item.cashThreeTrack || '',
      三收起號: item.cashThreeStartNo || '',
      三收迄號: item.cashThreeEndNo || '',
      收銀三聯副: item.cashThreeDupSub,
      三收副字軌: item.cashThreeSubTrack || '',
      三收副起號: item.cashThreeSubStartNo || '',
      三收副迄號: item.cashThreeSubEndNo || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '統購字軌清單');
    XLSX.writeFile(workbook, `統購字軌資料_${period}_${times}次.xlsx`);
  },

  handlePreview: () => {
    const { rows, selectedIndex } = get();
    const selectedRow = rows[selectedIndex];
    if (!selectedRow) {
      alert('請先選取一筆資料');
      return;
    }

    // 建立預覽視窗內容
    const previewHtml = `
      <html>
        <head>
          <title>發票字軌預覽 - ${selectedRow.companyShortName || selectedRow.companyCode}</title>
          <style>
            body { font-family: 'Courier New', monospace; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header h2 { margin: 5px 0; font-size: 18px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .section { margin-top: 20px; }
            .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
            .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
            .info-label { font-weight: bold; }
            .info-value { font-family: monospace; }
            @media print { body { margin: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>統一發票字軌預覽</h1>
            <h2>${selectedRow.companyShortName || ''} (${selectedRow.companyCode})</h2>
            <div>統編：${selectedRow.unifiedNo || ''} | 稅籍：${selectedRow.taxNo || ''}</div>
          </div>
          
          <div class="section">
            <h3>二聯發票</h3>
            <table>
              <tr><th>項目</th><th>字軌</th><th>起號</th><th>迄號</th></tr>
              <tr><td>二聯(手)</td><td>${selectedRow.manualTwoTrack || ''}</td><td>${selectedRow.manualTwoStartNo || ''}</td><td>${selectedRow.manualTwoEndNo || ''}</td></tr>
              <tr><td>二聯副(手)</td><td>${selectedRow.manualTwoSubTrack || ''}</td><td>${selectedRow.manualTwoSubStartNo || ''}</td><td>${selectedRow.manualTwoSubEndNo || ''}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h3>三聯發票</h3>
            <table>
              <tr><th>項目</th><th>字軌</th><th>起號</th><th>迄號</th></tr>
              <tr><td>三聯(手)</td><td>${selectedRow.manualThreeTrack || ''}</td><td>${selectedRow.manualThreeStartNo || ''}</td><td>${selectedRow.manualThreeEndNo || ''}</td></tr>
              <tr><td>三聯副(手)</td><td>${selectedRow.manualThreeSubTrack || ''}</td><td>${selectedRow.manualThreeSubStartNo || ''}</td><td>${selectedRow.manualThreeSubEndNo || ''}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h3>特種發票</h3>
            <table>
              <tr><th>項目</th><th>字軌</th><th>起號</th><th>迄號</th></tr>
              <tr><td>特種</td><td>${selectedRow.specialTrack || ''}</td><td>${selectedRow.specialStartNo || ''}</td><td>${selectedRow.specialEndNo || ''}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h3>收銀機發票</h3>
            <table>
              <tr><th>項目</th><th>字軌</th><th>起號</th><th>迄號</th></tr>
              <tr><td>收銀二聯</td><td>${selectedRow.cashTwoTrack || ''}</td><td>${selectedRow.cashTwoStartNo || ''}</td><td>${selectedRow.cashTwoEndNo || ''}</td></tr>
              <tr><td>收銀三聯</td><td>${selectedRow.cashThreeTrack || ''}</td><td>${selectedRow.cashThreeStartNo || ''}</td><td>${selectedRow.cashThreeEndNo || ''}</td></tr>
              <tr><td>收銀三聯副</td><td>${selectedRow.cashThreeSubTrack || ''}</td><td>${selectedRow.cashThreeSubStartNo || ''}</td><td>${selectedRow.cashThreeSubEndNo || ''}</td></tr>
            </table>
          </div>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">列印 / 另存為 PDF</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; margin-left: 10px;">關閉</button>
          </div>
        </body>
      </html>
    `;

    const previewWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    if (previewWindow) {
      previewWindow.document.write(previewHtml);
      previewWindow.document.close();
    }
  },
}));
