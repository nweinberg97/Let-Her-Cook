import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChefHat, Heart, Pencil, Printer, Share2, FolderPlus, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { storageErrorMessage } from '../lib/storage/repository';
import { effectiveTotalMinutes, type Recipe } from '../types/recipe';
import { formatMinutes, formatQuantity } from '../lib/parsing/quantity';
import { RecipeImage } from '../components/recipes/RecipeImage';
import { IngredientList } from '../components/recipes/IngredientList';
import { StepList } from '../components/recipes/StepList';
import { ServingScaler } from '../components/recipes/ServingScaler';
import { ShareDialog } from '../components/recipes/ShareDialog';
import { CollectionPicker } from '../components/collections/CollectionPicker';
import { Button, ButtonLink, IconButton } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';
import { Wordmark } from '../components/ui/Wordmark';
import { usePageTitle } from '../lib/usePageTitle';
import { NotFound } from './NotFound';
import { haptic, isNativeApp } from '../lib/native';
import { PLACE } from '../lib/native';
import { courseStyle } from '../lib/courseColors';

export function useScale(recipe: Recipe | undefined) {
  const [servings, setServings] = useState<number>(recipe?.servings ?? 1);
  const [multiplier, setMultiplier] = useState(1);
  useEffect(() => {
    setServings(recipe?.servings ?? 1);
    setMultiplier(1);
  }, [recipe?.id, recipe?.servings]);
  const original = recipe?.servings ?? null;
  const factor = original ? servings / original : multiplier;
  return {
    original,
    value: original ? servings : multiplier,
    setValue: original ? setServings : setMultiplier,
    factor,
    displayServings: original ? servings : null
  };
}

