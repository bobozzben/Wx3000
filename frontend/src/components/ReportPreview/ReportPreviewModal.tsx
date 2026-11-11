import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FileImage,
  FileText,
  FileType2,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import {
  buildReportPrintableHtml,
  exportReportToJpg,
  exportReportToPdf,
  exportReportToWord,
  getCellPlainText,
  getPaperDimensionsPx,
  getTargetPages,
  mmToPx,
  printHtmlViaIframe,
  renderSheetsToJpegDataUrls,
} from './exportUtils';
import { localagentApi } from '../../services/localagent';
import { PrintSettingsSidebar } from './PrintSettingsSidebar';
import type {
  PrintSettingsState,
  ReportExportType,
  ReportPreviewColumn,
  ReportPreviewHeaderMeta,
  ReportPreviewProps,
  SystemPrinterInfo,
  ZoomPreset,
} from './types';

const EXPORT_MENU_META: Record<
  ReportExportType,
  { label: string; ext: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pdf: { label: '匯出 PDF', ext: '.pdf', Icon: FileText },
  jpg: { label: '匯出 JPG', ext: '.jpg', Icon: FileImage },
  word: { label: '匯出 WORD', ext: '.doc', Icon: FileType2 },
};

const ZOOM_STEPS = [50, 75, 90, 100, 120, 150, 200] as const;

interface SavedLayoutPrefs {
  colWidths?: Record<string, number>;
  rowHeight?: number;
  fontSize?: number;
  zoomPreset?: ZoomPreset;
}

function getStorageKey(reportId?: string): string | null {
  return reportId ? `wx3000_report_preview_${reportId}` : null;
}

function loadLayoutPrefs(reportId?: string): SavedLayoutPrefs | null {
  const key = getStorageKey(reportId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedLayoutPrefs) : null;
  } catch {
    return null;
  }
}

