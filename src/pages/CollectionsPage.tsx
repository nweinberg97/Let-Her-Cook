import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, FolderHeart } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { storageErrorMessage } from '../lib/storage/repository';
import { Button, IconButton } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { usePageTitle } from '../lib/usePageTitle';
import { hueStyle, HUES } from '../lib/courseColors';
import { RecipeImage } from '../components/recipes/RecipeImage';
import type { Collection } from '../types/recipe';


export function CollectionsPage() {
  usePageTitle('Collections');
  const { collections, recipes, repo } = useLibrary();
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const nameId = useId();
  const editNameId = useId();
  const editDescId = useId();

  const create = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (collections.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      toast.info(`You already have a collection called “${clean}”.`);
      return;
    }
    try {
      await repo.createCollection(clean);
      setName('');
      toast.success(`Created “${clean}”.`);
    } catch (err) {
      toast.error(storageErrorMessage(err));
    }
  };

  return (
    <div className="page collections">
      <header className="page-header">
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="page-lede">Group recipes your way. A recipe can live in as many collections as you like.</p>
        </div>
      </header>

      <form
        className="create-collection"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label htmlFor={nameId} className="field__label">
          New collection
        </label>
        <div className="link-form__row">
          <input id={nameId} className="input input--lg" placeholder="e.g. Grandma’s recipes, Weeknight winners, Things to try" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="primary" size="lg" icon={<Plus size={18} />} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>

      {collections.length === 0 ? (
        <div className="empty empty--inline">
          <FolderHeart size={28} aria-hidden="true" className="empty__icon" />
          <h2 className="empty__title">No collections yet</h2>
          <p className="empty__text">Try “Family favorites”, “Holiday baking” or “Summer salads”. Then add recipes from each recipe’s page.</p>
        </div>
      ) : (
        <ul className="collection-grid">
          {collections.map((c, i) => {
            const items = recipes.filter((r) => r.collections.includes(c.id));
            const cover = items.find((r) => r.heroImage) ?? items[0];
            return (
              <li key={c.id} className="collection-tile" style={hueStyle(HUES[i % HUES.length])}>
                <Link to={`/collections/${c.id}`} className="collection-tile__link">
                  <div className="collection-tile__cover">
                    {cover ? <RecipeImage image={cover.heroImage} title={cover.title} course={cover.course} /> : <span className="collection-tile__empty" />}
                  </div>
                  <div className="collection-tile__body">
                    <h2 className="collection-tile__name">{c.name}</h2>
                    <p className="collection-tile__count">
                      {items.length} {items.length === 1 ? 'recipe' : 'recipes'}
                    </p>
                  </div>
                </Link>
                <div className="collection-tile__tools">
                  <IconButton
                    label={`Rename ${c.name}`}
                    icon={<Pencil size={16} />}
                    size="sm"
                    onClick={() => {
                      setEditing(c);
                      setEditName(c.name);
                      setEditDesc(c.description);
                    }}
                  />
                  <IconButton label={`Delete ${c.name}`} icon={<Trash2 size={16} />} size="sm" onClick={() => setDeleting(c)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit collection"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!editName.trim()}
              onClick={async () => {
                if (!editing) return;
                try {
                  await repo.updateCollection(editing.id, { name: editName, description: editDesc });
                  toast.success('Collection updated.');
                  setEditing(null);
                } catch (err) {
                  toast.error(storageErrorMessage(err));
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor={editNameId} className="field__label">
            Name
          </label>
          <input id={editNameId} className="input" value={editName} maxLength={120} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={editDescId} className="field__label">
            Description <span className="field__optional">optional</span>
          </label>
          <textarea id={editDescId} className="textarea" rows={3} value={editDesc} maxLength={1000} onChange={(e) => setEditDesc(e.target.value)} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description={<p>Only the collection is deleted. Every recipe in it stays in your library.</p>}
        confirmLabel="Delete collection"
        danger
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await repo.deleteCollection(deleting.id);
            toast.success('Collection deleted. Its recipes are still in your library.');
            setDeleting(null);
          } catch (err) {
            toast.error(storageErrorMessage(err));
          }
        }}
      />
    </div>
  );
}
