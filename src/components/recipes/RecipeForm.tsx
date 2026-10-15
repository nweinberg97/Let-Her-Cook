import { useEffect, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, ImagePlus, Trash2, Sparkles } from 'lucide-react';
import { DIETARY_TAGS, SUGGESTED_TAGS, type RecipeDraft } from '../../types/recipe';
import type { ExtractionWarning } from '../../lib/extraction/types';
import {
  ingredientsToRows,
  instructionsToRows,
  rowsToIngredients,
  rowsToInstructions,
  type EditorRow
} from '../../lib/parsing/ingredient';
import { useLibrary } from '../../lib/storage/LibraryContext';
import { makeStoredImage } from '../../lib/images';
import { RowEditor } from './RowEditor';
import { TagInput } from '../ui/TagInput';
import { CollectionPicker } from '../collections/CollectionPicker';
import { RecipeImage } from './RecipeImage';
import { useToast } from '../ui/Toast';

export interface RecipeFormState {
  draft: RecipeDraft;
  ingredientRows: EditorRow[];
  stepRows: EditorRow[];
}

export function toFormState(draft: RecipeDraft): RecipeFormState {
  return { draft, ingredientRows: ingredientsToRows(draft.ingredients), stepRows: instructionsToRows(draft.instructions) };
}

export function fromFormState(s: RecipeFormState): RecipeDraft {
  return {
    ...s.draft,
    ingredients: rowsToIngredients(s.ingredientRows, s.draft.ingredients),
    instructions: rowsToInstructions(s.stepRows)
  };
}

function numberOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface RecipeFormProps {
  state: RecipeFormState;
  onChange: (s: RecipeFormState) => void;
  warnings?: ExtractionWarning[];
  suggested?: { course: boolean; cuisine: boolean; dietary: boolean };
  /** An image uploaded for import, offered as the recipe photo. In memory only. */
  importedImage?: File | null;
  /** Highlight empty important fields (used on the review screen). */
  reviewMode?: boolean;
}

