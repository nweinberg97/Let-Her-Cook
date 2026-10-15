/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * Content Security Policy for production builds (dev needs inline scripts for
 * hot reload). Scripts only from this origin; WebAssembly allowed for local OCR;
 * network requests are allowed to https so URL import can reach recipe sites.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'lhc-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    }
  };
}

// Relative base so the built app works from any static host or sub-path
// (GitHub Pages, Netlify, a USB stick…). Routing uses the URL hash.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Let Her Cook',
        short_name: 'Let Her Cook',
        description: 'Every recipe has a home. A private recipe library that lives in your browser.',
        theme_color: '#FFFAF3',
        background_color: '#FFFAF3',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // The app shell and code are precached. OCR engine + language data are
        // large, so they're cached on first use instead (see runtimeCaching).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'],
        globIgnores: ['ocr/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lhc-ocr-assets',
              expiration: { maxEntries: 20 }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
