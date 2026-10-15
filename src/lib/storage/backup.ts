import {
  backupSchema,
  preferencesSchema,
  SCHEMA_VERSION,
  type Backup,
  type Collection,
  type Preferences,
  type Recipe
} from '../../types/recipe';
import { repairCollection, repairRecipe } from './normalize';

export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

export interface ParsedBackup {
  recipes: Recipe[];
  collections: Collection[];
  preferences?: Preferences;
  exportedAt: string | null;
  schemaVersion: number;
  /** Entries in the file that couldn't be read and will be left out. */
  invalidRecipes: number;
  invalidCollections: number;
}

export class BackupError extends Error {}

/** Migrations from older backup formats would run here, keyed by schemaVersion. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

export function parseBackupText(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('This file isn’t valid JSON, so it can’t be a Let Her Cook backup. Your existing recipes are untouched.');
  }
  const shape = backupSchema.safeParse(json);
  if (!shape.success) {
    throw new BackupError('This file isn’t a Let Her Cook backup. Choose a file you downloaded from “Download backup”. Your existing recipes are untouched.');
  }
  if (shape.data.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of Let Her Cook. Update the app, then try again. Your existing recipes are untouched.');
  }
  const data = migrate(shape.data as unknown as Record<string, unknown>) as typeof shape.data;

  const recipes: Recipe[] = [];
  let invalidRecipes = 0;
  for (const r of data.recipes) {
    const fixed = repairRecipe(r);
    if (fixed) recipes.push(fixed);
    else invalidRecipes++;
  }
  const collections: Collection[] = [];
  let invalidCollections = 0;
  for (const c of data.collections) {
    const fixed = repairCollection(c);
    if (fixed) collections.push(fixed);
    else invalidCollections++;
  }
  const prefs = preferencesSchema.safeParse(data.preferences);
  return {
    recipes,
    collections,
    preferences: prefs.success ? prefs.data : undefined,
    exportedAt: data.exportedAt ?? null,
    schemaVersion: data.schemaVersion,
    invalidRecipes,
    invalidCollections
  };
}

export function makeBackup(recipes: Recipe[], collections: Collection[], preferences: Preferences): Backup {
  return {
    app: 'let-her-cook',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recipes,
    collections,
    preferences
  };
}

export function backupFileName(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `let-her-cook-backup-${d}.json`;
}

/** How many recipes in the backup already exist here (same id). */
export function countDuplicates(incoming: Recipe[], existing: Recipe[]): number {
  const ids = new Set(existing.map((r) => r.id));
  return incoming.filter((r) => ids.has(r.id)).length;
}
