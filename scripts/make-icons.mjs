// Generates the PWA PNG icons from an inline SVG. Run once: node scripts/make-icons.mjs
import sharp from 'sharp';
const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${pad ? '' : 'rx="112"'} fill="#B0381F"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 1}) translate(-256 -256)">
    <circle cx="256" cy="256" r="168" fill="none" stroke="#FFFBF3" stroke-width="40"/>
    <circle cx="256" cy="256" r="84" fill="none" stroke="#F2AE2E" stroke-width="40"/>
    <circle cx="256" cy="256" r="28" fill="#FFFBF3"/>
  </g></svg>`;
await sharp(Buffer.from(mark(false))).resize(192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(mark(false))).resize(512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(mark(true))).resize(512).png().toFile('public/icons/icon-maskable-512.png');
console.log('icons written');
