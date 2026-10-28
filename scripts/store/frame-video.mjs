// Puts the demo recording inside an iPhone on a branded Let 'Em Cook
// background → out/demo/demo-phone.mp4 (1080×1920, vertical for social/Stories)
// and demo-phone.gif. Needs: dist/ (built app, for fonts), out/demo/demo.mp4,
// playwright and ffmpeg.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const DIST = process.env.DIST ?? 'dist';
const DIR = process.env.DEMO_DIR ?? 'out/demo';
const INPUT = join(DIR, 'demo.mp4');
const PORT = 4323;

// Geometry (1080×1920 canvas)
const CW = 1080, CH = 1920;
const SW = 560; // screen width
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', INPUT]).toString().trim().split(',').map(Number);
const DURATION = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', INPUT]).toString().trim();
const VH = Math.round((SW * probe[1]) / probe[0] / 2) * 2; // video height at screen width (even)
const BAND = 70; // status bar
const SH = BAND + VH;
const BEZEL = 16;
const PW = SW + BEZEL * 2, PH = SH + BEZEL * 2;
const PX = Math.round((CW - PW) / 2), PY = 318;
const SX = PX + BEZEL, SY = PY + BEZEL;
const R = 74; // screen corner radius

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
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
const css = (await readFile(join(DIST, 'index.html'), 'utf8')).match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
const logo = await readFile(join(DIST, 'favicon.svg'), 'utf8');

const icons = `<svg width="78" height="15" viewBox="0 0 72 14" fill="#1E1B18"><rect x="0" y="9" width="3.2" height="5" rx="1"/><rect x="5" y="6.5" width="3.2" height="7.5" rx="1"/><rect x="10" y="4" width="3.2" height="10" rx="1"/><rect x="15" y="1.5" width="3.2" height="12.5" rx="1"/><path d="M31 3.2a11 11 0 0 1 14.6 0l-1.5 1.6a8.8 8.8 0 0 0-11.6 0zM33.7 6.2a7 7 0 0 1 9.2 0l-1.5 1.6a4.8 4.8 0 0 0-6.2 0zM36.4 9.2a3 3 0 0 1 3.8 0l-1.9 2.1z"/><rect x="50" y="1" width="19" height="12" rx="3.5" fill="none" stroke="#1E1B18" stroke-opacity=".45" stroke-width="1.2"/><rect x="51.8" y="2.8" width="15.4" height="8.4" rx="2"/><rect x="70" y="4.6" width="1.6" height="4.8" rx=".8" fill-opacity=".45"/></svg>`;

