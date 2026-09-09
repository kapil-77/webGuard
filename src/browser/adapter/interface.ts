import type { BrowserRuntimeApi } from '../runtime/namespace';

export type BrowserId = 'chromium' | 'firefox' | 'webkit';

/**
 * Honest per-browser capability matrix, derived from the cross-browser
 * research recorded in ARCHITECTURE.md.
 *
 * Capabilities are declared here — they are the ONLY place browser
 * differences are encoded for the core engine's consumption. Add a field
 * when a feature needs it; never guess at call sites.
 */
export interface WebGuardCapabilities {
  /** How the background entry executes. */
  readonly backgroundModel: 'extension-service-worker' | 'background-page';
  /** Can webRequest handlers block or modify requests? */
  readonly blockingWebRequests: boolean;
  /** Can the extension passively observe web requests? */
  readonly observableWebRequests: boolean;
  /** Storage areas we may rely on. */
  readonly storageAreas: readonly ('local' | 'session' | 'sync')[];
  /** Namespace(s) the browser exposes. */
  readonly namespace: 'browser' | 'chrome' | 'both';
  /** MV3 async APIs return promises on every target. */
  readonly promises: true;
  /** Safari-specific: webRequest does not exist on iOS. */
  readonly webRequestUnavailableOnIOS: boolean;
  /** Firefox-specific: request blocking requires the webRequestBlocking permission. */
  readonly requiresWebRequestBlockingPermission: boolean;
}

/**
 * A BrowserAdapter is the only type that knows browser specifics.
 *
 * Everything upstream (core engine, detectors, UI) depends on the adapter
 * interface and on normalized shapes (PageSnapshot, Finding, …) — never on
 * raw browser API objects.
 */
export interface BrowserAdapter {
  readonly id: BrowserId;
  readonly capabilities: Readonly<WebGuardCapabilities>;
  readonly api: BrowserRuntimeApi;
}