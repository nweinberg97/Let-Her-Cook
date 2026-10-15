/**
 * Quantity parsing, formatting and scaling. Pure functions, no DOM.
 *
 * Supports: 2 · 1.5 · 1/2 · 1 1/2 · ½ · 1½ · 1 ½ · 1⁄2 · ranges 2-3 · 2–3 · 2 to 3
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

// One number: mixed unicode (1½, 1 ½), mixed ascii (1 1/2), fraction (1/2), decimal, lone unicode.
const NUM = `(?:\\d+\\s?[${FRACTION_CHARS}]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|\\.\\d+|[${FRACTION_CHARS}])`;
const RANGE_SEP = `\\s*(?:-|–|—|to|or)\\s*`;
const LEADING_QTY = new RegExp(`^(${NUM})(?:${RANGE_SEP}(${NUM}))?(?=$|[\\s\\p{L}(,.-])`, 'u');

export function normalizeFractionChars(s: string): string {
  // U+2044 FRACTION SLASH → "/"
  return s.replace(/⁄/g, '/');
}

export function parseNumber(token: string): number | null {
  const t = normalizeFractionChars(token).trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(new RegExp(`^(\\d+)\\s?([${FRACTION_CHARS}])$`)))) {
    return Number(m[1]) + UNICODE_FRACTIONS[m[2]];
  }
  if ((m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/))) {
    const den = Number(m[3]);
    return den ? Number(m[1]) + Number(m[2]) / den : null;
  }
  if ((m = t.match(/^(\d+)\/(\d+)$/))) {
    const den = Number(m[2]);
    return den ? Number(m[1]) / den : null;
  }
  if (/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return Number(t);
  if (t.length === 1 && t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t];
  return null;
}

export interface LeadingQuantity {
  quantity: number;
  quantityMax: number | null;
  /** Exactly the characters that were recognised as the quantity. */
  matched: string;
  /** Everything after the quantity, untouched. */
  rest: string;
}

export function parseLeadingQuantity(text: string): LeadingQuantity | null {
  const s = normalizeFractionChars(text);
  const m = s.match(LEADING_QTY);
  if (!m) return null;
  const q = parseNumber(m[1]);
  if (q == null) return null;
  let max: number | null = null;
  if (m[2]) {
    max = parseNumber(m[2]);
    if (max == null || max <= q) max = null;
  }
  // Reject a range we couldn't make sense of rather than half-parsing it.
  if (m[2] && max == null) {
    return { quantity: q, quantityMax: null, matched: m[1], rest: s.slice(m[1].length) };
  }
  return { quantity: q, quantityMax: max, matched: m[0], rest: s.slice(m[0].length) };
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞']
];

/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4". */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  for (const [value, glyph] of NICE_FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) return whole ? `${whole}${glyph}` : glyph;
  }
  // Not a common fraction: round sensibly.
  const rounded = n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
  return String(rounded);
}

export interface ScaledLine {
  text: string;
  scaled: boolean;
}

/**
 * Scales the leading quantity of an ingredient line. Always computed from the
 * original text (never from an already-scaled value), so changing servings
 * up and down repeatedly can't compound rounding errors. Lines without a clear
 * leading quantity — "salt to taste", "a handful of basil" — are returned
 * unchanged. Temperatures and times never appear at the start of an ingredient
 * line, so they aren't touched.
 */
export function scaleIngredientText(raw: string, factor: number): ScaledLine {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return { text: raw, scaled: false };
  const leadMatch = raw.match(/^(\s*(?:[-*•▢☐◦·]\s*)?)/);
  const lead = leadMatch ? leadMatch[1] : '';
  const body = raw.slice(lead.length);
  const q = parseLeadingQuantity(body);
  if (!q) return { text: raw, scaled: false };
  // Something like "350°F" or "9x13" isn't a quantity of ingredient.
  if (/^\s*(°|º|degrees|x\d|×)/i.test(q.rest)) return { text: raw, scaled: false };
  const min = formatQuantity(q.quantity * factor);
  const max = q.quantityMax != null ? formatQuantity(q.quantityMax * factor) : null;
  const restSpacing = /^\s/.test(q.rest) || q.rest === '' ? '' : ' ';
  const newTop = (q.quantityMax ?? q.quantity) * factor;
  const rest = adjustUnitPlural(q.rest, (q.quantityMax ?? q.quantity) > 1, newTop > 1);
  return { text: `${lead}${max ? `${min}–${max}` : min}${restSpacing}${rest}`, scaled: true };
}

