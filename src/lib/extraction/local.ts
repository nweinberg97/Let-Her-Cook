import { parseRecipeText, splitRecipes } from '../parsing/text';
import { FileImportError, validateImportFile } from '../files/validate';
import { extractFromUrl } from './url';
import type { ExtractionProvider, ExtractionResult, ProgressCallback } from './types';

/**
 * Runs every step on this device: page fetches go straight from the browser,
 * files are read in memory, OCR runs in a local Web Worker, and parsing is
 * deterministic code — no AI service, no API key, no uploads.
 */
export class LocalExtractionProvider implements ExtractionProvider {
  readonly id = 'local';
  readonly label = 'On this device';
  readonly sendsDataOffDevice = false;

  async extractFromText(text: string, options: { sourceUrl?: string | null; fileName?: string } = {}): Promise<ExtractionResult[]> {
    const trimmed = text.trim();
    if (!trimmed) return [];
    return splitRecipes(trimmed).map((segment) => parseRecipeText(segment, options));
  }

  extractFromUrl(url: string, signal?: AbortSignal): Promise<ExtractionResult[]> {
    return extractFromUrl(url, signal);
  }

  async extractFromImage(file: File, onProgress?: ProgressCallback, signal?: AbortSignal) {
    const kind = await validateImportFile(file);
    if (kind !== 'image') throw new FileImportError('That isn’t an image file.');
    const { recognizeImages } = await import('../ocr/tesseract');
    const ocr = await recognizeImages([file], onProgress, signal);
    const results = ocr.text.trim() ? await this.extractFromText(ocr.text) : [];
    for (const r of results) {
      r.method = 'ocr';
      r.warnings.unshift({
        field: 'general',
        message:
          ocr.confidence < 60
            ? 'This was hard to read, so expect mistakes — especially in handwriting and amounts. Compare with the original before saving.'
            : 'Read from an image. Text recognition isn’t perfect, so check amounts and temperatures before saving.'
      });
      if (r.confidence === 'high' && ocr.confidence < 75) r.confidence = 'medium';
    }
    return { text: ocr.text, results };
  }

  async extractFromDocument(file: File, onProgress?: ProgressCallback, signal?: AbortSignal) {
    const kind = await validateImportFile(file);
    const { readPdf, readDocx, readTextFile } = await import('../files/documents');
    let text = '';
    let note: string | null = null;
    let method: ExtractionResult['method'] = 'document';
    if (kind === 'pdf') {
      const pdf = await readPdf(file, onProgress, signal);
      text = pdf.text;
      if (pdf.usedOcr) {
        method = 'ocr';
        note = `This PDF is a scan, so we read ${pdf.pagesRead === 1 ? 'the page' : `the first ${pdf.pagesRead} pages`} with text recognition. Check amounts carefully.`;
      } else if (pdf.pagesRead < pdf.pageCount) {
        note = `This PDF has ${pdf.pageCount} pages; we read the first ${pdf.pagesRead}.`;
      }
    } else if (kind === 'docx') {
      text = await readDocx(file, onProgress);
    } else if (kind === 'text') {
      text = await readTextFile(file);
    } else {
      return this.extractFromImage(file, onProgress, signal);
    }
    const results = text.trim() ? await this.extractFromText(text, { fileName: file.name }) : [];
    for (const r of results) {
      r.method = method;
      if (note) r.warnings.unshift({ field: 'general', message: note });
    }
    return { text, results };
  }
}

export const localExtraction = new LocalExtractionProvider();
