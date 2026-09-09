import { resolveNamespace, type BrowserRuntimeApi } from '../runtime/namespace';
import { ChromiumAdapter } from '../chromium/adapter';
import { FirefoxAdapter } from '../firefox/adapter';
import { WebKitAdapter } from '../webkit/adapter';
import type { BrowserAdapter, BrowserId } from './interface';

/**
 * Runtime adapter factory.
 *
 * Detection is synchronous and based on the user-agent string, which every
 * extension context (service worker, background page, content script, popup)
 * exposes. The adapter then resolves the `browser.*`/`chrome.*` namespace.
 */

export function detectBrowserId(userAgent: string = navigator.userAgent): BrowserId {
  const ua = userAgent.toLowerCase();

  if (ua.includes('firefox')) return 'firefox';
  // Chromium-family first: Edge/Opera/Vivaldi/Brave UAs also contain "Safari".
  if (
    ua.includes('edg/') ||
    ua.includes('chrome') ||
    ua.includes('chromium') ||
    ua.includes('opr/') ||
    ua.includes('vivaldi') ||
    ua.includes('brave')
  ) {
    return 'chromium';
  }
  if (ua.includes('safari') || ua.includes('applewebkit')) return 'webkit';

  throw new Error('WebGuard: unrecognized browser user agent');
}

export function createAdapter(browserId?: BrowserId, host?: unknown): BrowserAdapter {
  const id = browserId ?? detectBrowserId();
  const api: BrowserRuntimeApi = resolveNamespace(host);

  switch (id) {
    case 'chromium':
      return new ChromiumAdapter(api);
    case 'firefox':
      return new FirefoxAdapter(api);
    case 'webkit':
      return new WebKitAdapter(api);
  }
}