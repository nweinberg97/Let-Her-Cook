import { z } from 'zod';

/**
 * The recipe schema is the contract between the UI, the parsers, local storage,
 * backups and any future backend. It deliberately contains nothing specific to
 * IndexedDB. Unknown values are `null`, never `0`, so "we don't know the cook
 * time" is never confused with "it takes no time".
 */

export const SCHEMA_VERSION = 1;

export const DEFAULT_COURSES = [
  'Breakfast',
  'Brunch',
  'Lunch',
  'Dinner',
  'Snack',
  'Dessert',
  'Appetizer',
  'Side Dish',
  'Drink',
  'Sauce & Condiment',
  'Baking',
  'Other'
] as const;

export const DIETARY_TAGS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'High-Protein'
] as const;

export const SUGGESTED_TAGS = [
  'Weeknight',
  'Quick & Easy',
  'Kid-Friendly',
  'Meal Prep',
  'Comfort Food',
  'Family Favorite',
  'Dinner Party',
  'Summer'
];

const nullableNumber = z.number().finite().nonnegative().nullable();
const shortText = (max: number) => z.string().max(max);

export const ingredientSchema = z.object({
  id: z.string().min(1).max(64),
  /** The ingredient exactly as written in the source or by the user. */
  raw: shortText(1000),
  quantity: nullableNumber,
  /** Upper bound when the source gives a range, e.g. "2–3 cloves". */
  quantityMax: nullableNumber,
  unit: shortText(40).nullable(),
  name: shortText(1000),
  note: shortText(500).nullable(),
  group: shortText(200).nullable()
});

export const instructionSchema = z.object({
  id: z.string().min(1).max(64),
  text: shortText(5000),
  group: shortText(200).nullable(),
  /** A timer suggested by the step text (e.g. "bake for 25 minutes"). */
  timerMinutes: nullableNumber
});

export const heroImageSchema = z.object({
  /** A data: URL for images kept on this device, or an https URL from a recipe site. */
  src: z.string().max(8_000_000),
  /** Small data: URL used in the library grid. */
  thumb: z.string().max(1_000_000).nullable(),
  alt: shortText(300).nullable(),
  credit: shortText(300).nullable(),
  /** `local` images were explicitly kept by the user; `remote` ones are linked from the source. */
  origin: z.enum(['local', 'remote'])
});

export const recipeSchema = z.object({
  id: z.string().min(1).max(64),
  title: shortText(300),
  description: shortText(5000),
  heroImage: heroImageSchema.nullable(),
  ingredients: z.array(ingredientSchema).max(500),
  instructions: z.array(instructionSchema).max(500),
  prepTimeMinutes: nullableNumber,
  cookTimeMinutes: nullableNumber,
  totalTimeMinutes: nullableNumber,
  servings: nullableNumber,
  /** Free-text yield when it isn't a plain number of servings, e.g. "Makes 2 dozen". */
  yieldText: shortText(200).nullable(),
  course: shortText(80),
  cuisine: shortText(80).nullable(),
  dietaryTags: z.array(shortText(60)).max(30),
  customTags: z.array(shortText(60)).max(60),
  /** Collection ids. */
  collections: z.array(z.string().max(64)).max(200),
  notes: shortText(20000),
  sourceUrl: shortText(2000).nullable(),
  sourceName: shortText(300).nullable(),
  author: shortText(300).nullable(),
  isFavorite: z.boolean(),
  /** True for the demo recipes Walla adds; they can be removed in one go. */
  isSample: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const collectionSchema = z.object({
  id: z.string().min(1).max(64),
  name: shortText(120).min(1),
  description: shortText(1000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const preferencesSchema = z.object({
  customCourses: z.array(shortText(80)).max(50),
  defaultSort: z.string().max(40).optional(),
  lastBackupAt: z.string().max(40).optional()
});

export const backupSchema = z.object({
  app: z.literal('let-her-cook'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  recipes: z.array(z.unknown()),
  collections: z.array(z.unknown()),
  preferences: z.unknown().optional()
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Instruction = z.infer<typeof instructionSchema>;
export type HeroImage = z.infer<typeof heroImageSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;

export interface Backup {
  app: 'let-her-cook';
  schemaVersion: number;
  exportedAt: string;
  recipes: Recipe[];
  collections: Collection[];
  preferences: Preferences;
}

/** A recipe before it has been saved: no id or timestamps yet. */
export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export const DEFAULT_PREFERENCES: Preferences = { customCourses: [] };

export function emptyDraft(): RecipeDraft {
  return {
    title: '',
    description: '',
    heroImage: null,
    ingredients: [],
    instructions: [],
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    servings: null,
    yieldText: null,
    course: 'Other',
    cuisine: null,
    dietaryTags: [],
    customTags: [],
    collections: [],
    notes: '',
    sourceUrl: null,
    sourceName: null,
    author: null,
    isFavorite: false
  };
}

/** Effective total time: explicit total, or prep + cook when both are known. Unknown stays null. */
export function effectiveTotalMinutes(r: Pick<Recipe, 'totalTimeMinutes' | 'prepTimeMinutes' | 'cookTimeMinutes'>): number | null {
  if (r.totalTimeMinutes != null) return r.totalTimeMinutes;
  if (r.prepTimeMinutes != null && r.cookTimeMinutes != null) return r.prepTimeMinutes + r.cookTimeMinutes;
  return null;
}
