import type { BrowserAdapter } from '../../browser/adapter/interface';
import { createAdapter } from '../../browser/adapter/factory';
import { onMessage } from '../../browser/runtime/messaging';

/**
 * Background entry point.
 *
 * This single stateless script runs as:
 *   - an extension service worker on Chromium,
 *   - a background page on Firefox,
 *   - a non-persistent background page on Safari.
 *
 * It never assumes persistence on any browser, so state must always be
 * rebuilt from events + storage.local.
 */
const adapter: BrowserAdapter = createAdapter();

onMessage((message) => {
  switch (message.type) {
    case 'webguard/hello': {
      // Milestone 0 handshake: proves the adapter + messaging layer work.
      return {
        ok: true,
        adapter: adapter.id,
        capabilities: adapter.capabilities,
      };
    }
    default: {
      return { ok: false, error: 'unknown message type' };
    }
  }
});

export { adapter };