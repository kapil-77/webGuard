import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for onMessage(): the wrapper MUST respond through the
 * runtime's sendResponse callback (Chrome semantics), because Chrome ignores
 * a plain (non-Promise) listener return value as a response.
 */

interface Listener {
  (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void): unknown;
}

let capturedListener: Listener | undefined;

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function clearGlobals() {
  const g = globalThis as Partial<Record<string, unknown>>;
  delete g['chrome'];
  delete g['browser'];
}

type Handler = (message: { type: string; id: string }, sender: unknown) => unknown | Promise<unknown> | undefined;

/** Installs a fake chrome.* runtime, then loads a FRESH messaging module. */
async function loadWithHandler(handler: Handler): Promise<void> {
  setGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (listener: Listener) => {
          capturedListener = listener;
        },
      },
    },
  });
  setGlobal('browser', undefined);
  vi.resetModules();
  const { onMessage } = await import('./messaging');
  onMessage(handler);
}

function validEnvelope() {
  return { type: 'webguard/collect', id: 'test-1' };
}

function fire(message: unknown): { returned: unknown; responses: unknown[] } {
  const responses: unknown[] = [];
  const returned = capturedListener!(message, { tab: { id: 7 } }, (value) => responses.push(value));
  return { returned, responses };
}

describe('onMessage (Chrome sendResponse semantics)', () => {
  beforeEach(() => {
    capturedListener = undefined;
  });

  afterEach(() => {
    clearGlobals();
  });

  it('delivers a synchronous handler result through sendResponse', async () => {
    await loadWithHandler((message) => ({ seen: message.type }));

    const { returned, responses } = fire(validEnvelope());

    expect(typeof capturedListener).toBe('function');
    expect(returned).toBeUndefined(); // synchronous path: no `true` needed
    expect(responses).toEqual([{ seen: 'webguard/collect' }]);
  });

  it('delivers an async handler result via sendResponse after the promise resolves', async () => {
    await loadWithHandler(async () => ({ ok: true }));

    const { returned, responses } = fire(validEnvelope());

    expect(returned).toBe(true); // keeps the channel open for async sendResponse
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    expect(responses).toEqual([{ ok: true }]);
  });

  it('drops malformed messages without invoking the handler', async () => {
    let calls = 0;
    await loadWithHandler(() => {
      calls += 1;
      return { ok: true };
    });

    const { responses } = fire('not an envelope');

    expect(calls).toBe(0);
    expect(responses).toEqual([]);
  });

  it('does not respond when the handler declines (returns undefined)', async () => {
    await loadWithHandler(() => undefined);

    const { returned, responses } = fire(validEnvelope());

    expect(returned).toBeUndefined();
    expect(responses).toEqual([]);
  });
});