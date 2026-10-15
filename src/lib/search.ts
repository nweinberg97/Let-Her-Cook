import { effectiveTotalMinutes, type Collection, type Recipe } from '../types/recipe';

export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "crème" matches "creme"
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function recipeSearchText(r: Recipe, collectionNames: Map<string, string>): string {
  const parts = [
    r.title,
    r.description,
    r.cuisine ?? '',
    r.course,
    r.notes,
    r.sourceName ?? '',
    r.author ?? '',
    ...r.dietaryTags,
    ...r.customTags,
    ...r.collections.map((id) => collectionNames.get(id) ?? ''),
    ...r.ingredients.map((i) => `${i.raw} ${i.name} ${i.group ?? ''}`),
    ...r.instructions.map((s) => s.text)
  ];
  return normalizeForSearch(parts.join(' \n '));
}

export function queryTerms(query: string): string[] {
  return normalizeForSearch(query).split(' ').filter(Boolean);
}

/** Every term must appear somewhere (AND), so "chicken lemon" narrows results. */
export function matchesQuery(searchText: string, terms: string[]): boolean {
  return terms.every((t) => searchText.includes(t));
}

export function searchRecipes(recipes: Recipe[], collections: Collection[], query: string): Recipe[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return recipes;
  const names = new Map(collections.map((c) => [c.id, c.name]));
  // Title matches first, then everything else.
  const scored = recipes
    .map((r) => {
      const text = recipeSearchText(r, names);
      if (!matchesQuery(text, terms)) return null;
      const title = normalizeForSearch(r.title);
      const score = terms.filter((t) => title.includes(t)).length;
      return { r, score };
    })
    .filter((x): x is { r: Recipe; score: number } => x !== null);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.r);
}

export type SortKey = 'added' | 'updated' | 'alpha' | 'quickest' | 'longest';

export const SORT_LABELS: Record<SortKey, string> = {
  added: 'Recently added',
  updated: 'Recently updated',
  alpha: 'Alphabetical',
  quickest: 'Quickest to make',
  longest: 'Longest to make'
};

/** Unknown times always sort last, in both directions — never treated as zero. */
export function sortRecipes(recipes: Recipe[], key: SortKey): Recipe[] {
  const list = [...recipes];
  const byTime = (dir: 1 | -1) => (a: Recipe, b: Recipe) => {
    const ta = effectiveTotalMinutes(a);
    const tb = effectiveTotalMinutes(b);
    if (ta == null && tb == null) return a.title.localeCompare(b.title);
    if (ta == null) return 1;
    if (tb == null) return -1;
    return dir * (ta - tb) || a.title.localeCompare(b.title);
  };
  switch (key) {
    case 'added':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'updated':
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'alpha':
      return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'quickest':
      return list.sort(byTime(1));
    case 'longest':
      return list.sort(byTime(-1));
  }
}

export interface RecipeFilters {
  q: string;
  courses: string[];
  cuisines: string[];
  dietary: string[];
  tags: string[];
  collection: string | null;
  favorites: boolean;
  maxMinutes: number | null;
}

export const EMPTY_FILTERS: RecipeFilters = {
  q: '',
  courses: [],
  cuisines: [],
  dietary: [],
  tags: [],
  collection: null,
  favorites: false,
  maxMinutes: null
};

export function hasActiveFilters(f: RecipeFilters): boolean {
  return (
    f.q.trim() !== '' ||
    f.courses.length > 0 ||
    f.cuisines.length > 0 ||
    f.dietary.length > 0 ||
    f.tags.length > 0 ||
    f.collection !== null ||
    f.favorites ||
    f.maxMinutes !== null
  );
}

const lower = (s: string) => s.toLowerCase();

/**
 * Within one facet, options are OR'd (Dinner or Lunch); across facets they're
 * AND'd (Dinner AND Vegetarian). Dietary tags and custom tags are AND'd because
 * people use them to narrow ("Vegan" + "Gluten-Free").
 */
export function applyFilters(recipes: Recipe[], collections: Collection[], f: RecipeFilters): Recipe[] {
  let list = recipes;
  if (f.favorites) list = list.filter((r) => r.isFavorite);
  if (f.collection) list = list.filter((r) => r.collections.includes(f.collection!));
  if (f.courses.length) {
    const set = new Set(f.courses.map(lower));
    list = list.filter((r) => set.has(lower(r.course)));
  }
  if (f.cuisines.length) {
    const set = new Set(f.cuisines.map(lower));
    list = list.filter((r) => r.cuisine != null && set.has(lower(r.cuisine)));
  }
  if (f.dietary.length) {
    list = list.filter((r) => {
      const have = new Set(r.dietaryTags.map(lower));
      return f.dietary.every((d) => have.has(lower(d)));
    });
  }
  if (f.tags.length) {
    list = list.filter((r) => {
      const have = new Set(r.customTags.map(lower));
      return f.tags.every((t) => have.has(lower(t)));
    });
  }
  if (f.maxMinutes != null) {
    list = list.filter((r) => {
      const t = effectiveTotalMinutes(r);
      return t != null && t <= f.maxMinutes!;
    });
  }
  if (f.q.trim()) list = searchRecipes(list, collections, f.q);
  return list;
}

/** Splits text into segments for accessible <mark> highlighting of search terms. */
export function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  const terms = queryTerms(query).filter((t) => t.length > 1);
  if (!terms.length) return [{ text, match: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const out: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), match: false });
    out.push({ text: m[0], match: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}
