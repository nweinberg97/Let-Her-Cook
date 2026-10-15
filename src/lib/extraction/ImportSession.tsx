import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ExtractionResult } from './types';

/**
 * Holds an import in progress — extracted text, candidate drafts, the uploaded
 * image — in React memory only. Nothing here is ever written to IndexedDB;
 * it's dropped when the import finishes, is cancelled, or the tab closes.
 */
export interface ImportSession {
  kind: 'url' | 'text' | 'image' | 'document' | 'manual';
  /** e.g. the file name or link, shown on the review screen. */
  sourceLabel: string;
  results: ExtractionResult[];
  /** The text we extracted (OCR / PDF / paste), so the user can compare. Transient. */
  extractedText: string | null;
  /** The uploaded image, kept in memory in case the user wants it as the recipe photo. */
  imageFile: File | null;
  activeIndex: number;
  savedIndices: number[];
}

interface ImportSessionApi {
  session: ImportSession | null;
  start: (s: Omit<ImportSession, 'activeIndex' | 'savedIndices'>) => void;
  choose: (index: number) => void;
  markSaved: (index: number) => void;
  clear: () => void;
}

const Ctx = createContext<ImportSessionApi | null>(null);

export function ImportSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImportSession | null>(null);

  const start = useCallback<ImportSessionApi['start']>((s) => setSession({ ...s, activeIndex: 0, savedIndices: [] }), []);
  const choose = useCallback((index: number) => setSession((s) => (s ? { ...s, activeIndex: index } : s)), []);
  const markSaved = useCallback(
    (index: number) => setSession((s) => (s ? { ...s, savedIndices: Array.from(new Set([...s.savedIndices, index])) } : s)),
    []
  );
  const clear = useCallback(() => setSession(null), []);

  const value = useMemo(() => ({ session, start, choose, markSaved, clear }), [session, start, choose, markSaved, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImportSession(): ImportSessionApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useImportSession must be used inside ImportSessionProvider');
  return ctx;
}
