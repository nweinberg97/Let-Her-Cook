import { emptyDraft, type HeroImage, type RecipeDraft } from '../../types/recipe';
import type { ExtractionResult, ExtractionWarning } from '../extraction/types';
import { matchCourseName, suggestCourse, suggestCuisine, suggestDietary } from './classify';
import { makeInstruction, parseIngredientLine } from './ingredient';
import { parseDurationText, parseLeadingQuantity } from './quantity';

/**
 * Reads schema.org/Recipe structured data (JSON-LD) from a page's HTML.
 * The HTML is parsed with DOMParser into an inert document — no scripts run,
 * nothing is rendered, and only text is ever taken from it.
 */

type Json = unknown;

function asArray<T = Json>(v: Json): T[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

function isRecipeType(t: Json): boolean {
  return asArray<string>(t).some((x) => typeof x === 'string' && /(^|[/:])Recipe$/i.test(x));
}

/** Walks arrays, @graph and nested objects looking for Recipe nodes. */
export function findRecipeNodes(data: Json, out: Record<string, Json>[] = [], depth = 0): Record<string, Json>[] {
  if (depth > 8 || data == null) return out;
  if (Array.isArray(data)) {
    for (const d of data) findRecipeNodes(d, out, depth + 1);
    return out;
  }
  if (typeof data === 'object') {
    const o = data as Record<string, Json>;
    if (isRecipeType(o['@type'])) out.push(o);
    if (o['@graph']) findRecipeNodes(o['@graph'], out, depth + 1);
    if (o.mainEntity) findRecipeNodes(o.mainEntity, out, depth + 1);
    if (o.mainEntityOfPage && typeof o.mainEntityOfPage === 'object') findRecipeNodes(o.mainEntityOfPage, out, depth + 1);
    if (o.itemListElement) findRecipeNodes(o.itemListElement, out, depth + 1);
    if (o.item && typeof o.item === 'object') findRecipeNodes(o.item, out, depth + 1);
  }
  return out;
}

/** Decodes entities and strips tags by parsing into an inert document and reading textContent. */
export function htmlToText(s: Json): string {
  if (typeof s !== 'string') return typeof s === 'number' ? String(s) : '';
  if (!/[<&]/.test(s)) return s.replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function pickImage(img: Json): string | null {
  for (const candidate of asArray(img)) {
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const o = candidate as Record<string, Json>;
      const url = typeof o.url === 'string' ? o.url : typeof o.contentUrl === 'string' ? o.contentUrl : null;
      if (url && /^https?:\/\//i.test(url)) return url;
    }
  }
  return null;
}

function personName(a: Json): string | null {
  const names = asArray(a)
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? (x as Record<string, Json>).name : null))
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => htmlToText(x));
  return names.length ? names.join(', ') : null;
}

function textList(v: Json): string[] {
  if (typeof v === 'string') return v.split(/\s*,\s*/).map((s) => htmlToText(s)).filter(Boolean);
  return asArray(v)
    .map((x) => htmlToText(x))
    .filter(Boolean);
}

