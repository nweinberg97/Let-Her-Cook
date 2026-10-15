import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type Backup,
  type Collection,
  type Preferences,
  type Recipe,
  type RecipeDraft
} from '../../types/recipe';
import { newId, nowIso } from '../id';
import { searchRecipes } from '../search';
import { makeBackup } from './backup';
import { finalizeRecipe } from './normalize';
import {
  StorageError,
  type BackupImportPlan,
  type BackupImportResult,
  type RecipeRepository
} from './repository';

interface MetaRow {
  key: string;
  value: unknown;
}

class LetHerCookDb extends Dexie {
  recipes!: Table<Recipe, string>;
  collections!: Table<Collection, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    // IndexedDB schema versions. Add a new `.version(n)` block with an
    // `.upgrade()` callback for future migrations — never edit old ones.
    this.version(1).stores({
      recipes: 'id, title, createdAt, updatedAt, isFavorite, course, *collections, *customTags',
      collections: 'id, name',
      meta: 'key'
    });
  }
}

function toStorageError(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const e = err as { name?: string; inner?: { name?: string }; message?: string } | undefined;
  const names = [e?.name, e?.inner?.name];
  if (names.some((n) => n === 'QuotaExceededError')) {
    return new StorageError('Storage quota exceeded', 'quota', { cause: err });
  }
  if (
    names.some((n) =>
      ['MissingAPIError', 'OpenFailedError', 'InvalidStateError', 'DatabaseClosedError', 'SecurityError', 'UnknownError'].includes(n ?? '')
    )
  ) {
    return new StorageError('Storage unavailable', 'unavailable', { cause: err });
  }
  return new StorageError(e?.message ?? 'Unknown storage error', 'unknown', { cause: err });
}

export class IndexedDbRepository implements RecipeRepository {
  private db: LetHerCookDb;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;

