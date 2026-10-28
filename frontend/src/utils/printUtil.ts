/**
 * Web Direct Print Utility
 * Prints a specific HTML element cleanly via an isolated hidden iframe
 * ensuring headers, inputs, buttons, and navigation controls are excluded.
 */
export function printElement(element: HTMLElement, title = '報表列印') {
  // Create hidden iframe
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
    window.print();
    return;
  }

  doc.open();
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
  doc.write(`<title>${title}</title>`);

  // Copy stylesheets and style tags
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    doc.write(node.outerHTML);
  });

  // Base print styles
  doc.write(`
    <style>
      @page {
        size: A4 portrait;
        margin: 15mm 10mm;
      }
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        margin: 0;
        padding: 0;
        font-family: Consolas, Monaco, "Courier New", monospace;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      button, input, select, textarea, .print\\:hidden, .no-print {
        display: none !important;
      }
    </style>
  `);
  doc.write('</head><body>');
  doc.write(element.outerHTML);
  doc.write('</body></html>');
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
      }, 1000);
    }
  }, 250);
}

