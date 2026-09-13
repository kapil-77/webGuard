/**
 * WebGuard production build (Vite programmatic API).
 *
 * WHY per-entry builds instead of one multi-entry `vite build`:
 *   - Extension background/service-worker and content scripts must be
 *     CLASSIC, self-contained scripts. They cannot be ES modules.
 *       * Chrome: `background.service_worker` is loaded as a classic script
 *         unless manifest `background.type` is "module" — but Firefox/Safari
 *         do not support module background scripts, so we can't set it.
 *       * Chrome content scripts: there is NO module content-script option.
 *     A single multi-entry Vite build splits shared code into `assets/*.js`
 *     chunks that these scripts would `import` — which fails with
 *     "SyntaxError: Cannot use import statement outside a module" and
 *     "Service worker registration failed (status 15)".
 *   - A single-input build always INLINES everything into the entry file
 *     (no shared chunks, no import/export), which is exactly what
 *     background.js and content.js need.
 *   - Only the popup is a real ES module (`popup.html` loads it via
 *     `<script type="module">`), so an ESM popup.js is fine.
 *
 * Strategy:
 *   1. Run three single-input Vite builds, each writing to its own stage dir:
 *        dist/.stage/background/  (from src/extension/background/index.ts)
 *        dist/.stage/content/     (from src/extension/content/index.ts)
 *        dist/.stage/popup/       (from src/extension/popup/popup.tsx)
 *   2. Merge the stage dirs into dist/ and remove dist/.stage.
 *   3. Call assembleManifests() to produce dist/chromium, dist/firefox,
 *      dist/safari (bundle + static files + per-browser manifest.json) —
 *      both in one-shot (`npm run build`) and in watch (`npm run dev`),
 *      so the per-browser folders are always present and loadable.
 *
 *   node scripts/build-extension.mjs [--watch]
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { assembleManifests } from './build-manifests.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const STAGE = join(ROOT, 'dist', '.stage');
const DIST = join(ROOT, 'dist');
const WATCH = process.argv.includes('--watch');

const ENTRIES = {
  background: join(ROOT, 'src/extension/background/index.ts'),
  content: join(ROOT, 'src/extension/content/index.ts'),
  popup: join(ROOT, 'src/extension/popup/popup.tsx'),
};

async function buildEntry(name, entryPath) {
  const outDir = join(STAGE, name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  await build({
    logLevel: 'info',
    configFile: false,
    plugins: [react()],
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      // Object-form input -> the emitted entry chunk keeps the key name, so
      // the output file is exactly `<name>.js` (background.js, content.js,
      // popup.js) matching the manifest / popup.html references.
      rollupOptions: {
        input: { [name]: entryPath },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash][extname]',
        },
      },
    },
  });
}

/** Copies the merged output of a stage dir into dist/. */
function mergeStage(name) {
  const stageDir = join(STAGE, name);
  const files = readdirSync(stageDir);
  for (const file of files) {
    const from = join(stageDir, file);
    const to = join(DIST, file);
    cpSync(from, to, { recursive: true });
  }
}

function clearDist() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
}

async function buildOnce() {
  clearDist();
  for (const [name, entry] of Object.entries(ENTRIES)) {
    await buildEntry(name, entry);
  }
  for (const name of Object.keys(ENTRIES)) {
    mergeStage(name);
  }
  rmSync(STAGE, { recursive: true, force: true });
  console.log('✔ extension bundle written to dist/');
  assembleManifests();
}

async function runWatch() {
  // Event-driven watch using Node's built-in fs.watch (no extra dependency).
  // Rebuilds (bundle + manifests) only when a file under src/ or static/ changes.
  console.log('WebGuard build watch started. Press Ctrl+C to stop.');
  await buildOnce();

  const watched = [join(ROOT, 'src'), join(ROOT, 'static')];
  let building = false;
  let pending = false;

  const rebuild = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      await buildOnce();
    } catch (error) {
      console.error('[watch] build failed:', error?.message || error);
    } finally {
      building = false;
      if (pending) {
        pending = false;
        void rebuild();
      }
    }
  };

  for (const dir of watched) {
    if (!existsSync(dir)) continue;
    watch(dir, { recursive: true }, () => {
      void rebuild();
    });
  }

  // Keep the process alive.
  await new Promise(() => {});
}

if (WATCH) {
  await runWatch();
} else {
  await buildOnce();
}
