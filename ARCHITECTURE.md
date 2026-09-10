# WebGuard Architecture

WebGuard is a cross-browser **web security intelligence** browser extension.
Its central engineering goal is to demonstrate that browser-specific
WebExtension API differences can be isolated behind **adapters** while the core
security engine remains browser-agnostic.

This document is the source of truth for that architecture — including the
verified cross-browser research that motivated every compatibility decision.

---

## 1. The pipeline

Implemented flow (M1 vertical slice):

```
Current Tab
  ↓  (popup sends webguard/analyze to the background)
Browser Adapter          adapter.getActiveTabId() → tab id (no permission needed)
  ↓                      adapter.collectPageData(tab) → tabs.sendMessage(content script)
Content Script           observePage() → raw ContentObservation (DOM scan)
  ↓
Normalized Page Data     normalizeObservation() → PageSecurityData
  ↓
Security Detectors       4 detectors (see §10) → normalized Finding[]
  ↓
Risk Scoring             scoreFindings() → 0..100 + status (SECURE/CAUTION/RISK/DANGEROUS)
  ↓
Security Report          SecurityReport (fully serializable)
  ↓
Popup UI                 renders score, status, expandable findings
```

Conceptual dependency diagram:

```
        ┌────────────────────────────┐
        │          BROWSER           │  Chrome / Edge · Firefox · Safari
        └─────────────┬──────────────┘
                      │ WebExtension APIs (browser.* / chrome.*)
        ┌─────────────▼──────────────┐
        │      BROWSER ADAPTERS      │  chromium/ · firefox/ · webkit/
        │    (only layer touching    │  → BrowserAdapter interface
        │     browser APIs, incl.    │  → capability matrix (WebGuardCapabilities)
        │     namespace resolution)  │  → base: getActiveTabId + collectPageData
        └─────────────┬──────────────┘
                      │ normalized shapes only (PageSecurityData, …)
        ┌─────────────▼──────────────┐
        │   NORMALIZED BROWSER DATA  │  PageSecurityData { url, protocol, origin,
        └─────────────┬──────────────┘        hostname, usesHttps, resources[] }
        ┌─────────────▼──────────────┐
        │     SECURITY DETECTORS     │  registry-driven, browser-agnostic
        └─────────────┬──────────────┘  Finding { severity, category, title,
        ┌─────────────▼──────────────┐        description, evidence, scoreImpact }
        │       RISK SCORING         │  scoreFindings() → 0..100 + status
        └─────────────┬──────────────┘
        ┌─────────────▼──────────────┐
        │       SECURITY REPORT      │  SecurityReport (fully serializable)
        └─────────────┬──────────────┘
        ┌─────────────▼──────────────┐
        │     UI (popup / report)    │  renders sanitized data only
        └────────────────────────────┘
```

### Dependency rules (enforced by imports + tests)

1. `src/core/**` is **pure TypeScript**. It never imports from `src/browser`,
   `src/extension`, or any WebExtension API. Everything it needs arrives as
   normalized data (`PageSecurityData`, `Finding`).
2. `src/browser/**` is the **only** layer that touches `browser.*`/`chrome.*`,
   and only through `src/browser/runtime/namespace.ts` — the single module that
   references `globalThis`.
3. `src/extension/**` wires the pipeline together (background receives a
   request, resolves the adapter, feeds the engine, returns a report).
4. `src/lib/**` holds cross-cutting helpers (validation, sanitization) that any
   layer may use.
5. All cross-layer boundaries cross **well-typed, JSON-serializable objects**
   only. Raw browser objects never leave `src/browser`.

---

## 2. Directory map

