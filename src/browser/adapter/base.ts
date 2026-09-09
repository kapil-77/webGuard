import { getActiveTabId as queryActiveTabId } from '../runtime/messaging';
import { createEnvelope, sendTabMessage } from '../runtime/messaging';
import type { PageSecurityData } from '../../core/types/page-security-data';
import type { BrowserRuntimeApi } from '../runtime/namespace';
import { normalizeObservation } from '../collection/normalize';
import { isContentObservation, MESSAGE_TYPES } from '../../lib/protocol';
import { CollectionFailedError } from '../collection/errors';
import type { BrowserAdapter, BrowserId, WebGuardCapabilities } from './interface';

/**
 * Shared adapter scaffolding.
 *
 * The tab-transport primitives (query active tab, ask a tab's content script
 * for observed page data) are genuinely identical across Chromium, Firefox
 * and Safari — the API shape is the same — so they live here once. Concrete
 * adapters only declare capabilities/identity; browser-specific behavior is
 * added over time as thin overrides rather than branching logic in the core.
 */
export abstract class BaseBrowserAdapter implements BrowserAdapter {
  readonly #id: BrowserId;
  readonly #capabilities: Readonly<WebGuardCapabilities>;
  readonly #api: BrowserRuntimeApi;

  protected constructor(id: BrowserId, capabilities: Readonly<WebGuardCapabilities>, api: BrowserRuntimeApi) {
    this.#id = id;
    this.#capabilities = capabilities;
    this.#api = api;
  }

  get id(): BrowserId {
    return this.#id;
  }

  get capabilities(): Readonly<WebGuardCapabilities> {
    return this.#capabilities;
  }

  get api(): BrowserRuntimeApi {
    return this.#api;
  }

  async getActiveTabId(): Promise<number | undefined> {
    return queryActiveTabId();
  }

  async collectPageData(tabId: number): Promise<PageSecurityData> {
    const envelope = createEnvelope(MESSAGE_TYPES.COLLECT_PAGE_DATA);
    const raw = await sendTabMessage(tabId, envelope);
    if (!isContentObservation(raw)) {
      throw new CollectionFailedError('The content script did not return a valid page observation.');
    }
    return normalizeObservation(raw);
  }
}