import { describe, expect, it } from 'vitest';
import { parseRecipeText, splitRecipes } from '../lib/parsing/text';
import { parseIngredientLine } from '../lib/parsing/ingredient';
import { formatQuantity, parseDurationText, parseLeadingQuantity, scaleIngredientText, detectTimerMinutes } from '../lib/parsing/quantity';
import { suggestDietary, suggestCourse, suggestCuisine } from '../lib/parsing/classify';
import { SAMPLE_RECIPE_TEXT } from '../lib/sampleRecipe';

describe('Case A — clean recipe text', () => {
  const r = parseRecipeText(SAMPLE_RECIPE_TEXT);
  it('finds title, times, servings', () => {
    expect(r.draft.title).toBe('Sheet-Pan Lemon Herb Chicken');
    expect(r.draft.servings).toBe(4);
    expect(r.draft.prepTimeMinutes).toBe(15);
    expect(r.draft.cookTimeMinutes).toBe(40);
    expect(r.draft.totalTimeMinutes).toBeNull(); // not given → unknown, not invented
  });
  it('structures ingredients and steps', () => {
    expect(r.draft.ingredients).toHaveLength(9);
    expect(r.draft.ingredients[1]).toMatchObject({ quantity: 1.5, unit: 'lb', name: 'baby potatoes', note: 'halved' });
    expect(r.draft.instructions).toHaveLength(5);
    expect(r.draft.instructions[3].timerMinutes).toBe(40);
    expect(r.draft.notes).toMatch(/Boneless thighs/);
  });
  it('is high confidence with no leftovers', () => {
    expect(r.confidence).toBe('high');
    expect(r.unclassified).toBe('');
    expect(r.draft.course).toBe('Dinner');
  });
});

const MESSY = `Skip to content
The Cozy Kitchen
Home Recipes About
This is honestly the best soup I have ever made. My kids ask for it every week, and it freezes beautifully.
Advertisement
Jump to Recipe
★★★★★ 4.9 from 212 votes
Creamy Tomato Soup
Prep Time
10
minutes
Cook Time
30
minutes
Servings 6 people
Ingredients
▢ 2 tablespoons butter
▢ 1 yellow onion, diced
▢ 2 (28 oz) cans whole tomatoes
▢ 2 cups vegetable broth
▢ ½ cup heavy cream
Instructions
Melt the butter in a large pot over medium heat. Add the onion and cook until soft, about 8 minutes.
Add the tomatoes and broth. Simmer for 20 minutes.
Blend until smooth, then stir in the cream.
Nutrition
Calories: 180kcal
Comments
Jane says: Loved it!`;

describe('Case B — messy web page copy', () => {
  const r = parseRecipeText(MESSY);
  it('extracts the recipe from the clutter', () => {
    expect(r.draft.title).toBe('Creamy Tomato Soup');
    expect(r.draft.prepTimeMinutes).toBe(10);
    expect(r.draft.cookTimeMinutes).toBe(30);
    expect(r.draft.servings).toBe(6);
    expect(r.draft.ingredients.map((i) => i.raw)).toEqual([
      '2 tablespoons butter',
      '1 yellow onion, diced',
      '2 (28 oz) cans whole tomatoes',
      '2 cups vegetable broth',
      '½ cup heavy cream'
    ]);
    expect(r.draft.instructions).toHaveLength(3);
  });
  it('keeps uncertain text for review instead of discarding it, and drops comments/ads', () => {
    expect(r.unclassified).toMatch(/best soup I have ever made/);
    expect(r.unclassified).toMatch(/Calories: 180kcal/);
    expect(r.unclassified).not.toMatch(/Advertisement|Jump to Recipe|Loved it/);
    expect(r.warnings.some((w) => /Leftover text/.test(w.message))).toBe(true);
  });
  it('suggests vegetarian from clear evidence (vegetable broth, no meat)', () => {
    expect(r.draft.dietaryTags).toEqual(['Vegetarian']);
  });
});

describe('Case C/D — OCR-style text (screenshots, handwriting)', () => {
  const OCR = `Nana's Shortbread
3/4 cup butter, softened
1/4 cup sugar
2 cups flour
pinch of salt
Cream butter and sugar. Mix in flour and salt.
Press into a pan and bake at 325°F for 20-25 minutes.`;
  it('builds an editable draft from noisy recognised text', () => {
    const r = parseRecipeText(OCR);
    expect(r.draft.title).toBe("Nana's Shortbread");
    expect(r.draft.ingredients).toHaveLength(4);
    expect(r.draft.instructions.length).toBeGreaterThanOrEqual(1);
    expect(r.draft.instructions.at(-1)!.text).toMatch(/325°F/);
    expect(r.draft.course).toBe('Other'); // no strong signal → not guessed as dessert
  });
});

