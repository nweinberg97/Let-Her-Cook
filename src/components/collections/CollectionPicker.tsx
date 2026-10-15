import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLibrary } from '../../lib/storage/LibraryContext';
import { storageErrorMessage } from '../../lib/storage/repository';
import { useToast } from '../ui/Toast';

/** Checkbox list of collections plus an inline "new collection" field. Works for drafts and saved recipes. */
export function CollectionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { collections, repo } = useLibrary();
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const create = async () => {
    const clean = name.trim();
    if (!clean) return;
    const existing = collections.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (!value.includes(existing.id)) onChange([...value, existing.id]);
      setName('');
      return;
    }
    setBusy(true);
    try {
      const c = await repo.createCollection(clean);
      onChange([...value, c.id]);
      setName('');
    } catch (err) {
      toast.error(storageErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="collection-picker">
      {collections.length > 0 ? (
        <fieldset className="checklist">
          <legend className="visually-hidden">Collections</legend>
          {collections.map((c) => (
            <label key={c.id} className="checklist__item">
              <input
                type="checkbox"
                checked={value.includes(c.id)}
                onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="field__hint">No collections yet. Make one — like “Weeknight winners” or “Grandma’s recipes”.</p>
      )}
      <div className="inline-create">
        <label htmlFor={inputId} className="visually-hidden">
          New collection name
        </label>
        <input
          id={inputId}
          className="input"
          placeholder="New collection name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create();
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--md" onClick={create} disabled={busy || !name.trim()}>
          <span className="btn__icon" aria-hidden="true">
            <Plus size={16} />
          </span>
          <span className="btn__label">Create</span>
        </button>
      </div>
    </div>
  );
}
