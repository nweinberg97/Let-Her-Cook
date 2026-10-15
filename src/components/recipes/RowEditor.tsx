import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Heading, Plus, Trash2 } from 'lucide-react';
import type { EditorRow } from '../../lib/parsing/ingredient';
import { newId } from '../../lib/id';

/**
 * Editable list used for both ingredients and steps. Each row is one line of
 * text; headings split the list into groups ("For the dressing").
 * Pasting several lines into one row splits them into separate rows.
 */
export function RowEditor({
  rows,
  onChange,
  kind,
  labelledBy
}: {
  rows: EditorRow[];
  onChange: (rows: EditorRow[]) => void;
  kind: 'ingredient' | 'step';
  labelledBy: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const noun = kind === 'ingredient' ? 'ingredient' : 'step';

  const focusRow = (id: string) => {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${id}"]`);
      el?.focus();
    });
  };

  const update = (id: string, text: string) => onChange(rows.map((r) => (r.id === id ? { ...r, text } : r)));
  const remove = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    const next = rows.filter((r) => r.id !== id);
    onChange(next);
    const neighbour = next[Math.max(0, idx - 1)];
    if (neighbour) focusRow(neighbour.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const idx = rows.findIndex((r) => r.id === id);
    const to = idx + dir;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
    focusRow(id);
  };
  const insertAfter = (id: string | null, kindOfRow: EditorRow['kind'] = 'item', text = '') => {
    const row: EditorRow = { id: newId(), kind: kindOfRow, text };
    const idx = id ? rows.findIndex((r) => r.id === id) : rows.length - 1;
    const next = [...rows];
    next.splice(idx + 1, 0, row);
    onChange(next);
    focusRow(row.id);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>, row: EditorRow) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;
    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/^\s*(?:[-*•▢☐]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const idx = rows.findIndex((r) => r.id === row.id);
    const newRows = lines.map((l, i) => (i === 0 && !row.text ? { ...row, text: l } : { id: newId(), kind: 'item' as const, text: l }));
    const next = [...rows];
    next.splice(row.text ? idx + 1 : idx, row.text ? 0 : 1, ...newRows);
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, row: EditorRow) => {
    if (e.key === 'Enter' && (kind === 'ingredient' || row.kind === 'heading' || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      insertAfter(row.id);
    } else if (e.key === 'Backspace' && row.text === '' && rows.length > 1) {
      e.preventDefault();
      remove(row.id);
    }
  };

  let stepNumber = 0;
  return (
    <div className="row-editor">
      {rows.length === 0 && <p className="row-editor__empty">No {noun}s yet.</p>}
      <ol className="row-editor__list" ref={listRef} aria-labelledby={labelledBy}>
        {rows.map((row, i) => {
          if (row.kind === 'item') stepNumber++;
          const label = row.kind === 'heading' ? `Section heading` : kind === 'step' ? `Step ${stepNumber}` : `Ingredient ${stepNumber}`;
          return (
            <li key={row.id} className={`row-editor__row row-editor__row--${row.kind}`}>
              {kind === 'step' && row.kind === 'item' && (
                <span className="row-editor__num" aria-hidden="true">
                  {stepNumber}
                </span>
              )}
              {row.kind === 'heading' || kind === 'ingredient' ? (
                <input
                  data-row={row.id}
                  className={`input ${row.kind === 'heading' ? 'input--heading' : ''}`}
                  value={row.text}
                  aria-label={label}
                  placeholder={row.kind === 'heading' ? 'e.g. For the dressing' : 'e.g. 2 cups flour, sifted'}
                  onChange={(e) => update(row.id, e.target.value)}
                  onPaste={(e) => onPaste(e, row)}
                  onKeyDown={(e) => onKeyDown(e, row)}
                  maxLength={1000}
                />
              ) : (
                <textarea
                  data-row={row.id}
                  className="textarea textarea--auto"
                  value={row.text}
                  aria-label={label}
                  placeholder="Describe this step"
                  rows={Math.min(8, Math.max(2, Math.ceil(row.text.length / 70)))}
                  onChange={(e) => update(row.id, e.target.value)}
                  onPaste={(e) => onPaste(e, row)}
                  onKeyDown={(e) => onKeyDown(e, row)}
                  maxLength={5000}
                />
              )}
              <div className="row-editor__tools">
                <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(row.id, -1)}>
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Move ${label} down`} disabled={i === rows.length - 1} onClick={() => move(row.id, 1)}>
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Remove ${label}`} onClick={() => remove(row.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="row-editor__add">
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => insertAfter(null)}>
          <span className="btn__icon" aria-hidden="true">
            <Plus size={16} />
          </span>
          <span className="btn__label">Add {noun}</span>
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => insertAfter(null, 'heading')}>
          <span className="btn__icon" aria-hidden="true">
            <Heading size={16} />
          </span>
          <span className="btn__label">Add section heading</span>
        </button>
      </div>
      <p className="field__hint">
        {kind === 'ingredient'
          ? 'One ingredient per line. Press Enter for a new line, or paste a whole list at once.'
          : 'Paste several steps at once and they’ll be split up. Ctrl/⌘ + Enter adds a new step.'}
      </p>
    </div>
  );
}
