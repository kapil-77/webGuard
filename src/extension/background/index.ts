import type { BrowserAdapter } from '../../browser/adapter/interface';
import { createAdapter } from '../../browser/adapter/factory';
import { onMessage } from '../../browser/runtime/messaging';
import { UnsupportedPageError } from '../../browser/collection/errors';
import { createDefaultDetectorRegistry } from '../../core/detectors/registry-factory';
import { SecurityEngine } from '../../core/security-engine/engine';
import type { AnalyzeResponse } from '../../lib/protocol';
import { MESSAGE_TYPES } from '../../lib/protocol';

/**
 * Background entry point.
 *
 * This single stateless script runs as:
 *   - an extension service worker on Chromium,
 *   - a background page on Firefox,
 *   - a non-persistent background page on Safari.
 *
 * It is the ONLY context that touches the privileged tabs API: the popup
 * sends it `webguard/analyze`, and it orchestrates:
 *
 *   adapter.getActiveTabId()
 *     -> adapter.collectPageData(tabId)   (content script observation)
 *     -> SecurityEngine.analyze(page)
 *     -> SecurityReport -> popup
 *
 * The popup never sees the tabs API — it only talks to this message handler.
 *
 * NOTE (async responses): message handlers return a Promise, which is
 * supported by Firefox, Safari, and Chromium 148+ (mid-2026). Older Chromium
 * requires the `return true` + sendResponse pattern; not supported here by
 * design (see ARCHITECTURE.md).
 */
const adapter: BrowserAdapter = createAdapter();
const engine = new SecurityEngine(createDefaultDetectorRegistry());

onMessage((message) => {
  switch (message.type) {
    case MESSAGE_TYPES.ANALYZE:
      return analyzeActivePage();
    default:
      return fail('internal-error', 'Unknown message type.');
  }
});

async function analyzeActivePage(): Promise<AnalyzeResponse> {
  try {
    const tabId = await adapter.getActiveTabId();
    if (tabId === undefined) {
      return fail('no-active-tab', 'No active browser tab could be resolved.');
    }
    const page = await adapter.collectPageData(tabId);
    const report = await engine.analyze(page);
    return { ok: true, report };
  } catch (error) {
    if (error instanceof UnsupportedPageError) {
      return fail('unsupported-page', error.message);
    }
    const detail = error instanceof Error ? error.message : 'Unknown failure while analyzing the page.';
    return fail('collection-failed', detail);
  }
}

function fail(reason: AnalyzeResponseErrorReason, detail: string): AnalyzeResponse {
  return { ok: false, reason, detail };
}

type AnalyzeResponseErrorReason = Extract<AnalyzeResponse, { ok: false }>['reason'];

export { adapter, engine };