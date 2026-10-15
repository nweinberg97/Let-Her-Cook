import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbRepository } from '../lib/storage/indexeddb';
import { parseBackupText } from '../lib/storage/backup';
import { StorageError } from '../lib/storage/repository';
import { emptyDraft, type RecipeDraft } from '../types/recipe';
import { parseRecipeText } from '../lib/parsing/text';
import { findDuplicates } from '../lib/duplicates';

let dbName: string;
let repo: IndexedDbRepository;

const draft = (title: string, extra: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  title,
  course: 'Dinner',
  ingredients: parseRecipeText(`${title}\nIngredients\n1 cup rice\n2 cups water\nInstructions\nCook it.`).draft.ingredients,
  instructions: parseRecipeText(`${title}\nIngredients\n1 cup rice\nInstructions\nCook it.`).draft.instructions,
  ...extra
});

beforeEach(() => {
  dbName = `lhc-test-${Math.random().toString(36).slice(2)}`;
  repo = new IndexedDbRepository(dbName);
});
afterEach(async () => {
  await repo.deleteDatabase();
});

describe('recipes CRUD', () => {
  it('creates, reads, updates and deletes', async () => {
    const r = await repo.createRecipe(draft('Rice'));
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.createdAt).toBe(r.updatedAt);
    const updated = await repo.updateRecipe(r.id, { title: 'Perfect Rice', isFavorite: true });
    expect(updated.title).toBe('Perfect Rice');
    expect(updated.createdAt).toBe(r.createdAt);
    expect((await repo.getRecipe(r.id))?.isFavorite).toBe(true);
    await repo.deleteRecipe(r.id);
    expect(await repo.getRecipe(r.id)).toBeUndefined();
  });

  it('keeps unknown values as null, never zero', async () => {
    const r = await repo.createRecipe(draft('Mystery'));
    expect(r.prepTimeMinutes).toBeNull();
    expect(r.servings).toBeNull();
  });

  it('normalises tags (Title Case for lowercase input, keeps deliberate capitals, dedupes)', async () => {
    const r = await repo.createRecipe(draft('Tags', { customTags: ['comfort food', 'Comfort Food', 'BBQ', '  weeknight '] }));
    expect(r.customTags).toEqual(['Comfort Food', 'BBQ', 'Weeknight']);
  });

  it('rejects updating a missing recipe with a not-found error', async () => {
    await expect(repo.updateRecipe('nope', { title: 'x' })).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('searches across ingredients, notes and collection names', async () => {
    const c = await repo.createCollection('Grandma’s Recipes');
    await repo.createRecipe(draft('Soup', { notes: 'Use smoked paprika', collections: [c.id] }));
    await repo.createRecipe(draft('Toast'));
    expect((await repo.searchRecipes('PAPRIKA')).map((r) => r.title)).toEqual(['Soup']);
    expect((await repo.searchRecipes('grandma')).map((r) => r.title)).toEqual(['Soup']);
    expect((await repo.searchRecipes('rice  water')).length).toBe(2);
  });
});

describe('Case K — persistence', () => {
  it('survives reopening the database (a page reload)', async () => {
    const c = await repo.createCollection('Weeknight');
    const r = await repo.createRecipe(draft('Tacos', { customTags: ['Quick'], collections: [c.id], isFavorite: true }));
    repo.close();
    const reopened = new IndexedDbRepository(dbName);
    const again = await reopened.getRecipe(r.id);
    expect(again).toEqual(r);
    expect((await reopened.listCollections())[0].name).toBe('Weeknight');
    repo = reopened;
  });
});

describe('collections', () => {
  it('deleting a collection never deletes its recipes', async () => {
    const c = await repo.createCollection('Holiday');
    const r = await repo.createRecipe(draft('Ham', { collections: [c.id] }));
    await repo.deleteCollection(c.id);
    const still = await repo.getRecipe(r.id);
    expect(still).toBeDefined();
    expect(still!.collections).toEqual([]);
  });
  it('drops references to collections that do not exist', async () => {
    const r = await repo.createRecipe(draft('Ghost', { collections: ['missing-id'] }));
    expect(r.collections).toEqual([]);
  });
  it('renames', async () => {
    const c = await repo.createCollection('Old');
    expect((await repo.updateCollection(c.id, { name: 'New' })).name).toBe('New');
  });
});

describe('Case L — backup round trip', () => {
  it('restores recipes and their collection relationships exactly', async () => {
    const a = await repo.createCollection('Family Favorites');
    const b = await repo.createCollection('Summer');
    await repo.updatePreferences({ customCourses: ['Picnic'] });
    const r1 = await repo.createRecipe(draft('Lemonade', { course: 'Drink', collections: [a.id, b.id], customTags: ['Kid-Friendly'], isFavorite: true, notes: 'Mint!' }));
    const r2 = await repo.createRecipe(draft('Potato Salad', { collections: [b.id], prepTimeMinutes: 20 }));
    const backup = await repo.exportBackup();
    expect(backup.schemaVersion).toBe(1);
    const text = JSON.stringify(backup);

    const fresh = new IndexedDbRepository(`${dbName}-restore`);
    const parsed = parseBackupText(text);
    expect(parsed.invalidRecipes).toBe(0);
    const result = await fresh.importBackup({ ...parsed, duplicateStrategy: 'skip' });
    expect(result).toMatchObject({ added: 2, collectionsAdded: 2 });
    expect(await fresh.getRecipe(r1.id)).toEqual(r1);
    expect(await fresh.getRecipe(r2.id)).toEqual(r2);
    expect((await fresh.listCollections()).map((c) => c.name)).toEqual(['Family Favorites', 'Summer']);
    expect((await fresh.getPreferences()).customCourses).toEqual(['Picnic']);
    await fresh.deleteDatabase();
  });

  it('handles duplicates by strategy', async () => {
    const r = await repo.createRecipe(draft('Chili'));
    const backup = await repo.exportBackup();
    await repo.updateRecipe(r.id, { title: 'Chili (edited)' });
    const parsed = parseBackupText(JSON.stringify(backup));

    expect(await repo.importBackup({ ...parsed, duplicateStrategy: 'skip' })).toMatchObject({ skipped: 1, added: 0 });
    expect((await repo.getRecipe(r.id))!.title).toBe('Chili (edited)');

    expect(await repo.importBackup({ ...parsed, duplicateStrategy: 'replace' })).toMatchObject({ replaced: 1 });
    expect((await repo.getRecipe(r.id))!.title).toBe('Chili');

    expect(await repo.importBackup({ ...parsed, duplicateStrategy: 'keep-both' })).toMatchObject({ added: 1 });
    expect((await repo.listRecipes()).length).toBe(2);
  });

  it('merges collections with the same name instead of duplicating them', async () => {
    const mine = await repo.createCollection('Desserts');
    const other = new IndexedDbRepository(`${dbName}-other`);
    const theirs = await other.createCollection('desserts');
    await other.createRecipe(draft('Pie', { collections: [theirs.id] }));
    const parsed = parseBackupText(JSON.stringify(await other.exportBackup()));
    await repo.importBackup({ ...parsed, duplicateStrategy: 'skip' });
    expect((await repo.listCollections()).length).toBe(1);
    expect((await repo.listRecipes())[0].collections).toEqual([mine.id]);
    await other.deleteDatabase();
  });

  it('rejects files that are not backups and repairs damaged entries', () => {
    expect(() => parseBackupText('not json')).toThrow(/isn’t valid JSON/);
    expect(() => parseBackupText('{"hello":1}')).toThrow(/isn’t a Let Her Cook backup/);
    expect(() => parseBackupText(JSON.stringify({ app: 'let-her-cook', schemaVersion: 99, exportedAt: '', recipes: [], collections: [] }))).toThrow(/newer version/);
    const parsed = parseBackupText(
      JSON.stringify({
        app: 'let-her-cook',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        recipes: [{ title: 'Old format', ingredients: ['1 cup sugar'], instructions: ['Stir'] }, 42, null],
        collections: [{ name: 'Ok' }, { nope: true }]
      })
    );
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.recipes[0].ingredients[0].raw).toBe('1 cup sugar');
    expect(parsed.invalidRecipes).toBe(2);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.invalidCollections).toBe(1);
  });
});

