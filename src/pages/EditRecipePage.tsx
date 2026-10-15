import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { storageErrorMessage } from '../lib/storage/repository';
import { RecipeForm, fromFormState, toFormState, type RecipeFormState } from '../components/recipes/RecipeForm';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';
import { usePageTitle } from '../lib/usePageTitle';
import { NotFound } from './NotFound';

export function EditRecipePage() {
  const { id } = useParams();
  const { recipes, repo, status } = useLibrary();
  const recipe = recipes.find((r) => r.id === id);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<RecipeFormState | null>(null);
  const [initialJson, setInitialJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(recipe ? `Edit ${recipe.title}` : 'Edit recipe');

  useEffect(() => {
    if (recipe && !form) {
      const s = toFormState(recipe);
      setForm(s);
      setInitialJson(JSON.stringify(fromFormState(s)));
    }
  }, [recipe, form]);

  const dirty = !!form && JSON.stringify(fromFormState(form)) !== initialJson;
  const guard = useUnsavedGuard(dirty && !saving);

  if (status === 'loading' || (recipe && !form)) return <div className="page"><p className="loading-line" role="status">Opening the recipe…</p></div>;
  if (!recipe || !form) return <NotFound what="recipe" />;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await repo.updateRecipe(recipe.id, fromFormState(form));
      guard.allowNavigation();
      toast.success('Recipe updated.');
      navigate(`/recipes/${recipe.id}`, { replace: true });
    } catch (err) {
      setError(storageErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="page review">
      <header className="page-header review__header">
        <div>
          <h1 className="page-title">Edit recipe</h1>
          <p className="page-lede">{dirty ? 'You have unsaved changes.' : 'No changes yet.'}</p>
        </div>
        <div className="review__header-actions">
          <Button variant="ghost" onClick={() => navigate(`/recipes/${recipe.id}`)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </header>
      {error && (
        <div className="callout callout--danger" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div className="callout__body">
            <p className="callout__title">Your changes weren’t saved.</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      <RecipeForm state={form} onChange={setForm} />
      <div className="review__footer">
        <Button variant="ghost" onClick={() => navigate(`/recipes/${recipe.id}`)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      {guard.dialog}
    </div>
  );
}
