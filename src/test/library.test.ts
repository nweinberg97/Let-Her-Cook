import { describe, expect, it } from 'vitest';
import { applyFilters, sortRecipes, highlightSegments, EMPTY_FILTERS } from '../lib/search';
import { finalizeRecipe } from '../lib/storage/normalize';
import { emptyDraft, type Recipe } from '../types/recipe';
import { recipeToPlainText } from '../lib/export/plainText';
import { parseRecipeText } from '../lib/parsing/text';

const mk = (title: string, o: Partial<Recipe> = {}): Recipe => ({ ...finalizeRecipe({ ...emptyDraft(), title }), ...o });

const recipes = [
  mk('Veggie Chili', { course: 'Dinner', dietaryTags: ['Vegetarian'], customTags: ['Weeknight'], totalTimeMinutes: 45, createdAt: '2026-01-03T00:00:00.000Z' }),
  mk('Steak Frites', { course: 'Dinner', cuisine: 'French', totalTimeMinutes: 25, isFavorite: true, createdAt: '2026-01-02T00:00:00.000Z' }),
  mk('Overnight Oats', { course: 'Breakfast', customTags: ['Quick & Easy'], prepTimeMinutes: 5, createdAt: '2026-01-04T00:00:00.000Z' }),
  mk('Tarte Tatin', { course: 'Dessert', cuisine: 'French', createdAt: '2026-01-01T00:00:00.000Z' })
];

describe('filters combine and clear', () => {
  it('Dinner + Vegetarian', () => {
    expect(applyFilters(recipes, [], { ...EMPTY_FILTERS, courses: ['Dinner'], dietary: ['Vegetarian'] }).map((r) => r.title)).toEqual(['Veggie Chili']);
  });
  it('Dessert + French', () => {
    expect(applyFilters(recipes, [], { ...EMPTY_FILTERS, courses: ['Dessert'], cuisines: ['french'] }).map((r) => r.title)).toEqual(['Tarte Tatin']);
  });
  it('Favorites + under 30 minutes', () => {
    expect(applyFilters(recipes, [], { ...EMPTY_FILTERS, favorites: true, maxMinutes: 30 }).map((r) => r.title)).toEqual(['Steak Frites']);
  });
  it('unknown times are excluded from time filters rather than treated as zero', () => {
    expect(applyFilters(recipes, [], { ...EMPTY_FILTERS, maxMinutes: 15 }).map((r) => r.title)).toEqual([]);
  });
  it('no filters returns everything', () => {
    expect(applyFilters(recipes, [], EMPTY_FILTERS)).toHaveLength(4);
  });
});

describe('sorting', () => {
  it('quickest/longest put unknown times last', () => {
    expect(sortRecipes(recipes, 'quickest').map((r) => r.title)).toEqual(['Steak Frites', 'Veggie Chili', 'Overnight Oats', 'Tarte Tatin']);
    expect(sortRecipes(recipes, 'longest').map((r) => r.title)).toEqual(['Veggie Chili', 'Steak Frites', 'Overnight Oats', 'Tarte Tatin']);
  });
  it('recently added and alphabetical', () => {
    expect(sortRecipes(recipes, 'added')[0].title).toBe('Overnight Oats');
    expect(sortRecipes(recipes, 'alpha')[0].title).toBe('Overnight Oats');
  });
});

describe('highlighting and plain text', () => {
  it('splits matches for <mark>', () => {
    expect(highlightSegments('Veggie Chili', 'chili')).toEqual([
      { text: 'Veggie ', match: false },
      { text: 'Chili', match: true }
    ]);
  });
  it('copies a readable recipe with scaled amounts', () => {
    const r = finalizeRecipe(parseRecipeText('Rice\nServes 2\nIngredients\n1 cup rice\nInstructions\nBoil.').draft);
    const text = recipeToPlainText(r, 4);
    expect(text).toContain('- 2 cups rice');
    expect(text).toContain('1. Boil.');
    expect(text).toContain('Serves 4');
  });
});
