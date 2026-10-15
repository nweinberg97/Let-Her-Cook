import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_COURSES, DEFAULT_PREFERENCES, type Collection, type Preferences, type Recipe } from '../../types/recipe';
import type { RecipeRepository } from './repository';

interface LibraryState {
  repo: RecipeRepository;
  recipes: Recipe[];
  collections: Collection[];
  preferences: Preferences;
  /** Default courses plus any the user added. */
  courses: string[];
  /** All tags used across the library, for suggestions. */
  allTags: string[];
  allCuisines: string[];
  status: 'loading' | 'ready' | 'error';
  error: unknown;
  reload: () => void;
}

const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ repo, children }: { repo: RecipeRepository; children: ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [status, setStatus] = useState<LibraryState['status']>('loading');
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    Promise.all([repo.listRecipes(), repo.listCollections(), repo.getPreferences()])
      .then(([r, c, p]) => {
        setRecipes(r);
        setCollections(c);
        setPreferences(p);
        setStatus('ready');
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setStatus('error');
      });
  }, [repo]);

  useEffect(() => {
    reload();
    return repo.subscribe(reload);
  }, [repo, reload]);

  const value = useMemo<LibraryState>(() => {
    const courseSet = new Map<string, string>();
    for (const c of [...DEFAULT_COURSES, ...preferences.customCourses, ...recipes.map((r) => r.course)]) {
      if (c && !courseSet.has(c.toLowerCase())) courseSet.set(c.toLowerCase(), c);
    }
    const tagMap = new Map<string, string>();
    const cuisineMap = new Map<string, string>();
    for (const r of recipes) {
      for (const t of r.customTags) if (!tagMap.has(t.toLowerCase())) tagMap.set(t.toLowerCase(), t);
      if (r.cuisine && !cuisineMap.has(r.cuisine.toLowerCase())) cuisineMap.set(r.cuisine.toLowerCase(), r.cuisine);
    }
    const sortAlpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return {
      repo,
      recipes,
      collections,
      preferences,
      courses: Array.from(courseSet.values()),
      allTags: Array.from(tagMap.values()).sort(sortAlpha),
      allCuisines: Array.from(cuisineMap.values()).sort(sortAlpha),
      status,
      error,
      reload
    };
  }, [repo, recipes, collections, preferences, status, error, reload]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryState {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
