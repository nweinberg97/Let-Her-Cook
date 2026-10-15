import { Minus, Plus, RotateCcw } from 'lucide-react';
import { formatQuantity } from '../../lib/parsing/quantity';

/**
 * Either "Serves [−] 4 [+]" when the recipe knows its servings, or a simple
 * ½× / 1× / 2× / 3× multiplier when it doesn't. Scaling is display-only: the
 * saved recipe never changes.
 */
export function ServingScaler({
  original,
  value,
  onChange,
  label = 'Serves'
}: {
  label?: string;
  original: number | null;
  /** Either a servings count (when original is known) or a multiplier. */
  value: number;
  onChange: (v: number) => void;
}) {
  if (original) {
    const step = original < 2 ? 0.5 : 1;
    const changed = value !== original;
    return (
      <div className="scaler" role="group" aria-label={label === 'Serves' ? 'Servings' : 'Amount'}>
        <span className="scaler__label">{label}</span>
        <button type="button" className="scaler__btn" aria-label={label === 'Serves' ? 'Fewer servings' : 'Make fewer'} disabled={value <= step} onClick={() => onChange(Math.max(step, value - step))}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <output className="scaler__value" aria-live="polite">
          {formatQuantity(value)}
        </output>
        <button type="button" className="scaler__btn" aria-label={label === 'Serves' ? 'More servings' : 'Make more'} disabled={value >= 200} onClick={() => onChange(value + step)}>
          <Plus size={16} aria-hidden="true" />
        </button>
        {changed && (
          <button type="button" className="scaler__reset" onClick={() => onChange(original)}>
            <RotateCcw size={14} aria-hidden="true" /> Original: {formatQuantity(original)}
          </button>
        )}
      </div>
    );
  }
  const options = [0.5, 1, 2, 3];
  return (
    <div className="scaler" role="group" aria-label="Scale recipe">
      <span className="scaler__label">Scale</span>
      {options.map((o) => (
        <button key={o} type="button" className="chip chip--sm" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o === 0.5 ? '½×' : `${o}×`}
        </button>
      ))}
    </div>
  );
}
