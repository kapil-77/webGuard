import type { BrowserRuntimeApi } from '../runtime/namespace';
import { BaseBrowserAdapter } from '../adapter/base';

/**
 * Chromium adapter (Chrome, Edge, Opera, Vivaldi, Brave, …) — Manifest V3.
 *
 * Facts encoded here (verified against Chrome docs, see ARCHITECTURE.md):
 * - MV3 background = extension service worker (event-driven, non-persistent).
 * - Blocking web requests moved to declarativeNetRequest; webRequest is
 *   observe-only.
 * - `browser.*` namespace available since Chrome 148 alongside `chrome.*`.
 */
export class ChromiumAdapter extends BaseBrowserAdapter {
  constructor(api: BrowserRuntimeApi) {
    super(
      'chromium',
      {
        backgroundModel: 'extension-service-worker',
        blockingWebRequests: false,
        observableWebRequests: true,
        storageAreas: ['local', 'session', 'sync'],
        namespace: 'both',
        promises: true,
        webRequestUnavailableOnIOS: false,
        requiresWebRequestBlockingPermission: false,
      },
      api,
    );
  }
}