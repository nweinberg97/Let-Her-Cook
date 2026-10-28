import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Info, Copy as CopyIcon } from 'lucide-react';
import { useImportSession } from '../lib/extraction/ImportSession';
import { useLibrary } from '../lib/storage/LibraryContext';
import { storageErrorMessage } from '../lib/storage/repository';
import { findDuplicates } from '../lib/duplicates';
import { RecipeForm, fromFormState, toFormState, type RecipeFormState } from '../components/recipes/RecipeForm';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';
import { usePageTitle } from '../lib/usePageTitle';
import type { Recipe } from '../types/recipe';
import { haptic } from '../lib/native';

const CONFIDENCE_COPY = {
  high: 'Looks complete. Give it a quick check.',
  medium: 'We found most of it. Check the highlighted parts.',
  low: 'This one was hard to read. Fill in what’s missing below.'
};

export function ReviewPage() {
  usePageTitle('Check your recipe');
  const { session, markSaved, clear } = useImportSession();
  const { repo, recipes } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const result = session ? session.results[session.activeIndex] : undefined;
  const [form, setForm] = useState<RecipeFormState | null>(() => (result ? toFormState(result.draft) : null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Recipe[] | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [leftover, setLeftover] = useState(result?.unclassified ?? '');
  const guard = useUnsavedGuard(!!session && !saving, 'This recipe hasn’t been saved yet.');

  useEffect(() => {
    if (result) {
      setForm(toFormState(result.draft));
      setLeftover(result.unclassified);
      setDuplicates(null);
    }
    // Re-initialise only when switching to another candidate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeIndex]);

  const generalWarnings = useMemo(() => (result?.warnings ?? []).filter((w) => w.field === 'general' || w.field === 'times' || w.field === 'servings'), [result]);

  if (!session || !result || !form) return <Navigate to="/add" replace />;

  const remaining = session.results.length - session.savedIndices.length - 1;

  const save = async (skipDuplicateCheck = false) => {
    setSaveError(null);
    const draft = fromFormState(form);
    if (!skipDuplicateCheck) {
      const dups = findDuplicates(draft, recipes);
      if (dups.length) {
        setDuplicates(dups);
        document.getElementById('duplicate-warning')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await repo.createRecipe(draft);
      void haptic('success');
      guard.allowNavigation();
      markSaved(session.activeIndex);
      if (remaining > 0) {
        toast.success(`Saved “${saved.title}”. ${remaining} more to go.`);
        navigate('/add?resume=1', { replace: true });
      } else {
        clear();
        toast.success(`Saved “${saved.title}”.`);
        navigate(`/recipes/${saved.id}`, { replace: true });
      }
    } catch (err) {
      // The draft stays on screen; nothing is lost.
      setSaveError(storageErrorMessage(err));
      setSaving(false);
    }
  };

  const discard = () => {
    guard.allowNavigation();
    const multi = session.results.length > 1;
    if (!multi) clear();
    navigate(multi ? '/add?resume=1' : '/add', { replace: true });
  };

  const isManual = session.kind === 'manual';

  return (
    <div className="page review">
      <header className="page-header review__header">
        <div>
          <h1 className="page-title">{isManual ? 'New recipe' : 'Check it over'}</h1>
          {!isManual && (
            <p className="page-lede">
              From <strong>{session.sourceLabel}</strong>. {CONFIDENCE_COPY[result.confidence]}
            </p>
          )}
        </div>
        <div className="review__header-actions">
          <Button variant="ghost" onClick={() => setCancelOpen(true)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save recipe'}
          </Button>
        </div>
      </header>

      {saveError && (
        <div className="callout callout--danger" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div className="callout__body">
            <p className="callout__title">The recipe wasn’t saved.</p>
            <p>{saveError}</p>
          </div>
        </div>
      )}

      {generalWarnings.length > 0 && (
        <ul className="review__notices" aria-label="About this import">
          {generalWarnings.map((w) => (
            <li key={w.message}>
              <Info size={16} aria-hidden="true" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {duplicates && duplicates.length > 0 && (
        <div className="callout callout--info" id="duplicate-warning" role="alert">
          <CopyIcon size={20} aria-hidden="true" />
          <div className="callout__body">
            <p className="callout__title">You might already have this one.</p>
            <ul className="dup-list">
              {duplicates.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <Link to={`/recipes/${d.id}`} target="_blank" rel="noopener">
                    {d.title}
                  </Link>{' '}
                  <span className="muted">saved {new Date(d.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
            <div className="callout__actions">
              <Button variant="primary" onClick={() => save(true)} disabled={saving}>
                Save anyway
              </Button>
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Don’t save
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="review__layout">
        <RecipeForm state={form} onChange={setForm} warnings={result.warnings} suggested={result.suggested} importedImage={session.imageFile} reviewMode />

        {(leftover || session.extractedText) && (
          <aside className="review__aside" aria-label="Original text">
            {leftover && (
              <section className="leftover">
                <h2 className="form-section__title">Leftover text</h2>
                <p className="field__hint">This didn’t clearly belong anywhere. Move anything useful into your notes, or leave it out.</p>
                <textarea className="textarea leftover__text" value={leftover} onChange={(e) => setLeftover(e.target.value)} rows={8} aria-label="Leftover text" />
                <div className="leftover__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setForm({ ...form, draft: { ...form.draft, notes: [form.draft.notes, leftover].filter(Boolean).join('\n\n') } });
                      setLeftover('');
                      toast.success('Added to notes.');
                    }}
                  >
                    Add to notes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setLeftover('')}>
                    Leave it out
                  </Button>
                </div>
              </section>
            )}
            {session.extractedText && session.kind !== 'text' && (
              <details className="extracted">
                <summary>Compare with the text we read</summary>
                <pre className="extracted__text">{session.extractedText}</pre>
              </details>
            )}
          </aside>
        )}
      </div>

      <div className="review__footer">
        <Button variant="ghost" onClick={() => setCancelOpen(true)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" onClick={() => save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </Button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Discard this recipe?"
        description={<p>Nothing from this import will be kept. Your saved recipes aren’t affected.</p>}
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setCancelOpen(false);
          discard();
        }}
      />
      {guard.dialog}
    </div>
  );
}
