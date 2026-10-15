import { DEFAULT_COURSES } from '../../types/recipe';

/**
 * Category suggestions. These are suggestions shown on the review screen, not
 * facts. Dietary labels are only suggested when the ingredient list gives
 * clear evidence, and only for diets that can be read from ingredients
 * (vegetarian / vegan / pescatarian). Allergen-related labels like
 * "Gluten-Free" or "Nut-Free" are never auto-assigned — packaged ingredients
 * can contain hidden allergens, so that's the cook's call.
 */

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`, 'i').test(text));

const COURSE_RULES: [string, string[]][] = [
  ['Drink', ['smoothie', 'cocktail', 'lemonade', 'latte', 'margarita', 'mocktail', 'spritz', 'sangria', 'punch', 'iced tea', 'hot chocolate', 'milkshake', 'chai']],
  ['Sauce & Condiment', ['sauce', 'dressing', 'vinaigrette', 'pesto', 'aioli', 'mayonnaise', 'chutney', 'jam', 'relish', 'salsa verde', 'gravy', 'marinade', 'spice rub', 'compound butter', 'pickle', 'hot sauce']],
  ['Dessert', ['cake', 'cookie', 'brownie', 'blondie', 'pie', 'tart', 'pudding', 'ice cream', 'sorbet', 'cheesecake', 'cupcake', 'fudge', 'mousse', 'crumble', 'cobbler', 'tiramisu', 'pavlova', 'truffle', 'macaron', 'frosting', 'custard', 'panna cotta', 'dessert']],
  ['Baking', ['bread', 'loaf', 'muffin', 'scone', 'biscuit', 'focaccia', 'sourdough', 'bagel', 'brioche', 'rolls', 'buns', 'croissant', 'pretzel', 'baguette']],
  ['Breakfast', ['pancake', 'waffle', 'oatmeal', 'porridge', 'granola', 'omelet', 'omelette', 'frittata', 'french toast', 'breakfast', 'scrambled eggs', 'overnight oats', 'hash brown']],
  ['Brunch', ['brunch', 'eggs benedict', 'shakshuka', 'quiche', 'strata']],
  ['Appetizer', ['dip', 'crostini', 'bruschetta', 'appetizer', 'canapé', 'canape', 'deviled eggs', 'spring rolls', 'dumpling', 'bites', 'hummus', 'guacamole', 'nachos']],
  ['Snack', ['snack', 'energy balls', 'trail mix', 'popcorn', 'roasted nuts', 'chips']],
  ['Side Dish', ['side', 'slaw', 'roasted vegetables', 'mashed potatoes', 'rice pilaf', 'roasted carrots', 'green beans', 'coleslaw', 'potato salad']],
  ['Lunch', ['sandwich', 'wrap', 'panini', 'lunch', 'grain bowl', 'toastie']],
  ['Dinner', ['chicken', 'beef', 'pork', 'lamb', 'salmon', 'shrimp', 'pasta', 'spaghetti', 'lasagna', 'curry', 'stew', 'chili', 'taco', 'enchilada', 'risotto', 'roast', 'steak', 'casserole', 'stir-fry', 'stir fry', 'meatball', 'burger', 'noodle', 'soup', 'tofu', 'fish', 'pizza', 'gnocchi', 'dinner']]
];

/** Title words count much more than ingredients: "Banana Bread" is Baking even though it has bananas. */
export function suggestCourse(title: string, ingredientText: string, hint?: string | null): string {
  const fromHint = matchCourseName(hint);
  if (fromHint) return fromHint;
  for (const [course, words] of COURSE_RULES) if (has(title, words)) return course;
  // Weak signal from ingredients: proteins → Dinner.
  if (has(ingredientText, ['chicken', 'beef', 'pork', 'lamb', 'salmon', 'shrimp', 'sausage', 'ground turkey'])) return 'Dinner';
  return 'Other';
}

export function matchCourseName(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  for (const c of DEFAULT_COURSES) if (h.includes(c.toLowerCase())) return c;
  if (/main|entr[ée]e|supper/.test(h)) return 'Dinner';
  if (/starter|appeti|hors/.test(h)) return 'Appetizer';
  if (/side/.test(h)) return 'Side Dish';
  if (/beverage|drink|cocktail/.test(h)) return 'Drink';
  if (/sauce|condiment|dressing/.test(h)) return 'Sauce & Condiment';
  if (/bread|baking|baked goods/.test(h)) return 'Baking';
  if (/dessert|sweet/.test(h)) return 'Dessert';
  return null;
}

const CUISINE_RULES: [string, string[], string[]][] = [
  // [cuisine, strong title words, ingredient signals]
  ['Italian', ['italian', 'pasta', 'risotto', 'lasagna', 'gnocchi', 'carbonara', 'bolognese', 'focaccia', 'tiramisu', 'cacio', 'piccata', 'marsala', 'osso buco', 'arancini', 'minestrone'], ['parmigiano', 'parmesan', 'pecorino', 'pancetta', 'prosciutto', 'mozzarella', 'basil', 'arborio', 'ricotta']],
  ['Mexican', ['mexican', 'taco', 'enchilada', 'quesadilla', 'burrito', 'tamale', 'pozole', 'mole', 'carnitas', 'elote', 'chilaquiles', 'tostada', 'fajita'], ['tortilla', 'chipotle', 'jalapeño', 'jalapeno', 'cotija', 'masa', 'poblano', 'cilantro']],
  ['Thai', ['thai', 'pad thai', 'tom yum', 'tom kha', 'larb', 'massaman', 'panang', 'pad see ew'], ['fish sauce', 'lemongrass', 'galangal', 'kaffir', 'makrut', 'thai basil', 'palm sugar']],
  ['Indian', ['indian', 'tikka', 'masala', 'dal', 'dhal', 'biryani', 'korma', 'vindaloo', 'paneer', 'saag', 'samosa', 'naan', 'chana', 'aloo'], ['garam masala', 'turmeric', 'cumin seeds', 'ghee', 'cardamom', 'fenugreek', 'curry leaves', 'asafoetida']],
  ['Japanese', ['japanese', 'ramen', 'teriyaki', 'miso', 'sushi', 'katsu', 'udon', 'soba', 'tempura', 'yakitori', 'okonomiyaki', 'onigiri'], ['mirin', 'dashi', 'miso', 'sake', 'nori', 'bonito', 'panko']],
  ['Chinese', ['chinese', 'kung pao', 'mapo', 'chow mein', 'lo mein', 'dumpling', 'bao', 'char siu', 'fried rice', 'wonton', 'dan dan'], ['hoisin', 'shaoxing', 'five-spice', 'five spice', 'oyster sauce', 'sichuan', 'doubanjiang', 'black bean sauce']],
  ['Korean', ['korean', 'bibimbap', 'bulgogi', 'kimchi', 'japchae', 'tteokbokki', 'galbi'], ['gochujang', 'gochugaru', 'kimchi']],
  ['Vietnamese', ['vietnamese', 'pho', 'banh mi', 'bún', 'bun cha'], ['rice paper', 'nuoc cham']],
  ['French', ['french', 'gratin', 'ratatouille', 'bourguignon', 'coq au vin', 'quiche', 'soufflé', 'souffle', 'crêpe', 'crepe', 'niçoise', 'nicoise', 'tarte', 'confit', 'cassoulet', 'béarnaise', 'madeleine'], ['gruyère', 'gruyere', 'herbes de provence', 'crème fraîche', 'creme fraiche', 'shallot', 'tarragon']],
  ['Greek', ['greek', 'moussaka', 'souvlaki', 'spanakopita', 'tzatziki', 'gyro', 'avgolemono'], ['feta', 'kalamata', 'phyllo', 'filo']],
  ['Middle Eastern', ['shawarma', 'falafel', 'hummus', 'tabbouleh', 'fattoush', 'shakshuka', 'baba ganoush', 'kofta', 'middle eastern', 'lebanese', 'persian'], ["za'atar", 'zaatar', 'sumac', 'tahini', 'pomegranate molasses', 'harissa']],
  ['Spanish', ['spanish', 'paella', 'tapas', 'gazpacho', 'patatas bravas', 'churros', 'tortilla española'], ['chorizo', 'saffron', 'manchego', 'smoked paprika']],
  ['American', ['american', 'mac and cheese', 'burger', 'meatloaf', 'pot roast', 'buffalo', 'sloppy joe', 'cornbread', 'clam chowder', 'barbecue', 'bbq', 'biscuits and gravy', 'pot pie'], []],
  ['Caribbean', ['jerk', 'caribbean', 'jamaican', 'oxtail', 'plantain'], ['scotch bonnet', 'allspice']]
];

/** Suggests a cuisine only with a clear signal: a telling title word, or several ingredient signals. */
export function suggestCuisine(title: string, ingredientText: string, hint?: string | null): string | null {
  if (hint && hint.trim()) return hint.trim().split(/[,;]/)[0].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  for (const [cuisine, titleWords] of CUISINE_RULES) if (has(title, titleWords)) return cuisine;
  let best: { cuisine: string; score: number } | null = null;
  for (const [cuisine, , ingredientWords] of CUISINE_RULES) {
    const score = ingredientWords.filter((w) => new RegExp(`\\b${w}`, 'i').test(ingredientText)).length;
    if (score >= 2 && (!best || score > best.score)) best = { cuisine, score };
  }
  return best?.cuisine ?? null;
}

const MEAT = ['chicken', 'beef', 'pork', 'lamb', 'veal', 'bacon', 'ham', 'sausage', 'chorizo', 'pancetta', 'prosciutto', 'salami', 'pepperoni', 'turkey', 'duck', 'venison', 'goat meat', 'mutton', 'meat', 'steak', 'brisket', 'mince', 'ground beef', 'lard', 'gelatin', 'gelatine', 'bone broth', 'oxtail', 'guanciale', 'speck', 'liver'];
const SEAFOOD = ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'anchov', 'sardine', 'mackerel', 'trout', 'squid', 'calamari', 'octopus', 'fish sauce', 'worcestershire', 'bonito', 'dashi', 'caesar dressing'];
const ANIMAL_PRODUCTS = ['egg', 'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'honey', 'ghee', 'mayonnaise', 'mayo', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'buttermilk', 'custard', 'whey', 'paneer', 'crème', 'creme'];
const PLANT_QUALIFIERS = /\b(vegan|plant[- ]based|dairy[- ]free|non[- ]dairy|oat|almond|soy|coconut|cashew|rice|veggie|vegetable|flax|chia)\s+(milk|butter|cheese|cream|yogh?urt|mayo(nnaise)?|egg)/i;
// Ambiguous items we can't judge without knowing the product, e.g. "stock".
const AMBIGUOUS = /\b(stock|broth|bouillon)\b(?!.*\b(vegetable|veggie|mushroom|vegan)\b)/i;

/** Returns diet labels clearly supported by the ingredient list. Needs ≥3 ingredients to say anything. */
export function suggestDietary(ingredientLines: string[]): string[] {
  if (ingredientLines.length < 3) return [];
  const lines = ingredientLines.map((l) => l.toLowerCase());
  const veggieStock = (l: string) => /\b(vegetable|veggie|mushroom|vegan)\s+(stock|broth|bouillon)/.test(l);
  const hasMeat = lines.some((l) => has(l, MEAT) && !/\b(vegan|plant[- ]based|meatless|veggie)\b/.test(l) && !veggieStock(l));
  const hasSeafood = lines.some((l) => has(l, SEAFOOD) && !/\b(vegan|vegetarian)\b/.test(l));
  const ambiguous = lines.some((l) => AMBIGUOUS.test(l) && !veggieStock(l));
  if (hasMeat || ambiguous) return [];
  if (hasSeafood) return ['Pescatarian'];
  const animal = lines.some((l) => has(l, ANIMAL_PRODUCTS) && !PLANT_QUALIFIERS.test(l) && !/\beggplant\b/.test(l) && !/\bcream of tartar\b/.test(l) && !/\bpeanut butter|almond butter|nut butter|cocoa butter|apple butter|coconut cream|coconut milk\b/.test(l));
  return animal ? ['Vegetarian'] : ['Vegetarian', 'Vegan'];
}
