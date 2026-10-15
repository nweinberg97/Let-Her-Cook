import {
  recipeSchema,
  collectionSchema,
  type Collection,
  type Recipe,
  type RecipeDraft
} from '../../types/recipe';
import { newId, nowIso } from '../id';
import { StorageError } from './repository';

/**
 * Tag display: collapse whitespace; if typed all-lowercase ("comfort food"),
 * present it in Title Case. Anything the user capitalised deliberately
 * ("BBQ", "Mom's") is kept exactly as typed.
 */
export function canonicalTag(input: string): string {
  const t = input.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t) return '';
  if (t === t.toLowerCase()) {
    return t.replace(/(^|[\s\-/&])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return t;
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = canonicalTag(raw);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

const cleanNum = (n: number | null | undefined): number | null =>
  n == null || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 1000) / 1000;

const cleanStr = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t ? t : null;
};

/** Cleans a draft into a valid saved recipe. Throws StorageError('invalid') if it can't be made valid. */
export function finalizeRecipe(draft: RecipeDraft, existing?: Recipe): Recipe {
  const now = nowIso();
  const candidate: Recipe = {
    id: existing?.id ?? draft.id ?? newId(),
    title: draft.title.replace(/\s+/g, ' ').trim() || 'Untitled recipe',
    description: draft.description.trim(),
    heroImage: draft.heroImage,
    ingredients: draft.ingredients
      .filter((i) => (i.raw || i.name).trim() !== '')
      .map((i) => ({
        id: i.id || newId(),
        raw: (i.raw || i.name).trim(),
        quantity: cleanNum(i.quantity),
        quantityMax: cleanNum(i.quantityMax),
        unit: cleanStr(i.unit),
        name: (i.name || i.raw).trim(),
        note: cleanStr(i.note),
        group: cleanStr(i.group)
      })),
    instructions: draft.instructions
      .filter((s) => s.text.trim() !== '')
      .map((s) => ({
        id: s.id || newId(),
        text: s.text.trim(),
        group: cleanStr(s.group),
        timerMinutes: cleanNum(s.timerMinutes)
      })),
    prepTimeMinutes: cleanNum(draft.prepTimeMinutes),
    cookTimeMinutes: cleanNum(draft.cookTimeMinutes),
    totalTimeMinutes: cleanNum(draft.totalTimeMinutes),
    servings: cleanNum(draft.servings) || null,
    yieldText: cleanStr(draft.yieldText),
    course: draft.course.trim() || 'Other',
    cuisine: cleanStr(draft.cuisine),
    dietaryTags: dedupeTags(draft.dietaryTags),
    customTags: dedupeTags(draft.customTags),
    collections: Array.from(new Set(draft.collections)),
    notes: draft.notes.trim(),
    sourceUrl: cleanStr(draft.sourceUrl),
    sourceName: cleanStr(draft.sourceName),
    author: cleanStr(draft.author),
    isFavorite: Boolean(draft.isFavorite),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const parsed = recipeSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new StorageError(`${first?.path.join('.') || 'recipe'}: ${first?.message ?? 'invalid value'}`, 'invalid');
  }
  return parsed.data;
}

/**
 * Best-effort repair of a recipe from a backup file: fills missing optional
 * fields with safe defaults, then validates. Returns null if it can't be saved.
 */
export function repairRecipe(input: unknown): Recipe | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
  const strOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : nowIso());
  if (typeof o.title !== 'string' && !Array.isArray(o.ingredients)) return null;

  const candidate = {
    id: str(o.id) || newId(),
    title: str(o.title) || 'Untitled recipe',
    description: str(o.description),
    heroImage: o.heroImage && typeof o.heroImage === 'object' ? o.heroImage : null,
    ingredients: arr(o.ingredients).map((i) => {
      const x = (i ?? {}) as Record<string, unknown>;
      const raw = typeof i === 'string' ? i : str(x.raw) || str(x.name);
      return {
        id: str(x.id) || newId(),
        raw,
        quantity: num(x.quantity),
        quantityMax: num(x.quantityMax),
        unit: strOrNull(x.unit),
        name: str(x.name) || raw,
        note: strOrNull(x.note),
        group: strOrNull(x.group)
      };
    }),
    instructions: arr(o.instructions).map((s) => {
      const x = (s ?? {}) as Record<string, unknown>;
      return {
        id: str(x.id) || newId(),
        text: typeof s === 'string' ? s : str(x.text),
        group: strOrNull(x.group),
        timerMinutes: num(x.timerMinutes)
      };
    }),
    prepTimeMinutes: num(o.prepTimeMinutes),
    cookTimeMinutes: num(o.cookTimeMinutes),
    totalTimeMinutes: num(o.totalTimeMinutes),
    servings: num(o.servings) || null,
    yieldText: strOrNull(o.yieldText),
    course: str(o.course) || 'Other',
    cuisine: strOrNull(o.cuisine),
    dietaryTags: arr(o.dietaryTags).filter((t): t is string => typeof t === 'string'),
    customTags: arr(o.customTags).filter((t): t is string => typeof t === 'string'),
    collections: arr(o.collections).filter((t): t is string => typeof t === 'string'),
    notes: str(o.notes),
    sourceUrl: strOrNull(o.sourceUrl),
    sourceName: strOrNull(o.sourceName),
    author: strOrNull(o.author),
    isFavorite: o.isFavorite === true,
    createdAt: date(o.createdAt),
    updatedAt: date(o.updatedAt)
  };
  const parsed = recipeSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  // Last resort: drop the image (most likely culprit) and retry.
  const retry = recipeSchema.safeParse({ ...candidate, heroImage: null });
  return retry.success ? retry.data : null;
}

export function repairCollection(input: unknown): Collection | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const now = nowIso();
  const parsed = collectionSchema.safeParse({
    id: typeof o.id === 'string' && o.id ? o.id : newId(),
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 120) : '',
    description: typeof o.description === 'string' ? o.description : '',
    createdAt: typeof o.createdAt === 'string' && !Number.isNaN(Date.parse(o.createdAt)) ? new Date(o.createdAt).toISOString() : now,
    updatedAt: typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt)) ? new Date(o.updatedAt).toISOString() : now
  });
  return parsed.success ? parsed.data : null;
}