describe('Case E — missing quantities', () => {
  it('keeps ingredients without inventing amounts', () => {
    const r = parseRecipeText(`Garden Salad\nIngredients\n- lettuce\n- a handful of cherry tomatoes\n- olive oil\n- salt and pepper to taste\nInstructions\nToss everything together and serve.`);
    expect(r.draft.ingredients).toHaveLength(4);
    for (const i of r.draft.ingredients) {
      expect(i.quantity).toBeNull();
      expect(i.unit).toBeNull();
    }
    expect(r.draft.servings).toBeNull();
    expect(r.draft.prepTimeMinutes).toBeNull();
  });
});

describe('Case I — long recipe', () => {
  it('preserves every ingredient and step', () => {
    const ings = Array.from({ length: 80 }, (_, i) => `- ${i + 1} g ingredient number ${i + 1}`).join('\n');
    const steps = Array.from({ length: 40 }, (_, i) => `${i + 1}. Do step number ${i + 1} carefully, then continue.`).join('\n');
    const r = parseRecipeText(`Huge Feast\nIngredients\n${ings}\nInstructions\n${steps}`);
    expect(r.draft.ingredients).toHaveLength(80);
    expect(r.draft.instructions).toHaveLength(40);
    expect(r.draft.instructions[39].text).toBe('Do step number 40 carefully, then continue.');
  });
});

describe('Case J — special formatting', () => {
  it('handles fractions, unicode, ranges, apostrophes and temperatures without corrupting them', () => {
    const r = parseRecipeText(`Crème Brûlée for Two
Ingredients
1 ½ cups heavy cream
⅓ cup sugar, divided
2–3 egg yolks
1⁄2 tsp vanilla
For the topping:
2 tbsp turbinado sugar
Method
1. Heat oven to 325°F (160°C).
2. Whisk yolks with ⅓ cup sugar; don't let it curdle.
3. Bake in a water bath 35-40 minutes.`);
    const [cream, sugar, yolks, vanilla, top] = r.draft.ingredients;
    expect(cream).toMatchObject({ quantity: 1.5, unit: 'cup' });
    expect(sugar).toMatchObject({ unit: 'cup', name: 'sugar', note: 'divided' });
    expect(sugar.quantity).toBeCloseTo(1 / 3);
    expect(yolks).toMatchObject({ quantity: 2, quantityMax: 3 });
    expect(vanilla).toMatchObject({ quantity: 0.5, unit: 'tsp' });
    expect(top.group).toBe('For the topping');
    expect(r.draft.instructions[0].text).toBe('Heat oven to 325°F (160°C).');
    expect(r.draft.instructions[1].text).toContain("don't");
    expect(r.draft.instructions[2].timerMinutes).toBe(35);
    expect(r.draft.title).toBe('Crème Brûlée for Two');
  });
  it('joins wrapped ingredient lines', () => {
    const r = parseRecipeText(`Bread\nIngredients\n2 cups flour,\nsifted\n1 tsp salt\nInstructions\nMix and bake.`);
    expect(r.draft.ingredients.map((i) => i.raw)).toEqual(['2 cups flour, sifted', '1 tsp salt']);
  });
});

describe('Recipes without headers and social captions', () => {
  it('finds the ingredient run and the steps', () => {
    const r = parseRecipeText(`Mom's Banana Bread\n3 ripe bananas, mashed\n1/3 cup melted butter\n3/4 cup sugar\n1 egg, beaten\n1 tsp baking soda\n1 1/2 cups flour\nPreheat oven to 350°F. Mix butter into bananas.\nStir in the rest and bake for 60 minutes.`);
    expect(r.draft.title).toBe("Mom's Banana Bread");
    expect(r.draft.ingredients).toHaveLength(6);
    expect(r.draft.instructions).toHaveLength(2);
    expect(r.draft.course).toBe('Baking');
  });
  it('reads an inline caption ingredient list', () => {
    const r = parseRecipeText(`Easy pesto pasta 🌿\nIngredients: pasta, basil, parmesan, pine nuts, garlic, olive oil\nMethod: Blend everything but the pasta. Toss with hot pasta.`);
    expect(r.draft.ingredients.map((i) => i.name)).toEqual(['pasta', 'basil', 'parmesan', 'pine nuts', 'garlic', 'olive oil']);
    expect(r.draft.instructions.length).toBeGreaterThan(0);
  });
});

