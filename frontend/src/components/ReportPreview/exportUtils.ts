import type {
  PageOrientation,
  PaperSizeOption,
  PrintSettingsState,
  ReportPreviewColumn,
  ReportPreviewHeaderMeta,
} from './types';

const MM_TO_PX = 96 / 25.4;
const MM_TO_PT = 72 / 25.4;

export const PAPER_DIMENSIONS_MM: Record<PaperSizeOption, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  Letter: { width: 215.9, height: 279.4, label: 'Letter (216 × 279 mm)' },
  HalfLetter: { width: 215, height: 140, label: '中一刀 (215 × 140 mm)' },
  B4: { width: 250, height: 353, label: 'B4 (250 × 353 mm)' },
};

export function getPaperDimensionsPx(paperSize: PaperSizeOption, orientation: PageOrientation) {
  const base = PAPER_DIMENSIONS_MM[paperSize] || PAPER_DIMENSIONS_MM.A4;
  const widthMm = orientation === 'landscape' ? base.height : base.width;
  const heightMm = orientation === 'landscape' ? base.width : base.height;
  return {
    widthMm,
    heightMm,
    widthPx: Math.round(widthMm * MM_TO_PX),
    heightPx: Math.round(heightMm * MM_TO_PX),
  };
}

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

export function getCellPlainText<T extends Record<string, any>>(
  col: ReportPreviewColumn<T>,
  row: T,
  rowIndex: number
): string {
  const raw = row[col.key];
  if (col.formatText) {
    return col.formatText(raw, row, rowIndex);
  }
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

export function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  const result = new Set<number>();
  const parts = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let p = start; p <= end; p++) result.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
        result.add(p);
      }
    }
  }

  if (result.size === 0) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  return Array.from(result).sort((a, b) => a - b);
}

