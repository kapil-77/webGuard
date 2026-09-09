import type { BrowserRuntimeApi } from '../runtime/namespace';
import type { BrowserAdapter, BrowserId, WebGuardCapabilities } from './interface';

/**
 * Shared adapter scaffolding. Concrete adapters only declare their
 * capabilities and identity; browser-specific behavior is added over time as
 * thin overrides rather than branching logic in the core.
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
}