export function RecipePage() {
  const { id } = useParams();
  const { recipes, collections, repo, status } = useLibrary();
  const recipe = recipes.find((r) => r.id === id);
  const navigate = useNavigate();
  const toast = useToast();
  const scale = useScale(recipe);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [pendingCollections, setPendingCollections] = useState<string[]>([]);
  usePageTitle(recipe?.title);

  if (status === 'loading') return <div className="page"><p className="loading-line" role="status">Opening the recipe…</p></div>;
  if (!recipe) return <NotFound what="recipe" />;

  const total = effectiveTotalMinutes(recipe);
  const facts: { label: string; value: string }[] = [];
  if (recipe.prepTimeMinutes != null) facts.push({ label: 'Prep', value: formatMinutes(recipe.prepTimeMinutes) });
  if (recipe.cookTimeMinutes != null) facts.push({ label: 'Cook', value: formatMinutes(recipe.cookTimeMinutes) });
  if (total != null) facts.push({ label: 'Total', value: formatMinutes(total) });
  if (recipe.servings) facts.push({ label: 'Serves', value: formatQuantity(recipe.servings) });
  if (recipe.yieldText) facts.push({ label: 'Makes', value: recipe.yieldText.replace(/^(makes|yields?)\s*:?\s*/i, '') });

  const recipeCollections = collections.filter((c) => recipe.collections.includes(c.id));

  const toggleFavorite = async () => {
    try {
      await repo.updateRecipe(recipe.id, { isFavorite: !recipe.isFavorite });
      void haptic(recipe.isFavorite ? 'tap' : 'success');
      toast.success(recipe.isFavorite ? 'Removed from favorites.' : 'Added to favorites.');
    } catch (err) {
      toast.error(storageErrorMessage(err));
    }
  };

  const doDelete = async () => {
    const snapshot = recipe;
    try {
      await repo.deleteRecipe(recipe.id);
      setDeleteOpen(false);
      navigate('/');
      toast.success(`Deleted “${snapshot.title}”.`, {
        label: 'Undo',
        onClick: () => {
          repo
            .importBackup({ recipes: [snapshot], collections: [], duplicateStrategy: 'skip' })
            .then(() => toast.success('Recipe restored.'))
            .catch((err) => toast.error(storageErrorMessage(err)));
        }
      });
    } catch (err) {
      toast.error(storageErrorMessage(err));
    }
  };

  const tagLinks = [
    { label: recipe.course, to: `/?course=${encodeURIComponent(recipe.course)}` },
    ...(recipe.cuisine ? [{ label: recipe.cuisine, to: `/?cuisine=${encodeURIComponent(recipe.cuisine)}` }] : []),
    ...recipe.dietaryTags.map((d) => ({ label: d, to: `/?diet=${encodeURIComponent(d)}` })),
    ...recipe.customTags.map((t) => ({ label: t, to: `/?tag=${encodeURIComponent(t)}` }))
  ];

  return (
    <article className="page recipe" aria-labelledby="recipe-title" style={courseStyle(recipe.course)}>
      <div className="print-only print-brand">
        <Wordmark size="sm" />
        <span>Every recipe has a home.</span>
      </div>

      <nav className="recipe__back no-print" aria-label="Breadcrumb">
        <Link to="/" className="text-link">
          <ArrowLeft size={16} aria-hidden="true" /> My recipes
        </Link>
      </nav>

      <header className={`recipe__hero ${recipe.heroImage ? 'has-image' : ''}`}>
        <div className="recipe__heading">
          <ul className="recipe__tags" aria-label="Categories and tags">
            {tagLinks.map((t) => (
              <li key={t.label}>
                <Link to={t.to} className="tag-link">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
          <h1 id="recipe-title" className="recipe__title">
            {recipe.title}
          </h1>
          {recipe.description && <p className="recipe__description">{recipe.description}</p>}
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map((f) => (
                <div key={f.label} className="facts__item">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="recipe__actions no-print">
            <ButtonLink to={`/recipes/${recipe.id}/cook`} variant="primary" icon={<ChefHat size={18} />}>
              Start cooking
            </ButtonLink>
            <IconButton
              label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              pressed={recipe.isFavorite}
              variant="outline"
              className={recipe.isFavorite ? 'is-fav' : ''}
              icon={<Heart size={18} fill={recipe.isFavorite ? 'currentColor' : 'none'} />}
              onClick={toggleFavorite}
            />
            <ButtonLink to={`/recipes/${recipe.id}/edit`} variant="secondary" icon={<Pencil size={16} />}>
              Edit
            </ButtonLink>
            {!isNativeApp && (
              <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>
                Print / Save as PDF
              </Button>
            )}
            <Button variant="secondary" icon={<Share2 size={16} />} onClick={() => setShareOpen(true)}>
              Share
            </Button>
            <Button
              variant="secondary"
              icon={<FolderPlus size={16} />}
              onClick={() => {
                setPendingCollections(recipe.collections);
                setCollectionsOpen(true);
              }}
            >
              Collections
            </Button>
            <IconButton label="Delete recipe" variant="ghost" icon={<Trash2 size={18} />} onClick={() => setDeleteOpen(true)} />
          </div>
          {recipeCollections.length > 0 && (
            <p className="recipe__in-collections no-print">
              In{' '}
              {recipeCollections.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && (i === recipeCollections.length - 1 ? ' and ' : ', ')}
                  <Link to={`/collections/${c.id}`}>{c.name}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
        {recipe.heroImage && (
          <figure className="recipe__figure">
            <RecipeImage image={recipe.heroImage} title={recipe.title} variant="hero" course={recipe.course} />
            {recipe.heroImage.origin === 'remote' && recipe.heroImage.credit && (
              <figcaption>
                {recipe.isSample ? 'Sample photo' : 'Photo'}: {recipe.heroImage.credit}
              </figcaption>
            )}
          </figure>
        )}
      </header>

      <div className="recipe__columns">
        <section className="recipe__ingredients" aria-labelledby="ingredients-heading">
          <div className="section-head">
            <h2 id="ingredients-heading" className="section-title">
              Ingredients
            </h2>
            {recipe.ingredients.length > 0 && (
              <div className="no-print">
                <ServingScaler original={scale.original} value={scale.value} onChange={scale.setValue} label={recipe.yieldText ? 'Makes' : 'Serves'} />
              </div>
            )}
          </div>
          {scale.factor !== 1 && (
            <p className="scale-note">
              {scale.original
                ? recipe.yieldText
                  ? `Amounts adjusted to make ${formatQuantity(scale.value)} (recipe makes ${formatQuantity(scale.original)}).`
                  : `Amounts adjusted for ${formatQuantity(scale.value)} servings (recipe serves ${formatQuantity(scale.original)}).`
                : `Amounts multiplied by ${formatQuantity(scale.value)}.`}{' '}
              Times and temperatures stay the same; amounts we couldn’t read are unchanged.
            </p>
          )}
          {recipe.ingredients.length ? (
            <IngredientList ingredients={recipe.ingredients} factor={scale.factor} />
          ) : (
            <p className="muted">
              No ingredients yet. <Link to={`/recipes/${recipe.id}/edit`}>Add them</Link>.
            </p>
          )}
        </section>

        <section className="recipe__method" aria-labelledby="method-heading">
          <h2 id="method-heading" className="section-title">
            Method
          </h2>
          {recipe.instructions.length ? (
            <StepList steps={recipe.instructions} />
          ) : (
            <p className="muted">
              No steps yet. <Link to={`/recipes/${recipe.id}/edit`}>Add them</Link>.
            </p>
          )}

          {recipe.notes && (
            <section className="recipe__notes" aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="section-title section-title--small">
                Notes
              </h2>
              <p className="notes-text">{recipe.notes}</p>
            </section>
          )}
        </section>
      </div>

      {(recipe.sourceUrl || recipe.sourceName || recipe.author) && (
        <footer className="recipe__source">
          {recipe.author && <span>Recipe by {recipe.author}. </span>}
          {recipe.sourceUrl ? (
            <span>
              From{' '}
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                {recipe.sourceName ?? hostOf(recipe.sourceUrl)}
                <ExternalLink size={13} aria-hidden="true" className="no-print" />
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
              <span className="print-only"> — {recipe.sourceUrl}</span>
            </span>
          ) : (
            recipe.sourceName && <span>From {recipe.sourceName}.</span>
          )}
        </footer>
      )}

      <ShareDialog recipe={recipe} servings={scale.displayServings} open={shareOpen} onClose={() => setShareOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this recipe?"
        description={
          <p>
            “{recipe.title}” will be removed from {PLACE}. You can undo right after; otherwise it’s gone unless it’s in a backup.
          </p>
        }
        confirmLabel="Delete recipe"
        danger
        onConfirm={doDelete}
      />
      <Dialog
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        title="Collections"
        description={<p>Choose where “{recipe.title}” belongs. A recipe can be in as many collections as you like.</p>}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCollectionsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await repo.setRecipeCollections(recipe.id, pendingCollections);
                  setCollectionsOpen(false);
                  toast.success('Collections updated.');
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
        <CollectionPicker value={pendingCollections} onChange={setPendingCollections} />
      </Dialog>
    </article>
  );
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
