import type { Ingredient, Instruction } from '../../types/recipe';
import { newId } from '../id';
import { detectTimerMinutes, parseLeadingQuantity } from './quantity';

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(fl\.?\s?oz\.?|fluid\s+ounces?)\b/i, 'fl oz'],
  [/^(cups?|c\.)(?=\s|$)/i, 'cup'],
  [/^(tablespoons?|tbsps?\.?|tbls?\.?|tbs\.?)(?=\s|$)/i, 'tbsp'],
  [/^T\.?(?=\s)/, 'tbsp'],
  [/^(teaspoons?|tsps?\.?)(?=\s|$)/i, 'tsp'],
  [/^t\.?(?=\s)/, 'tsp'],
  [/^(ounces?|oz\.?)(?=\s|$)/i, 'oz'],
  [/^(pounds?|lbs?\.?)(?=\s|$)/i, 'lb'],
  [/^(kilograms?|kgs?)(?=\s|$)/i, 'kg'],
  [/^(grams?|g|gr)(?=\s|$)/i, 'g'],
  [/^(millilit(?:er|re)s?|ml|mls)(?=\s|$)/i, 'ml'],
  [/^(lit(?:er|re)s?|l)(?=\s|$)/i, 'l'],
  [/^(pints?|pt\.?)(?=\s|$)/i, 'pint'],
  [/^(quarts?|qts?\.?)(?=\s|$)/i, 'quart'],
  [/^(gallons?|gal\.?)(?=\s|$)/i, 'gallon'],
  [/^(pinch(?:es)?)(?=\s|$)/i, 'pinch'],
  [/^(dash(?:es)?)(?=\s|$)/i, 'dash'],
  [/^(cloves?)(?=\s|$)/i, 'clove'],
  [/^(cans?|tins?)(?=\s|$)/i, 'can'],
  [/^(jars?)(?=\s|$)/i, 'jar'],
  [/^(packages?|pkgs?\.?|packets?)(?=\s|$)/i, 'package'],
  [/^(sticks?)(?=\s|$)/i, 'stick'],
  [/^(slices?)(?=\s|$)/i, 'slice'],
  [/^(bunch(?:es)?)(?=\s|$)/i, 'bunch'],
  [/^(handfuls?)(?=\s|$)/i, 'handful'],
  [/^(sprigs?)(?=\s|$)/i, 'sprig'],
  [/^(heads?)(?=\s|$)/i, 'head'],
  [/^(stalks?)(?=\s|$)/i, 'stalk'],
  [/^(pieces?|pcs?\.?)(?=\s|$)/i, 'piece'],
  [/^(sheets?)(?=\s|$)/i, 'sheet'],
  [/^(drops?)(?=\s|$)/i, 'drop']
];

const BULLET = /^\s*(?:[-*•▢☐◦·▪●○✓✔]|\[\s?\]|\(\s?\))\s*/u;

export function stripBullet(line: string): string {
  return line.replace(BULLET, '').trim();
}

/** Parses one ingredient line into structured parts without changing the original text. */
export function parseIngredientLine(line: string, group: string | null = null): Ingredient {
  const raw = stripBullet(line).replace(/\s+/g, ' ').trim();
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: string | null = null;
  let rest = raw;

  const q = parseLeadingQuantity(raw);
  if (q && !/^\s*(°|º|degrees)/i.test(q.rest)) {
    quantity = q.quantity;
    quantityMax = q.quantityMax;
    rest = q.rest.trim();
    // A size in parentheses right after the number, e.g. "1 (14 oz) can", stays with the name.
    const sizeMatch = rest.match(/^(\([^)]*\))\s*/);
    const afterSize = sizeMatch ? rest.slice(sizeMatch[0].length) : rest;
    for (const [re, canonical] of UNIT_ALIASES) {
      const m = afterSize.match(re);
      if (m) {
        unit = canonical;
        rest = (sizeMatch ? sizeMatch[1] + ' ' : '') + afterSize.slice(m[0].length).trim();
        break;
      }
    }
    rest = rest.replace(/^of\s+/i, '');
  }

  let name = rest;
  let note: string | null = null;
  const comma = rest.indexOf(',');
  if (comma > 0) {
    name = rest.slice(0, comma).trim();
    note = rest.slice(comma + 1).trim() || null;
  }
  return {
    id: newId(),
    raw,
    quantity,
    quantityMax,
    unit,
    name: name || raw,
    note,
    group
  };
}

export function makeInstruction(text: string, group: string | null = null): Instruction {
  const clean = text.replace(/\s+/g, ' ').trim();
  return { id: newId(), text: clean, group, timerMinutes: detectTimerMinutes(clean) };
}

/** Editor row model: a flat list where section headings sit between items. */
export type EditorRow = { id: string; kind: 'item' | 'heading'; text: string };

export function ingredientsToRows(ings: Ingredient[]): EditorRow[] {
  const rows: EditorRow[] = [];
  let current: string | null = null;
  for (const i of ings) {
    if (i.group && i.group !== current) {
      rows.push({ id: newId(), kind: 'heading', text: i.group });
    }
    current = i.group;
    rows.push({ id: i.id, kind: 'item', text: i.raw });
  }
  return rows;
}

export function rowsToIngredients(rows: EditorRow[], previous: Ingredient[] = []): Ingredient[] {
  const byId = new Map(previous.map((i) => [i.id, i]));
  let group: string | null = null;
  const out: Ingredient[] = [];
  for (const row of rows) {
    if (row.kind === 'heading') {
      group = row.text.replace(/:\s*$/, '').trim() || null;
      continue;
    }
    if (!row.text.trim()) continue;
    const prev = byId.get(row.id);
    if (prev && prev.raw === row.text.trim() && prev.group === group) {
      out.push(prev);
    } else {
      out.push({ ...parseIngredientLine(row.text, group), id: row.id });
    }
  }
  return out;
}

export function instructionsToRows(steps: Instruction[]): EditorRow[] {
  const rows: EditorRow[] = [];
  let current: string | null = null;
  for (const s of steps) {
    if (s.group && s.group !== current) rows.push({ id: newId(), kind: 'heading', text: s.group });
    current = s.group;
    rows.push({ id: s.id, kind: 'item', text: s.text });
  }
  return rows;
}

export function rowsToInstructions(rows: EditorRow[]): Instruction[] {
  let group: string | null = null;
  const out: Instruction[] = [];
  for (const row of rows) {
    if (row.kind === 'heading') {
      group = row.text.replace(/:\s*$/, '').trim() || null;
      continue;
    }
    if (!row.text.trim()) continue;
    out.push({ ...makeInstruction(row.text, group), id: row.id });
  }
  return out;
}