describe('Case N — privacy lifecycle', () => {
  it('persists only the approved recipe, not the source image or raw OCR text', async () => {
    const rawOcrText = `SECRET-RAW-MARKER Grandma's Pie\nIngredients\n2 cups flour\n1 cup butter\nInstructions\nMix and bake for 45 minutes.`;
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const file = new File([imageBytes], 'pie.png', { type: 'image/png' });
    const result = parseRecipeText(rawOcrText); // what the OCR → parser step produces
    result.draft.title = "Grandma's Pie"; // user corrects the title during review
    const saved = await repo.createRecipe(result.draft); // user saves without keeping the image
    expect(saved.heroImage).toBeNull();
    const dump = JSON.stringify(await repo._dumpAllTables());
    expect(dump).toContain("Grandma's Pie");
    expect(dump).not.toContain('SECRET-RAW-MARKER');
    expect(dump).not.toContain('pie.png');
    expect(dump).not.toMatch(/data:image/);
    expect(file.size).toBeGreaterThan(0); // the file only ever existed in memory
  });
});

describe('Case G — duplicates', () => {
  it('flags same title, same source and near-identical ingredients, and allows saving anyway', async () => {
    const existing = await repo.createRecipe(draft('The Best Banana Bread', { sourceUrl: 'https://www.example.com/banana-bread/' }));
    const all = await repo.listRecipes();
    expect(findDuplicates(draft('Banana Bread'), all)).toHaveLength(1);
    expect(findDuplicates(draft('Something else', { sourceUrl: 'https://example.com/banana-bread' }), all)).toHaveLength(1);
    expect(findDuplicates(draft('Totally Different'), all, existing.id)).toHaveLength(0);
    await repo.createRecipe(draft('Banana Bread'));
    expect((await repo.listRecipes()).length).toBe(2);
  });
});