/** recipeInstructions can be a string, a list of strings, HowToStep[], or HowToSection[] with nested steps. */
function readInstructions(v: Json): { text: string; group: string | null }[] {
  const out: { text: string; group: string | null }[] = [];
  const visit = (node: Json, group: string | null, depth: number) => {
    if (depth > 6 || node == null) return;
    if (typeof node === 'string') {
      const text = htmlToText(node);
      // A single string often holds every step separated by newlines or numbers.
      const parts = node.includes('\n') || /<(p|li|br)\b/i.test(node) ? splitHtmlSteps(node) : [text];
      for (const p of parts) if (p) out.push({ text: p, group });
      return;
    }
    if (Array.isArray(node)) {
      for (const n of node) visit(n, group, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      const o = node as Record<string, Json>;
      const type = asArray<string>(o['@type']).join(' ');
      if (/HowToSection/i.test(type) || (o.itemListElement && !o.text)) {
        visit(o.itemListElement, htmlToText(o.name) || group, depth + 1);
        return;
      }
      const text = htmlToText(o.text ?? o.name ?? o.description);
      if (text) out.push({ text, group });
    }
  };
  visit(v, null, 0);
  return out;
}

function splitHtmlSteps(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html.replace(/<br\s*\/?>/gi, '\n')}`, 'text/html');
  const items = Array.from(doc.body.querySelectorAll('li, p'));
  const texts = items.length ? items.map((e) => e.textContent ?? '') : (doc.body.textContent ?? '').split(/\n+/);
  return texts.map((t) => t.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function readYield(v: Json): { servings: number | null; yieldText: string | null } {
  const values = asArray(v).map((x) => (typeof x === 'number' ? String(x) : htmlToText(x))).filter(Boolean);
  // Prefer a value that is (or starts with) a plain number.
  for (const val of values) {
    const q = parseLeadingQuantity(val);
    if (q) {
      const after = q.rest.trim();
      const plain = !after || /^(servings?|people|portions?|persons?)\b/i.test(after);
      return { servings: q.quantity, yieldText: plain ? null : val };
    }
  }
  return { servings: null, yieldText: values[0] ?? null };
}

export interface PageMeta {
  canonicalUrl: string | null;
  siteName: string | null;
  ogImage: string | null;
  title: string | null;
}

export function readPageMeta(doc: Document, pageUrl: string): PageMeta {
  const attr = (sel: string, name: string) => doc.querySelector(sel)?.getAttribute(name)?.trim() || null;
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      const url = new URL(u, pageUrl);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  return {
    canonicalUrl: abs(attr('link[rel="canonical"]', 'href')) ?? abs(attr('meta[property="og:url"]', 'content')),
    siteName: attr('meta[property="og:site_name"]', 'content'),
    ogImage: abs(attr('meta[property="og:image"]', 'content')),
    title: attr('meta[property="og:title"]', 'content') ?? (doc.title || null)
  };
}

export function recipeNodeToResult(node: Record<string, Json>, meta: PageMeta, pageUrl: string): ExtractionResult {
  const title = htmlToText(node.name ?? node.headline) || meta.title || '';
  const ingredientsRaw = textList(node.recipeIngredient ?? node.ingredients);
  const ingredients = ingredientsRaw.map((l) => parseIngredientLine(l));
  const steps = readInstructions(node.recipeInstructions).map((s) => makeInstruction(s.text, s.group));
  const { servings, yieldText } = readYield(node.recipeYield ?? node.yield);
  const categoryHint = textList(node.recipeCategory).join(', ') || null;
  const cuisineHint = textList(node.recipeCuisine).join(', ') || null;
  const ingredientText = ingredientsRaw.join('\n');
  const imageUrl = pickImage(node.image) ?? meta.ogImage;
  const heroImage: HeroImage | null = imageUrl
    ? { src: imageUrl, thumb: null, alt: title ? `Photo of ${title}` : null, credit: meta.siteName, origin: 'remote' }
    : null;

  const draft: RecipeDraft = {
    ...emptyDraft(),
    title,
    description: htmlToText(node.description),
    heroImage,
    ingredients,
    instructions: steps,
    prepTimeMinutes: parseDurationText(typeof node.prepTime === 'string' ? node.prepTime : null),
    cookTimeMinutes: parseDurationText(typeof node.cookTime === 'string' ? node.cookTime : null),
    totalTimeMinutes: parseDurationText(typeof node.totalTime === 'string' ? node.totalTime : null),
    servings,
    yieldText,
    course: suggestCourse(title, ingredientText, categoryHint),
    cuisine: suggestCuisine(title, ingredientText, cuisineHint),
    dietaryTags: suggestDietary(ingredientsRaw),
    sourceUrl: meta.canonicalUrl ?? (typeof node.url === 'string' && /^https?:/.test(node.url) ? node.url : pageUrl),
    sourceName: meta.siteName ?? (() => {
      try {
        return new URL(pageUrl).hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    })(),
    author: personName(node.author)
  };

  const warnings: ExtractionWarning[] = [];
  if (!ingredients.length) warnings.push({ field: 'ingredients', message: 'The page didn’t list ingredients in a way we could read. Add them below.' });
  if (!steps.length) warnings.push({ field: 'instructions', message: 'The page didn’t list steps in a way we could read. Add them below.' });
  if (heroImage) warnings.push({ field: 'general', message: 'The photo is linked from the original website. It may stop showing if the site removes it — you can upload your own instead.' });

  return {
    draft,
    warnings,
    unclassified: '',
    confidence: ingredients.length && steps.length && title ? 'high' : 'medium',
    suggested: { course: !matchCourseName(categoryHint), cuisine: !cuisineHint && draft.cuisine != null, dietary: draft.dietaryTags.length > 0 },
    method: 'structured-data'
  };
}

/** Extracts every Recipe found in the page's JSON-LD. Malformed JSON blocks are skipped, not fatal. */
export function extractRecipesFromHtml(html: string, pageUrl: string): { results: ExtractionResult[]; meta: PageMeta; doc: Document } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = readPageMeta(doc, pageUrl);
  const nodes: Record<string, Json>[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = script.textContent ?? '';
    try {
      findRecipeNodes(JSON.parse(raw), nodes);
    } catch {
      // Some sites ship JSON-LD with trailing commas or raw newlines; try a light repair once.
      try {
        findRecipeNodes(JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]+/g, ' ')), nodes);
      } catch {
        /* skip unreadable block */
      }
    }
  }
  // De-duplicate identical recipes declared twice on one page.
  const seen = new Set<string>();
  const results: ExtractionResult[] = [];
  for (const n of nodes) {
    const r = recipeNodeToResult(n, meta, pageUrl);
    const key = `${r.draft.title}|${r.draft.ingredients.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(r);
  }
  return { results, meta, doc };
}

/** Readable text of a page for the text parser, with navigation and scripts removed. */
export function pageToText(doc: Document): string {
  const clone = doc.body?.cloneNode(true) as HTMLElement | undefined;
  if (!clone) return '';
  clone.querySelectorAll('script, style, noscript, nav, header, footer, aside, form, iframe, svg, button').forEach((e) => e.remove());
  const blocks = clone.querySelectorAll('h1, h2, h3, h4, h5, p, li, td, th, div, section, article, br');
  blocks.forEach((b) => {
    if (b.tagName === 'BR') b.replaceWith('\n');
    else b.append('\n');
  });
  return (clone.textContent ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
