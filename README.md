# WebGuard

**Privacy-first, cross-browser web security intelligence — a browser extension.**

WebGuard analyzes the security posture of the current webpage and reports it as a
"Security Pulse / Threat Surface" score. It is built to be a portfolio-quality
demonstration of **how browser-specific WebExtension API differences can be
isolated behind adapters while the core security engine stays
browser-agnostic.**

> **Status: first working vertical slice (M1).** WebGuard now inspects the
> current webpage end-to-end: the popup asks the background, the background
> collects observed page data through the browser adapter + content script,
> four security detectors run, a deterministic 0–100 score with status is
> computed, and the popup renders score + expandable findings. See
> [ARCHITECTURE.md](./ARCHITECTURE.md) and *Roadmap* below.

---

## Supported browsers (target)

| Browser | Engine | Target |
|---|---|---|
| Chrome / Edge / Opera / Brave / Vivaldi | Chromium | `dist/chromium` |
| Firefox | Gecko | `dist/firefox` |
| Safari (macOS) | WebKit | `dist/safari` |

Safari additionally requires wrapping the built extension in a native
macOS/visionOS/iOS app for distribution (Xcode `safari-web-extension-converter`);
during development you can load a folder via *Develop → Allow Unsigned
Extensions*.

## Stack

- React 19 · TypeScript 7 · Vite 8 · Vitest 5
- Manifest V3 (MV2 also supported by Safari 15.4+)
- **No runtime dependencies beyond React** (used only by the popup UI)

## Project structure

```
webGuard/
├─ manifests/                  base manifest + per-browser overlays
│  ├─ base.json                shared keys (action, permissions, CSP, …)
│  ├─ chromium.json            background: service_worker
│  ├─ firefox.json             background: scripts + gecko.id
│  └─ safari.json              background: scripts + persistent:false
├─ scripts/
│  ├─ build-extension.mjs        per-entry Vite builds (+ manifest assembly)
│  ├─ build-manifests.mjs        merges overlays → dist/<target>/manifest.json
│  └─ smoke.mjs                  headless e2e smoke on the built bundle
├─ static/
│  ├─ popup.html               static popup shell (extension pages can't use
│  └─ style.css                absolute-rooted asset paths, so no Vite HTML entry)
├─ src/
│  ├─ core/                    browser-agnostic security engine (pure TS)
│  │  ├─ types/                Severity, Category, Finding, PageSecurityData, …
│  │  ├─ detectors/            https · mixed-content · insecure-form · third-party
│  │  ├─ security-engine/      engine: page → findings → report
│  │  └─ risk-scoring/         scoreFindings: → 0..100 score + status
│  ├─ browser/                 ONLY layer allowed to touch WebExtension APIs
│  │  ├─ runtime/              namespace resolution + validated messaging
│  │  ├─ adapter/              BrowserAdapter contract, factory, base
│  │  ├─ collection/           normalization + collection errors
│  │  ├─ chromium/             ChromiumAdapter    (service worker, observe-only)
│  │  ├─ firefox/              FirefoxAdapter     (background page, can block)
│  │  └─ webkit/               WebKitAdapter      (non-persistent, macOS-only)
│  ├─ extension/
│  │  ├─ background/           analyze flow (single stateless entry)
│  │  ├─ content/              DOM observer (content.js)
│  │  ├─ popup/                React popup (score card, findings, states)
│  │  └─ report/               reserved for the report view
│  ├─ components/  hooks/      reserved for the UI milestone
│  └─ lib/                     validation + sanitization + message protocol
├─ vitest.config.ts
└─ ARCHITECTURE.md             the full design document
```

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | `node scripts/build-extension.mjs --watch` (rebuild loop) |
| `npm run build` | Per-entry bundle + assemble `dist/chromium`, `dist/firefox`, `dist/safari` (single command) |
| `npm run typecheck` | `tsc` checks for `src/` and tool configs |
| `npm run smoke` | Headless e2e smoke test on the built `dist/chromium` (13 checks) |
| `npm test` | Run the Vitest suite (84 tests) |

> **Windows / PowerShell note:** if `npm` fails with a PowerShell execution-policy
> error, use `npm.cmd` instead (a `node_modules\.bin\*.cmd` shim exists).

### Loading the extension

- **Chrome/Edge/Brave:** `chrome://extensions` (or `edge://extensions`) → enable
  *Developer mode* → *Load unpacked* → select `dist/chromium`. The toolbar action
  opens `popup.html`.
- **Firefox:** `about:debugging` → *Load Temporary Add-on* → select
  `dist/firefox/manifest.json`.
- **Safari:** *Develop → Allow Unsigned Extensions* → load the unpacked folder.
  Distribution ultimately requires the native-app wrapper (macOS only).

## Security & privacy principles (wired into the slice)

- **Minimal permissions** — only `activeTab` is declared. No `tabs`, no
  `<all_urls>` host permissions, no network permissions, no `storage` (it
  returns only with a real persistence feature).
- **Popup never touches privileged APIs** — it only sends `webguard/analyze`
  and receives a validated `AnalyzeResponse`; all tabs access lives in the
  background behind the `BrowserAdapter`.
- **No remote code** — the extension bundles only local code; every extension
  page runs under `script-src 'self'; object-src 'self'`.
- **Validate extension messages** — envelopes are schema-checked before
  dispatch (`src/lib/validation.ts`) and payloads are validated by the typed
  protocol (`src/lib/protocol.ts`).
- **Sanitize displayed data** — nothing scraped is rendered verbatim
  (`src/lib/sanitize.ts`); evidence shows `scheme://host` only.
- **Privacy-first & local by default** — no network calls, no telemetry, a
  passive content script that only responds when asked; analysis happens only
  when you open the popup.
- **No hardcoded secrets** — there are none, by design.

## Verifying the slice in a real browser

1. `npm.cmd run build`
2. **Chrome/Edge/Brave:** `chrome://extensions` → Developer mode → Load
   unpacked → `dist/chromium`. Pin the WebGuard action, then open any website
   and click it. Expected: host, score, status pill and 4 expandable findings.
3. **Firefox:** `about:debugging` → Load Temporary Add-on →
   `dist/firefox/manifest.json`.
4. Good test pages: an https site (`https://example.com`), an http site
   (`http://example.com`), a browser-internal page (`chrome://settings`) → the
   popup must show the "cannot analyze" state.
5. The extension does a fresh local analysis per popup open, so no data is
   persisted.

## Roadmap

- **M0 (done):** scaffolding, architecture, manifests, adapters, engine/scorer
  contracts, tests, docs.
- **M1 (done):** first working vertical slice — current page → adapter →
  normalized page data → 4 detectors → deterministic score/status → popup with
  loading/unsupported/error/clean states.
- **M2:** Security Pulse / Threat Surface UI (dark, technical, minimal);
  persistence of last report to `storage.local` (restores the `storage`
  permission with justification).
- **M3:** observation-only network telemetry via each browser's supported
  mechanism; headers/cookies detectors.
- **M4:** packaging pipeline (`web-ext` for Firefox, Safari wrapper for macOS).