/**
 * THE single module in the codebase that touches `globalThis.browser` /
 * `globalThis.chrome`.
 *
 * All three targets natively expose the `browser.*` namespace (Firefox and
 * Safari historically; Chrome since 148). For older Chromium builds we apply
 * Chrome's own published runtime guard (`browser = chrome`), which keeps a
 * single code path valid everywhere without any polyfill dependency.
 *
 * The typed surface is deliberately narrow: only the members WebGuard
 * actually calls. Everything else stays `unknown` until a feature needs it.
 * This module is also the seam where future features get their types.
 */

export interface BrowserStorageArea {
  get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface BrowserRuntimeInfo {
  name?: string;
  version?: string;
}

/** Narrow view of a browser tab — only the members WebGuard actually calls. */
export interface BrowserTab {
  readonly id?: number;
  readonly url?: string;
  readonly title?: string;
}

export interface BrowserTabsApi {
  query(queryInfo: Record<string, unknown>): Promise<readonly BrowserTab[]>;
  sendMessage(tabId: number, message: unknown): Promise<unknown | undefined>;
}

/**
 * Listener signature for `runtime.onMessage.addListener`.
 *
 * Responding contract in Chrome: a plain (non-Promise) listener return value
 * is NOT delivered as the response. A listener must respond via ONE of:
 *   - call `sendResponse(value)` synchronously, and return `undefined`, or
 *   - return `true` and call `sendResponse(value)` asynchronously later, or
 *   - return a Promise (Chrome 148+, Firefox, Safari).
 * Our messaging.onMessage() wrapper normalizes all three paths (see
 * src/browser/runtime/messaging.ts).
 */
export type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => true | void;

export interface BrowserRuntimeApi {
  runtime: {
    getBrowserInfo?(): Promise<BrowserRuntimeInfo>;
    sendMessage?(message: unknown): Promise<unknown | undefined>;
    /** `runtime.onMessage` is an Event object — use `onMessage.addListener(...)`. */
    onMessage?: {
      addListener(listener: RuntimeMessageListener): void;
    };
  };
  tabs?: BrowserTabsApi;
  storage?: {
    local?: BrowserStorageArea;
    session?: BrowserStorageArea;
    sync?: BrowserStorageArea;
  };
}

interface NamespaceHost {
  browser?: BrowserRuntimeApi;
  chrome?: BrowserRuntimeApi;
}

/**
 * Resolves the extension runtime namespace.
 *
 * - `browser.*` when the host provides it (Firefox, Safari, Chrome 148+).
 * - `chrome.*` otherwise, aliased onto `browser` so downstream code can
 *   always use `browser` (matches Chrome's official recommendation).
 *
 * `host` is injectable for unit tests; it defaults to the extension global.
 */
export function resolveNamespace(host: unknown = globalThis): BrowserRuntimeApi {
  const g = host as NamespaceHost;
  if (g.browser) return g.browser;
  if (g.chrome) {
    g.browser = g.chrome;
    return g.chrome;
  }
  throw new Error('WebGuard: no WebExtension namespace (browser.* or chrome.*) is available');
}