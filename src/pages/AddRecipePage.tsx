import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Link2, ClipboardPaste, Camera, FileUp, PenLine, Loader2, AlertTriangle, Upload, Check, ShieldCheck } from 'lucide-react';
import { localExtraction } from '../lib/extraction/local';
import { useImportSession } from '../lib/extraction/ImportSession';
import { UrlImportError, validateRecipeUrl } from '../lib/extraction/url';
import { FileImportError, ACCEPT_ATTR } from '../lib/files/validate';
import { OcrError } from '../lib/ocr/tesseract';
import type { ExtractionProgress, ExtractionResult } from '../lib/extraction/types';
import { emptyDraft } from '../types/recipe';
import { SAMPLE_RECIPE_TEXT } from '../lib/sampleRecipe';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { usePageTitle } from '../lib/usePageTitle';
import { courseStyle } from '../lib/courseColors';

type Tab = 'link' | 'text' | 'photo' | 'file' | 'manual';

const TABS: { id: Tab; label: string; icon: typeof Link2; blurb: string }[] = [
  { id: 'link', label: 'Link', icon: Link2, blurb: 'From a recipe website' },
  { id: 'text', label: 'Paste text', icon: ClipboardPaste, blurb: 'From a message, note or page' },
  { id: 'photo', label: 'Photo', icon: Camera, blurb: 'Screenshot, cookbook page or card' },
  { id: 'file', label: 'File', icon: FileUp, blurb: 'PDF, Word or text file' },
  { id: 'manual', label: 'Type it in', icon: PenLine, blurb: 'Start from a blank card' }
];

type Busy = { label: string; progress?: number } | null;

function friendlyError(err: unknown): string {
  if (err instanceof FileImportError || err instanceof OcrError || err instanceof UrlImportError) return err.message;
  return 'Something went wrong reading that. Your existing recipes are safe — try again, or paste the recipe text instead.';
}

