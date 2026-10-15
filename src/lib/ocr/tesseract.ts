import type { ProgressCallback } from '../extraction/types';

/**
 * Local OCR with Tesseract.js. Everything runs in a Web Worker in this
 * browser: the engine, its WebAssembly core and the English language data are
 * served from this app's own /ocr/ folder (copied from node_modules at build
 * time), never from a third-party CDN. The image never leaves the device.
 *
 * First use downloads ~3–4 MB of language data from this site; after that it
 * is cached for offline use.
 */

export class OcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrError';
  }
}

function assetBase(): string {
  return new URL('ocr/', document.baseURI).href;
}

const MAX_SIDE = 2600;

/** Downscale very large photos (faster, less memory) and keep the result in memory only. */
async function prepareImage(source: Blob): Promise<Blob | HTMLCanvasElement> {
  if (typeof createImageBitmap !== 'function') return source;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new OcrError('We couldn’t open this image. It may be damaged. Your existing recipes are safe — try a different screenshot or paste the text instead.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return source;
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export interface OcrOutput {
  text: string;
  /** Tesseract's mean confidence, 0–100. */
  confidence: number;
}

export async function recognizeImages(
  images: (Blob | HTMLCanvasElement)[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<OcrOutput> {
  onProgress?.({ stage: 'Loading the text reader (first time can take a moment)…' });
  const { createWorker } = await import('tesseract.js');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const base = assetBase();
  let pageIndex = 0;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: `${base}lang`,
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        const overall = (pageIndex + m.progress) / images.length;
        onProgress?.({
          stage: images.length > 1 ? `Reading page ${pageIndex + 1} of ${images.length}…` : 'Reading the text…',
          progress: overall
        });
      } else if (/load|initializ/i.test(m.status)) {
        onProgress?.({ stage: 'Loading the text reader (first time can take a moment)…', progress: undefined });
      }
    }
  });
  const abort = () => void worker.terminate();
  signal?.addEventListener('abort', abort);
  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (; pageIndex < images.length; pageIndex++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const input = images[pageIndex] instanceof Blob ? await prepareImage(images[pageIndex] as Blob) : images[pageIndex];
      const { data } = await worker.recognize(input as HTMLCanvasElement);
      texts.push(data.text);
      confidences.push(data.confidence);
      // Release the canvas pixels right away.
      if (input instanceof HTMLCanvasElement) {
        input.width = 0;
        input.height = 0;
      }
    }
    const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    return { text: texts.join('\n\n').trim(), confidence };
  } catch (err) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (err instanceof OcrError) throw err;
    throw new OcrError('We couldn’t read this image. Your existing recipes are safe. Try a clearer, well-lit screenshot, or paste the recipe text instead.');
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker.terminate().catch(() => undefined);
  }
}