describe('splitRecipes', () => {
  it('splits a document holding two recipes and keeps each title', () => {
    const parts = splitRecipes(`Pancakes\nIngredients\n1 cup flour\n1 egg\nInstructions\nMix and fry.\n\nLemonade\nIngredients\n4 lemons\n1 cup sugar\nInstructions\nStir with water.`);
    expect(parts).toHaveLength(2);
    expect(parseRecipeText(parts[1]).draft.title).toBe('Lemonade');
  });
  it('does not split on "Ingredients for the dressing"', () => {
    expect(splitRecipes(`Salad\nIngredients\n1 lettuce\nIngredients for the dressing\n2 tbsp oil\nInstructions\nToss.`)).toHaveLength(1);
  });
});

describe('quantities and scaling', () => {
  it('parses quantities', () => {
    expect(parseLeadingQuantity('1 1/2 cups')?.quantity).toBe(1.5);
    expect(parseLeadingQuantity('1½ cups')?.quantity).toBe(1.5);
    expect(parseLeadingQuantity('¾ cup')?.quantity).toBe(0.75);
    expect(parseLeadingQuantity('2-3 cloves')).toMatchObject({ quantity: 2, quantityMax: 3 });
    expect(parseLeadingQuantity('salt')).toBeNull();
  });
  it('formats nicely', () => {
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(0.3333)).toBe('⅓');
    expect(formatQuantity(4)).toBe('4');
    expect(formatQuantity(2.4)).toBe('2.4');
  });
  it('Case M — scales from the original every time, never compounding', () => {
    const raw = '1 1/2 cups flour';
    const original = 4;
    let shown = '';
    for (const servings of [8, 2, 6, 1, 12, 4, 3, 4]) shown = scaleIngredientText(raw, servings / original).text;
    expect(shown).toBe(raw); // back at the original servings → original text exactly
    expect(scaleIngredientText(raw, 2).text).toBe('3 cups flour');
    expect(scaleIngredientText(raw, 0.5).text).toBe('¾ cup flour');
    expect(scaleIngredientText('2-3 cloves garlic', 2).text).toBe('4–6 cloves garlic');
    expect(scaleIngredientText('salt to taste', 3)).toEqual({ text: 'salt to taste', scaled: false });
    expect(scaleIngredientText('1 (14 oz) can tomatoes', 2).text).toBe('2 (14 oz) cans tomatoes');
  });
  it('parses durations', () => {
    expect(parseDurationText('PT1H30M')).toBe(90);
    expect(parseDurationText('1 hr 15 mins')).toBe(75);
    expect(parseDurationText('1½ hours')).toBe(90);
    expect(parseDurationText('45 minutes')).toBe(45);
    expect(parseDurationText('about forever')).toBeNull();
    expect(detectTimerMinutes('Bake at 350°F for 25 minutes.')).toBe(25);
    expect(detectTimerMinutes('Bake at 350 degrees until golden.')).toBeNull();
  });
  it('parses ingredient lines', () => {
    expect(parseIngredientLine('• 2 Tbsp. olive oil')).toMatchObject({ quantity: 2, unit: 'tbsp', name: 'olive oil' });
    expect(parseIngredientLine('1 pinch of salt')).toMatchObject({ unit: 'pinch', name: 'salt' });
    expect(parseIngredientLine('3 large eggs')).toMatchObject({ quantity: 3, unit: null, name: 'large eggs' });
  });
});

describe('classification is conservative', () => {
  it('only labels diets with clear evidence', () => {
    expect(suggestDietary(['1 lb chicken', 'salt', 'pepper'])).toEqual([]);
    expect(suggestDietary(['2 cups chicken stock', 'rice', 'peas'])).toEqual([]);
    expect(suggestDietary(['2 cups stock', 'rice', 'peas'])).toEqual([]); // ambiguous stock
    expect(suggestDietary(['1 can chickpeas', '2 tbsp tahini', '1 lemon'])).toEqual(['Vegetarian', 'Vegan']);
    expect(suggestDietary(['1 lb salmon', '1 lemon', 'dill'])).toEqual(['Pescatarian']);
    expect(suggestDietary(['1 eggplant', '2 tbsp peanut butter', 'rice'])).toEqual(['Vegetarian', 'Vegan']);
    expect(suggestDietary(['1 cup oat milk', 'oats', 'banana'])).toEqual(['Vegetarian', 'Vegan']);
    expect(suggestDietary(['flour', 'sugar'])).toEqual([]); // too little to say
  });
  it('separates course from cuisine', () => {
    expect(suggestCourse('Chicken Tikka Masala', '')).toBe('Dinner');
    expect(suggestCuisine('Chicken Tikka Masala', '')).toBe('Indian');
    expect(suggestCourse('Chocolate Chip Cookies', '')).toBe('Dessert');
    expect(suggestCuisine('Chocolate Chip Cookies', 'flour\nsugar')).toBeNull();
  });
});