  constructor(dbName = 'let-her-cook') {
    this.db = new LetHerCookDb(dbName);
    // Keep other open tabs in sync.
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`${dbName}-changes`);
      this.channel.onmessage = () => this.listeners.forEach((l) => l());
    }
  }

  private notify() {
    this.listeners.forEach((l) => l());
    this.channel?.postMessage('changed');
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw toStorageError(err);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listRecipes(): Promise<Recipe[]> {
    return this.run(() => this.db.recipes.toArray());
  }

  getRecipe(id: string): Promise<Recipe | undefined> {
    return this.run(() => this.db.recipes.get(id));
  }

  async createRecipe(draft: RecipeDraft): Promise<Recipe> {
    const recipe = await this.run(async () => {
      return this.db.transaction('rw', this.db.recipes, this.db.collections, async () => {
        const valid = new Set(await this.db.collections.toCollection().primaryKeys());
        const r = finalizeRecipe({ ...draft, collections: draft.collections.filter((c) => valid.has(c)) });
        if (await this.db.recipes.get(r.id)) r.id = newId();
        await this.db.recipes.add(r);
        return r;
      });
    });
    this.notify();
    return recipe;
  }

  async updateRecipe(id: string, changes: Partial<RecipeDraft>): Promise<Recipe> {
    const updated = await this.run(() =>
      this.db.transaction('rw', this.db.recipes, this.db.collections, async () => {
        const existing = await this.db.recipes.get(id);
        if (!existing) throw new StorageError('Recipe not found', 'not-found');
        const merged: RecipeDraft = { ...existing, ...changes, id };
        if (changes.collections) {
          const valid = new Set(await this.db.collections.toCollection().primaryKeys());
          merged.collections = changes.collections.filter((c) => valid.has(c));
        }
        const r = finalizeRecipe(merged, existing);
        await this.db.recipes.put(r);
        return r;
      })
    );
    this.notify();
    return updated;
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.run(() => this.db.recipes.delete(id));
    this.notify();
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    const [recipes, collections] = await Promise.all([this.listRecipes(), this.listCollections()]);
    return searchRecipes(recipes, collections, query);
  }

  listCollections(): Promise<Collection[]> {
    return this.run(async () => {
      const list = await this.db.collections.toArray();
      return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    });
  }

  async createCollection(name: string, description = ''): Promise<Collection> {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!clean) throw new StorageError('Give the collection a name', 'invalid');
    const now = nowIso();
    const c: Collection = { id: newId(), name: clean, description: description.trim(), createdAt: now, updatedAt: now };
    await this.run(() => this.db.collections.add(c));
    this.notify();
    return c;
  }

  async updateCollection(id: string, changes: Partial<Pick<Collection, 'name' | 'description'>>): Promise<Collection> {
    const result = await this.run(async () => {
      const existing = await this.db.collections.get(id);
      if (!existing) throw new StorageError('Collection not found', 'not-found');
      const name = changes.name !== undefined ? changes.name.replace(/\s+/g, ' ').trim().slice(0, 120) : existing.name;
      if (!name) throw new StorageError('Give the collection a name', 'invalid');
      const c: Collection = {
        ...existing,
        name,
        description: changes.description !== undefined ? changes.description.trim() : existing.description,
        updatedAt: nowIso()
      };
      await this.db.collections.put(c);
      return c;
    });
    this.notify();
    return result;
  }

  async deleteCollection(id: string): Promise<void> {
    await this.run(() =>
      this.db.transaction('rw', this.db.recipes, this.db.collections, async () => {
        await this.db.recipes
          .where('collections')
          .equals(id)
          .modify((r) => {
            r.collections = r.collections.filter((c) => c !== id);
          });
        await this.db.collections.delete(id);
      })
    );
    this.notify();
  }

  async setRecipeCollections(recipeId: string, collectionIds: string[]): Promise<void> {
    await this.updateRecipe(recipeId, { collections: collectionIds });
  }

  async getPreferences(): Promise<Preferences> {
    const row = await this.run(() => this.db.meta.get('preferences'));
    const parsed = preferencesSchema.safeParse(row?.value);
    return parsed.success ? parsed.data : { ...DEFAULT_PREFERENCES };
  }

  async updatePreferences(changes: Partial<Preferences>): Promise<Preferences> {
    const current = await this.getPreferences();
    const next = preferencesSchema.parse({ ...current, ...changes });
    await this.run(() => this.db.meta.put({ key: 'preferences', value: next }));
    this.notify();
    return next;
  }

  async exportBackup(): Promise<Backup> {
    const [recipes, collections, preferences] = await Promise.all([
      this.listRecipes(),
      this.listCollections(),
      this.getPreferences()
    ]);
    return makeBackup(recipes, collections, preferences);
  }

  async importBackup(plan: BackupImportPlan): Promise<BackupImportResult> {
    const result: BackupImportResult = { added: 0, replaced: 0, skipped: 0, collectionsAdded: 0 };
    await this.run(() =>
      this.db.transaction('rw', this.db.recipes, this.db.collections, this.db.meta, async () => {
        // 1. Collections: match by id, then by name, otherwise add.
        const existingCollections = await this.db.collections.toArray();
        const byId = new Map(existingCollections.map((c) => [c.id, c]));
        const byName = new Map(existingCollections.map((c) => [c.name.toLowerCase(), c]));
        const idMap = new Map<string, string>();
        for (const c of plan.collections) {
          const match = byId.get(c.id) ?? byName.get(c.name.toLowerCase());
          if (match) {
            idMap.set(c.id, match.id);
          } else {
            await this.db.collections.add(c);
            byId.set(c.id, c);
            byName.set(c.name.toLowerCase(), c);
            idMap.set(c.id, c.id);
            result.collectionsAdded++;
          }
        }
        // 2. Recipes, with collection ids remapped.
        for (const incoming of plan.recipes) {
          const r: Recipe = {
            ...incoming,
            collections: incoming.collections.map((id) => idMap.get(id) ?? (byId.has(id) ? id : '')).filter(Boolean)
          };
          const existing = await this.db.recipes.get(r.id);
          if (!existing) {
            await this.db.recipes.add(r);
            result.added++;
          } else if (plan.duplicateStrategy === 'replace') {
            await this.db.recipes.put(r);
            result.replaced++;
          } else if (plan.duplicateStrategy === 'keep-both') {
            await this.db.recipes.add({ ...r, id: newId() });
            result.added++;
          } else {
            result.skipped++;
          }
        }
        // 3. Preferences: union of custom courses.
        if (plan.preferences) {
          const row = await this.db.meta.get('preferences');
          const current = preferencesSchema.safeParse(row?.value);
          const base = current.success ? current.data : { ...DEFAULT_PREFERENCES };
          const courses = Array.from(new Set([...base.customCourses, ...plan.preferences.customCourses]));
          await this.db.meta.put({ key: 'preferences', value: { ...base, customCourses: courses } });
        }
      })
    );
    this.notify();
    return result;
  }

  async clearAll(): Promise<void> {
    await this.run(() =>
      this.db.transaction('rw', this.db.recipes, this.db.collections, this.db.meta, async () => {
        await this.db.recipes.clear();
        await this.db.collections.clear();
        await this.db.meta.clear();
      })
    );
    this.notify();
  }

  /** Test helper: raw table dump, used to verify nothing transient was persisted. */
  async _dumpAllTables(): Promise<Record<string, unknown[]>> {
    return {
      recipes: await this.db.recipes.toArray(),
      collections: await this.db.collections.toArray(),
      meta: await this.db.meta.toArray()
    };
  }

  close() {
    this.db.close();
    this.channel?.close();
  }

  async deleteDatabase() {
    this.channel?.close();
    await this.db.delete();
  }
}
