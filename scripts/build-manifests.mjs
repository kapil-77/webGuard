/**
 * Assembles per-browser extension folders after `vite build`.
 *
 * Vite emits the raw bundle into dist/ (background.js, content.js, popup.js,
 * assets/). This script then, for each target, copies the bundle — plus the
 * static extension files (popup.html, style.css) — into dist/<target>/ and
 * writes the browser-specific merged manifest.json.
 *
 *   dist/chromium/  dist/firefox/  dist/safari/
 *
 * Manifests are composed from manifests/base.json plus a per-browser overlay.
 * Overlay values override base values (deep merge).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TARGETS = ['chromium', 'firefox', 'safari'];
const DIST = 'dist';
const STATIC_DIR = 'static';
const STATIC_FILES = ['popup.html', 'style.css'];

function deepMerge(base, overlay) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`Expected "${DIST}/" to exist after "vite build". Did you run the build step?`);
    process.exit(1);
  }

  const base = readJson(join('manifests', 'base.json'));
  const bundleEntries = readdirSync(DIST);

  for (const target of TARGETS) {
    const outDir = join(DIST, target);
    const overlay = readJson(join('manifests', `${target}.json`));
    const manifest = deepMerge(base, overlay);

    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    // Copy the built bundle (everything in dist/ except the target folders).
    for (const entry of bundleEntries) {
      if (TARGETS.includes(entry)) continue;
      cpSync(join(DIST, entry), join(outDir, entry), { recursive: true });
    }

    // Copy static extension files (popup.html, style.css).
    for (const file of STATIC_FILES) {
      const source = join(STATIC_DIR, file);
      if (!existsSync(source)) {
        console.error(`Missing static file: ${source}`);
        process.exit(1);
      }
      cpSync(source, join(outDir, file));
    }

    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✔ built ${target} -> ${outDir}`);
  }
}

main();
