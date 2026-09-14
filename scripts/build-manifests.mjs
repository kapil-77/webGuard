
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const TARGETS = ['chromium', 'firefox', 'safari'];
const DIST = join(ROOT, 'dist');
const STATIC_DIR = join(ROOT, 'static');
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

/**
 * Assembles dist/chromium, dist/firefox and dist/safari from the bundle in
 * dist/ plus static/ files and the per-browser manifest overlays.
 */
export function assembleManifests() {
  if (!existsSync(DIST)) {
    throw new Error(`Expected "${DIST}/" to exist. Did you run scripts/build-extension.mjs first?`);
  }

  const base = readJson(join(ROOT, 'manifests', 'base.json'));
  const bundleEntries = readdirSync(DIST);

  for (const target of TARGETS) {
    const outDir = join(DIST, target);
    const overlay = readJson(join(ROOT, 'manifests', `${target}.json`));
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
        throw new Error(`Missing static file: ${source}`);
      }
      cpSync(source, join(outDir, file));
    }

    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✔ built ${target} -> ${outDir}`);
  }
}

// Run directly when executed as a CLI script (node scripts/build-manifests.mjs).
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    assembleManifests();
  } catch (error) {
    console.error(String(error?.message || error));
    process.exit(1);
  }
}