```
src/
├─ core/                      browser-agnostic engine (pure TS)
│  ├─ types/                  Severity, FindingCategory, Finding, PageSecurityData,
│  │                          ResourceInfo, RiskScore, SecurityReport
│  ├─ detectors/              Https, MixedContent, InsecureForm, ThirdPartyResource
│  │                          + DetectorRegistry + registry-factory
│  ├─ security-engine/        SecurityEngine: runs detectors with isolation
│  │                          + timeout, builds SecurityReport
│  └─ risk-scoring/           scoreFindings() → 0..100·status, riskContribution()
├─ browser/
│  ├─ runtime/
│  │  ├─ namespace.ts         THE browser.* / chrome.* seam (+ fallback guard)
│  │  └─ messaging.ts         validated send/onMessage + tabs primitives
│  ├─ adapter/
│  │  ├─ interface.ts         BrowserAdapter + WebGuardCapabilities
│  │  ├─ base.ts              getActiveTabId + collectPageData (shared)
│  │  └─ factory.ts           detectBrowserId() + createAdapter()
│  ├─ collection/
│  │  ├─ normalize.ts         ContentObservation → PageSecurityData
│  │  └─ errors.ts            UnsupportedPageError / CollectionFailedError
│  ├─ chromium/adapter.ts     ChromiumAdapter (service worker, MV3)
│  ├─ firefox/adapter.ts      FirefoxAdapter  (background page, blocking possible)
│  └─ webkit/adapter.ts       WebKitAdapter   (non-persistent, macOS-only webRequest)
├─ extension/
│  ├─ background/index.ts     single stateless entry: analyze flow (all 3 browsers)
│  ├─ content/
│  │  ├─ observer.ts          DOM scan → ContentObservation (dumb by design)
│  │  └─ index.ts             responds to webguard/collect-page-data only
│  ├─ popup/
│  │  ├─ popup.tsx            state machine + render
│  │  ├─ views.tsx            ScoreCard, FindingList, states
│  │  └─ client.ts            webguard/analyze client (no privileged APIs)
│  └─ report/                 reserved
├─ components/ · hooks/       reserved for UI milestone
└─ lib/                       validation.ts · sanitize.ts · protocol.ts
manifests/                    base.json + chromium/firefox/safari overlays
scripts/build-manifests.mjs   per-target manifest assembly
static/                       popup.html + style.css (copied verbatim)
```

---

## 3. Verified cross-browser research (the facts behind decisions)

Research performed against current (Sept 2026) documentation: MDN
(*Build a cross-browser extension*, *Chrome incompatibilities*, API
compatibility tables), Chrome for Developers (*Migrate to a service worker*,
*Transition to browser namespace*), Mozilla Extension Workshop (MV3
migration guide), and **Apple's Safari Web Extension docs** (including
*Assessing your Safari web extension's browser compatibility*).

| Area | Chromium | Firefox (Gecko) | Safari (WebKit) |
|---|---|---|---|
| **Namespace** | `browser.*` + `chrome.*`; `browser.*` since Chrome 148 (mid-2026) | `browser.*` native (+ `chrome.*` for porting) | `browser.*` and `chrome.*` both supported |
| **Async APIs** | Promises since 121; promise `onMessage` since 148 | Promises | Promises |
| **Background model** | **extension service worker** (MV3, non-persistent) | **background page** (MV3 = non-persistent recommended) | **background page**; MV3 ⇒ `persistent:false`; Safari 15.4+ supports MV2 & MV3 |
| **Request blocking** | Removed from `webRequest` (MV3) → `declarativeNetRequest` | `webRequestBlocking` permission still supported | `webRequestBlocking` **not supported**; no `BlockingResponse` |
| **Request observation** | `webRequest.onObserved` (Chrome 126+) | `webRequest` full lifecycle | `webRequest` observation-only, **macOS only** (none on iOS) |
| **Storage** | local / session / sync / managed | local / session | local (5 MB default) / session (16.4+); `sync` implemented but **no syncing** |
| **Tabs** | `query/get` w/ activeTab or host perms | same model | several gaps (`tabs.move`, `tabs.highlighted`, …) |
| **Permissions model** | `activeTab` grants current tab on user action | same | `tabs` requires host permission |
| **Packaging** | zip / unpacked folder | zip (web-ext) | **native macOS/visionOS/iOS app wrapper** (Xcode `safari-web-extension-converter`) |

### Consequences applied to WebGuard