const UNIT_PLURALS: [string, string][] = [
  ['cup', 'cups'],
  ['tablespoon', 'tablespoons'],
  ['teaspoon', 'teaspoons'],
  ['clove', 'cloves'],
  ['can', 'cans'],
  ['pound', 'pounds'],
  ['ounce', 'ounces'],
  ['stick', 'sticks'],
  ['slice', 'slices'],
  ['pinch', 'pinches'],
  ['quart', 'quarts'],
  ['pint', 'pints'],
  ['package', 'packages'],
  ['sprig', 'sprigs'],
  ['jar', 'jars'],
  ['egg', 'eggs'],
  ['large egg', 'large eggs']
];

/** "1 cup" → "2 cups" and back. Only touches the first word(s) when it's a known unit. */
function adjustUnitPlural(rest: string, wasPlural: boolean, isPlural: boolean): string {
  if (wasPlural === isPlural) return rest;
  // Skip a size in parentheses: "1 (14 oz) can" → look at "can".
  const m = rest.match(/^(\s*(?:\([^)]*\)\s*)?)(.*)$/s);
  if (!m) return rest;
  const [, space, body] = m;
  for (const [one, many] of UNIT_PLURALS) {
    const from = isPlural ? one : many;
    const to = isPlural ? many : one;
    const re = new RegExp(`^${from}(?=$|[\\s,.)])`, 'i');
    if (re.test(body)) {
      const replaced = body.replace(re, (w) => (w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to));
      return space + replaced;
    }
  }
  return rest;
}

/** Parses "1 hr 30 mins", "1½ hours", "45 min", "1h30", "PT1H30M". Returns minutes or null. */
export function parseDurationText(input: string | null | undefined): number | null {
  if (!input) return null;
  const s = normalizeFractionChars(String(input)).trim();
  const iso = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso && (iso[1] || iso[2] || iso[3] || iso[4])) {
    const mins = Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0) + Number(iso[4] ?? 0) / 60;
    return Math.round(mins);
  }
  let total = 0;
  let found = false;
  const re = new RegExp(`(${NUM})(?:\\s*(?:-|–|to)\\s*${NUM})?\\s*(days?|d\\b|hours?|hrs?|h\\b|minutes?|mins?|m\\b)`, 'gi');
  for (const m of s.matchAll(re)) {
    const n = parseNumber(m[1]);
    if (n == null) continue;
    const unit = m[2].toLowerCase();
    found = true;
    if (unit.startsWith('d')) total += n * 1440;
    else if (unit.startsWith('h')) total += n * 60;
    else total += n;
  }
  // "1h30" — trailing minutes without a unit.
  const hm = s.match(/(\d+)\s*h\s*(\d{1,2})\s*$/i);
  if (hm && !/m/i.test(s.slice(s.toLowerCase().lastIndexOf('h')))) {
    return Number(hm[1]) * 60 + Number(hm[2]);
  }
  return found ? Math.round(total) : null;
}

export function formatMinutes(mins: number | null | undefined): string {
  if (mins == null) return '';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24 && m === 0 && h % 24 === 0) return `${h / 24} day${h / 24 > 1 ? 's' : ''}`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** First explicit duration in an instruction ("simmer for 20 minutes"), used for an optional timer. */
export function detectTimerMinutes(text: string): number | null {
  const m = normalizeFractionChars(text).match(
    new RegExp(`(${NUM})(?:\\s*(?:-|–|to)\\s*${NUM})?\\s*(hours?|hrs?|minutes?|mins?)\\b`, 'i')
  );
  if (!m) return null;
  const n = parseNumber(m[1]);
  if (n == null || n <= 0) return null;
  const mins = /^h/i.test(m[2]) ? n * 60 : n;
  return mins > 0 && mins <= 24 * 60 ? Math.round(mins * 10) / 10 : null;
}
