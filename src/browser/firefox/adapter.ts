import type { BrowserRuntimeApi } from '../runtime/namespace';
import { BaseBrowserAdapter } from '../adapter/base';

/**
 * Firefox (Gecko) adapter — Manifest V3.
 *
 * Facts encoded here (verified against Mozilla Extension Workshop, see
 * ARCHITECTURE.md):
 * - Firefox keeps background pages; MV3 makes them non-persistent.
 * - Blocking web requests still supported behind the `webRequestBlocking`
 *   permission.
 * - `browser.*` is the native namespace (plus `chrome.*` for porting).
 */
export class FirefoxAdapter extends BaseBrowserAdapter {
  constructor(api: BrowserRuntimeApi) {
    super(
      'firefox',
      {
        backgroundModel: 'background-page',
        blockingWebRequests: true,
        observableWebRequests: true,
        storageAreas: ['local', 'session'],
        namespace: 'both',
        promises: true,
        webRequestUnavailableOnIOS: false,
        requiresWebRequestBlockingPermission: true,
      },
      api,
    );
  }
}