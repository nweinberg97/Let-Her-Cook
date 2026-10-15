import { useMemo, useState, useId, type ReactNode } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Heart } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { applyFilters, hasActiveFilters, sortRecipes, SORT_LABELS, type RecipeFilters, type SortKey } from '../lib/search';
import { DIETARY_TAGS } from '../types/recipe';
import { RecipeCard } from '../components/recipes/RecipeCard';
import { Button, ButtonLink } from '../components/ui/Button';
import { usePageTitle } from '../lib/usePageTitle';
import { NotFound } from './NotFound';
import { courseStyle } from '../lib/courseColors';
import { CategoryBubbles, DemoBanner, FeatureRow, FirstRun, HomeHello, Shelf } from '../components/home/Discover';
import { WallaSays } from '../components/ui/Wordmark';
import { effectiveTotalMinutes } from '../types/recipe';

type View = 'all' | 'favorites' | 'recent' | 'collection';

const TIME_OPTIONS = [
  { value: 15, label: 'Under 15 min' },
  { value: 30, label: 'Under 30 min' },
  { value: 60, label: 'Under 1 hour' }
];

function readFilters(params: URLSearchParams): RecipeFilters {
  const time = Number(params.get('time'));
  return {
    q: params.get('q') ?? '',
    courses: params.getAll('course'),
    cuisines: params.getAll('cuisine'),
    dietary: params.getAll('diet'),
    tags: params.getAll('tag'),
    collection: params.get('collection'),
    favorites: params.get('fav') === '1',
    maxMinutes: Number.isFinite(time) && time > 0 ? time : null
  };
}

