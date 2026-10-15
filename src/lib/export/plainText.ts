import type { Recipe } from '../../types/recipe';
import { effectiveTotalMinutes } from '../../types/recipe';
import { formatMinutes, scaleIngredientText } from '../parsing/quantity';

/** A readable, plain-text version of a recipe for copying, sharing or texting. */
export function recipeToPlainText(r: Recipe, servings?: number | null): string {
  const factor = servings && r.servings ? servings / r.servings : 1;
  const lines: string[] = [r.title];
  if (r.description) lines.push('', r.description);
  const facts: string[] = [];
  const shownServings = servings ?? r.servings;
  if (r.yieldText && factor === 1) facts.push(r.yieldText);
  else if (shownServings) facts.push(`Serves ${shownServings}`);
  if (r.prepTimeMinutes != null) facts.push(`Prep ${formatMinutes(r.prepTimeMinutes)}`);
  if (r.cookTimeMinutes != null) facts.push(`Cook ${formatMinutes(r.cookTimeMinutes)}`);
  const total = effectiveTotalMinutes(r);
  if (total != null) facts.push(`Total ${formatMinutes(total)}`);
  if (facts.length) lines.push('', facts.join(' | '));

  if (r.ingredients.length) {
    lines.push('', 'INGREDIENTS');
    let group: string | null = null;
    for (const i of r.ingredients) {
      if (i.group && i.group !== group) lines.push('', `${i.group}:`);
      group = i.group;
      lines.push(`- ${scaleIngredientText(i.raw, factor).text}`);
    }
  }
  if (r.instructions.length) {
    lines.push('', 'STEPS');
    let group: string | null = null;
    let n = 0;
    for (const s of r.instructions) {
      if (s.group && s.group !== group) lines.push('', `${s.group}:`);
      group = s.group;
      lines.push(`${++n}. ${s.text}`);
    }
  }
  if (r.notes) lines.push('', 'NOTES', r.notes);
  const source = [r.author, r.sourceName, r.sourceUrl].filter(Boolean).join(' — ');
  if (source) lines.push('', `Source: ${source}`);
  lines.push('', 'Saved with Let Her Cook');
  return lines.join('\n');
}
