import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { canonicalTag, dedupeTags } from '../../lib/storage/normalize';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  hint?: string;
}

/** Type a tag and press Enter or comma. Suggestions come from tags already in the library to avoid near-duplicates. */
export function TagInput({ label, value, onChange, suggestions = [], placeholder = 'Add a tag', hint }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const listId = useId();
  const hintId = useId();

  const add = (raw: string) => {
    const t = canonicalTag(raw);
    if (!t) return;
    // Reuse an existing tag's spelling when it matches case-insensitively.
    const existing = suggestions.find((s) => s.toLowerCase() === t.toLowerCase());
    onChange(dedupeTags([...value, existing ?? t]));
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const available = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  const quick = available.slice(0, 8);

  return (
    <div className="field">
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <div className="tag-input">
        {value.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" className="tag__remove" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="tag-input__field"
          value={draft}
          list={listId}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          aria-describedby={hint ? hintId : undefined}
          autoComplete="off"
        />
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {quick.length > 0 && (
        <div className="tag-suggestions" aria-label={`Suggested ${label.toLowerCase()}`}>
          {quick.map((s) => (
            <button key={s} type="button" className="chip chip--sm" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