- **One stateless background script** that is valid as a Chromium *service
  worker*, a Firefox *background page*, and a Safari *non-persistent background
  page*. No `background.type: "module"` (breaks Firefox/Safari). No persistence
  assumptions anywhere.
- **Observation-only network model.** The only honest posture across all three
  browsers; blocking is a Chromium/Firefox divergence we deliberately do not
  abstract in M0.
- **`browser.*` first namespace** with Chrome's official runtime guard
  (`browser = chrome` when absent) for pre-148 Chromium. No polyfill needed.
- **`activeTab` + `storage` only.** No `tabs`, no `<all_urls>`.

---

## 4. Namespace strategy

`src/browser/runtime/namespace.ts` is the only module that touches
`globalThis.browser` / `globalThis.chrome`.

```ts
resolveNamespace(host): BrowserRuntimeApi
```

Resolution order:

1. `host.browser` — Firefox, Safari, Chrome 148+.
2. `host.chrome` — pre-148 Chromium, aliased onto `browser` (Chrome's own
   published recommendation).
3. otherwise throw (never silently guess).

The typed surface (`BrowserRuntimeApi`) is deliberately narrow: only the
members WebGuard actually calls (`runtime.sendMessage/onMessage/getBrowserInfo`,
`storage.local/session/sync`) are declared. Everything else is `unknown` until
a real feature needs it — this is what keeps "no fake compatibility" honest.

---

## 5. Messaging contract

All extension messaging passes through `src/browser/runtime/messaging.ts` and
wraps every payload in a validated envelope:

```ts
{ type: string, id: string, payload?: unknown }
```

- Senders construct envelopes with `createEnvelope(type, payload)`.
- Receivers use `onMessage(handler)`, which **only invokes the handler for
  structurally valid envelopes** (`isValidEnvelope`). Anything else is dropped
  silently.
- Responses are correlated by the sender using `id`.

Current message types (M1):

| Type | Direction | Payload | Response |
|---|---|---|---|
| `webguard/analyze` | popup → background | — | `AnalyzeResponse { ok:true, report } \| { ok:false, reason, detail }` |
| `webguard/collect-page-data` | background → content script | — | `ContentObservation { url, title, resources[] }` |

All request/response shapes are declared and validated in `src/lib/protocol.ts`
(typed request types, `parseAnalyzeResponse`, `isContentObservation`), so the
UI never negotiates message shapes ad-hoc and never touches privileged APIs.

**Transport note (async responses):** `runtime.onMessage` handlers may return
a Promise on Firefox, Safari, and Chromium 148+ (the namespace/promise-return
update shipped mid-2026). Older Chromium builds require the legacy
`return true` + `sendResponse` pattern and are not supported by this slice.

---

## 6. Findings & scoring contracts

Every detector returns `Finding` objects (see `src/core/types/finding.ts`):

```ts
interface Finding {
  id: string;                 // stable, deduplicatable
  detectorId: string;         // "" for engine-level errors
  severity: 'critical'|'high'|'medium'|'low'|'info';
  category: FindingCategory;  // transport-security, content-security, …
  title: string;
  description: string;
  evidence?: string;          // display-safe artifact only
  scoreImpact: number;        // 0..1 multiplier on severity weight
  createdAt: string;          // ISO-8601
}
```

Scoring (`src/core/risk-scoring/scorer.ts`) is a **pure, deterministic
function** of the findings — no randomness:

```
riskPoints  = Σ severityWeight(severity) × clamp01(scoreImpact)
  critical=40  high=25  medium=12  low=5  info=0
score.value = max(0, round(100 − riskPoints))      // 100 = clean
status      = statusForScore(score.value)
confidence   = fraction of registered detectors that completed
```

Status thresholds (`src/core/risk-scoring/security-status.ts`):

| Score | Status |
|---|---|
| 90–100 | SECURE |
| 70–89  | CAUTION |
| 40–69  | RISK |
| 0–39   | DANGEROUS |

`riskContribution(finding)` exposes each finding's exact points so the popup
can show an explainable "−N pts" per finding.

Unknown severities are counted but never influence the score (defensive).
The engine (`src/core/security-engine/engine.ts`) isolates detector failures
and enforces a per-detector timeout, so one broken detector can never take
down a report.

