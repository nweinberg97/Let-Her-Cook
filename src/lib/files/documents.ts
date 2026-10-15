import type { ProgressCallback } from '../extraction/types';
import { FileImportError, MAX_PDF_OCR_PAGES, MAX_PDF_TEXT_PAGES, readBlobBuffer, readBlobText } from './validate';

/**
 * Reads text out of PDFs and Word documents, entirely in the browser.
 * Libraries are loaded on demand so they don't slow down the first visit.
 */

export interface PdfReadResult {
  text: string;
  pageCount: number;
  pagesRead: number;
  /** True when the PDF had no text layer and pages were OCR'd. */
  usedOcr: boolean;
  ocrConfidence: number | null;
}

export async function readPdf(file: File, onProgress?: ProgressCallback, signal?: AbortSignal): Promise<PdfReadResult> {
  onProgress?.({ stage: 'Opening the PDF…' });
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await readBlobBuffer(file));
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    doc = await pdfjs.getDocument({
      data,
      isEvalSupported: false, // never compile code from the PDF
      enableXfa: false,
      disableFontFace: true,
      useSystemFonts: false
    }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'PasswordException') throw new FileImportError('This PDF is password-protected. Open it, copy the recipe text and paste it instead.');
    throw new FileImportError('We couldn’t open this PDF. It may be damaged. Your existing recipes are safe — try exporting it again, or paste the text instead.');
  }

  try {
    const pageCount = doc.numPages;
    const pagesToRead = Math.min(pageCount, MAX_PDF_TEXT_PAGES);
    const pageTexts: string[] = [];
    for (let p = 1; p <= pagesToRead; p++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      onProgress?.({ stage: `Reading page ${p} of ${pagesToRead}…`, progress: p / pagesToRead });
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      let line = '';
      const lines: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2 && line) {
          lines.push(line);
          line = '';
        }
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = '';
          lastY = null;
        } else {
          lastY = y;
        }
      }
      if (line) lines.push(line);
      pageTexts.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).join('\n'));
      page.cleanup();
    }
    const text = pageTexts.join('\n\n').trim();
    const charsPerPage = text.replace(/\s/g, '').length / Math.max(1, pagesToRead);

    if (charsPerPage >= 40) {
      return { text, pageCount, pagesRead: pagesToRead, usedOcr: false, ocrConfidence: null };
    }

    // Scanned PDF: render a few pages and read them with OCR.
    const ocrPages = Math.min(pageCount, MAX_PDF_OCR_PAGES);
    const canvases: HTMLCanvasElement[] = [];
    for (let p = 1; p <= ocrPages; p++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      onProgress?.({ stage: `Preparing scanned page ${p} of ${ocrPages}…`, progress: (p - 1) / ocrPages });
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
      page.cleanup();
    }
    const { recognizeImages } = await import('../ocr/tesseract');
    const ocr = await recognizeImages(canvases, onProgress, signal);
    return { text: ocr.text, pageCount, pagesRead: ocrPages, usedOcr: true, ocrConfidence: ocr.confidence };
  } finally {
    await doc.destroy();
  }
}

export async function readDocx(file: File, onProgress?: ProgressCallback): Promise<string> {
  onProgress?.({ stage: 'Reading the document…' });
  const mammoth = await import('mammoth/mammoth.browser');
  try {
    // Raw text only: no HTML is generated or rendered from the document.
    const result = await mammoth.extractRawText({ arrayBuffer: await readBlobBuffer(file) });
    return result.value.replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    throw new FileImportError('We couldn’t read this Word document. It may be damaged. Your existing recipes are safe — try saving it again as .docx or PDF, or paste the text instead.');
  }
}

export async function readTextFile(file: File): Promise<string> {
  const text = await readBlobText(file);
  // Markdown: drop image syntax and link targets but keep the words.
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\((https?:[^)]+)\)/g, '$1 ($2)')
    .replace(/^\s*>\s?/gm, '');
}
