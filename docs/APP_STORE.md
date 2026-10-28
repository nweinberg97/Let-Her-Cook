# Let ’Em Cook — App Store launch kit

Everything needed to put Let ’Em Cook on the App Store as an iPhone + iPad app.
The app is the same codebase as the website, wrapped as a native iOS app with
[Capacitor 8](https://capacitorjs.com).

## Status

| Piece | Status |
| --- | --- |
| Native iOS project (`ios/`) | ✅ Generated, in the repo |
| Builds on a Mac (Xcode 26.3, iOS Simulator) | ✅ Automatic on GitHub (`iOS app build` workflow) |
| Runs on iPhone 16 Pro Max, iPhone SE, iPad Pro 13″ | ✅ Launched in the Simulator, screenshots on the `ios-build-output` branch |
| App icon (1024×1024) and launch screen | ✅ `resources/ios/` |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | ✅ No tracking, no data collected |
| Camera / photo permission messages | ✅ In `scripts/ios/configure.sh` |
| App Store screenshots — iPhone 6.9″ (1320×2868) and iPad 13″ (2064×2752) | ✅ `store-assets` branch, regenerated on every change |
| Privacy policy and support pages | ✅ `public/privacy.html`, `public/support.html` |
| Signed upload to TestFlight | ⏳ Pipeline ready (`iOS release → TestFlight`), needs your Apple credentials |
| Tested on a real iPhone | ⏳ Needs TestFlight |

## What's needed from you

1. **Join the Apple Developer Program** (developer.apple.com/programs). It's a yearly fee, $99 USD at the time of writing. Enroll as an *individual* (fastest) or an *organization* (needs a D-U-N-S number; shows your company name as the seller).
2. **Confirm the bundle ID**: currently `com.letemcook.app` in `capacitor.config.json`. It can't be changed after the first upload, so pick one you're happy with (a domain you own, reversed, is the convention).
3. **Create the app in App Store Connect** (appstoreconnect.apple.com → Apps → +): platform iOS, name, primary language English (U.S.), the bundle ID above, and an SKU (any text, e.g. `letemcook-ios`). If the name is taken, use the fallback names below.
4. **Create an App Store Connect API key** (Users and Access → Integrations → App Store Connect API → +, role *App Manager*). Download the `.p8` file — Apple only lets you download it once.
5. **Add four GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (the `.p8` file base64-encoded).
   Then run **Actions → iOS release → TestFlight → Run workflow**. The build shows up in TestFlight about 10–30 minutes later.
6. **A support email address** — replace `SUPPORT_EMAIL` in `public/support.html`.
7. **Test on your own iPhone** with TestFlight, then submit for review.

No backend is needed for version 1: everything runs on the device.

## Listing copy

**App name** (30 max): `Let ’Em Cook: Recipe Keeper` (27)
Fallbacks if taken: `Let ’Em Cook – Recipe Box`, `Let ’Em Cook Recipes`

**Subtitle** (30 max): `Save recipes from anywhere` (26)

**Promotional text** (170 max, can change anytime without review):
> Paste a link, snap a screenshot, or photograph Grandma’s recipe card — Walla the Koala turns it into a clean, cookable recipe. Free forever.

**Description**:
> Every recipe, finally in one place.
>
> Recipes end up everywhere — screenshots, texts from your sister, bookmarks, a stained card from Grandma. Let ’Em Cook brings them all into one beautiful, searchable cookbook, and does the organizing for you.
>
> BRING IT IN HOWEVER YOU HAVE IT
> • Paste a link from any recipe site
> • Snap a photo of a cookbook page or a handwritten recipe card
> • Import screenshots, PDFs, Word documents and text files
> • Paste text from a message, email or social post — the clutter gets cleaned up
> • Or type in the family classics you’ve never written down
> You check everything before it’s saved, and nothing is ever lost.
>
> CLEAN, COOKABLE RECIPES
> • Just ingredients and steps — no life story, no ads
> • Scale servings up or down; amounts update instantly
> • Courses, cuisines, diet labels, your own tags and collections
> • Search across titles, ingredients, steps and notes
>
> COOK WITH BIG, CALM STEPS
> • Cooking mode with large text and one step at a time
> • Check off ingredients and steps as you go
> • Built-in timers pulled straight from the recipe
>
> PRIVATE BY DESIGN
> • No account, no ads, no tracking
> • Your recipes stay on your iPhone — photos and documents are read on-device
> • Back up to Files or iCloud Drive whenever you like
>
> FREE FOREVER
> Every feature, for everyone. Walla runs on eucalyptus — and love.

**Keywords** (100 max, comma-separated, no spaces; don't repeat words from the name):
`recipes,cookbook,box,meal,planner,family,cooking,import,screenshot,dinner,organizer,mom,save,ocr` (96)

**Category**: Food & Drink (primary), Lifestyle (secondary)
**Age rating**: 4+ (answer "None" to every content question)
**Price**: Free
**Copyright**: `2026 <your name or company>`
**Support URL**: https://nweinberg97.github.io/Let-Her-Cook/support.html
**Privacy policy URL**: https://nweinberg97.github.io/Let-Her-Cook/privacy.html
**Marketing URL** (optional): https://nweinberg97.github.io/Let-Her-Cook/

### App privacy ("nutrition label")
Answer **"No, we do not collect data from this app."** That's accurate: recipes, photos and imports never leave the device, and there are no analytics or third-party SDKs.

### Notes for the App Review team
> Let ’Em Cook is a private recipe library. There is no account or login — all data is stored on the device.
> To explore quickly, tap “Peek at 12 sample recipes” on the first screen. To try importing, tap + and use “Paste text” → “Try an example”, or choose a photo of a printed recipe.
> The camera and photo library are only used when the user chooses to import a recipe photo; text recognition runs on-device.
> The “Feed Walla” screen is a free animation — the app has no purchases or payments.

## Native features (why it's more than a website)
Apple rejects apps that are "just a website" (guideline 4.2). This app uses the device directly:
- **Link import that works**: the app fetches recipe pages natively, so sites that block browsers can be imported.
- **On-device text recognition** for photos and scanned PDFs, fully offline after first use.
- **iOS share sheet** for sharing recipes; **Files / iCloud Drive** for backups.
- **Camera and photo library** import, **haptic feedback**, offline use, native status bar and launch screen.

## Things that work differently in the app
- **Print / Save as PDF** is hidden in the app (iOS web views can't print). Share or copy the recipe instead. Native printing is a good v1.1 addition.
- **Tip jar**: Apple requires tips inside apps to use In-App Purchase, so the app never links to an outside payment page — Feed Walla is a free animation there. To accept tips in the app later: sign the Paid Apps agreement, add bank/tax info, create "consumable" In-App Purchases (e.g. a leaf, a handful, a branch), and add a StoreKit plugin.
- **Keep screen on** in cooking mode depends on iOS's web support and may not appear in the app. A native keep-awake plugin would make it always available.

## Ideas for version 1.1
- **"Share to Let ’Em Cook"** from Safari, Instagram or TikTok (an iOS Share Extension) — the most-requested feature in recipe apps.
- iCloud sync between iPhone and iPad (needs no server of our own).
- Native printing and PDF export.
- In-App Purchase tip jar.

## How the pieces fit
- `capacitor.config.json` — app ID, name, colors, launch screen settings.
- `src/lib/native.ts` — everything that behaves differently in the app (share sheet, files, haptics, native page fetching).
- `scripts/ios/configure.sh` — applies icons, launch screen, permission messages, privacy manifest and version numbers to the Xcode project. Safe to re-run.
- `scripts/make-ios-assets.mjs` — regenerates the app icon and launch screen from the Walla artwork.
- `scripts/store/screenshots.mjs` — generates the App Store screenshots.
- `.github/workflows/ios.yml` — builds and runs the app in the Simulator on every relevant change.
- `.github/workflows/ios-release.yml` — signed build and upload to TestFlight (manual).
- `.github/workflows/store-assets.yml` — regenerates App Store screenshots.

### Working on a Mac (optional)
```bash
npm install
npm run ios:sync      # build the web app and copy it into the iOS project
scripts/ios/configure.sh
npm run ios:open      # opens Xcode — press ▶ to run on a simulator or your iPhone
```