export function LibraryPage({ view }: { view: View }) {
  const { recipes, collections, status, allTags, allCuisines } = useLibrary();
  const { id: collectionId } = useParams();
  const [params, setParams] = useSearchParams();
  const [showMore, setShowMore] = useState(false);
  const panelId = useId();
  const searchId = useId();
  const sortId = useId();

  const collection = view === 'collection' ? collections.find((c) => c.id === collectionId) : undefined;
  const filters = readFilters(params);
  const sort: SortKey = view === 'recent' ? 'added' : ((params.get('sort') as SortKey) in SORT_LABELS ? (params.get('sort') as SortKey) : 'added');

  const effective: RecipeFilters = {
    ...filters,
    favorites: view === 'favorites' ? true : filters.favorites,
    collection: view === 'collection' ? collectionId ?? null : filters.collection
  };

  const base = useMemo(() => {
    if (view === 'favorites') return recipes.filter((r) => r.isFavorite);
    if (view === 'collection') return recipes.filter((r) => r.collections.includes(collectionId ?? ''));
    return recipes;
  }, [recipes, view, collectionId]);

  const results = useMemo(() => sortRecipes(applyFilters(recipes, collections, effective), sort), [recipes, collections, effective, sort]);

  const title =
    view === 'favorites' ? 'Favorites' : view === 'recent' ? 'Recently added' : view === 'collection' ? collection?.name ?? 'Collection' : 'My recipes';
  usePageTitle(title);

  if (view === 'collection' && status === 'ready' && !collection) {
    return <NotFound what="collection" />;
  }

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    fn(next);
    setParams(next, { replace: true });
  };
  const toggleMulti = (key: string, value: string) =>
    update((p) => {
      const values = p.getAll(key);
      p.delete(key);
      const nextValues = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
      nextValues.forEach((v) => p.append(key, v));
    });
  const clearFilters = () => setParams(new URLSearchParams(params.get('sort') ? { sort: params.get('sort')! } : {}), { replace: true });

  // Facet options come from what's actually in this view, so there are no dead-end filters.
  const courseCounts = new Map<string, number>();
  for (const r of base) courseCounts.set(r.course, (courseCounts.get(r.course) ?? 0) + 1);
  const courseOptions = Array.from(courseCounts.keys()).sort();
  const cuisineOptions = allCuisines.filter((c) => base.some((r) => r.cuisine?.toLowerCase() === c.toLowerCase()));
  const dietOptions = DIETARY_TAGS.filter((d) => base.some((r) => r.dietaryTags.some((t) => t.toLowerCase() === d.toLowerCase())));
  const tagOptions = allTags.filter((t) => base.some((r) => r.customTags.some((x) => x.toLowerCase() === t.toLowerCase())));
  const secondaryActive =
    filters.cuisines.length + filters.dietary.length + filters.tags.length + (filters.maxMinutes ? 1 : 0) + (filters.collection ? 1 : 0) + (filters.favorites ? 1 : 0);
  const active = hasActiveFilters(filters);

  if (status === 'loading') {
    return (
      <div className="page">
        <p className="loading-line" role="status">
          Opening your recipe box…
        </p>
      </div>
    );
  }

  if (recipes.length === 0 && view !== 'collection') {
    return <FirstRun />;
  }

  const activeChips: { label: string; remove: () => void }[] = [
    ...filters.courses.map((c) => ({ label: c, remove: () => toggleMulti('course', c) })),
    ...filters.cuisines.map((c) => ({ label: c, remove: () => toggleMulti('cuisine', c) })),
    ...filters.dietary.map((c) => ({ label: c, remove: () => toggleMulti('diet', c) })),
    ...filters.tags.map((c) => ({ label: c, remove: () => toggleMulti('tag', c) })),
    ...(filters.maxMinutes ? [{ label: TIME_OPTIONS.find((t) => t.value === filters.maxMinutes)?.label ?? `Under ${filters.maxMinutes} min`, remove: () => update((p) => p.delete('time')) }] : []),
    ...(filters.favorites ? [{ label: 'Favorites', remove: () => update((p) => p.delete('fav')) }] : []),
    ...(filters.collection ? [{ label: collections.find((c) => c.id === filters.collection)?.name ?? 'Collection', remove: () => update((p) => p.delete('collection')) }] : [])
  ];

  const sampleCount = recipes.filter((r) => r.isSample).length;
  const discover = view === 'all' && !active;

  return (
    <div className="page library">
      {discover ? (
        <HomeHello />
      ) : (
      <header className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {view === 'collection' && collection?.description && <p className="page-lede">{collection.description}</p>}
          {view === 'recent' && <p className="page-lede">Newest first.</p>}
        </div>
        {view === 'collection' && (
          <Link to="/collections" className="text-link">
            Manage collections
          </Link>
        )}
      </header>
      )}

      {view === 'all' && <DemoBanner count={sampleCount} />}

      {base.length > 0 && (
        <section className="finder" aria-label="Search and filter">
          <div className="finder__top">
            <div className="search">
              <label htmlFor={searchId} className="visually-hidden">
                Search recipes
              </label>
              <Search size={18} aria-hidden="true" className="search__icon" />
              <input
                id={searchId}
                type="search"
                className="search__input"
                placeholder="Search titles, ingredients, notes…"
                value={filters.q}
                onChange={(e) => update((p) => (e.target.value ? p.set('q', e.target.value) : p.delete('q')))}
                enterKeyHint="search"
                autoComplete="off"
              />
            </div>
            <div className="finder__controls">
              <Button
                variant="secondary"
                icon={<SlidersHorizontal size={18} />}
                aria-expanded={showMore}
                aria-controls={panelId}
                onClick={() => setShowMore((s) => !s)}
              >
                Filters{secondaryActive ? ` (${secondaryActive})` : ''}
              </Button>
              {view !== 'recent' && (
                <div className="select-wrap">
                  <label htmlFor={sortId} className="visually-hidden">
                    Sort by
                  </label>
                  <select id={sortId} className="select" value={sort} onChange={(e) => update((p) => p.set('sort', e.target.value))}>
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {courseOptions.length > 1 && (
            <div className="chip-row" role="group" aria-label="Course">
              {courseOptions.map((c) => (
                <button key={c} type="button" className="chip chip--course" style={courseStyle(c)} aria-pressed={filters.courses.includes(c)} onClick={() => toggleMulti('course', c)}>
                  <span className="chip__dot" aria-hidden="true" />
                  {c}
                  <span className="chip__count">{courseCounts.get(c)}</span>
                </button>
              ))}
            </div>
          )}

          <div id={panelId} className="filter-panel" hidden={!showMore}>
            <FacetGroup label="Time">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="chip"
                  aria-pressed={filters.maxMinutes === t.value}
                  onClick={() => update((p) => (filters.maxMinutes === t.value ? p.delete('time') : p.set('time', String(t.value))))}
                >
                  {t.label}
                </button>
              ))}
            </FacetGroup>
            {dietOptions.length > 0 && (
              <FacetGroup label="Diet">
                {dietOptions.map((d) => (
                  <button key={d} type="button" className="chip" aria-pressed={filters.dietary.includes(d)} onClick={() => toggleMulti('diet', d)}>
                    {d}
                  </button>
                ))}
              </FacetGroup>
            )}
            {cuisineOptions.length > 0 && (
              <FacetGroup label="Cuisine">
                {cuisineOptions.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={filters.cuisines.includes(c)} onClick={() => toggleMulti('cuisine', c)}>
                    {c}
                  </button>
                ))}
              </FacetGroup>
            )}
            {tagOptions.length > 0 && (
              <FacetGroup label="Tags">
                {tagOptions.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={filters.tags.includes(t)} onClick={() => toggleMulti('tag', t)}>
                    {t}
                  </button>
                ))}
              </FacetGroup>
            )}
            {view !== 'collection' && collections.length > 0 && (
              <FacetGroup label="Collection">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="chip"
                    aria-pressed={filters.collection === c.id}
                    onClick={() => update((p) => (filters.collection === c.id ? p.delete('collection') : p.set('collection', c.id)))}
                  >
                    {c.name}
                  </button>
                ))}
              </FacetGroup>
            )}
            {view === 'all' && (
              <FacetGroup label="Show">
                <button type="button" className="chip" aria-pressed={filters.favorites} onClick={() => update((p) => (filters.favorites ? p.delete('fav') : p.set('fav', '1')))}>
                  <Heart size={14} aria-hidden="true" /> Favorites only
                </button>
              </FacetGroup>
            )}
          </div>

          {active && (
            <div className="active-filters">
              <ul className="active-filters__list" aria-label="Active filters">
                {filters.q && (
                  <li>
                    <button type="button" className="chip chip--active" onClick={() => update((p) => p.delete('q'))} aria-label={`Clear search “${filters.q}”`}>
                      “{filters.q}” <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                )}
                {activeChips.map((c) => (
                  <li key={c.label}>
                    <button type="button" className="chip chip--active" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                      {c.label} <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="text-button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      )}

      {discover && (
        <>
          <CategoryBubbles recipes={recipes} />
          <FeatureRow recipes={recipes} />
          <Shelf
            title="Quick weeknight wins"
            recipes={sortRecipes(recipes.filter((r) => (effectiveTotalMinutes(r) ?? Infinity) <= 30), 'quickest').slice(0, 12)}
            more={{ to: '/?time=30', label: 'See all' }}
          />
          <Shelf title="Your favorites" recipes={recipes.filter((r) => r.isFavorite).slice(0, 12)} more={{ to: '/favorites', label: 'See all' }} />
          <h2 className="all-recipes all-recipes__title">All recipes</h2>
        </>
      )}

      <p className="results-count" role="status" aria-live="polite">
        {base.length === 0 ? '' : active ? `${results.length} of ${base.length} recipes` : `${base.length} ${base.length === 1 ? 'recipe' : 'recipes'}`}
      </p>

      {base.length === 0 ? (
        <ViewEmpty view={view} />
      ) : results.length === 0 ? (
        <div className="empty empty--inline">
          <WallaSays size={110}>Hmm, I looked everywhere!</WallaSays>
          <h2 className="empty__title">{filters.q ? `Nothing matches “${filters.q}”` : 'No recipes match these filters'}</h2>
          <p className="empty__text">Try fewer filters or a different word — search looks through titles, ingredients, steps, tags and notes.</p>
          <div className="empty__actions">
            <Button variant="primary" onClick={clearFilters}>
              Clear filters
            </Button>
            <ButtonLink to="/add" variant="secondary">
              Add a recipe
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="recipe-grid">
          {results.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} query={filters.q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="facet" role="group" aria-label={label}>
      <span className="facet__label">{label}</span>
      <div className="facet__chips">{children}</div>
    </div>
  );
}

function ViewEmpty({ view }: { view: View }) {
  if (view === 'favorites') {
    return (
      <div className="empty empty--inline">
        <WallaSays size={110}>Tap the heart on a recipe you love!</WallaSays>
        <h2 className="empty__title">No favorites yet</h2>
        <p className="empty__text">Hearted recipes wait for you here, so the family classics are always one tap away.</p>
        <ButtonLink to="/" variant="primary">
          Browse my recipes
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="empty empty--inline">
      <WallaSays size={110}>This shelf is empty — let’s fill it!</WallaSays>
      <h2 className="empty__title">Nothing in this collection yet</h2>
      <p className="empty__text">Open any recipe and choose “Collections” to add it here.</p>
      <ButtonLink to="/" variant="primary">
        Browse my recipes
      </ButtonLink>
    </div>
  );
}