---

## 7. Manifest strategy

Manifests are composed from a **base** plus a **per-browser overlay**, merged
by `scripts/build-manifests.mjs` (deep merge; overlay wins):

| Key | base.json | chromium.json | firefox.json | safari.json |
|---|---|---|---|---|
| `manifest_version` | `3` | — | — | — |
| `permissions` | `["activeTab"]` | — | — | — |
| `background` | (omitted) | `{ "service_worker": "background.js" }` | `{ "scripts": ["background.js"] }` | `{ "scripts": ["background.js"], "persistent": false }` |
| `browser_specific_settings.gecko.id` | — | — | `webguard@webguard.dev` | — |
| `action.default_popup` | `popup.html` | — | — | — |
| `content_scripts` | `<all_urls>` @ `document_idle`, `content.js` | — | — | — |
| `content_security_policy.extension_pages` | `script-src 'self'; object-src 'self'` | — | — | — |

Rationale: the `background` key *genuinely differs* per browser, and Firefox
requires `gecko.id`. Rather than one manifest with `browser_specific_settings`
(forbidden for the other two), WebGuard generates **three honest manifests**
into `dist/chromium|firefox|safari`.

The popup `popup.html` + `style.css` are **static files** (in `static/`),
copied verbatim. Vite's HTML entries emit absolute-rooted asset URLs
(e.g. `/popup.js`), which extension pages cannot resolve; therefore the HTML is
static and points at the relative, hash-free `./popup.js` produced from the
`popup.tsx` entry.

### Build strategy (why per-entry builds)

`scripts/build-extension.mjs` runs **three single-input Vite builds** (one per
entry: background, content, popup) and merges the outputs into `dist/`. This is
a deliberate, cross-browser-required choice:

- **Extension background/service-worker and content scripts must be CLASSIC,
  self-contained scripts — they cannot be ES modules.**
  - Chrome loads `background.service_worker` as a classic script unless the
    manifest sets `background.type: "module"` — but Firefox and Safari do not
    support module background scripts, so we cannot set it.
  - Chrome content scripts have **no** module option at all.
- A single multi-entry Vite build splits shared code into `assets/*.js` chunks
  that these scripts would `import` — which fails with
  `SyntaxError: Cannot use import statement outside a module` and
  `Service worker registration failed (status 15)`.
- A **single-input** build always inlines everything into the entry file (no
  shared chunks, no `import`/`export`), which is exactly what `background.js`
  and `content.js` need.
- Only the **popup** is a real ES module (`popup.html` loads it via
  `<script type="module">`), so an ESM `popup.js` is fine.

`npm run dev` runs the same script with `--watch` (event-driven via Node's
built-in `fs.watch` on `src/` + `static/`; Vite 8's `createBuilder`/watch API
is still experimental).

---

## 8. Capability matrix

`WebGuardCapabilities` (`src/browser/adapter/interface.ts`) is the single
place where browser differences are encoded for the core to consume:

| Capability | chromium | firefox | webkit |
|---|---|---|---|
| `backgroundModel` | `extension-service-worker` | `background-page` | `background-page` |
| `blockingWebRequests` | `false` | `true` | `false` |
| `observableWebRequests` | `true` | `true` | `true` (macOS only) |
| `storageAreas` | `['local','session','sync']` | `['local','session']` | `['local','session']` |
| `namespace` | `both` | `both` | `both` |
| `webRequestUnavailableOnIOS` | `false` | `false` | `true` |
| `requiresWebRequestBlockingPermission` | `false` | `true` | `false` |

Adding a browser-specific behavior in the future means extending this
matrix — **never** adding `if (browser === ...)` branches inside `core/`.

---

## 9. Security & privacy decisions

1. **Minimal permissions.** `activeTab` is the only permission declared in M1.
   The popup never touches `tabs.*`; page data comes from our own content
   script (which needs no `tabs` permission). Nothing more will be added
   without a concrete feature + justification.
2. **No remote code execution.** Local bundles only; extension pages are CSP
   locked to `'self'`.