export function AddRecipePage() {
  usePageTitle('Add a recipe');
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.id === requested) ? requested : 'link';
  const { session, start, choose, clear } = useImportSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resume = params.get('resume') === '1' && session && session.results.length > 1;

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    next.delete('resume');
    setParams(next, { replace: true });
  };

  const finish = useCallback(
    (kind: 'url' | 'text' | 'image' | 'document' | 'manual', sourceLabel: string, results: ExtractionResult[], extractedText: string | null, imageFile: File | null) => {
      start({ kind, sourceLabel, results, extractedText, imageFile });
      if (results.length > 1) {
        toast.info(`We found ${results.length} recipes. Pick one to review first.`);
        navigate('/add?resume=1', { replace: true });
      } else {
        navigate('/add/review');
      }
    },
    [start, navigate, toast]
  );

  const run = async <T,>(label: string, fn: (signal: AbortSignal, onProgress: (p: ExtractionProgress) => void) => Promise<T>): Promise<T | undefined> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy({ label });
    try {
      return await fn(controller.signal, (p) => setBusy({ label: p.stage, progress: p.progress }));
    } catch (err) {
      if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
        toast.info('Import cancelled.');
        return undefined;
      }
      throw err;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const cancel = () => abortRef.current?.abort();

  const startManual = () => {
    finish('manual', 'Typed in', [{ draft: emptyDraft(), warnings: [], unclassified: '', confidence: 'high', suggested: { course: false, cuisine: false, dietary: false }, method: 'manual' }], null, null);
  };

  if (resume && session) {
    return (
      <div className="page add">
        <header className="page-header">
          <div>
            <h1 className="page-title">Choose a recipe</h1>
            <p className="page-lede">
              We found {session.results.length} recipes in {session.sourceLabel}. Review and save them one at a time.
            </p>
          </div>
        </header>
        <ul className="candidate-list">
          {session.results.map((r, i) => {
            const saved = session.savedIndices.includes(i);
            return (
              <li key={i} style={courseStyle(r.draft.course)} className={`candidate ${saved ? 'is-saved' : ''}`}>
                <div>
                  <h2 className="candidate__title">{r.draft.title || `Recipe ${i + 1}`}</h2>
                  <p className="candidate__meta">
                    {r.draft.ingredients.length} ingredients, {r.draft.instructions.length} steps
                  </p>
                </div>
                {saved ? (
                  <span className="candidate__saved">
                    <Check size={16} aria-hidden="true" /> Saved
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      choose(i);
                      navigate('/add/review');
                    }}
                  >
                    Review
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="add__footer-actions">
          <Button
            variant="ghost"
            onClick={() => {
              clear();
              navigate(session.savedIndices.length ? '/' : '/add', { replace: true });
            }}
          >
            {session.savedIndices.length ? 'Done' : 'Cancel import'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page add">
      <header className="page-header">
        <div>
          <h1 className="page-title">Add a recipe</h1>
          <p className="page-lede">Bring it in however you have it. You’ll check everything before it’s saved.</p>
        </div>
      </header>

      <div className="add__tabs" role="tablist" aria-label="How do you have the recipe?">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`add-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`add-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="add__tab"
            onClick={() => selectTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                selectTab(n.id);
                document.getElementById(`add-tab-${n.id}`)?.focus();
              }
            }}
            disabled={!!busy}
          >
            <t.icon size={20} aria-hidden="true" />
            <span className="add__tab-label">{t.label}</span>
            <span className="add__tab-blurb">{t.blurb}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`add-panel-${tab}`} aria-labelledby={`add-tab-${tab}`} className="add__panel">
        {busy ? (
          <BusyPanel busy={busy} onCancel={cancel} />
        ) : tab === 'link' ? (
          <LinkPanel run={run} finish={finish} />
        ) : tab === 'text' ? (
          <TextPanel finish={finish} />
        ) : tab === 'photo' || tab === 'file' ? (
          <FilePanel key={tab} mode={tab} run={run} finish={finish} onManual={startManual} />
        ) : (
          <div className="manual-start">
            <p>Start with a blank recipe card and fill in what you know — perfect for family recipes you’ve made a hundred times.</p>
            <Button variant="primary" size="lg" icon={<PenLine size={18} />} onClick={startManual}>
              Start a blank recipe
            </Button>
          </div>
        )}
      </div>

      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>
          Everything is read right here on your device. Files and photos aren’t uploaded anywhere, and only the recipe you save is kept. <Link to="/data">How your data is stored</Link>
        </span>
      </p>
    </div>
  );
}

type RunFn = <T>(label: string, fn: (signal: AbortSignal, onProgress: (p: ExtractionProgress) => void) => Promise<T>) => Promise<T | undefined>;
type FinishFn = (kind: 'url' | 'text' | 'image' | 'document' | 'manual', sourceLabel: string, results: ExtractionResult[], extractedText: string | null, imageFile: File | null) => void;

function BusyPanel({ busy, onCancel }: { busy: NonNullable<Busy>; onCancel: () => void }) {
  return (
    <div className="busy" role="status" aria-live="polite">
      <Loader2 size={28} className="spin" aria-hidden="true" />
      <p className="busy__label">{busy.label}</p>
      {busy.progress != null ? (
        <progress className="progress" max={1} value={busy.progress} aria-label="Progress" />
      ) : (
        <progress className="progress" aria-label="Working" />
      )}
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function LinkPanel({ run, finish }: { run: RunFn; finish: FinishFn }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<{ message: string; recoverable: boolean } | null>(null);
  const [fallbackText, setFallbackText] = useState('');
  const inputId = useId();
  const fallbackId = useId();

  const submit = async () => {
    setError(null);
    try {
      validateRecipeUrl(url);
    } catch (err) {
      setError({ message: friendlyError(err), recoverable: false });
      return;
    }
    try {
      const results = await run('Fetching the page…', (signal) => localExtraction.extractFromUrl(url, signal));
      if (results) finish('url', url, results, null, null);
    } catch (err) {
      setError({ message: friendlyError(err), recoverable: true });
    }
  };

  const useFallback = async () => {
    const source = (() => {
      try {
        return validateRecipeUrl(url).href;
      } catch {
        return null;
      }
    })();
    const results = await localExtraction.extractFromText(fallbackText, { sourceUrl: source });
    if (!results.length) return;
    for (const r of results) {
      if (source) {
        r.draft.sourceUrl = source;
        r.draft.sourceName = r.draft.sourceName ?? new URL(source).hostname.replace(/^www\./, '');
      }
    }
    finish('text', source ?? 'Pasted text', results, fallbackText, null);
  };

  return (
    <div className="panel-stack">
      <form
        className="link-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={inputId} className="field__label">
          Recipe link
        </label>
        <div className="link-form__row">
          <input
            id={inputId}
            className="input input--lg"
            type="url"
            inputMode="url"
            placeholder="https://www.example.com/best-banana-bread"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
            aria-invalid={error && !error.recoverable ? true : undefined}
            aria-describedby={error ? `${inputId}-err` : undefined}
          />
          <Button type="submit" variant="primary" size="lg" disabled={!url.trim()}>
            Get recipe
          </Button>
        </div>
        <p className="field__hint">Many recipe sites block apps from reading their pages. If that happens, we’ll help you paste it instead — it only takes a moment.</p>
      </form>

      {error && (
        <div className="callout callout--warning" id={`${inputId}-err`} role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div className="callout__body">
            <p className="callout__title">{error.recoverable ? 'We couldn’t pull this recipe in automatically.' : error.message}</p>
            {error.recoverable && (
              <>
                <p>
                  {error.message} No worries — copy the recipe text from the page and paste it here. We’ll keep the link as the source.
                </p>
                <label htmlFor={fallbackId} className="field__label">
                  Recipe text
                </label>
                <textarea
                  id={fallbackId}
                  className="textarea"
                  rows={8}
                  value={fallbackText}
                  onChange={(e) => setFallbackText(e.target.value)}
                  placeholder="Paste the ingredients and steps (extra text from the page is fine)"
                />
                <div className="callout__actions">
                  <Button variant="primary" onClick={useFallback} disabled={!fallbackText.trim()}>
                    Turn into a recipe
                  </Button>
                  <a href={(() => { try { return validateRecipeUrl(url).href; } catch { return undefined; } })()} target="_blank" rel="noopener noreferrer" className="text-link">
                    Open the page in a new tab
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TextPanel({ finish }: { finish: FinishFn }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async () => {
    setError(null);
    const results = await localExtraction.extractFromText(text);
    if (!results.length) {
      setError('Paste some recipe text first.');
      return;
    }
    finish('text', 'Pasted text', results, text, null);
  };

  return (
    <div className="panel-stack">
      <div className="field">
        <div className="field__label-row">
          <label htmlFor={id} className="field__label">
            Recipe text
          </label>
          <button type="button" className="text-button" onClick={() => setText(SAMPLE_RECIPE_TEXT)}>
            Try an example
          </button>
        </div>
        <textarea
          id={id}
          className="textarea textarea--big"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste from anywhere: a text from your sister, a note, an email, a web page.\n\nIt’s fine if it’s messy — we’ll find the title, ingredients and steps.'}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {error && (
          <p className="field__error" id={`${id}-err`}>
            {error}
          </p>
        )}
      </div>
      <div>
        <Button variant="primary" size="lg" onClick={submit} disabled={!text.trim()}>
          Turn into a recipe
        </Button>
      </div>
    </div>
  );
}

function FilePanel({ mode, run, finish, onManual }: { mode: 'photo' | 'file'; run: RunFn; finish: FinishFn; onManual: () => void }) {
  const [error, setError] = useState<{ message: string; text?: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const accept = mode === 'photo' ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp' : ACCEPT_ATTR;

  const handle = async (file: File) => {
    setError(null);
    const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    try {
      const out = await run(isImage ? 'Getting the text reader ready…' : 'Reading the file…', (signal, onProgress) =>
        isImage ? localExtraction.extractFromImage(file, onProgress, signal) : localExtraction.extractFromDocument(file, onProgress, signal)
      );
      if (!out) return;
      if (!out.results.length) {
        setError({
          message: isImage
            ? 'We couldn’t find any text in that image. Your existing recipes are safe. Try a sharper, well-lit photo, or type it in.'
            : 'That file doesn’t seem to contain any text we can read. Your existing recipes are safe. Try a different file, or paste the text instead.'
        });
        return;
      }
      finish(isImage ? 'image' : 'document', file.name, out.results, out.text, isImage ? file : null);
    } catch (err) {
      setError({ message: friendlyError(err) });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handle(f);
  };

  // Paste an image straight from the clipboard (e.g. a screenshot) on the photo tab.
  useEffect(() => {
    if (mode !== 'photo') return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void handle(new File([f], `pasted-image.${f.type.split('/')[1] ?? 'png'}`, { type: f.type }));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [mode]);

  return (
    <div className="panel-stack">
      <label
        htmlFor={inputId}
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={30} aria-hidden="true" className="dropzone__icon" />
        <span className="dropzone__title">{mode === 'photo' ? 'Choose a photo or screenshot' : 'Choose a file'}</span>
        <span className="dropzone__hint">
          {mode === 'photo'
            ? 'Drag it here, tap to pick one, or paste a screenshot. JPG, PNG or WebP up to 15 MB.'
            : 'PDF (up to 25 MB), Word .docx, or a .txt / .md file. Photos work here too.'}
        </span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="visually-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handle(f);
          }}
        />
      </label>
      {mode === 'photo' && (
        <ul className="tips">
          <Tip>Text recognition runs on this device. The first time, it downloads about 4 MB of reading data from this site — then it works offline.</Tip>
          <Tip>Handwriting is hard for any reader to get right, so expect to fix a few words. You’ll see everything before it’s saved.</Tip>
          <Tip>Crop to just the recipe and use good light for the best results.</Tip>
        </ul>
      )}
      {error && (
        <div className="callout callout--warning" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div className="callout__body">
            <p className="callout__title">{error.message}</p>
            <div className="callout__actions">
              <Button variant="secondary" onClick={onManual}>
                Type it in instead
              </Button>
              <Link className="text-link" to="/add?tab=text">
                Paste text instead
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <li className="tips__item">{children}</li>;
}
