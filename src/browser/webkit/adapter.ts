import type { BrowserRuntimeApi } from '../runtime/namespace';
import { BaseBrowserAdapter } from '../adapter/base';

/**
 * Safari (WebKit) adapter — Manifest V2/V3.
 *
 * Facts encoded here (verified against Apple's Safari docs, see
 * ARCHITECTURE.md):
 * - Safari 15.4+ supports MV3; MV3 background pages are non-persistent.
 * - webRequest is observation-only on macOS and does NOT exist on iOS.
 * - No BlockingResponse: request blocking is unsupported (use declarative
 *   content blocking instead).
 * - `storage.session` requires Safari 16.4+.
 */
export class WebKitAdapter extends BaseBrowserAdapter {
  constructor(api: BrowserRuntimeApi) {
    super(
      'webkit',
      {
        backgroundModel: 'background-page',
        blockingWebRequests: false,
        observableWebRequests: true,
        storageAreas: ['local', 'session'],
        namespace: 'both',
        promises: true,
        webRequestUnavailableOnIOS: true,
        requiresWebRequestBlockingPermission: false,
      },
      api,
    );
  }
}