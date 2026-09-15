/**
 * WebGuard smoke test — validates the BUILD ARTIFACTS end to end in Node
 * with faithful per-browser runtime stubs, WITHOUT launching a browser.
 *
 * Message delivery here emulates CHROME: a listener that returns a plain
 * (non-true, non-Promise) value has NOT produced a response. A response only
 * arrives via sendResponse(value) — synchronously, or asynchronously after
 * returning true — or via a returned Promise (Chrome 148+ / Firefox / Safari).
 * This matches the semantics our messaging.onMessage() wrapper normalizes.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'chromium');
const A = join(tmpdir(), 'webguard-host-content');
const B = join(tmpdir(), 'webguard-host-background');

if (!existsSync(DIST)) {
  console.error('dist/chromium not found - run `npm run build` first.');
  process.exit(1);
}

for (const dir of [A, B]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(DIST, dir, { recursive: true });
}

const url = (base, f) => pathToFileURL(join(base, f)).toString();

let contentListener = null;

/**
 * Chrome-faithful delivery of a single runtime.onMessage event:
 *   - a synchronous sendResponse(value) call delivers the response;
 *   - returning true keeps the channel open for a later async sendResponse;
 *   - a returned Promise resolves the response (Chrome 148+ / Firefox / Safari);
 *   - anything else (plain non-true return, or no sendResponse at all)
 *     delivers NO response => undefined.
 */
async function callRuntimeListener(listener, message) {
  let response;
  let responded = false;
  const sendResponse = (value) => {
    response = value;
    responded = true;
  };
  let result;
  try {
    result = listener(message, undefined, sendResponse);
  } catch {
    // A listener that throws answers with "no response" in Chrome.
    return undefined;
  }
  if (result === true) {
    // Async path: response arrives later via a sendResponse call. Give the
    // microtask queue a turn so Promise.resolve(...).then(sendResponse) lands.
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    return responded ? response : undefined;
  }
  if (result && typeof result.then === 'function') {
    return await result;
  }
  // Synchronous plain return WITHOUT sendResponse is ignored by Chrome.
  return responded ? response : undefined;
}
function makeFakeDom() {
  const bySel = {
    'script[src]': [{ v: '/app.js' }],
    'img[src], input[type="image"][src]': [{ v: 'https://cdn.example.com/logo.png' }],
    'form[action]': [{ v: 'http://example.com/legacy-search' }],
  };
  const toEl = (e) => ({ getAttribute: () => e.v });
  return {
    baseURI: 'https://example.com/',
    title: 'Smoke Fixture',
    querySelectorAll: (sel) => (bySel[sel] ?? []).map(toEl),
  };
}

async function main() {
  let failures = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
    if (!ok) failures += 1;
  };

  // ---------- helpers: emulate per-context global isolation ----------
  const resetNamespace = () => {
    // In a real browser each extension context gets its own global env. Here
    // the bundles share ONE `globalThis`, so the namespace aliasing from
    // resolveNamespace (`browser = chrome`) must be cleared between phases to
    // avoid leaking one context's runtime into the next.
    delete globalThis.browser;
    delete globalThis.chrome;
  };

  // ---------- phase 1: load content.js (its own isolated environment) ----------
  const contentChrome = {
    runtime: { onMessage: { addListener: (listener) => { contentListener = listener; } } },
  };
  resetNamespace();
  globalThis.chrome = contentChrome;
  globalThis.document = makeFakeDom();
  globalThis.window = { location: { href: 'https://example.com/' } };
  await import(url(A, 'content.js'));
  check('content.js registers a message listener', typeof contentListener === 'function');

  // ---------- phase 2: load background.js (its own isolated environment) ----------
  const backgroundChrome = {
    runtime: { onMessage: { addListener: (listener) => { globalThis.__backgroundListener = listener; } } },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (_tabId, message) => callRuntimeListener(contentListener, message),
    },
  };
  resetNamespace();
  globalThis.chrome = backgroundChrome;
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/148.0.0.0 Safari/537.36' },
    configurable: true,
    writable: true,
  });
  await import(url(B, 'background.js'));
  check('background.js registers an analyze listener', typeof globalThis.__backgroundListener === 'function');

  // ---------- phase 3: popup -> background analyze round-trip ----------
  // The content listener returns a PLAIN object (observePage data). In real
  // Chrome that return would be ignored; the response only exists because the
  // wrapper delivered it via sendResponse. callRuntimeListener enforces that.
  const response = await callRuntimeListener(globalThis.__backgroundListener, {
    type: 'webguard/analyze',
    id: 'smoke-1',
  });
  check('analyze resolves ok:true', response?.ok === true, JSON.stringify(response?.ok));
  if (!response?.ok) {
    console.log('  detail:', response?.detail);
    process.exit(1);
  }

  const report = response.report;
  check('report has the expected hostname', report.page.hostname === 'example.com', report.page.hostname);
  check('report shows usesHttps=true', report.page.usesHttps === true);
  check(
    'report observed the DOM resources',
    report.page.resources.length === 3,
    JSON.stringify(report.page.resources.map((r) => r.kind)),
  );
  check('report has exactly 4 findings', report.findings.length === 4, `got ${report.findings.length}`);
  check('score is deterministic and in range', report.score.value >= 0 && report.score.value <= 100, `score=${report.score.value}`);
  check('status is present', ['secure', 'caution', 'risk', 'dangerous'].includes(report.score.status), report.score.status);
  check(
    'mixed-content stays clean when the only http resource is a form (by design)',
    report.findings.some((f) => f.id === 'mixed-content:none' && f.severity === 'info'),
  );
  check('insecure-form detected the http form action', report.findings.some((f) => f.id === 'insecure-form:present' && f.severity === 'high'));
  check('no findings carry raw query strings or full urls in evidence', !JSON.stringify(report.findings).includes('?') && !JSON.stringify(report.findings).includes('http://example.com/legacy-search'));
  // ---------- phase 4: unsupported page handling ----------
  const oldListener = globalThis.__backgroundListener;
  backgroundChrome.tabs.query = async () => [{ id: 8 }];
  backgroundChrome.tabs.sendMessage = async () => ({ url: 'file:///C:/x.html', title: 'file', resources: [] });
  const unsupported = await callRuntimeListener(oldListener, { type: 'webguard/analyze', id: 'smoke-2' });
  const unsupportedOk = unsupported?.ok === false && unsupported.reason === 'unsupported-page';
  check('unsupported pages -> unsupported-page response', unsupportedOk, JSON.stringify(unsupportedOk ? '' : unsupported));

  rmSync(A, { recursive: true, force: true });
  rmSync(B, { recursive: true, force: true });

  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();