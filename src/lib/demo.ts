import type { RecipeDraft } from '../types/recipe';
import { parseRecipeText } from './parsing/text';
import type { RecipeRepository } from './storage/repository';

/**
 * Walla's sample recipes for the demo. They're added only when someone taps
 * "Try sample recipes", are flagged `isSample`, and can all be removed in one
 * go. Photos are free-to-use Unsplash images, linked and credited — they show
 * dishes like these, not these exact recipes, and are labelled as samples.
 */

interface Sample {
  id: string;
  text: string;
  course: string;
  cuisine?: string;
  dietary?: string[];
  tags: string[];
  photo: { base: string; credit: string; alt: string };
  favorite?: boolean;
}

const SAMPLES: Sample[] = [
  {
    id: 'sample-sheet-pan-chicken',
    course: 'Dinner',
    cuisine: 'Mediterranean',
    tags: ['Weeknight', 'Kid-Friendly', 'One-Pan'],
    favorite: true,
    photo: { base: 'https://images.unsplash.com/photo-1708782342502-0ae2053682c2', credit: 'Rimsha Noor', alt: 'Roasted chicken with potatoes and parsley' },
    text: `Sheet-Pan Lemon Herb Chicken & Potatoes
Crispy-skinned chicken and golden potatoes on one pan. Ten minutes of work, one pan to wash, and the whole family eats.
Serves 4 | Prep: 10 min | Cook: 40 min
Ingredients
8 bone-in, skin-on chicken thighs
1 1/2 lb baby potatoes, halved
3 tbsp olive oil
4 cloves garlic, smashed
1 lemon, thinly sliced
2 tsp dried oregano
1 tsp smoked paprika
1 1/2 tsp kosher salt
1/2 tsp black pepper
Fresh parsley, for serving
Instructions
1. Heat the oven to 425°F (220°C).
2. Toss the potatoes with 1 tbsp of the oil and half the salt on a large sheet pan.
3. Rub the chicken with the rest of the oil, garlic, oregano, paprika, salt and pepper. Nestle it among the potatoes, skin side up, and tuck the lemon slices around.
4. Roast for 40 minutes, until the skin is crisp and the potatoes are golden.
5. Scatter with parsley and serve straight from the pan.
Notes
Kid tip: let little ones squeeze the roasted lemon over everything — it's their favorite job.`
  },
  {
    id: 'sample-tomato-pasta',
    course: 'Dinner',
    cuisine: 'Italian',
    dietary: ['Vegetarian'],
    tags: ['Quick & Easy', 'Kid-Friendly', 'Pantry'],
    photo: { base: 'https://images.unsplash.com/photo-1709201417401-5c72ed84f191', credit: 'Zoshua Colah', alt: 'Creamy pink tomato pasta on a white plate' },
    text: `Creamy Tomato Rosé Pasta
Silky, blush-pink tomato pasta from pantry staples. Ready before anyone asks "what's for dinner?" twice.
Serves 4 | Prep: 5 min | Cook: 20 min
Ingredients
12 oz rigatoni or penne
2 tbsp butter
1 small onion, finely chopped
3 cloves garlic, minced
3 tbsp tomato paste
1 (14 oz) can crushed tomatoes
3/4 cup heavy cream
1/2 cup grated Parmesan, plus more for serving
1/2 tsp red pepper flakes (optional)
Salt, to taste
Fresh basil, to serve
Instructions
1. Cook the pasta in well-salted water until al dente. Save 1 cup of the pasta water, then drain.
2. Meanwhile, melt the butter in a large skillet over medium heat. Add the onion and cook for 5 minutes, until soft.
3. Stir in the garlic and tomato paste and cook for 2 minutes, until the paste darkens.
4. Add the crushed tomatoes and simmer for 8 minutes. Stir in the cream and Parmesan.
5. Toss in the pasta with a splash of pasta water until glossy. Season, top with basil and more Parmesan.
Notes
Skip the pepper flakes for little ones and pass them at the table instead.`
  },
  {
    id: 'sample-ricotta-pancakes',
    course: 'Breakfast',
    dietary: ['Vegetarian'],
    tags: ['Weekend', 'Kid-Friendly'],
    favorite: true,
    photo: { base: 'https://images.unsplash.com/photo-1612182062633-9ff3b3598e96', credit: 'Jaqueline Pelzer', alt: 'Stack of pancakes with berries' },
    text: `Fluffy Lemon Ricotta Pancakes
Cloud-soft Saturday pancakes with a little lemon sunshine. Worth getting out of bed for.
Makes 12 pancakes | Prep: 10 min | Cook: 15 min
Ingredients
1 1/2 cups all-purpose flour
2 tbsp sugar
2 tsp baking powder
1/2 tsp salt
1 cup ricotta
3/4 cup milk
2 large eggs
1 lemon, zested and juiced
2 tbsp melted butter, plus more for the pan
Fresh berries and maple syrup, to serve
Instructions
1. Whisk the flour, sugar, baking powder and salt in a large bowl.
2. In another bowl, whisk the ricotta, milk, eggs, lemon zest, lemon juice and melted butter until smooth.
3. Fold the wet ingredients into the dry until just combined — a few lumps are fine.
4. Heat a buttered skillet over medium-low heat. Cook 1/4 cup of batter at a time for 2 minutes, until bubbles appear, then flip and cook 1 minute more.
5. Serve warm with berries and maple syrup.
Notes
Keep finished pancakes warm on a tray in a 200°F oven while you cook the rest.`
  },
  {
    id: 'sample-brown-butter-cookies',
    course: 'Dessert',
    dietary: ['Vegetarian'],
    tags: ['Baking', 'Bake Sale', 'Family Favorite'],
    favorite: true,
    photo: { base: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e', credit: 'Jennifer Pallian', alt: 'Chocolate chip cookies with melty chocolate' },
    text: `Brown Butter Chocolate Chip Cookies
Toffee-ish brown butter, crisp edges, gooey middles and puddles of chocolate. The bake sale table never stood a chance.
Makes 24 cookies | Prep: 20 min | Cook: 11 min
Ingredients
1 cup unsalted butter
1 cup packed brown sugar
1/2 cup sugar
2 large eggs
2 tsp vanilla extract
2 1/4 cups all-purpose flour
1 tsp baking soda
1 tsp salt
2 cups chocolate chips or chopped chocolate
Flaky salt, for topping
Instructions
1. Melt the butter in a light-colored pan over medium heat, swirling, until it smells nutty and turns golden brown, about 5 minutes. Pour into a large bowl and cool for 10 minutes.
2. Whisk both sugars into the butter, then the eggs and vanilla until glossy.
3. Stir in the flour, baking soda and salt, then fold in the chocolate.
4. Heat the oven to 350°F (175°C). Scoop 2-tablespoon balls onto lined baking sheets, 2 inches apart.
5. Bake for 11 minutes, until the edges are golden but the centers look soft. Sprinkle with flaky salt and cool on the sheet for 5 minutes.
Notes
Chill the dough for 30 minutes (or up to 2 days) for thicker, chewier cookies.`
  },
  {
    id: 'sample-honey-garlic-salmon',
    course: 'Dinner',
    dietary: ['Pescatarian', 'High-Protein'],
    tags: ['Quick & Easy', 'Weeknight'],
    photo: { base: 'https://images.unsplash.com/photo-1712334562767-5d366d0c40d9', credit: 'Sara Nichols', alt: 'Cooked salmon fillet dinner plate' },
    text: `Honey Garlic Salmon with Rice
Sticky, sweet-savory glazed salmon that even the fish skeptics come back for. Twenty minutes, start to finish.
Serves 4 | Prep: 5 min | Cook: 15 min
Ingredients
4 salmon fillets (about 6 oz each)
Salt and pepper
1 tbsp olive oil
3 tbsp honey
3 tbsp soy sauce
3 cloves garlic, minced
1 tsp grated ginger
1 tbsp lemon juice
3 cups cooked rice
1 cup steamed broccoli or green beans
Sesame seeds and sliced green onion, to serve
Instructions
1. Pat the salmon dry and season with salt and pepper.
2. Heat the oil in a large nonstick skillet over medium-high heat. Cook the salmon skin side up for 4 minutes, then flip.
3. Whisk the honey, soy sauce, garlic, ginger and lemon juice. Pour it into the pan and simmer for 3 minutes, spooning the glaze over the salmon until sticky.
4. Serve over rice with the greens, spooning over any extra glaze. Top with sesame seeds and green onion.
Notes
Leftovers flake beautifully into next-day rice bowls for lunch.`
  },
  {
    id: 'sample-peach-burrata-salad',
    course: 'Side Dish',
    cuisine: 'Italian',
    dietary: ['Vegetarian'],
    tags: ['Summer', 'Dinner Party', 'No-Cook'],
    photo: { base: 'https://images.unsplash.com/photo-1606850246029-dd00bd5eff97', credit: 'Max Griss', alt: 'Burrata with sliced peaches and figs on a white plate' },
    text: `Peach & Burrata Summer Salad
Juicy peaches, creamy burrata and a drizzle of honey. No stove, no stress, total showstopper.
Serves 4 | Prep: 10 min
Ingredients
3 ripe peaches, sliced
4 fresh figs, quartered (optional)
1 large ball burrata (8 oz)
2 tbsp extra-virgin olive oil
1 tbsp honey
1 tbsp balsamic glaze
Small handful of fresh basil or mint
Flaky salt and cracked black pepper
Instructions
1. Arrange the peaches and figs on a platter.
2. Tear the burrata open in the middle of the platter.
3. Drizzle everything with olive oil, honey and balsamic glaze.
4. Scatter with basil, flaky salt and pepper. Serve right away with crusty bread.
Notes
Swap in nectarines or ripe tomatoes when peaches aren't in season.`
  },
  {
    id: 'sample-tortilla-soup',
    course: 'Dinner',
    cuisine: 'Mexican',
    tags: ['Make-Ahead', 'Freezer-Friendly', 'Comfort Food'],
    photo: { base: 'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa', credit: 'Kelsey Todd', alt: 'Bowl of red Mexican soup with avocado, cilantro and limes' },
    text: `Cozy Chicken Tortilla Soup
A big, brothy pot that's better the next day. Set out the toppings and let everyone build their own bowl.
Serves 6 | Prep: 15 min | Cook: 35 min
Ingredients
2 tbsp olive oil
1 onion, diced
1 red bell pepper, diced
3 cloves garlic, minced
2 tsp ground cumin
1 tsp chili powder
1 (14 oz) can fire-roasted tomatoes
6 cups chicken broth
1 1/2 lb boneless chicken breasts
1 (15 oz) can black beans, drained
1 cup frozen corn
1 lime, juiced
For serving:
Tortilla chips or crispy tortilla strips
Avocado, cilantro, sour cream and shredded cheese
Instructions
1. Warm the oil in a large pot over medium heat. Cook the onion and pepper for 6 minutes, until soft.
2. Add the garlic, cumin and chili powder and stir for 1 minute.
3. Add the tomatoes, broth and whole chicken breasts. Simmer gently for 20 minutes, until the chicken is cooked through.
4. Lift out the chicken, shred it with two forks and return it to the pot with the beans and corn. Simmer 5 minutes more.
5. Stir in the lime juice and season. Serve with the toppings.
Notes
Freezes well for up to 3 months — freeze it without the toppings.`
  },
  {
    id: 'sample-banana-oat-muffins',
    course: 'Baking',
    dietary: ['Vegetarian'],
    tags: ['Lunchbox', 'Kid-Friendly', 'Make-Ahead'],
    photo: { base: 'https://images.unsplash.com/photo-1790458820023-e395035c3fab', credit: 'Alimentos Fotogénicos', alt: 'Golden muffins on a wire cooling rack' },
    text: `Banana Oat Lunchbox Muffins
Soft, just-sweet-enough muffins that use up spotty bananas and slide right into a lunchbox.
Makes 12 muffins | Prep: 10 min | Cook: 20 min
Ingredients
3 very ripe bananas, mashed
2 large eggs
1/3 cup maple syrup
1/3 cup melted butter or coconut oil
1 tsp vanilla extract
1 1/2 cups rolled oats
3/4 cup all-purpose flour
1 tsp baking soda
1 tsp cinnamon
1/4 tsp salt
1/2 cup mini chocolate chips or blueberries (optional)
Instructions
1. Heat the oven to 350°F (175°C) and line a 12-cup muffin tin.
2. Whisk the bananas, eggs, maple syrup, butter and vanilla in a large bowl.
3. Stir in the oats, flour, baking soda, cinnamon and salt until just combined. Fold in the chocolate chips or blueberries.
4. Divide between the cups and bake for 20 minutes, until a toothpick comes out clean.
5. Cool in the tin for 5 minutes, then on a rack.
Notes
Freeze in a bag and drop a frozen muffin in the lunchbox — it thaws by snack time.`
  },
  {
    id: 'sample-chili-oil-noodles',
    course: 'Lunch',
    cuisine: 'Chinese',
    dietary: ['Vegetarian', 'Vegan'],
    tags: ['Quick & Easy', 'Spicy', 'Pantry'],
    photo: { base: 'https://images.unsplash.com/photo-1789999964582-b1c9b78c8488', credit: 'Zoshua Colah', alt: 'Noodles in glossy red chili oil' },
    text: `15-Minute Chili Oil Noodles
Slurpy, garlicky, a little fiery. The grown-ups' lunch for when everyone else is at school.
Serves 2 | Prep: 5 min | Cook: 10 min
Ingredients
8 oz wheat noodles
3 cloves garlic, finely grated
2 green onions, thinly sliced
1 tbsp chili flakes
1 tsp sesame seeds
3 tbsp neutral oil
2 tbsp soy sauce
1 tbsp black vinegar or rice vinegar
1 tsp sugar
1 tsp toasted sesame oil
Instructions
1. Cook the noodles according to the package, then drain and divide between two bowls.
2. Pile the garlic, green onion whites, chili flakes and sesame seeds on top of the noodles.
3. Heat the oil until shimmering, then carefully pour it over the aromatics — it should sizzle.
4. Add the soy sauce, vinegar, sugar and sesame oil. Toss well and top with the green onion tops.
Notes
Add a fried egg or some crispy tofu to make it a full meal.`
  },
  {
    id: 'sample-mango-smoothie',
    course: 'Drink',
    dietary: ['Vegetarian'],
    tags: ['Kid-Friendly', 'Quick & Easy', 'After School'],
    photo: { base: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4', credit: 'Julia Zyablova', alt: 'Glass of mango smoothie next to a mango' },
    text: `Mango Sunshine Smoothie
Tastes like a vacation, sneaks in some goodness. The after-school crowd pleaser.
Serves 2 | Prep: 5 min
Ingredients
2 cups frozen mango chunks
1 ripe banana
1 cup orange juice
1/2 cup plain Greek yogurt
1 tbsp honey (optional)
A squeeze of lime
Instructions
1. Add everything to a blender.
2. Blend until completely smooth, adding a splash more juice if it's too thick.
3. Pour into glasses and serve right away.
Notes
Pour leftovers into popsicle molds for a frozen treat tomorrow.`
  },
  {
    id: 'sample-turkey-tacos',
    course: 'Dinner',
    cuisine: 'Mexican',
    tags: ['Taco Tuesday', 'Kid-Friendly', 'Quick & Easy'],
    photo: { base: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f', credit: 'Jeswin Thomas', alt: 'Three tacos topped with onion and cilantro' },
    text: `Weeknight Turkey Tacos
Taco night in 20 minutes with a homemade seasoning you'll keep on hand forever.
Serves 4 | Prep: 10 min | Cook: 12 min
Ingredients
1 tbsp olive oil
1 lb ground turkey
1/2 onion, finely diced
2 tsp chili powder
1 tsp ground cumin
1 tsp smoked paprika
1/2 tsp garlic powder
1/2 tsp salt
1/3 cup tomato sauce
8 small tortillas, warmed
Toppings: diced onion, cilantro, avocado, cheese and lime wedges
Instructions
1. Heat the oil in a large skillet over medium-high heat. Add the turkey and onion and cook for 6 minutes, breaking it up, until browned.
2. Stir in the chili powder, cumin, paprika, garlic powder and salt for 1 minute.
3. Add the tomato sauce and a splash of water and simmer for 3 minutes, until saucy.
4. Spoon into warm tortillas and let everyone top their own.
Notes
Make a triple batch of the spice mix and keep it in a jar for next time.`
  },
  {
    id: 'sample-egg-muffins',
    course: 'Breakfast',
    dietary: ['Vegetarian', 'High-Protein'],
    tags: ['Make-Ahead', 'Meal Prep', 'Lunchbox'],
    photo: { base: 'https://images.unsplash.com/photo-1642463045543-55998f3174fc', credit: 'Thembi Johnson', alt: 'Mini cheese-topped egg muffins on a white plate' },
    text: `Make-Ahead Veggie Egg Muffins
Grab-and-go breakfast for busy mornings. Bake once on Sunday, eat all week.
Makes 12 egg muffins | Prep: 10 min | Cook: 22 min
Ingredients
10 large eggs
1/4 cup milk
1/2 tsp salt
1/4 tsp black pepper
1 cup baby spinach, chopped
1 red bell pepper, finely diced
1/2 cup cherry tomatoes, quartered
3/4 cup shredded cheddar
Instructions
1. Heat the oven to 350°F (175°C) and grease a 12-cup muffin tin well.
2. Whisk the eggs, milk, salt and pepper in a large jug.
3. Divide the spinach, pepper, tomatoes and half the cheese between the cups.
4. Pour in the egg mixture and top with the remaining cheese.
5. Bake for 22 minutes, until puffed and just set. Cool for 5 minutes before lifting out.
Notes
Keeps 4 days in the fridge. Reheat for 30 seconds in the microwave.`
  }
];

export const SAMPLE_COUNT = SAMPLES.length;

export function buildSampleDrafts(): RecipeDraft[] {
  return SAMPLES.map((s) => {
    const parsed = parseRecipeText(s.text).draft;
    return {
      ...parsed,
      id: s.id,
      course: s.course,
      cuisine: s.cuisine ?? null,
      dietaryTags: s.dietary ?? [],
      customTags: s.tags,
      isFavorite: Boolean(s.favorite),
      isSample: true,
      sourceName: 'Walla’s sample recipes',
      sourceUrl: null,
      heroImage: {
        src: `${s.photo.base}?auto=format&fit=crop&w=1400&q=80`,
        thumb: `${s.photo.base}?auto=format&fit=crop&w=640&q=75`,
        alt: s.photo.alt,
        credit: `${s.photo.credit} on Unsplash`,
        origin: 'remote'
      }
    };
  });
}

/** Adds the samples that aren't already in the library. Returns how many were added. */
export async function addSampleRecipes(repo: RecipeRepository): Promise<number> {
  const existing = new Set((await repo.listRecipes()).map((r) => r.id));
  let added = 0;
  // Add in reverse so the first sample is the "most recent".
  for (const draft of buildSampleDrafts().reverse()) {
    if (existing.has(draft.id!)) continue;
    await repo.createRecipe(draft);
    added++;
  }
  return added;
}

export async function removeSampleRecipes(repo: RecipeRepository): Promise<number> {
  const samples = (await repo.listRecipes()).filter((r) => r.isSample);
  for (const r of samples) await repo.deleteRecipe(r.id);
  return samples.length;
}
