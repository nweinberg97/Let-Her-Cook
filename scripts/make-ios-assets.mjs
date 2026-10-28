// Builds the iOS app icon (1024×1024, square, no transparency — Apple rounds the
// corners itself) and the launch screen image (2732×2732, Walla centered so any
// iPhone/iPad crop keeps her in view). Run: node scripts/make-ios-assets.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

// Full-bleed orange square with Walla scaled to ~84% so iOS's rounded corners
// never clip her hat or ears.
const inner = readFileSync('public/favicon.svg', 'utf8')
  .replace(/<title>.*?<\/title>/s, '')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/<rect width="64" height="64" rx="16" fill="#FF7A3D"\s*\/>/, '');
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#FF7A3D"/><g transform="translate(32 33) scale(0.84) translate(-32 -32)">${inner}</g></svg>`;

await sharp(Buffer.from(logo), { density: 1600 })
  .resize(1024, 1024)
  .flatten({ background: '#FF7A3D' })
  .removeAlpha()
  .png()
  .toFile('resources/ios/AppIcon-1024.png');

const walla = await sharp(readFileSync('resources/walla-full.svg'), { density: 900 }).resize({ height: 760 }).png().toBuffer();
const meta = await sharp(walla).metadata();
await sharp({ create: { width: 2732, height: 2732, channels: 3, background: '#FFFAF3' } })
  .composite([{ input: walla, left: Math.round((2732 - meta.width) / 2), top: Math.round((2732 - meta.height) / 2) - 40 }])
  .removeAlpha()
  .png()
  .toFile('resources/ios/Splash-2732.png');
console.log('iOS icon and splash written to resources/ios/');