const page = (body, transparent = false) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="./${css}">
<style>html,body{margin:0;width:${CW}px;height:${CH}px;overflow:hidden;background:${transparent ? 'transparent' : '#FFE8DC'}}*{box-sizing:border-box}</style></head><body>${body}</body></html>`;

// Layer 1: background, headline, phone body.
const background = page(`
<div style="position:absolute;inset:0;overflow:hidden;background:
  radial-gradient(circle at 12% 9%, #FFD666 0 150px, transparent 151px),
  radial-gradient(circle at 96% 30%, #FF8FAB 0 190px, transparent 191px),
  radial-gradient(circle at 2% 64%, #A98BFF 0 150px, transparent 151px),
  radial-gradient(circle at 104% 101%, #5FCF97 0 220px, transparent 221px),
  radial-gradient(circle at 18% 104%, #6CB8FF 0 170px, transparent 171px),
  linear-gradient(170deg, #FFE8DC 0%, #FFD8C6 100%);"></div>
<div style="position:absolute;top:70px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:18px">
  <div style="display:flex;align-items:center;gap:16px">
    <div style="width:78px;height:78px;filter:drop-shadow(0 8px 14px rgba(173,55,8,.35))">${logo.replace('<svg ', '<svg width="78" height="78" ')}</div>
    <span style="font-family:var(--font-display);font-weight:800;font-size:66px;letter-spacing:-.05em;color:#1E1B18">let ’em cook</span>
  </div>
  <div style="font-family:var(--font-display);font-weight:800;font-size:40px;letter-spacing:-.03em;color:#AD3708">Every recipe, finally in one place.</div>
</div>
<div style="position:absolute;left:${PX}px;top:${PY}px;width:${PW}px;height:${PH}px;border-radius:${R + BEZEL}px;background:#1E1B18;
  box-shadow:0 60px 90px -40px rgba(80,30,10,.55), 0 0 0 3px #3a3532 inset, 0 0 0 2px rgba(255,255,255,.25)"></div>
<div style="position:absolute;left:${PX - 4}px;top:${PY + 210}px;width:5px;height:70px;border-radius:3px;background:#2b2724"></div>
<div style="position:absolute;left:${PX + PW - 1}px;top:${PY + 260}px;width:5px;height:110px;border-radius:3px;background:#2b2724"></div>
<div style="position:absolute;left:${SX}px;top:${SY}px;width:${SW}px;height:${SH}px;border-radius:${R}px;background:#FFFAF3"></div>
<div style="position:absolute;left:0;right:0;top:${PY + PH + 40}px;text-align:center;font-family:var(--font-display);font-weight:800;font-size:42px;letter-spacing:-.03em;color:#1E1B18">Free forever. <span style="color:#AD3708">Fueled by eucalyptus.</span></div>
`);

// Layer 3 (on top of the video): status bar and Dynamic Island.
const top = page(`
<div style="position:absolute;left:${SX}px;top:${SY}px;width:${SW}px;height:${BAND}px;border-radius:${R}px ${R}px 0 0;background:#FFFAF3;
  display:flex;align-items:center;justify-content:space-between;padding:6px 44px 0 52px;font:600 22px -apple-system,system-ui,sans-serif;color:#1E1B18">
  <span>9:41</span>${icons}
</div>
<div style="position:absolute;left:${SX + SW / 2 - 82}px;top:${SY + 16}px;width:164px;height:46px;border-radius:24px;background:#000"></div>
`, true);

// Mask for the video: rounded bottom corners only.
const mask = `<!doctype html><html><head><style>html,body{margin:0;width:${SW}px;height:${VH}px;background:transparent}</style></head><body>
<div style="width:${SW}px;height:${VH}px;background:#fff;border-radius:0 0 ${R}px ${R}px"></div></body></html>`;

await mkdir(DIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: CW, height: CH }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const [name, html] of [['bg', background], ['top', top]]) {
  await writeFile(join(DIST, `__${name}.html`), html);
  await p.goto(`http://localhost:${PORT}/__${name}.html`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(DIR, `layer-${name}.png`), omitBackground: name === 'top' });
}
await p.setViewportSize({ width: SW, height: VH });
await p.setContent(mask);
await p.screenshot({ path: join(DIR, 'layer-mask.png'), omitBackground: true });
await browser.close();
server.close();

const filter = [
  `[1:v]scale=${SW}:${VH}:flags=lanczos,format=rgba[v]`,
  `[2:v]format=rgba,alphaextract[m]`,
  `[v][m]alphamerge[vm]`,
  `[0:v][vm]overlay=${SX}:${SY + BAND}:shortest=1[b]`,
  `[b][3:v]overlay=0:0,format=yuv420p[out]`
].join(';');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', join(DIR, 'layer-bg.png'), '-i', INPUT, '-loop', '1', '-i', join(DIR, 'layer-mask.png'), '-loop', '1', '-i', join(DIR, 'layer-top.png'),
  '-filter_complex', filter, '-map', '[out]', '-t', DURATION, '-r', '30', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', join(DIR, 'demo-phone.mp4')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(DIR, 'demo-phone.mp4'), '-vf', 'fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', join(DIR, 'demo-phone.gif')], { stdio: 'inherit' });
console.log('Saved demo-phone.mp4 and demo-phone.gif');