export function RecipeForm({ state, onChange, warnings = [], suggested, importedImage, reviewMode }: RecipeFormProps) {
  const { courses, allTags, allCuisines, repo, preferences } = useLibrary();
  const toast = useToast();
  const d = state.draft;
  const set = (patch: Partial<RecipeDraft>) => onChange({ ...state, draft: { ...d, ...patch } });
  const ids = {
    title: useId(),
    desc: useId(),
    servings: useId(),
    yield: useId(),
    prep: useId(),
    cook: useId(),
    total: useId(),
    course: useId(),
    cuisine: useId(),
    cuisineList: useId(),
    notes: useId(),
    sourceUrl: useId(),
    sourceName: useId(),
    author: useId(),
    ingHeading: useId(),
    stepHeading: useId(),
    photo: useId(),
    newCourse: useId()
  };
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // A temporary preview of the uploaded import image; the object URL is revoked on unmount.
  useEffect(() => {
    if (!importedImage) return;
    const url = URL.createObjectURL(importedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [importedImage]);

  const warningsFor = (field: ExtractionWarning['field']) => warnings.filter((w) => w.field === field);
  const titleMissing = reviewMode && !d.title.trim();

  const applyImage = async (file: File) => {
    setImageBusy(true);
    try {
      const img = await makeStoredImage(file, d.title ? `Photo of ${d.title}` : null);
      set({ heroImage: img });
    } catch (err) {
      toast.error((err as Error).message || 'We couldn’t use that image.');
    } finally {
      setImageBusy(false);
    }
  };

  const tagSuggestions = Array.from(new Set([...allTags, ...SUGGESTED_TAGS]));
  const cuisineSuggestions = Array.from(new Set([...allCuisines, 'American', 'Chinese', 'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Spanish', 'Thai', 'Vietnamese']));

  return (
    <div className="recipe-form">
      <FormSection title="The basics">
        <div className={`field ${titleMissing ? 'field--attention' : ''}`}>
          <label htmlFor={ids.title} className="field__label">
            Title
          </label>
          <input
            id={ids.title}
            className="input input--title"
            value={d.title}
            maxLength={300}
            placeholder="What’s it called?"
            onChange={(e) => set({ title: e.target.value })}
            aria-invalid={titleMissing || undefined}
            aria-describedby={titleMissing ? `${ids.title}-err` : undefined}
          />
          {warningsFor('title').map((w) => (
            <InlineWarning key={w.message} id={`${ids.title}-err`}>
              {w.message}
            </InlineWarning>
          ))}
        </div>
        <div className="field">
          <label htmlFor={ids.desc} className="field__label">
            Description <span className="field__optional">optional</span>
          </label>
          <textarea id={ids.desc} className="textarea" rows={2} value={d.description} maxLength={5000} onChange={(e) => set({ description: e.target.value })} placeholder="A line or two about the dish" />
        </div>

        <div className="field">
          <span className="field__label" id={ids.photo}>
            Photo <span className="field__optional">optional</span>
          </span>
          <div className="photo-field" aria-labelledby={ids.photo} role="group">
            {d.heroImage ? (
              <div className="photo-field__current">
                <div className="photo-field__thumb">
                  <RecipeImage image={d.heroImage} title={d.title} />
                </div>
                <div className="photo-field__info">
                  <p>{d.heroImage.origin === 'remote' ? 'Linked from the original website. It may stop showing if the site removes it.' : 'Saved with this recipe in this browser.'}</p>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ heroImage: null })}>
                    <span className="btn__icon" aria-hidden="true">
                      <Trash2 size={16} />
                    </span>
                    <span className="btn__label">Remove photo</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="field__hint">No photo — the recipe will show as an index card with its title.</p>
            )}
            <div className="photo-field__actions">
              {importedImage && previewUrl && !d.heroImage && (
                <button type="button" className="photo-field__offer" onClick={() => applyImage(importedImage)} disabled={imageBusy}>
                  <img src={previewUrl} alt="" />
                  <span>Use the image you imported as the photo</span>
                </button>
              )}
              <label className="btn btn--secondary btn--sm file-btn">
                <span className="btn__icon" aria-hidden="true">
                  <ImagePlus size={16} />
                </span>
                <span className="btn__label">{imageBusy ? 'Preparing…' : d.heroImage ? 'Replace photo' : 'Add a photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="visually-hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast.error('Choose a JPG, PNG or WebP photo.');
                    if (f.size > 15 * 1024 * 1024) return toast.error('That photo is over 15 MB. Choose a smaller one.');
                    void applyImage(f);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Time and servings" hint="Leave anything you don’t know blank — we never fill in guesses.">
        <div className="field-grid">
          <NumberField id={ids.servings} label="Serves" value={d.servings} onChange={(v) => set({ servings: v })} step="0.5" />
          <div className="field">
            <label htmlFor={ids.yield} className="field__label">
              Makes <span className="field__optional">optional</span>
            </label>
            <input id={ids.yield} className="input" value={d.yieldText ?? ''} placeholder="e.g. 24 cookies" maxLength={200} onChange={(e) => set({ yieldText: e.target.value || null })} />
          </div>
          <NumberField id={ids.prep} label="Prep" suffix="min" value={d.prepTimeMinutes} onChange={(v) => set({ prepTimeMinutes: v })} />
          <NumberField id={ids.cook} label="Cook" suffix="min" value={d.cookTimeMinutes} onChange={(v) => set({ cookTimeMinutes: v })} />
          <NumberField
            id={ids.total}
            label="Total"
            suffix="min"
            value={d.totalTimeMinutes}
            onChange={(v) => set({ totalTimeMinutes: v })}
            hint={d.totalTimeMinutes == null && d.prepTimeMinutes != null && d.cookTimeMinutes != null ? `Prep + cook = ${d.prepTimeMinutes + d.cookTimeMinutes} min` : undefined}
          />
        </div>
      </FormSection>

      <FormSection title="Ingredients" headingId={ids.ingHeading} attention={reviewMode && state.ingredientRows.filter((r) => r.kind === 'item').length === 0}>
        {warningsFor('ingredients').map((w) => (
          <InlineWarning key={w.message}>{w.message}</InlineWarning>
        ))}
        <RowEditor kind="ingredient" rows={state.ingredientRows} onChange={(rows) => onChange({ ...state, ingredientRows: rows })} labelledBy={ids.ingHeading} />
      </FormSection>

      <FormSection title="Steps" headingId={ids.stepHeading} attention={reviewMode && state.stepRows.filter((r) => r.kind === 'item').length === 0}>
        {warningsFor('instructions').map((w) => (
          <InlineWarning key={w.message}>{w.message}</InlineWarning>
        ))}
        <RowEditor kind="step" rows={state.stepRows} onChange={(rows) => onChange({ ...state, stepRows: rows })} labelledBy={ids.stepHeading} />
      </FormSection>

      <FormSection title="Organize">
        <div className="field-grid field-grid--2">
          <div className="field">
            <label htmlFor={ids.course} className="field__label">
              Course {suggested?.course && <SuggestedBadge />}
            </label>
            {addingCourse ? (
              <div className="inline-create">
                <label htmlFor={ids.newCourse} className="visually-hidden">
                  New course name
                </label>
                <input id={ids.newCourse} className="input" value={newCourse} autoFocus maxLength={80} onChange={(e) => setNewCourse(e.target.value)} placeholder="e.g. Picnic" />
                <button
                  type="button"
                  className="btn btn--secondary btn--md"
                  onClick={async () => {
                    const c = newCourse.trim();
                    if (!c) return setAddingCourse(false);
                    try {
                      if (!courses.some((x) => x.toLowerCase() === c.toLowerCase())) {
                        await repo.updatePreferences({ customCourses: [...preferences.customCourses, c] });
                      }
                      set({ course: courses.find((x) => x.toLowerCase() === c.toLowerCase()) ?? c });
                    } catch {
                      set({ course: c });
                    }
                    setNewCourse('');
                    setAddingCourse(false);
                  }}
                >
                  <span className="btn__label">Add</span>
                </button>
              </div>
            ) : (
              <select
                id={ids.course}
                className="select"
                value={d.course}
                onChange={(e) => (e.target.value === '__new' ? setAddingCourse(true) : set({ course: e.target.value }))}
              >
                {(courses.includes(d.course) ? courses : [...courses, d.course]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new">Add a new course…</option>
              </select>
            )}
          </div>
          <div className="field">
            <label htmlFor={ids.cuisine} className="field__label">
              Cuisine <span className="field__optional">optional</span> {suggested?.cuisine && <SuggestedBadge />}
            </label>
            <input
              id={ids.cuisine}
              className="input"
              value={d.cuisine ?? ''}
              list={ids.cuisineList}
              maxLength={80}
              placeholder="e.g. Thai"
              onChange={(e) => set({ cuisine: e.target.value || null })}
            />
            <datalist id={ids.cuisineList}>
              {cuisineSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <fieldset className="field">
          <legend className="field__label">
            Diet {suggested?.dietary && <SuggestedBadge />}
          </legend>
          <div className="chip-wrap">
            {DIETARY_TAGS.map((t) => {
              const on = d.dietaryTags.some((x) => x.toLowerCase() === t.toLowerCase());
              return (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => set({ dietaryTags: on ? d.dietaryTags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...d.dietaryTags, t] })}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <p className="field__hint">
            {suggested?.dietary
              ? 'Suggested from the ingredient list. Check labels on packaged ingredients — we can’t guarantee a recipe is allergen-free.'
              : 'We only suggest a diet when the ingredients clearly support it, and never allergen labels.'}
          </p>
        </fieldset>

        <TagInput label="Tags" value={d.customTags} onChange={(tags) => set({ customTags: tags })} suggestions={tagSuggestions} hint="Things like Weeknight, Kid-friendly, Summer." />

        <div className="field">
          <span className="field__label">Collections</span>
          <CollectionPicker value={d.collections} onChange={(c) => set({ collections: c })} />
        </div>

        <label className="checkbox-line">
          <input type="checkbox" checked={d.isFavorite} onChange={(e) => set({ isFavorite: e.target.checked })} />
          <span>Favorite</span>
        </label>
      </FormSection>

      <FormSection title="Notes and source">
        <div className="field">
          <label htmlFor={ids.notes} className="field__label">
            Notes <span className="field__optional">optional</span>
          </label>
          <textarea id={ids.notes} className="textarea" rows={4} value={d.notes} maxLength={20000} onChange={(e) => set({ notes: e.target.value })} placeholder="Swaps, tips, who loved it…" />
        </div>
        <div className="field-grid field-grid--3">
          <div className="field">
            <label htmlFor={ids.sourceUrl} className="field__label">
              Source link
            </label>
            <input id={ids.sourceUrl} className="input" type="url" inputMode="url" value={d.sourceUrl ?? ''} maxLength={2000} placeholder="https://…" onChange={(e) => set({ sourceUrl: e.target.value || null })} />
          </div>
          <div className="field">
            <label htmlFor={ids.sourceName} className="field__label">
              Source name
            </label>
            <input id={ids.sourceName} className="input" value={d.sourceName ?? ''} maxLength={300} placeholder="e.g. Grandma’s recipe box" onChange={(e) => set({ sourceName: e.target.value || null })} />
          </div>
          <div className="field">
            <label htmlFor={ids.author} className="field__label">
              Recipe by
            </label>
            <input id={ids.author} className="input" value={d.author ?? ''} maxLength={300} onChange={(e) => set({ author: e.target.value || null })} />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

function FormSection({ title, hint, headingId, attention, children }: { title: string; hint?: string; headingId?: string; attention?: boolean; children: ReactNode }) {
  const fallback = useId();
  const id = headingId ?? fallback;
  return (
    <section className={`form-section ${attention ? 'form-section--attention' : ''}`} aria-labelledby={id}>
      <div className="form-section__head">
        <h2 id={id} className="form-section__title">
          {title}
        </h2>
        {hint && <p className="form-section__hint">{hint}</p>}
      </div>
      <div className="form-section__body">{children}</div>
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  step = '1',
  hint
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  step?: string;
  hint?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText((t) => (numberOrNull(t) === value ? t : value == null ? '' : String(value)));
  }, [value]);
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="input-affix">
        <input
          id={id}
          className="input"
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={text}
          placeholder="—"
          onChange={(e) => {
            setText(e.target.value);
            onChange(numberOrNull(e.target.value));
          }}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && <span className="input-affix__suffix">{suffix}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function InlineWarning({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="inline-warning" id={id}>
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function SuggestedBadge() {
  return (
    <span className="suggested-badge" title="We suggested this from the recipe. Change it if it’s wrong.">
      <Sparkles size={12} aria-hidden="true" /> suggested
    </span>
  );
}