export function getTargetPages(
  settings: PrintSettingsState,
  currentPage: number,
  totalPages: number
): number[] {
  if (totalPages <= 0) return [];
  if (settings.pageRangeMode === 'current') {
    return [Math.max(1, Math.min(totalPages, currentPage))];
  }
  if (settings.pageRangeMode === 'custom') {
    return parsePageRanges(settings.customPages, totalPages);
  }
  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ExportBuildParams<T extends Record<string, any>> {
  pages: T[][];
  pageNumbers: number[];
  totalPages: number;
  columns: ReportPreviewColumn<T>[];
  colWidths: number[];
  rowHeight: number;
  fontSize: number;
  headerMeta: ReportPreviewHeaderMeta;
  settings: PrintSettingsState;
}

export function buildReportPrintableHtml<T extends Record<string, any>>(
  params: ExportBuildParams<T>
): string {
  const {
    pages,
    pageNumbers,
    totalPages,
    columns,
    colWidths,
    rowHeight,
    fontSize,
    headerMeta,
    settings,
  } = params;

  const { widthMm, heightMm } = getPaperDimensionsPx(settings.paperSize, settings.orientation);
  const grayscaleCss = settings.colorMode === 'bw' ? 'filter: grayscale(100%);' : '';
  const totalColWidth = colWidths.reduce((sum, w) => sum + w, 0) || 1;

  const colgroupHtml = colWidths
    .map((w) => `<col style="width: ${((w / totalColWidth) * 100).toFixed(2)}%;" />`)
    .join('');

  const pageHtmlList = pageNumbers.map((pageNo, idx) => {
    const rows = pages[pageNo - 1] || [];
    const baseRowIdx = pages.slice(0, pageNo - 1).reduce((sum, p) => sum + p.length, 0);

    const headerHtml = settings.includeHeaderFooter
      ? `
        <div class="rpt-header">
          ${headerMeta.companyName ? `<div class="rpt-company">${escapeHtml(headerMeta.companyName)}</div>` : ''}
          <div class="rpt-title">${escapeHtml(headerMeta.reportTitle)}</div>
          <div class="rpt-sub">
            <span class="rpt-sub-left">${escapeHtml(headerMeta.subHeaderLeft)}</span>
            <span class="rpt-sub-center">${escapeHtml(headerMeta.subHeaderCenter)}</span>
            <span class="rpt-sub-right">${escapeHtml(
              headerMeta.subHeaderRight || `頁次：${pageNo} / ${totalPages}`
            )}</span>
          </div>
        </div>
      `
      : '';

    const theadHtml = `
      <thead>
        <tr>
          ${columns
            .map(
              (col) =>
                `<th style="text-align: ${col.align || 'left'};">${escapeHtml(col.label)}</th>`
            )
            .join('')}
        </tr>
      </thead>
    `;

    const tbodyHtml = `
      <tbody>
        ${rows
          .map((row, rIdx) => {
            const globalIdx = baseRowIdx + rIdx;
            return `<tr style="height: ${rowHeight}px;">
              ${columns
                .map((col) => {
                  const text = getCellPlainText(col, row, globalIdx);
                  return `<td style="text-align: ${col.align || 'left'};">${escapeHtml(text)}</td>`;
                })
                .join('')}
            </tr>`;
          })
          .join('')}
      </tbody>
    `;

    const footerHtml = settings.includeHeaderFooter
      ? `
        <div class="rpt-footer">
          <span>${escapeHtml(headerMeta.footerText || `共 ${pages.flat().length} 筆`)}</span>
          <span>第 ${pageNo} 頁 / 共 ${totalPages} 頁</span>
        </div>
      `
      : '';

    const isLast = idx === pageNumbers.length - 1;
    return `
      <section class="rpt-page ${isLast ? '' : 'page-break'}">
        ${headerHtml}
        <table class="rpt-table">
          <colgroup>${colgroupHtml}</colgroup>
          ${theadHtml}
          ${tbodyHtml}
        </table>
        ${footerHtml}
      </section>
    `;
  });

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(headerMeta.reportTitle)}</title>
  <style>
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: ${settings.marginTopMm}mm ${settings.marginRightMm}mm ${settings.marginBottomMm}mm ${settings.marginLeftMm}mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: "PMingLiU", "MingLiU", "Microsoft JhengHei", Consolas, monospace;
      ${settings.includeBackgroundGraphics ? '-webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}
      ${grayscaleCss}
    }
    .rpt-page {
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .rpt-header {
      text-align: center;
      margin-bottom: 6px;
    }
    .rpt-company {
      font-size: ${Math.max(fontSize + 4, 15)}px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .rpt-title {
      font-size: ${Math.max(fontSize + 2, 14)}px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-top: 2px;
    }
    .rpt-sub {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: ${Math.max(fontSize - 1, 11)}px;
      margin-top: 6px;
    }
    .rpt-sub-left, .rpt-sub-right {
      min-width: 120px;
    }
    .rpt-sub-left { text-align: left; }
    .rpt-sub-center { flex: 1; text-align: center; font-weight: 600; }
    .rpt-sub-right { text-align: right; }
    .rpt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${fontSize}px;
    }
    .rpt-table thead th {
      border-top: 2px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 4px 6px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      ${settings.includeBackgroundGraphics ? 'background-color: #f3f4f6;' : ''}
    }
    .rpt-table tbody td {
      padding: 2px 6px;
      border-bottom: 1px solid #e5e7eb;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }
    .rpt-footer {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #000;
      display: flex;
      justify-content: space-between;
      font-size: ${Math.max(fontSize - 1, 10)}px;
    }
  </style>
</head>
<body>
  ${pageHtmlList.join('\n')}
</body>
</html>`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

/**
 * 透過隱藏 iframe 呼叫瀏覽器原生列印視窗
 */
export function printHtmlViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}

/**
 * 將單頁報表繪製到高解析 Canvas，供匯出 JPG 與純前端 PDF 使用
 */
function renderPageToCanvas<T extends Record<string, any>>(
  pageRows: T[],
  baseRowIdx: number,
  pageNo: number,
  totalPages: number,
  totalRowCount: number,
  columns: ReportPreviewColumn<T>[],
  colWidths: number[],
  rowHeight: number,
  fontSize: number,
  headerMeta: ReportPreviewHeaderMeta,
  settings: PrintSettingsState
): HTMLCanvasElement {
  const scale = 2; // 2x DPI 確保中文字體銳利清晰
  const { widthPx, heightPx } = getPaperDimensionsPx(settings.paperSize, settings.orientation);
  const marginTop = mmToPx(settings.marginTopMm);
  const marginRight = mmToPx(settings.marginRightMm);
  const marginBottom = mmToPx(settings.marginBottomMm);
  const marginLeft = mmToPx(settings.marginLeftMm);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx * scale;
  canvas.height = heightPx * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 白底紙張
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (settings.colorMode === 'bw') {
    ctx.filter = 'grayscale(100%)';
  }

  const contentLeft = marginLeft;
  const contentWidth = Math.max(120, widthPx - marginLeft - marginRight);
  let y = marginTop;

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';

  // 表頭區
  if (settings.includeHeaderFooter) {
    if (headerMeta.companyName) {
      ctx.font = `bold ${Math.max(fontSize + 5, 16)}px "Microsoft JhengHei", "PMingLiU", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(headerMeta.companyName, contentLeft + contentWidth / 2, y + 12);
      y += 24;
    }

    ctx.font = `bold ${Math.max(fontSize + 3, 14)}px "Microsoft JhengHei", "PMingLiU", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(headerMeta.reportTitle, contentLeft + contentWidth / 2, y + 10);
    y += 22;

    ctx.font = `${Math.max(fontSize - 1, 11)}px "Microsoft JhengHei", Consolas, monospace`;
    ctx.textAlign = 'left';
    if (headerMeta.subHeaderLeft) {
      ctx.fillText(headerMeta.subHeaderLeft, contentLeft, y + 8);
    }
    if (headerMeta.subHeaderCenter) {
      ctx.textAlign = 'center';
      ctx.fillText(headerMeta.subHeaderCenter, contentLeft + contentWidth / 2, y + 8);
    }
    ctx.textAlign = 'right';
    ctx.fillText(
      headerMeta.subHeaderRight || `頁次：${pageNo} / ${totalPages}`,
      contentLeft + contentWidth,
      y + 8
    );
    y += 20;
  }

  // 欄寬縮放至可列印寬度
  const sumW = colWidths.reduce((s, w) => s + w, 0) || 1;
  const scaledWidths = colWidths.map((w) => (w / sumW) * contentWidth);

  // 表頭列
  const headerRowH = Math.max(rowHeight, 26);
  if (settings.includeBackgroundGraphics) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(contentLeft, y, contentWidth, headerRowH);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(contentLeft, y);
  ctx.lineTo(contentLeft + contentWidth, y);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentLeft, y + headerRowH);
  ctx.lineTo(contentLeft + contentWidth, y + headerRowH);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontSize}px "Microsoft JhengHei", Consolas, monospace`;
  let x = contentLeft;
  columns.forEach((col, cIdx) => {
    const w = scaledWidths[cIdx];
    const align = col.align || 'left';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y, Math.max(0, w - 4), headerRowH);
    ctx.clip();
    ctx.textAlign = align;
    const textX = align === 'right' ? x + w - 5 : align === 'center' ? x + w / 2 : x + 5;
    ctx.fillText(col.label, textX, y + headerRowH / 2);
    ctx.restore();
    x += w;
  });
  y += headerRowH;

  // 資料列
  ctx.font = `${fontSize}px "Microsoft JhengHei", Consolas, monospace`;
  pageRows.forEach((row, rIdx) => {
    const globalIdx = baseRowIdx + rIdx;
    let cx = contentLeft;
    columns.forEach((col, cIdx) => {
      const w = scaledWidths[cIdx];
      const align = col.align || 'left';
      const txt = getCellPlainText(col, row, globalIdx);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 2, y, Math.max(0, w - 4), rowHeight);
      ctx.clip();
      ctx.fillStyle = '#000000';
      ctx.textAlign = align;
      const textX = align === 'right' ? cx + w - 5 : align === 'center' ? cx + w / 2 : cx + 5;
      ctx.fillText(txt, textX, y + rowHeight / 2);
      ctx.restore();
      cx += w;
    });

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(contentLeft, y + rowHeight);
    ctx.lineTo(contentLeft + contentWidth, y + rowHeight);
    ctx.stroke();

    y += rowHeight;
  });

  // 表尾
  if (settings.includeHeaderFooter) {
    const footerY = heightPx - marginBottom - 16;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(contentLeft, footerY);
    ctx.lineTo(contentLeft + contentWidth, footerY);
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = `${Math.max(fontSize - 1, 10)}px "Microsoft JhengHei", Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(headerMeta.footerText || `總計筆數：${totalRowCount} 筆`, contentLeft, footerY + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`第 ${pageNo} 頁 / 共 ${totalPages} 頁`, contentLeft + contentWidth, footerY + 12);
  }

  return canvas;
}

/**
 * 依據「每張工作表頁數 (pagesPerSheet: 1 | 2 | 4)」將各頁 Canvas 拼版為實體列印紙張 Canvas
 */
export function renderSheetsToCanvases<T extends Record<string, any>>(
  params: ExportBuildParams<T>
): HTMLCanvasElement[] {
  const { pages, pageNumbers, totalPages, columns, colWidths, rowHeight, fontSize, headerMeta, settings } =
    params;
  const totalRowCount = pages.reduce((sum, p) => sum + p.length, 0);

  const pageCanvases = pageNumbers.map((pageNo) => {
    const pageRows = pages[pageNo - 1] || [];
    const baseRowIdx = pages.slice(0, pageNo - 1).reduce((sum, p) => sum + p.length, 0);
    return renderPageToCanvas(
      pageRows,
      baseRowIdx,
      pageNo,
      totalPages,
      totalRowCount,
      columns,
      colWidths,
      rowHeight,
      fontSize,
      headerMeta,
      settings
    );
  });

  if (settings.pagesPerSheet <= 1 || pageCanvases.length === 0) {
    return pageCanvases;
  }

  const perSheet = settings.pagesPerSheet;
  const sheetW = pageCanvases[0].width;
  const sheetH = pageCanvases[0].height;
  const cols = 2;
  const rows = perSheet === 4 ? 2 : 1;
  const cellW = sheetW / cols;
  const cellH = sheetH / rows;

  const sheets: HTMLCanvasElement[] = [];
  for (let i = 0; i < pageCanvases.length; i += perSheet) {
    const sheet = document.createElement('canvas');
    sheet.width = sheetW;
    sheet.height = sheetH;
    const ctx = sheet.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    for (let slot = 0; slot < perSheet; slot++) {
      const src = pageCanvases[i + slot];
      if (!src) break;
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const scale = Math.min((cellW - 16) / src.width, (cellH - 16) / src.height);
      const drawW = src.width * scale;
      const drawH = src.height * scale;
      const dx = col * cellW + (cellW - drawW) / 2;
      const dy = row * cellH + (cellH - drawH) / 2;
      ctx.drawImage(src, dx, dy, drawW, drawH);
    }
    sheets.push(sheet);
  }
  return sheets;
}

/**
 * 產生高解析 JPEG DataURL 陣列，供 LocalAgent 直接列印至本機印表機使用
 */
export function renderSheetsToJpegDataUrls<T extends Record<string, any>>(
  params: ExportBuildParams<T>
): string[] {
  return renderSheetsToCanvases(params).map((canvas) => canvas.toDataURL('image/jpeg', 0.94));
}

/**
 * 匯出 JPG 圖檔
 */
export async function exportReportToJpg<T extends Record<string, any>>(
  params: ExportBuildParams<T>,
  fileNameBase: string
): Promise<void> {
  const sheetCanvases = renderSheetsToCanvases(params);

  for (let i = 0; i < sheetCanvases.length; i++) {
    const canvas = sheetCanvases[i];
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    );
    if (blob) {
      const suffix = sheetCanvases.length > 1 ? `_第${i + 1}張` : '';
      triggerBlobDownload(blob, `${fileNameBase}${suffix}.jpg`);
    }
  }
}

/**
 * 零相依性多頁 JPEG -> PDF 1.4 二進位組裝器 (Web 瀏覽器降級方案)
 */
function buildPdfFromJpegPages(
  jpegPages: Array<{ bytes: Uint8Array; pixelWidth: number; pixelHeight: number; ptWidth: number; ptHeight: number }>
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };
  const pushText = (str: string) => pushBytes(encoder.encode(str));

  pushText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const objOffsets: number[] = [0]; // 1-based object id offsets

  // Object 1: Catalog
  objOffsets[1] = currentOffset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  const pageCount = jpegPages.length;
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjIds.push(3 + i * 3);
  }
  objOffsets[2] = currentOffset;
  pushText(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`
  );

  // Page + Content + Image XObject triplets
  jpegPages.forEach((p, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = pageId + 1;
    const imgId = pageId + 2;
    const ptW = p.ptWidth.toFixed(2);
    const ptH = p.ptHeight.toFixed(2);

    // Page object
    objOffsets[pageId] = currentOffset;
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im${idx} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    // Content stream
    const streamStr = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im${idx} Do\nQ\n`;
    objOffsets[contentId] = currentOffset;
    pushText(
      `${contentId} 0 obj\n<< /Length ${streamStr.length} >>\nstream\n${streamStr}endstream\nendobj\n`
    );

    // Image XObject
    objOffsets[imgId] = currentOffset;
    pushText(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
    );
    pushBytes(p.bytes);
    pushText('\nendstream\nendobj\n');
  });

  // Cross-reference table
  const xrefOffset = currentOffset;
  const totalObjs = objOffsets.length;
  pushText(`xref\n0 ${totalObjs}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < totalObjs; i++) {
    pushText(`${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const finalBytes = new Uint8Array(totalSize);
  let pos = 0;
  for (const chunk of chunks) {
    finalBytes.set(chunk, pos);
    pos += chunk.length;
  }
  return finalBytes;
}

/**
 * 匯出 PDF（Electron 環境優先使用向量 printToPDF；網頁環境使用高解析 Canvas 多頁 PDF）
 */
export async function exportReportToPdf<T extends Record<string, any>>(
  params: ExportBuildParams<T>,
  fileNameBase: string
): Promise<void> {
  const electronApi = (window as any).electronAPI;
  if (electronApi?.printToPDF) {
    const html = buildReportPrintableHtml(params);
    const { widthMm, heightMm } = getPaperDimensionsPx(
      params.settings.paperSize,
      params.settings.orientation
    );
    const base64 = await electronApi.printToPDF(html, {
      landscape: params.settings.orientation === 'landscape',
      printBackground: params.settings.includeBackgroundGraphics,
      pageSize: {
        width: Math.round(widthMm * 1000),
        height: Math.round(heightMm * 1000),
      },
    });
    if (base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      triggerBlobDownload(new Blob([bytes], { type: 'application/pdf' }), `${fileNameBase}.pdf`);
      return;
    }
  }

  const { settings } = params;
  const { widthMm, heightMm } = getPaperDimensionsPx(settings.paperSize, settings.orientation);
  const ptWidth = widthMm * MM_TO_PT;
  const ptHeight = heightMm * MM_TO_PT;

  const jpegPages: Array<{
    bytes: Uint8Array;
    pixelWidth: number;
    pixelHeight: number;
    ptWidth: number;
    ptHeight: number;
  }> = [];

  const sheetCanvases = renderSheetsToCanvases(params);
  for (const canvas of sheetCanvases) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (blob) {
      const buffer = await blob.arrayBuffer();
      jpegPages.push({
        bytes: new Uint8Array(buffer),
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        ptWidth,
        ptHeight,
      });
    }
  }

  if (jpegPages.length > 0) {
    const pdfBytes = buildPdfFromJpegPages(jpegPages);
    const pdfBuffer = new Uint8Array(pdfBytes).buffer;
    triggerBlobDownload(new Blob([pdfBuffer], { type: 'application/pdf' }), `${fileNameBase}.pdf`);
  }
}

/**
 * 匯出 WORD 文件 (.doc 相容格式，內含完整分頁、欄寬、列高與表頭表尾)
 */
export function exportReportToWord<T extends Record<string, any>>(
  params: ExportBuildParams<T>,
  fileNameBase: string
): void {
  const { pages, pageNumbers, totalPages, columns, colWidths, rowHeight, fontSize, headerMeta, settings } =
    params;
  const totalColWidth = colWidths.reduce((s, w) => s + w, 0) || 1;
  const { widthMm, heightMm } = getPaperDimensionsPx(settings.paperSize, settings.orientation);

  const sectionsHtml = pageNumbers
    .map((pageNo, idx) => {
      const rows = pages[pageNo - 1] || [];
      const baseRowIdx = pages.slice(0, pageNo - 1).reduce((s, p) => s + p.length, 0);
      const isLast = idx === pageNumbers.length - 1;

      const headerBlock = settings.includeHeaderFooter
        ? `
          <div style="text-align:center; margin-bottom:6pt;">
            ${headerMeta.companyName ? `<div style="font-size:${fontSize + 4}px; font-weight:bold; letter-spacing:2px;">${escapeHtml(headerMeta.companyName)}</div>` : ''}
            <div style="font-size:${fontSize + 2}px; font-weight:bold; letter-spacing:3px;">${escapeHtml(headerMeta.reportTitle)}</div>
            <table style="width:100%; border:none; margin-top:4pt; font-size:${Math.max(fontSize - 1, 11)}px;">
              <tr>
                <td style="text-align:left; width:30%;">${escapeHtml(headerMeta.subHeaderLeft)}</td>
                <td style="text-align:center; width:40%; font-weight:bold;">${escapeHtml(headerMeta.subHeaderCenter)}</td>
                <td style="text-align:right; width:30%;">${escapeHtml(headerMeta.subHeaderRight || `頁次：${pageNo} / ${totalPages}`)}</td>
              </tr>
            </table>
          </div>
        `
        : '';

      const tableRows = rows
        .map((row, rIdx) => {
          const globalIdx = baseRowIdx + rIdx;
          return `<tr style="height:${rowHeight}px;">
            ${columns
              .map((col, cIdx) => {
                const wPct = ((colWidths[cIdx] / totalColWidth) * 100).toFixed(2);
                const text = getCellPlainText(col, row, globalIdx);
                return `<td style="width:${wPct}%; text-align:${col.align || 'left'}; padding:2px 5px; border-bottom:1px solid #d1d5db;">${escapeHtml(text)}</td>`;
              })
              .join('')}
          </tr>`;
        })
        .join('');

      const footerBlock = settings.includeHeaderFooter
        ? `
          <table style="width:100%; border-top:1px solid #000; margin-top:6pt; font-size:${Math.max(fontSize - 1, 10)}px;">
            <tr>
              <td style="text-align:left;">${escapeHtml(headerMeta.footerText || `總計筆數：${pages.flat().length} 筆`)}</td>
              <td style="text-align:right;">第 ${pageNo} 頁 / 共 ${totalPages} 頁</td>
            </tr>
          </table>
        `
        : '';

      return `
        <div>
          ${headerBlock}
          <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:${fontSize}px;">
            <thead>
              <tr>
                ${columns
                  .map((col, cIdx) => {
                    const wPct = ((colWidths[cIdx] / totalColWidth) * 100).toFixed(2);
                    return `<th style="width:${wPct}%; text-align:${col.align || 'left'}; padding:4px 5px; border-top:2px solid #000; border-bottom:1.5px solid #000; background:#f3f4f6;">${escapeHtml(col.label)}</th>`;
                  })
                  .join('')}
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${footerBlock}
        </div>
        ${isLast ? '' : '<br clear="all" style="page-break-before:always" />'}
      `;
    })
    .join('\n');

  const wordDoc = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(headerMeta.reportTitle)}</title>
<style>
  @page Section1 {
    size: ${widthMm}mm ${heightMm}mm;
    margin: ${settings.marginTopMm}mm ${settings.marginRightMm}mm ${settings.marginBottomMm}mm ${settings.marginLeftMm}mm;
  }
  div.Section1 { page: Section1; font-family: "PMingLiU", "MingLiU", "Microsoft JhengHei", serif; }
</style>
</head>
<body>
  <div class="Section1">
    ${sectionsHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([wordDoc], { type: 'application/msword;charset=utf-8' });
  triggerBlobDownload(blob, `${fileNameBase}.doc`);
}
