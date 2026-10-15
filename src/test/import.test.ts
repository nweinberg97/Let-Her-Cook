import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractRecipesFromHtml } from '../lib/parsing/jsonld';
import { extractFromUrl, UrlImportError, validateRecipeUrl } from '../lib/extraction/url';
import { validateImportFile, FileImportError } from '../lib/files/validate';
import { localExtraction } from '../lib/extraction/local';

const PAGE = `<!doctype html><html><head>
<link rel="canonical" href="https://cooking.example.com/recipes/pad-thai">
<meta property="og:site_name" content="Example Cooking">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Example"}</script>
<script type="application/ld+json">{ this is broken json </script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"Organization","name":"Example"},
  {"@type":["Recipe","NewsArticle"],"name":"Weeknight Pad Thai","description":"Fast &amp; <b>good</b>.",
   "image":[{"@type":"ImageObject","url":"https://img.example.com/padthai.jpg"}],
   "author":[{"@type":"Person","name":"Jo Cook"}],
   "prepTime":"PT15M","cookTime":"PT10M","totalTime":"PT25M","recipeYield":["4","4 servings"],
   "recipeCuisine":"Thai","recipeCategory":"Main Course",
   "recipeIngredient":["8 oz rice noodles","2 tbsp fish sauce","2 eggs","1 cup bean sprouts"],
   "recipeInstructions":[{"@type":"HowToSection","name":"For the sauce","itemListElement":[{"@type":"HowToStep","text":"Whisk the fish sauce with sugar."}]},
     {"@type":"HowToSection","name":"Stir-fry","itemListElement":[{"@type":"HowToStep","text":"Soak the noodles for 10 minutes."},{"@type":"HowToStep","text":"Fry everything together."}]}]}
]}</script>
<script>window.evil = true</script>
</head><body><h1>Pad Thai</h1></body></html>`;

describe('JSON-LD extraction', () => {
  it('finds the Recipe among several JSON-LD blocks, @graph and broken JSON', () => {
    const { results } = extractRecipesFromHtml(PAGE, 'https://cooking.example.com/recipes/pad-thai?utm=x');
    expect(results).toHaveLength(1);
    const d = results[0].draft;
    expect(d.title).toBe('Weeknight Pad Thai');
    expect(d.description).toBe('Fast & good.');
    expect(d.prepTimeMinutes).toBe(15);
    expect(d.totalTimeMinutes).toBe(25);
    expect(d.servings).toBe(4);
    expect(d.cuisine).toBe('Thai');
    expect(d.course).toBe('Dinner');
    expect(d.author).toBe('Jo Cook');
    expect(d.sourceUrl).toBe('https://cooking.example.com/recipes/pad-thai');
    expect(d.sourceName).toBe('Example Cooking');
    expect(d.heroImage).toMatchObject({ src: 'https://img.example.com/padthai.jpg', origin: 'remote' });
    expect(d.ingredients[1]).toMatchObject({ quantity: 2, unit: 'tbsp', name: 'fish sauce' });
    expect(d.instructions.map((s) => s.group)).toEqual(['For the sauce', 'Stir-fry', 'Stir-fry']);
    expect(d.instructions[1].timerMinutes).toBe(10);
    expect(d.dietaryTags).toEqual(['Pescatarian']);
    expect((globalThis as { evil?: boolean }).evil).toBeUndefined(); // page scripts never run
  });
});

describe('Case F — unavailable URL', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('validates links', () => {
    expect(validateRecipeUrl('example.com/pie').href).toBe('https://example.com/pie');
    expect(() => validateRecipeUrl('javascript:alert(1)')).toThrow(UrlImportError);
    expect(() => validateRecipeUrl('http://localhost:3000/x')).toThrow(/private or local/);
    expect(() => validateRecipeUrl('https://user:pw@example.com')).toThrow(/password/);
  });
  it('turns a blocked request (CORS / network) into a friendly, recoverable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(extractFromUrl('https://blocked.example.com/recipe')).rejects.toMatchObject({ kind: 'blocked' });
  });
  it('reports HTTP errors and pages without recipes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })));
    await expect(extractFromUrl('https://example.com/missing')).rejects.toMatchObject({ kind: 'http' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><body><p>Just a blog post about my cat.</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    await expect(extractFromUrl('https://example.com/cat')).rejects.toMatchObject({ kind: 'not-recipe' });
  });
  it('imports a reachable page with recipe data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })));
    const [r] = await extractFromUrl('https://cooking.example.com/recipes/pad-thai');
    expect(r.draft.title).toBe('Weeknight Pad Thai');
  });
});

describe('Case H — malformed and unsupported files', () => {
  it('rejects unsupported formats with a clear message', async () => {
    await expect(validateImportFile(new File(['MZ'], 'virus.exe'))).rejects.toThrow(/isn’t a supported file/);
    await expect(validateImportFile(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }))).rejects.toThrow(/HEIC/);
    await expect(validateImportFile(new File(['x'], 'old.doc'))).rejects.toThrow(/\.doc files aren’t supported/);
  });
  it('detects a renamed file whose contents do not match', async () => {
    await expect(validateImportFile(new File(['just text'], 'photo.png', { type: 'image/png' }))).rejects.toThrow(/damaged/);
    await expect(validateImportFile(new File(['hello'], 'recipe.pdf', { type: 'application/pdf' }))).rejects.toThrow(/damaged/);
  });
  it('rejects empty and oversized files', async () => {
    await expect(validateImportFile(new File([], 'empty.txt', { type: 'text/plain' }))).rejects.toThrow(/empty/);
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.txt', { type: 'text/plain' });
    await expect(validateImportFile(big)).rejects.toBeInstanceOf(FileImportError);
  });
  it('accepts real files and imports a text file end to end', async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'a.png', { type: 'image/png' });
    expect(await validateImportFile(png)).toBe('image');
    const md = new File(['# Toast\n\n## Ingredients\n- 2 slices bread\n- butter\n\n## Method\n1. Toast the bread.\n2. Butter it.'], 'toast.md', { type: 'text/markdown' });
    const { results } = await localExtraction.extractFromDocument(md);
    expect(results[0].draft.title).toBe('Toast');
    expect(results[0].draft.ingredients).toHaveLength(2);
    expect(results[0].draft.instructions).toHaveLength(2);
  });
});
