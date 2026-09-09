import { isValidEnvelope, type MessageEnvelope } from '../../lib/validation';
import { resolveNamespace } from './namespace';

/**
 * Validated messaging primitives shared by background, content and popup.
 *
 * Security rule: EVERY inbound message passes `isValidEnvelope` before it is
 * dispatched. Anything malformed is dropped silently.
 */

export interface ExtensionMessage extends MessageEnvelope {}

let cachedApi: ReturnType<typeof resolveNamespace> | undefined;

function api(): ReturnType<typeof resolveNamespace> {
  cachedApi ??= resolveNamespace();
  return cachedApi;
}

/** Builds a wire envelope: { type, id, payload? }. */
export function createEnvelope(type: string, payload?: unknown): MessageEnvelope {
  return {
    type,
    id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    payload,
  };
}

/** Sends a validated envelope to other extension contexts (background, etc.). */
export async function sendMessage(message: MessageEnvelope): Promise<unknown> {
  const send = api().runtime.sendMessage;
  if (!send) {
    throw new Error('WebGuard: runtime.sendMessage is unavailable in this context');
  }
  return await send(message);
}

export type MessageHandler = (message: MessageEnvelope, sender: unknown) => unknown | Promise<unknown> | undefined;

/**
 * Registers an inbound message listener. Immutable rule: the listener only
 * ever sees envelopes that passed structural validation.
 */
export function onMessage(handler: MessageHandler): void {
  const register = api().runtime.onMessage;
  if (!register) {
    throw new Error('WebGuard: runtime.onMessage is unavailable in this context');
  }
  register((message: unknown, sender: unknown) => {
    if (!isValidEnvelope(message)) {
      return undefined;
    }
    return handler(message, sender);
  });
}