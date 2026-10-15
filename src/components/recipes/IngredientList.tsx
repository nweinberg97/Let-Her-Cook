import type { Ingredient } from '../../types/recipe';
import { formatQuantity, parseLeadingQuantity, scaleIngredientText } from '../../lib/parsing/quantity';
import { stripBullet } from '../../lib/parsing/ingredient';

/** Splits "1½ cups flour" into the amount and the rest, so the amount can be set in bold. */
function splitAmount(text: string): [string, string] {
  const clean = stripBullet(text);
  const q = parseLeadingQuantity(clean);
  if (!q) return ['', clean];
  const unit = q.rest.match(/^\s*((?:\([^)]*\)\s*)?[a-zA-Z]{1,12}\.?)(?=\s)/);
  const unitWords = /^(\s*\(.*\)\s*)?(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|litres?|pinch(es)?|dash(es)?|cloves?|cans?|sticks?|slices?|bunch(es)?|handfuls?|sprigs?|pints?|quarts?|packages?|jars?|heads?|stalks?|pieces?)\.?$/i;
  // Show "1 1/2" as "1½" — same value, easier to read at the stove.
  const pretty = q.quantityMax != null ? `${formatQuantity(q.quantity)}–${formatQuantity(q.quantityMax)}` : formatQuantity(q.quantity);
  if (unit && unitWords.test(unit[1])) {
    const amount = q.matched + unit[0];
    return [`${pretty} ${unit[1].trim()}`, clean.slice(amount.length).trim()];
  }
  return [pretty, q.rest.trim()];
}

export function IngredientList({
  ingredients,
  factor,
  checked,
  onToggle
}: {
  ingredients: Ingredient[];
  factor: number;
  checked?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const groups: { name: string | null; items: Ingredient[] }[] = [];
  for (const ing of ingredients) {
    const last = groups[groups.length - 1];
    if (last && last.name === ing.group) last.items.push(ing);
    else groups.push({ name: ing.group, items: [ing] });
  }
  return (
    <div className="ingredients">
      {groups.map((g, gi) => (
        <div key={gi} className="ingredients__group">
          {g.name && <h3 className="ingredients__group-title">{g.name}</h3>}
          <ul className="ingredients__list">
            {g.items.map((ing) => {
              const { text, scaled } = scaleIngredientText(ing.raw, factor);
              const [amount, rest] = splitAmount(text);
              const content = (
                <>
                  {amount && <strong className={`ing-amount ${scaled ? 'is-scaled' : ''}`}>{amount}</strong>} <span>{rest}</span>
                </>
              );
              if (onToggle) {
                const isChecked = checked?.has(ing.id) ?? false;
                return (
                  <li key={ing.id} className={`ingredient ingredient--check ${isChecked ? 'is-done' : ''}`}>
                    <label>
                      <input type="checkbox" checked={isChecked} onChange={() => onToggle(ing.id)} />
                      <span className="ingredient__text">{content}</span>
                    </label>
                  </li>
                );
              }
              return (
                <li key={ing.id} className="ingredient">
                  {content}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