3. **No hardcoded secrets.** There are none; any future API keys belong in
   user-controlled, local-only settings — never in the bundle.
4. **Validate extension messages.** Envelopes are schema-checked before
   dispatch; request/response shapes are validated by `src/lib/protocol.ts`;
   findings are schema-checked before persistence/rendering
   (`src/lib/validation.ts`).
5. **Sanitize displayed data.** Control chars stripped, whitespace collapsed,
   long values truncated, non-http(s) schemes neutralized
   (`src/lib/sanitize.ts`); React's default output escaping is the last line
   of defense.
6. **Privacy-first, local by default.** No network calls, no telemetry, a
   passive content script that only responds when asked, and analysis happens
   only on explicit user action (opening the popup). `storage.*` is not used
   in this slice; it will only return with an actual persistence feature.
7. **Observation-only network posture.** WebGuard will never silently block
   requests across browsers; it reports. (This is also the only truly
   cross-browser-true network model.)

---

## 10. Implemented vertical slice (M1) — collection, detectors, limitations

### Collection architecture

```
Popup (toolbar click)
  └─ runtime.sendMessage("webguard/analyze")                    [client.ts]
       └─ Background: adapter.getActiveTabId()                  [tabs.query, no permission]
            └─ adapter.collectPageData(tabId)                   [tabs.sendMessage]
                 └─ Content script: observePage()               [DOM scan]
                      └─ normalizeObservation()                 [browser/collection]
                           └─ SecurityEngine.analyze(page)      [core]
                                └─ AnalyzeResponse -> popup
```

### Detector set (M1)

| Detector | Observation | Finding on trigger | Severity / impact |
|---|---|---|---|
| `https` | page protocol | `https:enabled` / `https:disabled` | info / **critical 1.0** |
| `mixed-content` | http sub-resources (scripts, imgs, iframes, links, media) on HTTPS page | `mixed-content:present` (aggregated count, evidence hosts) | **high 1.0** |
| `insecure-form` | `<form action="http:…">` on HTTPS page | `insecure-form:present` (aggregated, evidence hosts) | **high 1.0** |
| `third-party-resource` | resources whose origin ≠ page origin | `third-party:present` (count + origins) | info (0 impact) |

Every detector returns **exactly one finding** so the popup renders a clean
4-row list; no detector is ever silent. Positive/clean states are info
findings ("✓ HTTPS", "✓ No mixed content", …).

**Phantom cases avoided (no fake security intelligence):**
- On plain HTTP pages, mixed-content and insecure-form report
  "not assessed" instead of double-penalizing — the HTTPS detector already
  owns transport risk there.
- Anchor links (`<a href>`) are NOT loaded by the page and are not reported.
- `data:`/`file:`/unparseable resources are dropped during normalization.
- Evidence strings show `scheme://host` only — never query strings (privacy).

### Documented browser-API limitations (this slice)

1. **DOM-time observation only.** Resources are detected from the DOM *at the
   moment the popup is opened*. Requests made later by JavaScript, plus
   sub-frames, are invisible. Real network-level observation (webRequest) is a
   separate milestone and differs per browser (Chromium observe-only, Safari
   macOS-only, absent on iOS) — the capability matrix already records this.
2. **Async message responses require Chromium 148+** (mid-2026), which is when
   Chrome shipped the `browser.*` namespace + promise-returning
   `runtime.onMessage`. Firefox and Safari have supported promise responses
   for years. Older Chromium is out of scope for M1.
3. **Tab URL is not read from `tabs.query`** — doing so would require the
   `tabs` permission or matching host permissions. WebGuard obtains the URL
   from its own content script instead, so it stays at a single `activeTab`
   permission. (Verified: the tab *id* itself requires no permission.)
4. **Safari distribution** still requires the native macOS/visionOS/iOS app
   wrapper; the `dist/safari/` bundle is the web-extension payload for that
   wrapper. iOS (no network observation) is not a target for this slice.
5. **`storage` permission was dropped** in M1 (unused). It returns with a real
   persistence feature.