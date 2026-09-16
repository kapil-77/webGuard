import type { BrowserRuntimeApi } from '../runtime/namespace';
import { BaseBrowserAdapter } from '../adapter/base';

/**
 * Chromium adapter (Chrome, Edge, Opera, Vivaldi, Brave, …) — Manifest V3.
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