import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * WebGuard build configuration.
 *
 * The extension ships as multiple independent entry points (NOT a web app):
 *   - background  -> background.js    (browser service worker / background page)
 *   - content     -> content.js       (passive, privacy-first content script)
 *   - popup       -> popup.html       (toolbar popup UI)
 *
 * Per-browser manifests (dist/chromium, dist/firefox, dist/safari) are assembled
 * afterwards by scripts/build-manifests.mjs.
 */
export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        background: fileURLToPath(new URL('src/extension/background/index.ts', import.meta.url)),
        content: fileURLToPath(new URL('src/extension/content/index.ts', import.meta.url)),
        popup: fileURLToPath(new URL('src/extension/popup/popup.tsx', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});