import type React from 'react';

export type ReportExportType = 'pdf' | 'jpg' | 'word';

export type PaperSizeOption = 'A4' | 'Letter' | 'HalfLetter' | 'B4';

export type PageOrientation = 'portrait' | 'landscape';

export type PageRangeMode = 'all' | 'current' | 'custom';

export type MarginPreset = 'default' | 'none' | 'minimum' | 'custom';

export type ZoomPreset =
  | 'pageWidth'
  | 'wholePage'
  | 50
  | 75
  | 90
  | 100
  | 120
  | 150
  | 200;

export interface ReportPreviewColumn<T = Record<string, any>> {
  key: string;
  label: string;
  /** 欄位寬度 (px)，未指定時自動分配 */
  width?: number;
  align?: 'left' | 'center' | 'right';
  className?: string;
  /** 編修模式是否允許修改此欄位 (預設 true) */
  editable?: boolean;
  /** 自訂畫面顯示內容 (非編修模式下使用) */
  render?: (val: any, row: T, rowIndex: number) => React.ReactNode;
  /** 轉成純文字，供編修輸入預設值與 PDF/JPG/WORD 匯出使用 */
  formatText?: (val: any, row: T, rowIndex: number) => string;
}

export interface ReportDrillDownContext<T = Record<string, any>> {
  /** 被雙擊的該筆完整來源資料列 (含傳票號、主鍵等隱藏來源欄位) */
  row: T;
  /** 在全部資料中的索引 (0-based) */
  rowIndex: number;
  /** 所在頁碼 (1-based) */
  pageNo: number;
  /** 被雙擊的欄位 key */
  columnKey: string;
  /** 被雙擊儲存格的值 */
  cellValue: any;
  /** 滑鼠原生事件 */
  nativeEvent: React.MouseEvent;
}

export interface ReportPreviewHeaderMeta {
  companyName: string;
  reportTitle: string;
  subHeaderLeft: string;
  subHeaderCenter: string;
  subHeaderRight: string;
  footerText: string;
}

export interface PrintSettingsState {
  destination: string;
  pageRangeMode: PageRangeMode;
  customPages: string;
  orientation: PageOrientation;
  colorMode: 'color' | 'bw';
  paperSize: PaperSizeOption;
  pagesPerSheet: 1 | 2 | 4;
  marginPreset: MarginPreset;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  printScaleMode: 'default' | 'fit';
  includeHeaderFooter: boolean;
  includeBackgroundGraphics: boolean;
}

export interface SystemPrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
}

export interface ReportPreviewProps<T extends Record<string, any> = Record<string, any>> {
  isOpen: boolean;
  onClose: () => void;

  /** 報表識別碼，有設定時自動記憶欄寬、列高、顯示比例等偏好至 localStorage */
  reportId?: string;
  /** 公司名稱 / 報表抬頭第一行 */
  companyName?: string;
  /** 報表主標題 */
  reportTitle: string;
  /** 表頭左側文字 */
  subHeaderLeft?: string;
  /** 表頭中間文字 */
  subHeaderCenter?: string;
  /** 表頭右側文字（未傳入時預設顯示「頁次：n」） */
  subHeaderRight?: string;
  /** 表尾附註文字 */
  footerText?: string;

  /** 呼叫端傳入要列印的資料 */
  data: T[];
  /** 欄位定義 */
  columns: ReportPreviewColumn<T>[];
  /** 取得資料列唯一鍵值 */
  getRowKey?: (row: T, index: number) => string | number;
  /** 資料載入中狀態 */
  loading?: boolean;
  /** 無資料提示文字 */
  emptyText?: string;

  /** 預設資料列高 (px，預設 26) */
  defaultRowHeight?: number;
  /** 預設表格字型大小 (px，預設 12) */
  defaultFontSize?: number;
  /** 預設紙張規格 (預設 'A4') */
  defaultPaperSize?: PaperSizeOption;
  /** 預設紙張方向 (預設 'portrait') */
  defaultOrientation?: PageOrientation;

  /** 是否顯示上方「編修」按鈕 (預設 true) */
  enableEdit?: boolean;
  /** 編修完成並鎖定後回呼 */
  onDataEdited?: (editedData: T[], headerMeta: ReportPreviewHeaderMeta) => void;

  /** 點選上方「更新」按鈕時通知呼叫端重新取得資料 */
  onRefresh?: () => void | Promise<void>;

  /** 是否顯示上方「匯出」按鈕 (預設 true) */
  showExport?: boolean;
  /** 控制「匯出」下拉選單要顯示哪些項目，預設 ['pdf', 'jpg', 'word']；空陣列則隱藏按鈕 */
  exportOptions?: ReportExportType[];
  /** 匯出檔名（不含副檔名，預設使用 reportTitle） */
  exportFileName?: string;
  /** 自訂匯出行為（若未傳入則由模組內建處理 PDF / JPG / WORD 匯出） */
  onExport?: (
    type: ReportExportType,
    currentData: T[],
    headerMeta: ReportPreviewHeaderMeta
  ) => void | Promise<void>;

  /**
   * 報表追追追：滑鼠雙擊預覽畫面該筆資料列時觸發，
   * 提供該筆資料與來源欄位資訊，由呼叫端決定開啟哪張報表或輸入畫面。
   */
  onRowDrillDown?: (context: ReportDrillDownContext<T>) => void;
}
