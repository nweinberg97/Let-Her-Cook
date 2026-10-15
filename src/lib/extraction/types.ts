import type { RecipeDraft } from '../../types/recipe';

export type ExtractionMethod = 'structured-data' | 'text' | 'ocr' | 'document' | 'manual';

export interface ExtractionWarning {
  /** Which part of the draft the warning is about, so the review screen can place it. */
  field: 'title' | 'ingredients' | 'instructions' | 'times' | 'servings' | 'general';
  message: string;
}

export interface ExtractionResult {
  draft: RecipeDraft;
  warnings: ExtractionWarning[];
  /** Text we couldn't confidently place. Shown on the review screen, never thrown away silently. */
  unclassified: string;
  confidence: 'high' | 'medium' | 'low';
  /** Which categories were guessed rather than read from the source. */
  suggested: { course: boolean; cuisine: boolean; dietary: boolean };
  method: ExtractionMethod;
}

export interface ExtractionProgress {
  stage: string;
  /** 0–1 when known. */
  progress?: number;
}

export type ProgressCallback = (p: ExtractionProgress) => void;

/**
 * The extraction boundary. Version one ships `LocalExtractionProvider`, which
 * runs entirely in the browser. A future server-side AI provider can implement
 * the same interface — it must run behind an authenticated backend (never with
 * an API key in the browser) and only after the user explicitly opts in.
 */
export interface ExtractionProvider {
  readonly id: string;
  readonly label: string;
  /** True when this provider sends content off the device. The UI must ask for consent first. */
  readonly sendsDataOffDevice: boolean;
  extractFromText(text: string, options?: { sourceUrl?: string | null; fileName?: string }): Promise<ExtractionResult[]>;
  extractFromUrl(url: string, signal?: AbortSignal): Promise<ExtractionResult[]>;
  extractFromImage(file: File, onProgress?: ProgressCallback, signal?: AbortSignal): Promise<{ text: string; results: ExtractionResult[] }>;
  extractFromDocument(file: File, onProgress?: ProgressCallback, signal?: AbortSignal): Promise<{ text: string; results: ExtractionResult[] }>;
}
