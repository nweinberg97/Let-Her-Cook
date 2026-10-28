// Records a ~45-second phone-sized walkthrough of the app with Playwright:
// sample recipes → home → recipe + scaling → cooking mode → importing a recipe
// → Feed Walla. Taps show as soft circles. Output: out/demo/demo.webm
// Run after `npm run build` (needs playwright installed).
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const OUT = 'out/demo';
const PORT = 4322;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    let file = join(DIST, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''));
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, r));

const W = 430;
const H = 932;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
  locale: 'en-US',
  recordVideo: { dir: OUT, size: { width: W * 2, height: H * 2 } }
});

// Show taps as a soft circle so viewers can follow along.
await context.addInitScript(() => {
  const show = (x, y) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(30,27,24,.28);border:2px solid rgba(255,255,255,.9);pointer-events:none;z-index:99999;transition:transform .45s ease-out,opacity .45s ease-out;`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => {
      d.style.transform = 'scale(1.6)';
      d.style.opacity = '0';
    });
    setTimeout(() => d.remove(), 500);
  };
  addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) show(t.clientX, t.clientY); }, { capture: true, passive: true });
  // Hide demo-only chrome for a cleaner video.
  addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = '.demo-banner,.exit-demo,.recipe-card__badge,.recipe__figure figcaption{display:none!important}';
    document.head.appendChild(s);
  });
});

const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const smoothScroll = async (dy, ms = 1400) => {
  await page.evaluate(({ dy, ms }) => new Promise((done) => {
    const start = scrollY, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      scrollTo(0, start + dy * e);
      k < 1 ? requestAnimationFrame(step) : done();
    };
    requestAnimationFrame(step);
  }), { dy, ms });
};
const tap = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  await pause(250);
  await locator.tap();
};
const imagesLoaded = async () => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
};

// 1. Welcome → load Walla's sample recipes
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await pause(2200);
await tap(page.getByText(/Peek at .* sample recipes/));
await page.waitForSelector('.home__hello');
await imagesLoaded();
await pause(1800);

// 2. Browse the home screen
await smoothScroll(1100, 2600);
await pause(900);
await smoothScroll(-1100, 1200);
await pause(600);

// 3. Open tonight's dinner idea and scale it
await tap(page.locator('.feature-card').first());
await page.waitForSelector('#recipe-title');
await imagesLoaded();
await pause(1500);
await smoothScroll(620, 1400);
await pause(700);
const more = page.locator('button[aria-label="More servings"], button[aria-label="Make more"]').first();
await tap(more);
await pause(600);
await tap(more);
await pause(1600);

// 4. Cooking mode
await smoothScroll(-2000, 900);
await pause(400);
await tap(page.getByRole('link', { name: 'Start cooking' }));
await page.waitForSelector('.cook');
await pause(1400);
await tap(page.locator('.ingredient--check label').nth(0));
await pause(450);
await tap(page.locator('.ingredient--check label').nth(1));
await pause(800);
await tap(page.locator('#tab-steps'));
await pause(1100);
await tap(page.locator('.cook-step .step__check').first());
await pause(1700);
await tap(page.getByLabel('Exit cooking mode'));
await pause(900);

// 5. Import a recipe from pasted text
await tap(page.locator('.tabbar__add'));
await pause(1000);
await tap(page.getByRole('tab', { name: /Paste text/ }));
await pause(700);
await tap(page.getByText('Try an example'));
await pause(1100);
await tap(page.getByRole('button', { name: 'Turn into a recipe' }));
await page.waitForSelector('.review');
await pause(1600);
await smoothScroll(900, 2000);
await pause(700);
await tap(page.locator('.review__header-actions').getByRole('button', { name: 'Save recipe' }));
await pause(900);
const saveAnyway = page.getByRole('button', { name: 'Save anyway' });
if (await saveAnyway.isVisible().catch(() => false)) {
  await pause(1300);
  await tap(saveAnyway);
}
await page.waitForSelector('#recipe-title');
await pause(2200);

// 6. Feed Walla
await tap(page.locator('.feed-icon'));
await pause(1300);
await tap(page.locator('.feed-option', { hasText: 'A handful' }));
await pause(7600);

await context.close();
await browser.close();
server.close();

const video = (await readdir(OUT)).find((f) => f.endsWith('.webm'));
await rename(join(OUT, video), join(OUT, 'demo.webm'));
console.log('Saved out/demo/demo.webm');
