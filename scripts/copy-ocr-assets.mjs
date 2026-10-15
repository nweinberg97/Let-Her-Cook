// Copies the OCR engine (Tesseract.js worker + WebAssembly core) and the
// English language data from node_modules into public/ocr/, so the app serves
// them itself instead of loading code from a third-party CDN at runtime.
// public/ocr/ is git-ignored and rebuilt by `npm run dev` / `npm run build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'ocr');
mkdirSync(join(out, 'lang'), { recursive: true });

function pkgDir(name) {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    return null;
  }
}

let copied = 0;
const copy = (from, to) => {
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to);
  copied++;
};

const tess = pkgDir('tesseract.js');
const core = pkgDir('tesseract.js-core');
const lang = pkgDir('@tesseract.js-data/eng');

if (!tess || !core || !lang) {
  console.warn('[ocr] Tesseract packages not found — image import will be unavailable until `npm install` completes.');
  process.exit(0);
}

copy(join(tess, 'dist', 'worker.min.js'), join(out, 'worker.min.js'));

for (const f of readdirSync(core)) {
  if (/^tesseract-core.*\.(wasm|wasm\.js|js)$/.test(f)) copy(join(core, f), join(out, f));
}

// Prefer the smaller "fast" LSTM model when present; fall back to best_int.
const langCandidates = ['4.0.0_fast', '4.0.0_best_int', '4.0.0'].map((d) => join(lang, d, 'eng.traineddata.gz'));
const langFile = langCandidates.find((p) => existsSync(p));
if (!langFile) {
  console.warn('[ocr] English language data not found in @tesseract.js-data/eng.');
} else {
  copy(langFile, join(out, 'lang', 'eng.traineddata.gz'));
}
console.log(`[ocr] ${copied} OCR asset(s) ready in public/ocr/`);
