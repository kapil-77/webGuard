import { isValidEnvelope, type MessageEnvelope } from '../../lib/validation';
import { resolveNamespace, type BrowserTabsApi, type RuntimeMessageListener } from './namespace';

/**
 * Validated messaging primitives shared by background, content and popup.
 *
 * Security rule: EVERY inbound message passes `isValidEnvelope` before it is
 * dispatched. Anything malformed is dropped silently.
 */

export interface ExtensionMessage extends MessageEnvelope {}

let cachedApi: ReturnType<typeof resolveNamespace> | undefined;
let cachedTabs: BrowserTabsApi | undefined;

function api(): ReturnType<typeof resolveNamespace> {
  cachedApi ??= resolveNamespace();
  return cachedApi;
}

function tabsApi(): BrowserTabsApi {
  cachedTabs ??= api().tabs;
  if (!cachedTabs) {
    throw new Error('WebGuard: the tabs API is unavailable in this context');
  }
  return cachedTabs;
}

/** Builds a wire envelope: { type, id, payload? }. */
export function createEnvelope(type: string, payload?: unknown): MessageEnvelope {
  return {
    type,
    id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    payload,
  };
}

/** Sends a validated envelope to the extension background (from the popup). */
export async function sendMessage(message: MessageEnvelope): Promise<unknown> {
  const send = api().runtime.sendMessage;
  if (!send) {
    throw new Error('WebGuard: runtime.sendMessage is unavailable in this context');
  }
  return await send(message);
}

export type MessageHandler = (message: MessageEnvelope, sender: unknown) => unknown | Promise<unknown> | undefined;

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Registers an inbound message listener.
 *
 * `runtime.onMessage` is an Event object: listeners are added with
 * `onMessage.addListener(...)`, NOT by invoking `onMessage` directly.
 * Listeners respond through the third argument — `sendResponse`.
 *
 * Chrome does NOT use a plain (non-Promise) listener return value as the
 * response; the only valid mechanisms are `sendResponse(value)` (all
 * versions) or a returned Promise (Chrome 148+, Firefox, Safari). This
 * wrapper normalizes both: a handler that returns a value is delivered via
 * `sendResponse` synchronously; a handler that returns a Promise is delivered
 * via `sendResponse` once it resolves (returning `true` keeps the channel
 * open for the async `sendResponse`).
 *
 * Immutable rule: the listener only ever sees envelopes that passed
 * structural validation.
 */
export function onMessage(handler: MessageHandler): void {
  const onMessageEvent = api().runtime.onMessage;
  if (!onMessageEvent?.addListener) {
    throw new Error('WebGuard: runtime.onMessage is unavailable in this context');
  }
  const listener: RuntimeMessageListener = (message, sender, sendResponse) => {
    if (!isValidEnvelope(message)) {
      return undefined;
    }
    const result = handler(message, sender);
    if (result === undefined) {
      // Handler declined to respond — leave the channel untouched.
      return undefined;
    }
    if (isPromiseLike(result)) {
      void Promise.resolve(result).then(
        (value) => sendResponse(value),
        () => sendResponse(undefined),
      );
      return true; // keep the channel open for the async sendResponse
    }
    sendResponse(result);
    return undefined;
  };
  onMessageEvent.addListener(listener);
}

/**
 * Resolves the id of the active tab in the current window.
 *
 * The tab *id* is available without any permission (accessing tab.url/title
 * would require the `tabs` permission or host permissions — WebGuard instead
 * obtains page data from its declared content script, so no `tabs` permission
 * is needed).
 */
export async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await tabsApi().query({ currentWindow: true, active: true });
  const id = tabs[0]?.id;
  return typeof id === 'number' ? id : undefined;
}

/** Sends a validated envelope to a specific tab (background -> content script). */
export async function sendTabMessage(tabId: number, message: MessageEnvelope): Promise<unknown> {
  const send = tabsApi().sendMessage;
  if (!send) {
    throw new Error('WebGuard: tabs.sendMessage is unavailable in this context');
  }
  return await send(tabId, message);
}