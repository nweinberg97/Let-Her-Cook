import type { Backup, Collection, Preferences, Recipe, RecipeDraft } from '../../types/recipe';

/**
 * Storage boundary. The UI only talks to this interface, never to IndexedDB.
 * Version one ships `IndexedDbRepository`; a future server-backed repository
 * (REST, Supabase, etc.) can implement the same contract without UI changes.
 */
export interface RecipeRepository {
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | undefined>;
  createRecipe(draft: RecipeDraft): Promise<Recipe>;
  updateRecipe(id: string, changes: Partial<RecipeDraft>): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  searchRecipes(query: string): Promise<Recipe[]>;

  listCollections(): Promise<Collection[]>;
  createCollection(name: string, description?: string): Promise<Collection>;
  updateCollection(id: string, changes: Partial<Pick<Collection, 'name' | 'description'>>): Promise<Collection>;
  /** Removes the collection and detaches it from recipes. Never deletes recipes. */
  deleteCollection(id: string): Promise<void>;
  setRecipeCollections(recipeId: string, collectionIds: string[]): Promise<void>;

  getPreferences(): Promise<Preferences>;
  updatePreferences(changes: Partial<Preferences>): Promise<Preferences>;

  exportBackup(): Promise<Backup>;
  importBackup(plan: BackupImportPlan): Promise<BackupImportResult>;
  clearAll(): Promise<void>;

  /** Called after any write so views can refresh. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export type DuplicateStrategy = 'skip' | 'replace' | 'keep-both';

export interface BackupImportPlan {
  recipes: Recipe[];
  collections: Collection[];
  preferences?: Preferences;
  duplicateStrategy: DuplicateStrategy;
}

export interface BackupImportResult {
  added: number;
  replaced: number;
  skipped: number;
  collectionsAdded: number;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly kind: 'quota' | 'unavailable' | 'not-found' | 'invalid' | 'unknown',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function storageErrorMessage(err: unknown): string {
  if (err instanceof StorageError) {
    switch (err.kind) {
      case 'quota':
        return 'Your browser is out of storage space for this site, so the recipe wasn’t saved. Your draft is still open — try removing the photo or deleting recipes you no longer need, then save again.';
      case 'unavailable':
        return 'Your browser isn’t letting this site store data (private browsing can do this). Your draft is still open. Copy it somewhere safe, or try a regular browser window.';
      case 'not-found':
        return 'That recipe no longer exists. It may have been deleted in another tab.';
      case 'invalid':
        return `That recipe couldn’t be saved: ${err.message}`;
      default:
        return 'Something went wrong while saving. Your existing recipes are safe and your draft is still open — try again.';
    }
  }
  return 'Something went wrong while saving. Your existing recipes are safe and your draft is still open — try again.';
}
