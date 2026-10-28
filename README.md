# Let ’Em Cook

**Every recipe has a home.**

Let ’Em Cook is a personal recipe library that turns recipes from anywhere — a link, a screenshot, a photo of Grandma's card, a PDF, a text from your sister — into one beautiful, searchable cookbook. It runs entirely in your browser: no account, no server, no API keys.

## Get started

You need [Node.js](https://nodejs.org) 18.18 or newer.

```bash
npm install
npm run dev        # open the URL it prints (usually http://localhost:5173)
```

To build a production version you can host anywhere static (GitHub Pages, Netlify, any web server, or just a folder):

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ locally to try it
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the automated tests (parser, storage, backups, import, filters) |
| `npm run typecheck` | Strict TypeScript check |

### Add your first recipe

1. Click **Add recipe** (or the **+** button on your phone).
2. Choose how you have it: **Link**, **Paste text**, **Photo**, **File**, or **Type it in**. Not sure? Paste text and press **Try an example**.
3. Check the draft on the **Check it over** screen. Fix anything that's off, pick a course, add tags or collections, and press **Save recipe**.

### Back up your recipes

Recipes live in this browser only, so download a backup now and then:

1. Open **Backup & privacy** (bottom of the sidebar, or the shield icon on mobile).
2. Press **Download backup**. You get a `let-em-cook-backup-YYYY-MM-DD.json` file with every recipe, kept photo, collection, tag and setting.
3. To restore — on this device or another browser — press **Choose backup file** on the same page. You'll see what's inside and choose how to handle recipes you already have before anything changes.

On the same page, **Ask the browser to keep my recipes** requests persistent storage, which makes the browser much less likely to clear your data when space runs low.

## What it does

- **Capture:** links (via recipe-card data on the page), pasted text, photos and screenshots (on-device text recognition), PDFs (text and scanned), Word `.docx`, `.txt` and `.md` files, or typing it in.
- **Review before saving:** every import becomes an editable draft. Guessed categories are marked *suggested*; anything the parser couldn't place shows up as **Leftover text** instead of disappearing.
- **Organize:** courses (each with its own color), cuisines, diet labels, your own tags, collections, and favorites.
- **Find:** instant search across titles, ingredients, steps, notes, tags and collection names; combinable filters (course, time, diet, cuisine, tag, collection, favorites); five sort orders.
- **Cook:** a cooking mode with large text, ingredient and step checklists, step-by-step navigation, timers pulled from the steps, and "keep screen on". Serving sizes scale amounts from the original every time.
- **Share & print:** **Print / Save as PDF** uses a dedicated cookbook-page layout; **Share** uses your device's share sheet, or copies or downloads a plain-text version.
- **Installable:** a PWA — install it from the browser menu and your library opens offline once it's been loaded.

## How it's built

React 18 + TypeScript (strict) + Vite. Data in IndexedDB via Dexie, validated with Zod. Icons from Lucide. Fonts (Newsreader, Atkinson Hyperlegible Next) are bundled with the app.

```
src/
  types/recipe.ts            Recipe, Collection and Backup schema (Zod) — the contract for everything
  lib/storage/               Repository interface, IndexedDB implementation, backup format, normalisation
  lib/parsing/               Deterministic parsers: text, JSON-LD, ingredients, quantities, classification
  lib/extraction/            Extraction provider boundary + local provider, URL import, in-memory import session
  lib/ocr/, lib/files/       Tesseract.js OCR, PDF / DOCX / text reading, file validation
  lib/export/                Plain-text recipe, downloads
  components/, pages/        UI
  styles/                    Tokens, components, pages, print stylesheet
```

### Local-first architecture

- **Storage boundary.** The UI talks only to the `RecipeRepository` interface (`src/lib/storage/repository.ts`): `listRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `searchRecipes`, `listCollections`, `createCollection`, `updateCollection`, `deleteCollection`, `exportBackup`, `importBackup`, and a `subscribe` change feed. Version one implements it with IndexedDB (`IndexedDbRepository`). The recipe schema has no IndexedDB-specific fields.
- **Ready for a backend.** Ids are UUIDs and timestamps are ISO-8601, so records can move to a server without re-keying. A server-backed repository can implement the same interface, and the versioned backup file (`schemaVersion`) is the migration path: export here, import there.
- **Extraction boundary.** `ExtractionProvider` (`src/lib/extraction/types.ts`) defines `extractFromText`, `extractFromUrl`, `extractFromImage` and `extractFromDocument`. Version one ships `LocalExtractionProvider` only. A future AI provider must run behind an authenticated backend (never with an API key in the browser), declare `sendsDataOffDevice`, and be opt-in.
- **Schema versioning.** IndexedDB versions are declared in `indexeddb.ts`; add a new `.version(n).upgrade(...)` block for migrations. Backups from older versions pass through `migrate()` in `backup.ts`; backups from newer versions are refused with a clear message.

### Backup format

```json
{
  "app": "let-her-cook",
  "schemaVersion": 1,
  "exportedAt": "2026-10-14T20:00:00.000Z",
  "recipes": [ /* Recipe objects, see src/types/recipe.ts */ ],
  "collections": [ { "id": "…", "name": "Family Favorites", "description": "", "createdAt": "…", "updatedAt": "…" } ],
  "preferences": { "customCourses": [] }
}
```

On restore, every entry is validated; damaged entries are repaired where possible and otherwise skipped (and counted). Recipes with the same id are skipped, replaced, or kept as copies — your choice. Collections with the same name are merged.

## Import formats and known limitations

| Source | How | Limits |
| --- | --- | --- |
| Link | Fetched directly by your browser; reads schema.org Recipe JSON-LD (multiple blocks, `@graph`, HowToSections), falls back to page text | **Most recipe sites block this** (CORS / bot protection). When that happens the app asks you to paste the text and keeps the link as the source. No proxy or third-party service is used. 5 MB, 12 s timeout. |
| Pasted text | Deterministic parser | Handles headers, bullets, numbered steps, groups, "Prep: 10 min" lines, web clutter and captions. It's not an AI model — unusual layouts need a quick fix on the review screen. |
| Photo / screenshot (JPG, PNG, WebP ≤ 15 MB) | Tesseract.js in a Web Worker, assets served from this app | First use downloads ~4 MB of English language data from this site, then it's cached. Handwriting recognition is best-effort. HEIC isn't supported — screenshot or export as JPG. English only. |
| PDF (≤ 25 MB) | pdf.js text layer (first 40 pages); scanned PDFs are OCR'd (first 5 pages) | Password-protected PDFs can't be opened. |
| Word `.docx` (≤ 15 MB) | mammoth.js raw text | `.doc`, `.pages`, `.rtf`, `.odt` aren't supported. |
| `.txt`, `.md` (≤ 2 MB) | Read as text | — |

Documents holding several recipes are split at each **Ingredients** heading and you review them one at a time. Splitting is heuristic: if the boundary lands in the wrong place, fix it on the review screen.

Other limitations:
- Photos linked from recipe websites are shown from that site and may disappear; upload your own to keep one.
- Unit-aware scaling only touches the leading amount of an ingredient line. "A pinch", "salt to taste" and amounts mid-sentence are never changed.
- Sharing is text-only; there are no public recipe links in version one.

## Privacy model

- Recipes are stored in **IndexedDB in this browser, on this device**. There is no account and no server.
- **Browser storage is not encrypted.** Anyone with access to the same browser profile can read your recipes.
- Imported files are read **in memory**. The uploaded file, raw extracted text and OCR output are never written to storage and are dropped after the import. Only the recipe you approve is saved — plus a photo, and only if you choose to keep one (re-encoded, which strips location metadata).
- Link imports are a direct request from your browser to that website — nothing else sees the URL.
- No analytics, ads, trackers or error reporting. Production builds ship a Content Security Policy that only allows the app's own scripts.
- Imported content is always rendered as text; page HTML is parsed into an inert document and never rendered or executed; PDFs are opened with script evaluation disabled.

## Tests

`npm test` covers the PRD's test cases: clean and messy text (A, B), OCR-style text (C, D), missing quantities (E), unavailable URLs (F), duplicates (G), malformed files (H), long recipes (I), special formatting (J), persistence across reloads (K), backup round trips (L), serving scaling (M) and the privacy lifecycle (N), plus filters, sorting, search and JSON-LD parsing. OCR itself (Tesseract running on a real image) is verified in a browser rather than in the unit tests.