function saveLayoutPrefs(reportId: string | undefined, prefs: SavedLayoutPrefs): void {
  const key = getStorageKey(reportId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

function computeDefaultColWidths<T extends Record<string, any>>(
  columns: ReportPreviewColumn<T>[],
  usableWidthPx: number,
  savedWidths?: Record<string, number>
): number[] {
  const fallbackWidth = Math.max(70, Math.floor(usableWidthPx / Math.max(1, columns.length)));
  return columns.map((col) => {
    const saved = savedWidths?.[col.key];
    if (typeof saved === 'number' && saved >= 36) return saved;
    if (typeof col.width === 'number' && col.width >= 36) return col.width;
    return fallbackWidth;
  });
}

/**
 * ReportPreviewModal — 共用報表預覽及列印模組
 *
 * - 工具列漸層底色：Color:$00FFF3E8 (#E8F3FF) -> ColorTo:$00FFCA8E (#8ECAFF)
 * - 按鈕漸層底色：Color:$00834727 (#274783) -> ColorTo:$00793D20 (#203D79)
 * - 單純預覽與列印畫面，不含資料過濾條件；呼叫端傳入 data 與 columns 即可預覽
 * - 支援欄寬/列高拖曳調整、縮放百分比、編修、更新、可客製化匯出 (PDF/JPG/WORD)、雙擊報表追追追、右側 Windows 列印側邊欄
 */
export function ReportPreviewModal<T extends Record<string, any> = Record<string, any>>({
  isOpen,
  onClose,
  reportId,
  companyName = '',
  reportTitle,
  subHeaderLeft = '',
  subHeaderCenter = '',
  subHeaderRight = '',
  footerText = '',
  data,
  columns,
  getRowKey,
  loading = false,
  emptyText = '⚠️ 目前無可供預覽列印之資料',
  defaultRowHeight = 26,
  defaultFontSize = 12,
  defaultPaperSize = 'A4',
  defaultOrientation = 'portrait',
  enableEdit = true,
  onDataEdited,
  onRefresh,
  showExport = true,
  exportOptions = ['pdf', 'jpg', 'word'],
  exportFileName,
  onExport,
  onRowDrillDown,
}: ReportPreviewProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });

  // 列印設定狀態 (右側 Windows 列印側邊欄)
  const [printSettings, setPrintSettings] = useState<PrintSettingsState>({
    destination: 'Microsoft Print to PDF',
    pageRangeMode: 'all',
    customPages: '',
    orientation: defaultOrientation,
    colorMode: 'color',
    paperSize: defaultPaperSize,
    pagesPerSheet: 1,
    marginPreset: 'default',
    marginTopMm: 12,
    marginBottomMm: 12,
    marginLeftMm: 10,
    marginRightMm: 10,
    printScaleMode: 'default',
    includeHeaderFooter: true,
    includeBackgroundGraphics: false,
  });

  const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
  const [localagentPrintersAvailable, setLocalagentPrintersAvailable] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 版面配置與縮放狀態
  const savedPrefs = useMemo(() => loadLayoutPrefs(reportId), [reportId]);
  const [rowHeight, setRowHeight] = useState<number>(() => savedPrefs?.rowHeight || defaultRowHeight);
  const [fontSize, setFontSize] = useState<number>(() => savedPrefs?.fontSize || defaultFontSize);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>(() => savedPrefs?.zoomPreset || 'pageWidth');

  const paperDims = useMemo(
    () => getPaperDimensionsPx(printSettings.paperSize, printSettings.orientation),
    [printSettings.paperSize, printSettings.orientation]
  );

  const usablePaperWidthPx = useMemo(
    () =>
      Math.max(
        240,
        paperDims.widthPx - mmToPx(printSettings.marginLeftMm) - mmToPx(printSettings.marginRightMm)
      ),
    [paperDims.widthPx, printSettings.marginLeftMm, printSettings.marginRightMm]
  );

  const [colWidths, setColWidths] = useState<number[]>(() =>
    computeDefaultColWidths(columns, usablePaperWidthPx, savedPrefs?.colWidths)
  );

  // 當 columns 數量或 reportId 變更時重新初始化欄寬
  useEffect(() => {
    const prefs = loadLayoutPrefs(reportId);
    setColWidths(computeDefaultColWidths(columns, usablePaperWidthPx, prefs?.colWidths));
  }, [columns, reportId, usablePaperWidthPx]);

  // 儲存排版偏好至 localStorage
  useEffect(() => {
    if (!reportId) return;
    const widthMap: Record<string, number> = {};
    columns.forEach((col, i) => {
      if (colWidths[i]) widthMap[col.key] = colWidths[i];
    });
    saveLayoutPrefs(reportId, {
      colWidths: widthMap,
      rowHeight,
      fontSize,
      zoomPreset,
    });
  }, [reportId, columns, colWidths, rowHeight, fontSize, zoomPreset]);

  // 編修暫存資料與表頭文字
  const [isEditing, setIsEditing] = useState(false);
  const [workingRows, setWorkingRows] = useState<T[]>(data);
  const [headerMeta, setHeaderMeta] = useState<ReportPreviewHeaderMeta>({
    companyName,
    reportTitle,
    subHeaderLeft,
    subHeaderCenter,
    subHeaderRight,
    footerText,
  });

  useEffect(() => {
    setWorkingRows(data);
  }, [data]);

  useEffect(() => {
    setHeaderMeta({
      companyName,
      reportTitle,
      subHeaderLeft,
      subHeaderCenter,
      subHeaderRight,
      footerText,
    });
  }, [companyName, reportTitle, subHeaderLeft, subHeaderCenter, subHeaderRight, footerText]);

  // UI 控制狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpInput, setJumpInput] = useState('1');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | number | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const showTemporaryNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const t = setTimeout(() => setStatusNotice(null), 3500);
    return () => clearTimeout(t);
  }, [statusNotice]);

  // 載入系統印表機清單 (優先 Electron，其次 LocalAgent :5009 供網頁版直接列印)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const applyPrinters = (list: SystemPrinterInfo[]) => {
      if (cancelled || !Array.isArray(list) || list.length === 0) return;
      setPrinters(list);
      const def = list.find((p) => p.isDefault) || list[0];
      if (def) {
        setPrintSettings((prev) => ({ ...prev, destination: def.name }));
      }
    };

    const electronApi = (window as any).electronAPI;
    if (electronApi?.getPrinters) {
      electronApi
        .getPrinters()
        .then((list: SystemPrinterInfo[]) => applyPrinters(list))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    localagentApi
      .get('/api/printers', { timeout: 2500 })
      .then((res) => {
        if (!cancelled && res.data?.success && Array.isArray(res.data.printers)) {
          setLocalagentPrintersAvailable(true);
          applyPrinters(res.data.printers);
        }
      })
      .catch(() => {
        if (!cancelled) setLocalagentPrintersAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 監測預覽視窗容器大小，計算「頁寬」「整頁」縮放比例
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const el = viewportRef.current;
    const updateSize = () => {
      setViewportSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  // 計算實際縮放倍率
  const effectiveZoom = useMemo(() => {
    const padX = 48;
    const padY = 48;
    if (zoomPreset === 'pageWidth') {
      const ratio = (viewportSize.width - padX) / Math.max(1, paperDims.widthPx);
      return Math.max(0.35, Math.min(2.0, Number(ratio.toFixed(2))));
    }
    if (zoomPreset === 'wholePage') {
      const rx = (viewportSize.width - padX) / Math.max(1, paperDims.widthPx);
      const ry = (viewportSize.height - padY) / Math.max(1, paperDims.heightPx);
      return Math.max(0.3, Math.min(2.0, Number(Math.min(rx, ry).toFixed(2))));
    }
    return zoomPreset / 100;
  }, [zoomPreset, viewportSize.width, viewportSize.height, paperDims.widthPx, paperDims.heightPx]);

  const effectiveZoomPercent = Math.round(effectiveZoom * 100);

  // 計算每頁可容納資料列數並自動分頁
  const marginTopPx = mmToPx(printSettings.marginTopMm);
  const marginBottomPx = mmToPx(printSettings.marginBottomMm);
  const marginLeftPx = mmToPx(printSettings.marginLeftMm);
  const marginRightPx = mmToPx(printSettings.marginRightMm);

  const rowsPerPage = useMemo(() => {
    const headerReserve = printSettings.includeHeaderFooter ? (headerMeta.companyName ? 82 : 56) : 0;
    const footerReserve = printSettings.includeHeaderFooter ? 36 : 0;
    const theadHeight = Math.max(rowHeight, 28);
    const availableBodyPx = Math.max(
      rowHeight,
      paperDims.heightPx - marginTopPx - marginBottomPx - headerReserve - footerReserve - theadHeight
    );
    return Math.max(1, Math.floor(availableBodyPx / rowHeight));
  }, [
    paperDims.heightPx,
    marginTopPx,
    marginBottomPx,
    printSettings.includeHeaderFooter,
    headerMeta.companyName,
    rowHeight,
  ]);

  const pages = useMemo(() => {
    if (workingRows.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < workingRows.length; i += rowsPerPage) {
      chunks.push(workingRows.slice(i, i + rowsPerPage));
    }
    return chunks;
  }, [workingRows, rowsPerPage]);

  const totalPages = pages.length;

  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
      setJumpInput('1');
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      setJumpInput(String(totalPages));
    }
  }, [totalPages, currentPage]);

  const goToPage = useCallback(
    (page: number) => {
      if (totalPages === 0) return;
      const clamped = Math.max(1, Math.min(totalPages, page));
      setCurrentPage(clamped);
      setJumpInput(String(clamped));
    },
    [totalPages]
  );

  // 目前頁資料與起始索引
  const currentPageRows = pages[currentPage - 1] || [];
  const currentPageBaseIndex = (currentPage - 1) * rowsPerPage;

  // 計算要列印/匯出的頁數與紙張數
  const targetPages = useMemo(
    () => getTargetPages(printSettings, currentPage, totalPages),
    [printSettings, currentPage, totalPages]
  );
  const sheetCount = Math.max(
    targetPages.length === 0 ? 0 : 1,
    Math.ceil(targetPages.length / printSettings.pagesPerSheet)
  );

  // 點擊外部關閉匯出下拉框
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportMenuOpen]);

  // 欄寬拖曳調整
  const handleStartColResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colIdx] || 80;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) / effectiveZoom;
      const nextWidth = Math.max(36, Math.round(startWidth + delta));
      setColWidths((prev) => {
        const copy = [...prev];
        copy[colIdx] = nextWidth;
        return copy;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 列高拖曳調整
  const handleStartRowResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = (ev.clientY - startY) / effectiveZoom;
      const nextH = Math.max(18, Math.min(72, Math.round(startH + delta)));
      setRowHeight(nextH);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 縮放 +/- 調整
  const stepZoom = useCallback(
    (direction: 1 | -1) => {
      const currentPct = effectiveZoomPercent;
      if (direction > 0) {
        const next = ZOOM_STEPS.find((s) => s > currentPct) ?? 200;
        setZoomPreset(next);
      } else {
        const prev = [...ZOOM_STEPS].reverse().find((s) => s < currentPct) ?? 50;
        setZoomPreset(prev);
      }
    },
    [effectiveZoomPercent]
  );

  // 更新資料
  const handleRefreshClick = async () => {
    if (!onRefresh) {
      showTemporaryNotice('呼叫端未設定更新資料來源');
      return;
    }
    setRefreshing(true);
    try {
      await onRefresh();
      showTemporaryNotice('✅ 已重新載入最新報表資料');
    } finally {
      setRefreshing(false);
    }
  };

  // 切換編修模式
  const handleToggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      onDataEdited?.(workingRows, headerMeta);
      showTemporaryNotice('✅ 已完成編修，列印與匯出將採用最新內容');
    } else {
      setIsEditing(true);
      showTemporaryNotice('✏️ 已進入編修模式：可直接點選表頭與欄位內容進行修改');
    }
  };

  // 更新儲存格文字 (編修模式)
  const handleCellEdit = (globalRowIndex: number, key: string, value: string) => {
    setWorkingRows((prev) => {
      const next = [...prev];
      const currentRow = next[globalRowIndex];
      if (!currentRow) return prev;
      next[globalRowIndex] = { ...currentRow, [key]: value };
      return next;
    });
  };

  // 組裝匯出/列印參數
  const buildExportParams = useCallback(() => {
    const pageNums = targetPages.length > 0 ? targetPages : [1];
    return {
      pages,
      pageNumbers: pageNums,
      totalPages: Math.max(1, totalPages),
      columns,
      colWidths,
      rowHeight,
      fontSize,
      headerMeta,
      settings: printSettings,
    };
  }, [targetPages, pages, totalPages, columns, colWidths, rowHeight, fontSize, headerMeta, printSettings]);

  // 執行匯出
  const allowedExportOptions = showExport ? exportOptions : [];
  const fileNameBase = `${exportFileName || headerMeta.reportTitle || 'report'}_${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const handleExportAction = useCallback(
    async (type: ReportExportType) => {
      setExportMenuOpen(false);
      if (workingRows.length === 0) {
        showTemporaryNotice('⚠️ 目前無資料可供匯出');
        return;
      }

      setExporting(true);
      try {
        if (onExport) {
          await onExport(type, workingRows, headerMeta);
          return;
        }

        const params = buildExportParams();
        if (type === 'pdf') {
          await exportReportToPdf(params, fileNameBase);
          showTemporaryNotice(`📄 已匯出 ${fileNameBase}.pdf`);
        } else if (type === 'jpg') {
          await exportReportToJpg(params, fileNameBase);
          showTemporaryNotice(`🖼️ 已匯出 JPG 圖檔 (${params.pageNumbers.length} 頁)`);
        } else if (type === 'word') {
          exportReportToWord(params, fileNameBase);
          showTemporaryNotice(`📝 已匯出 ${fileNameBase}.doc`);
        }
      } catch (err) {
        console.error('Report export failed:', err);
        showTemporaryNotice('❌ 匯出失敗，請檢查瀏覽器權限或資料內容');
      } finally {
        setExporting(false);
      }
    },
    [workingRows, headerMeta, onExport, buildExportParams, fileNameBase, showTemporaryNotice]
  );

  // 執行列印（直接依右側預覽條件靜默送印，不再彈出第二個預覽視窗）
  const handlePrint = useCallback(async () => {
    if (workingRows.length === 0) {
      showTemporaryNotice('⚠️ 目前無資料可供列印');
      return;
    }

    if (
      printSettings.destination === '__SAVE_PDF__' ||
      printSettings.destination === 'Microsoft Print to PDF'
    ) {
      await handleExportAction('pdf');
      return;
    }

    setPrinting(true);
    try {
      const params = buildExportParams();
      const electronApi = (window as any).electronAPI;

      // 1. Electron 桌面端：直接使用 silent: true 送印，不跳出瀏覽器第二層預覽視窗
      if (electronApi?.printHtml && printSettings.destination !== '__BROWSER_DEFAULT__') {
        const html = buildReportPrintableHtml(params);
        const { widthMm, heightMm } = getPaperDimensionsPx(
          printSettings.paperSize,
          printSettings.orientation
        );
        const res = await electronApi.printHtml(html, {
          silent: true,
          deviceName: printSettings.destination,
          landscape: printSettings.orientation === 'landscape',
          color: printSettings.colorMode === 'color',
          printBackground: printSettings.includeBackgroundGraphics,
          pageSize: {
            width: Math.round(widthMm * 1000),
            height: Math.round(heightMm * 1000),
          },
        });
        if (res?.success) {
          showTemporaryNotice(`🖨️ 已直接送出列印至「${printSettings.destination}」`);
        } else {
          showTemporaryNotice(`❌ 列印失敗：${res?.reason || '請檢查印表機連線'}`);
        }
        return;
      }

      // 2. 瀏覽器端 + LocalAgent：透過 /api/print/direct 直接送到 Windows 印表機，不彈出瀏覽器預覽
      if (localagentPrintersAvailable && printSettings.destination !== '__BROWSER_DEFAULT__') {
        const pageImages = renderSheetsToJpegDataUrls(params);
        const res = await localagentApi.post(
          '/api/print/direct',
          {
            deviceName: printSettings.destination,
            landscape: printSettings.orientation === 'landscape',
            color: printSettings.colorMode === 'color',
            paperSize: printSettings.paperSize,
            jobName: headerMeta.reportTitle || 'Wx3000 報表列印',
            pages: pageImages,
          },
          { timeout: 60000 }
        );
        if (res.data?.success) {
          showTemporaryNotice(
            `🖨️ 已直接送出列印至「${res.data.printer || printSettings.destination}」(${res.data.printedPages} 張)`
          );
        } else {
          showTemporaryNotice(`❌ 列印失敗：${res.data?.error || '請檢查印表機設定'}`);
        }
        return;
      }

      // 3. 純瀏覽器離線降級（無 Electron 且無 LocalAgent）
      showTemporaryNotice(
        '⚠️ 網頁模式需啟動 LocalAgent (Port 5009) 才能直接送印，您可改選「另存為 PDF」或點下方「使用系統對話方塊進行列印」'
      );
    } catch (err: any) {
      console.error('Direct print failed:', err);
      showTemporaryNotice(`❌ 送印失敗：${err?.response?.data?.error || err?.message || '請檢查 LocalAgent 或印表機狀態'}`);
    } finally {
      setPrinting(false);
    }
  }, [
    workingRows.length,
    printSettings,
    buildExportParams,
    showTemporaryNotice,
    handleExportAction,
    localagentPrintersAvailable,
    headerMeta.reportTitle,
  ]);

  // 開啟系統原生列印對話方塊 (Ctrl+Shift+P)
  const handleSystemPrintDialog = useCallback(() => {
    if (workingRows.length === 0) return;
    const html = buildReportPrintableHtml(buildExportParams());
    printHtmlViaIframe(html);
  }, [workingRows.length, buildExportParams]);

  // 重設欄寬與列高設定
  const handleResetLayout = () => {
    setRowHeight(defaultRowHeight);
    setFontSize(defaultFontSize);
    setZoomPreset('pageWidth');
    setColWidths(computeDefaultColWidths(columns, usablePaperWidthPx));
    const key = getStorageKey(reportId);
    if (key) localStorage.removeItem(key);
    setSettingsPopoverOpen(false);
    showTemporaryNotice('⚙️ 已重設為預設欄寬與列高');
  };

  // 鍵盤快速鍵處理
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      const isInputFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (exportMenuOpen) {
          setExportMenuOpen(false);
        } else if (settingsPopoverOpen) {
          setSettingsPopoverOpen(false);
        } else if (isEditing) {
          setIsEditing(false);
          onDataEdited?.(workingRows, headerMeta);
        } else {
          onClose();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        handleSystemPrintDialog();
        return;
      }

      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') || e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
        return;
      }

      if (isInputFocused) return;

      if (e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'Home' || (e.ctrlKey && e.key === 'Home')) {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End' || (e.ctrlKey && e.key === 'End')) {
        e.preventDefault();
        goToPage(totalPages);
      } else if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        stepZoom(1);
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        stepZoom(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    isOpen,
    exportMenuOpen,
    settingsPopoverOpen,
    isEditing,
    workingRows,
    headerMeta,
    onDataEdited,
    onClose,
    handleSystemPrintDialog,
    handlePrint,
    goToPage,
    currentPage,
    totalPages,
    stepZoom,
  ]);

  if (!isOpen) return null;

  // 工具列與按鈕依指定 Delphi TColor 漸層色設定：
  // 工具列底色：Color:$00FFF3E8 (#E8F3FF) -> ColorTo:$00FFCA8E (#8ECAFF)
  // 按鈕底色：Color:$00834727 (#274783) -> ColorTo:$00793D20 (#203D79)
  const toolbarGradientStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #E8F3FF 0%, #8ECAFF 100%)',
  };
  const buttonGradientStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #274783 0%, #203D79 100%)',
  };

  const navBtnClass =
    'h-8 px-3 text-xs font-bold text-white rounded-[2px] border border-[#1a3260] shadow-xs hover:brightness-115 active:brightness-95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 whitespace-nowrap transition';

  const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1f1f1f] select-none">
      {/* 1. TOP TOOLBAR (附圖一風格：移除「列印」按鈕與「捲動」勾選框) */}
      <header
        style={toolbarGradientStyle}
        className="h-11 px-2 flex items-center justify-between gap-2 border-b border-[#5b9bd5] shrink-0 shadow-sm"
      >
        {/* 左側按鈕群：首頁 / 上頁 / 下頁 / 尾頁 / 編修 / 更新 / 匯出 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            style={buttonGradientStyle}
            onClick={() => goToPage(1)}
            disabled={currentPage <= 1 || totalPages === 0}
            className={navBtnClass}
            title="首頁 (Home)"
          >
            首頁
          </button>
          <button
            type="button"
            style={buttonGradientStyle}
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || totalPages === 0}
            className={navBtnClass}
            title="上一頁 (PageUp)"
          >
            上頁
          </button>
          <button
            type="button"
            style={buttonGradientStyle}
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || totalPages === 0}
            className={navBtnClass}
            title="下一頁 (PageDown)"
          >
            下頁
          </button>
          <button
            type="button"
            style={buttonGradientStyle}
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages || totalPages === 0}
            className={navBtnClass}
            title="尾頁 (End)"
          >
            尾頁
          </button>

          {enableEdit && (
            <button
              type="button"
              style={
                isEditing
                  ? { background: 'linear-gradient(180deg, #d97706 0%, #b45309 100%)' }
                  : buttonGradientStyle
              }
              onClick={handleToggleEdit}
              className={`${navBtnClass} ml-1 ${isEditing ? 'ring-2 ring-yellow-300 border-yellow-400' : ''}`}
              title="點選可直接修改預覽內容"
            >
              {isEditing ? '完成編修' : '編修'}
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              style={buttonGradientStyle}
              onClick={handleRefreshClick}
              disabled={refreshing || loading}
              className={navBtnClass}
              title="通知呼叫端重新取得最新資料並刷新預覽"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
              <span>更新</span>
            </button>
          )}

          {allowedExportOptions.length > 0 && (
            <div ref={exportDropdownRef} className="relative">
              <button
                type="button"
                style={buttonGradientStyle}
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={exporting || workingRows.length === 0}
                className={navBtnClass}
              >
                <span>{exporting ? '匯出中...' : '匯出'}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {exportMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-36 bg-white border border-slate-300 rounded shadow-xl z-50 py-1 text-xs text-slate-800">
                  {allowedExportOptions.map((opt) => {
                    const meta = EXPORT_MENU_META[opt];
                    if (!meta) return null;
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleExportAction(opt)}
                        className="w-full px-3 py-2 text-left hover:bg-[#E8F3FF] hover:text-[#203D79] font-semibold flex items-center justify-between cursor-pointer transition"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-[#274783]" />
                          <span>{meta.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{meta.ext}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 中間調整控制區：顯示比例百分比 + 列高 */}
        <div className="flex items-center gap-2 text-xs text-slate-900 font-bold">
          {/* 顯示百分比縮放 */}
          <div className="flex items-center gap-1 bg-white/85 border border-slate-400 rounded px-1.5 py-0.5 shadow-2xs">
            <span className="text-[11px] text-slate-700">比例:</span>
            <button
              type="button"
              onClick={() => stepZoom(-1)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 cursor-pointer font-mono"
              title="縮小 (Ctrl+-)"
            >
              −
            </button>
            <select
              value={String(zoomPreset)}
              onChange={(e) => {
                const v = e.target.value;
                setZoomPreset(v === 'pageWidth' || v === 'wholePage' ? v : (Number(v) as ZoomPreset));
              }}
              className="bg-transparent font-mono text-xs outline-none cursor-pointer"
            >
              <option value="pageWidth">頁寬 ({effectiveZoomPercent}%)</option>
              <option value="wholePage">整頁 ({effectiveZoomPercent}%)</option>
              {ZOOM_STEPS.map((pct) => (
                <option key={pct} value={String(pct)}>
                  {pct}%
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => stepZoom(1)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 cursor-pointer font-mono"
              title="放大 (Ctrl++)"
            >
              +
            </button>
          </div>

          {/* 列高調整 */}
          <div className="hidden md:flex items-center gap-1 bg-white/85 border border-slate-400 rounded px-1.5 py-0.5 shadow-2xs">
            <span className="text-[11px] text-slate-700">列高:</span>
            <button
              type="button"
              onClick={() => setRowHeight((h) => Math.max(18, h - 2))}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 cursor-pointer font-mono"
              title="縮小列高"
            >
              −
            </button>
            <input
              type="number"
              min={18}
              max={72}
              value={rowHeight}
              onChange={(e) => setRowHeight(Math.max(18, Math.min(72, Number(e.target.value) || 26)))}
              className="w-10 text-center bg-transparent font-mono text-xs outline-none"
            />
            <span className="text-[10px] text-slate-500">px</span>
            <button
              type="button"
              onClick={() => setRowHeight((h) => Math.min(72, h + 2))}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 cursor-pointer font-mono"
              title="加大列高"
            >
              +
            </button>
          </div>
        </div>

        {/* 右側按鈕群：報表設定 / 離開 */}
        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            style={buttonGradientStyle}
            onClick={() => setSettingsPopoverOpen((v) => !v)}
            className={navBtnClass}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>報表設定</span>
          </button>

          <button
            type="button"
            style={buttonGradientStyle}
            onClick={onClose}
            className={navBtnClass}
            title="離開預覽 (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>離開</span>
          </button>

          {/* 報表設定小浮窗 */}
          {settingsPopoverOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-300 rounded-md shadow-2xl p-3 z-50 text-xs text-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 font-bold text-[#203D79]">
                <span>報表版面設定</span>
                <button
                  type="button"
                  onClick={() => setSettingsPopoverOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>表格字級 (px)</span>
                <input
                  type="number"
                  min={9}
                  max={20}
                  value={fontSize}
                  onChange={(e) => setFontSize(Math.max(9, Math.min(20, Number(e.target.value) || 12)))}
                  className="w-16 px-2 py-0.5 border border-slate-300 rounded text-right font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>資料列高 (px)</span>
                <input
                  type="number"
                  min={18}
                  max={72}
                  value={rowHeight}
                  onChange={(e) => setRowHeight(Math.max(18, Math.min(72, Number(e.target.value) || 26)))}
                  className="w-16 px-2 py-0.5 border border-slate-300 rounded text-right font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                提示：也可直接拖曳表頭欄線調整欄寬，或拖曳資料列底線調整列高。
              </p>
              <div className="pt-1 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  重設預設值
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: 左側預覽紙張 + 右側 Windows 列印側邊欄 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左側灰底預覽區 */}
        <div className="flex-1 min-w-0 flex flex-col bg-[#7a7a7a] relative">
          {/* 提示橫幅 (編修模式 / 操作回饋) */}
          {(isEditing || statusNotice) && (
            <div
              className={`px-3 py-1 text-xs font-medium flex items-center justify-between shrink-0 border-b ${
                isEditing
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : 'bg-slate-900/90 text-amber-300 border-slate-700'
              }`}
            >
              <span>
                {statusNotice ||
                  '✏️ 編修模式中：直接點擊報表標題或資料格即可修改文字，完成後請點選上方「完成編修」。'}
              </span>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleToggleEdit}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  完成編修
                </button>
              )}
            </div>
          )}

          {/* 滾動預覽畫布 */}
          <div
            ref={viewportRef}
            onWheel={(e) => {
              if (e.ctrlKey) {
                e.preventDefault();
                stepZoom(e.deltaY < 0 ? 1 : -1);
              }
            }}
            className="flex-1 overflow-auto p-5 flex justify-center items-start"
          >
            {loading || refreshing ? (
              <div className="bg-white/95 text-slate-800 px-8 py-6 rounded shadow-lg font-bold text-sm mt-12">
                ⏳ 正在載入報表資料，請稍候...
              </div>
            ) : workingRows.length === 0 ? (
              <div className="bg-white/95 text-red-600 px-8 py-6 rounded shadow-lg font-bold text-sm mt-12">
                {emptyText}
              </div>
            ) : (
              <div
                style={{
                  width: `${Math.round(paperDims.widthPx * effectiveZoom)}px`,
                  height: `${Math.round(paperDims.heightPx * effectiveZoom)}px`,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: `${paperDims.widthPx}px`,
                    height: `${paperDims.heightPx}px`,
                    padding: `${marginTopPx}px ${marginRightPx}px ${marginBottomPx}px ${marginLeftPx}px`,
                    transform: `scale(${effectiveZoom})`,
                    transformOrigin: 'top left',
                    filter: printSettings.colorMode === 'bw' ? 'grayscale(100%)' : undefined,
                    fontFamily: '"PMingLiU", "MingLiU", "Microsoft JhengHei", Consolas, monospace',
                  }}
                  className="bg-white text-black border-[1.5px] border-[#eab308] shadow-[0_8px_28px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden"
                >
                  {/* 表頭區 */}
                  {printSettings.includeHeaderFooter && (
                    <div className="shrink-0 mb-1.5">
                      {(headerMeta.companyName || isEditing) && (
                        <div className="text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={headerMeta.companyName}
                              onChange={(e) =>
                                setHeaderMeta((prev) => ({ ...prev, companyName: e.target.value }))
                              }
                              placeholder="公司名稱"
                              className="text-center font-bold tracking-[0.2em] bg-amber-50 border border-amber-400 px-2 py-0.5 outline-none w-2/3"
                              style={{ fontSize: `${Math.max(fontSize + 4, 15)}px` }}
                            />
                          ) : (
                            <div
                              className="font-bold tracking-[0.2em] text-black"
                              style={{ fontSize: `${Math.max(fontSize + 4, 15)}px` }}
                            >
                              {headerMeta.companyName}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-center mt-0.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={headerMeta.reportTitle}
                            onChange={(e) =>
                              setHeaderMeta((prev) => ({ ...prev, reportTitle: e.target.value }))
                            }
                            className="text-center font-bold tracking-[0.25em] bg-amber-50 border border-amber-400 px-2 py-0.5 outline-none w-1/2"
                            style={{ fontSize: `${Math.max(fontSize + 2, 14)}px` }}
                          />
                        ) : (
                          <div
                            className="font-bold tracking-[0.25em] text-black"
                            style={{ fontSize: `${Math.max(fontSize + 2, 14)}px` }}
                          >
                            {headerMeta.reportTitle}
                          </div>
                        )}
                      </div>

                      <div
                        className="flex items-end justify-between mt-1.5 gap-2"
                        style={{ fontSize: `${Math.max(fontSize - 1, 11)}px` }}
                      >
                        <div className="min-w-[110px] text-left">
                          {isEditing ? (
                            <input
                              type="text"
                              value={headerMeta.subHeaderLeft}
                              onChange={(e) =>
                                setHeaderMeta((prev) => ({ ...prev, subHeaderLeft: e.target.value }))
                              }
                              placeholder="左側副標"
                              className="w-full bg-amber-50 border border-amber-400 px-1 outline-none"
                            />
                          ) : (
                            headerMeta.subHeaderLeft
                          )}
                        </div>
                        <div className="flex-1 text-center font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              value={headerMeta.subHeaderCenter}
                              onChange={(e) =>
                                setHeaderMeta((prev) => ({ ...prev, subHeaderCenter: e.target.value }))
                              }
                              placeholder="中間副標"
                              className="w-full text-center bg-amber-50 border border-amber-400 px-1 outline-none"
                            />
                          ) : (
                            headerMeta.subHeaderCenter
                          )}
                        </div>
                        <div className="min-w-[110px] text-right">
                          {headerMeta.subHeaderRight || `頁次：${currentPage}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 報表主表格 (支援拖曳欄寬、拖曳列高、編修輸入、雙擊報表追追追) */}
                  <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
                    <table
                      style={{
                        width: `${Math.max(totalTableWidth, usablePaperWidthPx)}px`,
                        fontSize: `${fontSize}px`,
                      }}
                      className="border-collapse table-fixed"
                    >
                      <colgroup>
                        {columns.map((col, cIdx) => (
                          <col key={col.key} style={{ width: `${colWidths[cIdx] || 80}px` }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr
                          className={`border-t-2 border-b-[1.5px] border-black font-bold text-black ${
                            printSettings.includeBackgroundGraphics ? 'bg-gray-100' : ''
                          }`}
                        >
                          {columns.map((col, cIdx) => (
                            <th
                              key={col.key}
                              style={{ height: `${Math.max(rowHeight, 26)}px` }}
                              className={`relative px-1.5 py-0.5 truncate ${
                                col.align === 'right'
                                  ? 'text-right'
                                  : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                              } ${col.className || ''}`}
                            >
                              <span className="truncate block">{col.label}</span>
                              {/* 欄寬拖曳線 */}
                              <div
                                onMouseDown={(e) => handleStartColResize(e, cIdx)}
                                title="左右拖曳調整欄寬"
                                className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-amber-400/70 transition-colors"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageRows.map((row, rIdx) => {
                          const globalRowIdx = currentPageBaseIndex + rIdx;
                          const rowKey = getRowKey ? getRowKey(row, globalRowIdx) : globalRowIdx;
                          const isSelected = selectedRowKey === rowKey;

                          return (
                            <tr
                              key={rowKey}
                              style={{ height: `${rowHeight}px` }}
                              onClick={() => setSelectedRowKey(rowKey)}
                              onDoubleClick={(e) => {
                                if (isEditing || !onRowDrillDown) return;
                                // 以滑鼠點擊之欄位為準；若點到 tr 則預設第一欄
                                const tdEl = (e.target as HTMLElement).closest('td');
                                const colIdxAttr = tdEl?.getAttribute('data-col-idx');
                                const cIdx = colIdxAttr ? Number(colIdxAttr) : 0;
                                const col = columns[cIdx] || columns[0];
                                onRowDrillDown({
                                  row,
                                  rowIndex: globalRowIdx,
                                  pageNo: currentPage,
                                  columnKey: col?.key || '',
                                  cellValue: col ? row[col.key] : undefined,
                                  nativeEvent: e,
                                });
                              }}
                              title={
                                !isEditing && onRowDrillDown
                                  ? '雙擊此筆資料列可執行【報表追追追】'
                                  : undefined
                              }
                              className={`border-b border-gray-200 transition-colors ${
                                isSelected
                                  ? 'bg-amber-100/90'
                                  : !isEditing && onRowDrillDown
                                  ? 'hover:bg-amber-50 cursor-pointer'
                                  : ''
                              }`}
                            >
                              {columns.map((col, cIdx) => {
                                const val = row[col.key];
                                const canEditCell = isEditing && col.editable !== false;
                                const alignClass =
                                  col.align === 'right'
                                    ? 'text-right'
                                    : col.align === 'center'
                                    ? 'text-center'
                                    : 'text-left';

                                return (
                                  <td
                                    key={col.key}
                                    data-col-idx={cIdx}
                                    className={`relative px-1.5 align-middle truncate ${alignClass} ${
                                      col.className || ''
                                    }`}
                                  >
                                    {canEditCell ? (
                                      <input
                                        type="text"
                                        value={getCellPlainText(col, row, globalRowIdx)}
                                        onChange={(e) =>
                                          handleCellEdit(globalRowIdx, col.key, e.target.value)
                                        }
                                        className={`w-full h-full bg-amber-50/90 border border-amber-400/80 focus:border-blue-600 focus:bg-yellow-50 px-1 outline-none text-black ${alignClass}`}
                                        style={{ fontSize: `${fontSize}px` }}
                                      />
                                    ) : col.render ? (
                                      <span className="block truncate">
                                        {col.render(val, row, globalRowIdx)}
                                      </span>
                                    ) : (
                                      <span className="block truncate">
                                        {getCellPlainText(col, row, globalRowIdx)}
                                      </span>
                                    )}

                                    {/* 列高拖曳線 (附於第一欄底緣) */}
                                    {cIdx === 0 && (
                                      <div
                                        onMouseDown={handleStartRowResize}
                                        title="上下拖曳調整列高"
                                        className="absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-blue-500/60"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 表尾區 */}
                  {printSettings.includeHeaderFooter && (
                    <div
                      className="shrink-0 mt-auto pt-1.5 border-t border-black flex items-center justify-between text-gray-800"
                      style={{ fontSize: `${Math.max(fontSize - 1, 10)}px` }}
                    >
                      <span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={headerMeta.footerText}
                            onChange={(e) =>
                              setHeaderMeta((prev) => ({ ...prev, footerText: e.target.value }))
                            }
                            placeholder={`總計筆數：${workingRows.length} 筆`}
                            className="bg-amber-50 border border-amber-400 px-1 outline-none w-64"
                          />
                        ) : (
                          headerMeta.footerText || `總計筆數：${workingRows.length} 筆`
                        )}
                      </span>
                      <span>
                        第 {currentPage} 頁 / 共 {totalPages} 頁
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 左下角狀態列 (附圖一風格) */}
          <footer className="h-6 bg-[#f0f0f0] border-t border-slate-400 px-3 flex items-center justify-between text-[11px] text-slate-800 font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold">
                {totalPages > 0 ? `${currentPage} / ${totalPages}` : '0 / 0'}
              </span>
              <span className="text-slate-400">|</span>
              <label className="flex items-center gap-1">
                <span>跳到</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, totalPages)}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      goToPage(Number(jumpInput) || 1);
                    }
                  }}
                  onBlur={() => goToPage(Number(jumpInput) || currentPage)}
                  className="w-12 px-1 bg-white border border-slate-400 rounded text-center outline-none focus:border-blue-600"
                />
                <span>頁</span>
              </label>
              <span className="text-slate-400">|</span>
              <span>共 {workingRows.length} 筆</span>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              {isEditing ? (
                <span className="text-amber-700 font-bold">編修模式：可直接修改表頭及儲存格</span>
              ) : onRowDrillDown ? (
                <span className="text-[#203D79] font-semibold">
                  💡 雙擊任一資料列可執行【報表追追追】
                </span>
              ) : null}
              <span className="hidden sm:inline text-slate-400">|</span>
              <span className="hidden sm:inline">[Esc] 離開 · [F7/Ctrl+P] 列印</span>
            </div>
          </footer>
        </div>

        {/* 右側 Windows 系統預設列印工具列 (附圖二) */}
        <PrintSettingsSidebar
          settings={printSettings}
          onChange={(patch) => setPrintSettings((prev) => ({ ...prev, ...patch }))}
          printers={printers}
          sheetCount={sheetCount}
          totalPages={totalPages}
          printing={printing}
          onPrint={handlePrint}
          onSystemPrintDialog={handleSystemPrintDialog}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
