// Generates App Store screenshots from the built app (dist/):
//   out/store/iphone-6.9/  1320×2868  (required iPhone size)
//   out/store/ipad-13/     2064×2752  (required iPad size)
// Each screen is captured with Walla's sample recipes loaded, then placed in a
// branded frame with a caption. Run after `npm run build`:
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/store/screenshots.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const OUT = 'out/store';
const PORT = 4321;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}/`;

const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8');
const cssHref = indexHtml.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];

const SHOTS = [
  { id: '01-home', route: '#/', bg: '#FFE8DC', accent: '#AD3708', title: 'Every recipe,\nfinally in one place.', sub: 'Links, screenshots and Grandma’s cards — one beautiful cookbook.' },
  { id: '02-import', route: '#/add?tab=photo', bg: '#FFF3C9', accent: '#8A5A00', title: 'Snap it. Paste it.\nSaved.', sub: 'Walla tidies up recipes from links, photos, PDFs and texts.' },
  { id: '03-recipe', route: '#/recipes/sample-ricotta-pancakes', bg: '#FFE3EA', accent: '#B02A52', title: 'Clean recipes.\nNo life story.', sub: 'Just ingredients and steps, scaled for however many you’re feeding.' },
  { id: '04-cook', route: '#/recipes/sample-sheet-pan-chicken/cook', bg: '#DCF5E7', accent: '#1D6F45', title: 'Cook with\nbig, calm steps.', sub: 'Built-in timers. Check things off as you go.', prep: 'cook' },
  { id: '05-walla', route: '#/walla', bg: '#DFF0FF', accent: '#1D5EA3', title: 'Free forever.\nFueled by eucalyptus.', sub: 'No ads, no subscriptions. Your recipes stay on your phone.', prep: 'walla' }
];

const DEVICES = [
  { id: 'iphone-6.9', width: 440, height: 956, scale: 3, mobile: true },
  { id: 'ipad-13', width: 1032, height: 1376, scale: 2, mobile: false }
];

// A realistic status bar (9:41, Dynamic Island on iPhone) above the app, like a
// real device screenshot. It also keeps the app's logo clear of the frame's
// rounded corners.
function statusBar(isPad) {
  const h = isPad ? 32 : 54;
  const icons = `<svg width="${isPad ? 64 : 72}" height="14" viewBox="0 0 72 14" fill="#1E1B18"><rect x="0" y="9" width="3.2" height="5" rx="1"/><rect x="5" y="6.5" width="3.2" height="7.5" rx="1"/><rect x="10" y="4" width="3.2" height="10" rx="1"/><rect x="15" y="1.5" width="3.2" height="12.5" rx="1"/><path d="M31 3.2a11 11 0 0 1 14.6 0l-1.5 1.6a8.8 8.8 0 0 0-11.6 0zM33.7 6.2a7 7 0 0 1 9.2 0l-1.5 1.6a4.8 4.8 0 0 0-6.2 0zM36.4 9.2a3 3 0 0 1 3.8 0l-1.9 2.1z"/><rect x="50" y="1" width="19" height="12" rx="3.5" fill="none" stroke="#1E1B18" stroke-opacity=".45" stroke-width="1.2"/><rect x="51.8" y="2.8" width="15.4" height="8.4" rx="2"/><rect x="70" y="4.6" width="1.6" height="4.8" rx=".8" fill-opacity=".45"/></svg>`;
  return `(() => {
    const st = document.createElement('style');
    st.textContent = 'body{padding-top:${h}px!important}.lhc-sb{position:fixed;top:0;left:0;right:0;height:${h}px;z-index:9999;display:flex;align-items:center;justify-content:space-between;padding:0 ${isPad ? 22 : 34}px;font:600 ${isPad ? 15 : 17}px -apple-system,system-ui,sans-serif;color:#1E1B18;pointer-events:none}.lhc-di{position:absolute;left:50%;top:11px;width:124px;height:36px;margin-left:-62px;border-radius:20px;background:#000}';
    document.head.appendChild(st);
    const sb = document.createElement('div');
    sb.className = 'lhc-sb';
    sb.innerHTML = '<span>${isPad ? '9:41 &nbsp;Wed Oct 14' : '9:41'}</span>${isPad ? '' : '<span class="lhc-di"></span>'}' + ${JSON.stringify(icons)};
    document.body.appendChild(sb);
  })()`;
}

// Hide demo-only chrome so the shots show the app as people will use it.
const HIDE_DEMO = `.demo-banner,.exit-demo,.sidebar__demo,.recipe-card__badge,.recipe__figure figcaption,.toasts{display:none!important}`;

const browser = await chromium.launch();
await mkdir(join(DIST, '__shots'), { recursive: true });

for (const device of DEVICES) {
  const dir = join(OUT, device.id);
  await mkdir(join(dir, 'raw'), { recursive: true });
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: device.mobile,
    hasTouch: true,
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'America/Vancouver'
  });
  const page = await context.newPage();
  // Evening, so the home screen asks "What's cooking tonight?"
  await page.clock.install({ time: new Date('2026-10-14T18:30:00-07:00') });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText(/Peek at .* sample recipes/).click();
  await page.waitForSelector('.home__hello');
  await page.waitForTimeout(800);

  for (const shot of SHOTS) {
    await page.goto(BASE + shot.route, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: HIDE_DEMO });
    if (shot.prep === 'cook') {
      const stepsTab = page.locator('#tab-steps');
      if (await stepsTab.isVisible()) await stepsTab.click();
      await page.locator('.cook-step .step__check input').first().check();
      await page.waitForTimeout(400);
    }
    if (shot.prep === 'walla') {
      await page.locator('.feed-option', { hasText: 'A handful' }).click();
      await page.waitForTimeout(6800);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(statusBar(device.id.startsWith('ipad')));
    // Let photos finish loading.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
    await page.waitForTimeout(500);
    const raw = join(dir, 'raw', `${shot.id}.png`);
    await page.screenshot({ path: raw });
    await writeFile(join(DIST, '__shots', `${device.id}-${shot.id}.png`), await readFile(raw));
  }

  // Frame each raw screenshot with a caption.
  const frame = await context.newPage();
  for (const shot of SHOTS) {
    const isPad = device.id.startsWith('ipad');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${cssHref}">
<style>
  html,body{margin:0;width:${device.width}px;height:${device.height}px;overflow:hidden;background:${shot.bg};}
  .f{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:${isPad ? 64 : 46}px ${isPad ? 64 : 26}px 0;box-sizing:border-box;
     background:radial-gradient(circle at 88% 8%, rgba(255,255,255,.55) 0 ${isPad ? 120 : 70}px, transparent ${isPad ? 121 : 71}px), radial-gradient(circle at 6% 60%, rgba(255,255,255,.35) 0 ${isPad ? 160 : 90}px, transparent ${isPad ? 161 : 91}px), ${shot.bg};}
  h1{font-family:var(--font-display);font-weight:800;letter-spacing:-.045em;line-height:.98;text-align:center;color:#1E1B18;margin:0;font-size:${isPad ? 74 : 44}px;white-space:pre-line;}
  p{font-family:var(--font-ui);font-weight:600;color:${shot.accent};text-align:center;margin:${isPad ? 22 : 14}px 0 0;font-size:${isPad ? 26 : 16}px;line-height:1.35;max-width:${isPad ? 760 : 360}px;}
  .shot{margin-top:${isPad ? 48 : 30}px;width:${isPad ? 78 : 80}%;border-radius:${isPad ? 36 : 40}px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(30,27,24,.45),0 0 0 ${isPad ? 10 : 8}px #1E1B18;background:#fff;}
  .shot img{display:block;width:100%;}
</style></head><body><div class="f"><h1>${shot.title}</h1><p>${shot.sub}</p><div class="shot"><img src="./__shots/${device.id}-${shot.id}.png"></div></div></body></html>`;
    await writeFile(join(DIST, '__frame.html'), html);
    await frame.goto(BASE + '__frame.html', { waitUntil: 'networkidle' });
    await frame.evaluate(() => document.fonts.ready);
    await frame.waitForTimeout(300);
    await frame.screenshot({ path: join(dir, `${shot.id}.png`) });
  }
  await context.close();
  console.log(`Saved ${SHOTS.length} ${device.id} screenshots`);
}

await browser.close();
server.close();