describe('storage errors', () => {
  it('rejects a recipe that is too large with a StorageError and keeps existing data', async () => {
    const r = await repo.createRecipe(draft('Safe'));
    const huge = draft('Too big', { heroImage: { src: 'data:image/webp;base64,' + 'A'.repeat(9_000_000), thumb: null, alt: null, credit: null, origin: 'local' } });
    await expect(repo.createRecipe(huge)).rejects.toBeInstanceOf(StorageError);
    expect(await repo.getRecipe(r.id)).toBeDefined();
  });
});

describe('demo samples', () => {
  it('adds every sample once, flags them, and removes only samples', async () => {
    const { addSampleRecipes, removeSampleRecipes, SAMPLE_COUNT, buildSampleDrafts } = await import('../lib/demo');
    for (const d of buildSampleDrafts()) {
      expect(d.ingredients.length).toBeGreaterThan(4);
      expect(d.instructions.length).toBeGreaterThan(2);
      expect(d.heroImage?.src).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
    const mine = await repo.createRecipe(draft('My Own Soup'));
    expect(await addSampleRecipes(repo)).toBe(SAMPLE_COUNT);
    expect(await addSampleRecipes(repo)).toBe(0);
    const all = await repo.listRecipes();
    expect(all.filter((r) => r.isSample)).toHaveLength(SAMPLE_COUNT);
    expect(await removeSampleRecipes(repo)).toBe(SAMPLE_COUNT);
    expect((await repo.listRecipes()).map((r) => r.id)).toEqual([mine.id]);
  });
});
