import type { Recipe, RecipeDraft } from '../types/recipe';

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(the|a|an|best|easy|my|recipe|homemade)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

const normUrl = (u: string | null) => {
  if (!u) return null;
  try {
    const url = new URL(u);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

const ingredientWords = (r: Pick<Recipe, 'ingredients'>) =>
  new Set(
    r.ingredients
      .map((i) => i.name.toLowerCase().replace(/[^a-z ]/g, '').trim())
      .filter((n) => n.length > 2)
  );

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Finds saved recipes that look like the same dish: same source link, same title, or near-identical ingredients. */
export function findDuplicates(draft: RecipeDraft, recipes: Recipe[], ignoreId?: string): Recipe[] {
  const t = normTitle(draft.title);
  const u = normUrl(draft.sourceUrl);
  const ings = ingredientWords(draft);
  return recipes.filter((r) => {
    if (r.id === ignoreId) return false;
    if (u && normUrl(r.sourceUrl) === u) return true;
    if (t && t.length > 3 && normTitle(r.title) === t) return true;
    return ings.size >= 4 && jaccard(ings, ingredientWords(r)) >= 0.8;
  });
}
