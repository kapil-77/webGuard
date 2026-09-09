# WebGuard

**Privacy-first, cross-browser web security intelligence — a browser extension.**

WebGuard analyzes the security posture of the current webpage and reports it as a
"Security Pulse / Threat Surface" score. It is built to be a portfolio-quality
demonstration of **how browser-specific WebExtension API differences can be
isolated behind adapters while the core security engine stays
browser-agnostic.**

> **Status: foundation (milestone 0).** The project is initialized: architecture,
> build system, manifest strategy, adapters, engine/scoring contracts and tests
> are in place. Detectors, page collection and the real UI are intentionally not
> implemented yet. See [ARCHITECTURE.md](./ARCHITECTURE.md) and *Roadmap* below.

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
│  └─ build-manifests.mjs      merges overlays → dist/<target>/manifest.json
├─ static/
│  ├─ popup.html               static popup shell (extension pages can't use
│  └─ style.css                absolute-rooted asset paths, so no Vite HTML entry)
├─ src/
│  ├─ core/                    browser-agnostic security engine (pure TS)
│  │  ├─ types/                Severity, Category, Finding, PageSnapshot, …
│  │  ├─ detectors/            Detector contract + registry (0 detectors yet)
│  │  ├─ security-engine/      engine skeleton: snapshot → findings → report
│  │  └─ risk-scoring/         scoreFindings: findings → 0..100 score
│  ├─ browser/                 ONLY layer allowed to touch WebExtension APIs
│  │  ├─ runtime/              namespace resolution + validated messaging
│  │  ├─ adapter/              BrowserAdapter contract, factory, base
│  │  ├─ chromium/             ChromiumAdapter    (service worker, observe-only)
│  │  ├─ firefox/              FirefoxAdapter     (background page, can block)
│  │  └─ webkit/               WebKitAdapter      (non-persistent, macOS-only)
│  ├─ extension/
│  │  ├─ background/           single stateless background entry
│  │  ├─ content/              passive content script (no-op by design)
│  │  ├─ popup/                React popup entry (compile-only)
│  │  └─ report/               reserved for the report view
│  ├─ components/  hooks/      reserved for the UI milestone
│  └─ lib/                     validation + display sanitization
├─ vite.config.ts              multi-entry build (background/content/popup)
├─ vitest.config.ts
└─ ARCHITECTURE.md             the full design document
```

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | `vite build --watch` (iterate on the bundle) |
| `npm run build` | Build bundle + assemble `dist/chromium`, `dist/firefox`, `dist/safari` |
| `npm run typecheck` | `tsc` checks for `src/` and tool configs |
| `npm test` | Run the Vitest suite (37 tests) |

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

## Security & privacy principles (wired into this foundation)

- **Minimal permissions** — only `activeTab` + `storage` are declared. No
  `tabs`, no `<all_urls>` host permissions, no network permissions.
- **No remote code** — the extension bundles only local code; every extension
  page runs under `script-src 'self'; object-src 'self'`.
- **Validate extension messages** — every inbound message must pass structural
  validation (`src/lib/validation.ts`) before dispatch; malformed messages are
  dropped.
- **Sanitize displayed data** — nothing scraped is rendered verbatim
  (`src/lib/sanitize.ts`).
- **Privacy-first & local by default** — browsing data stays on the device,
  stored in `storage.local` only; there are no network calls and no telemetry.
- **No hardcoded secrets** — there are none, by design.

## Roadmap

- **M0 (done):** scaffolding, architecture, manifests, adapters, engine/scorer
  contracts, tests, docs.
- **M1:** collect page/security information → normalize (PageSnapshot collection
  via adapters) → run a first real detector set (TLS, security headers,
  cookies) → score → render a minimal report.
- **M2:** Security Pulse / Threat Surface UI (dark, technical, minimal).
- **M3:** observation-only network telemetry via each browser's supported
  mechanism.
- **M4:** packaging pipeline (`web-ext` for Firefox, Safari wrapper for macOS).