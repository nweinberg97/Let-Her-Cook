// Regenerates the PNG app icons from public/favicon.svg.
// Run once after changing the logo: node scripts/make-icons.mjs (needs `sharp`).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const render = (s, size) => sharp(Buffer.from(s), { density: 1200 }).resize(size, size).png();

await render(svg, 192).toFile('public/icons/icon-192.png');
await render(svg, 512).toFile('public/icons/icon-512.png');
await render(svg, 180).toFile('public/icons/apple-touch-icon.png');
// Maskable: full-bleed background, artwork scaled into the safe zone.
const inner = svg.replace(/<title>.*<\/title>/, '').replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">', '').replace('</svg>', '').replace(/<rect width="64" height="64" rx="16" fill="#FF7A3D"\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#FF7A3D"/><g transform="translate(32 32) scale(0.78) translate(-32 -32)">${inner}</g></svg>`;
await render(maskable, 512).toFile('public/icons/icon-maskable-512.png');
console.log('icons written');
