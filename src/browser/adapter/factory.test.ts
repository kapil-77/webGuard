import { describe, expect, it } from 'vitest';
import type { BrowserRuntimeApi } from '../runtime/namespace';
import { createAdapter, detectBrowserId } from './factory';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 OPR/120.0.0.0',
} as const;

function fakeApi(): BrowserRuntimeApi {
  return { runtime: {} };
}

describe('detectBrowserId', () => {
  it('detects Chromium family UAs', () => {
    expect(detectBrowserId(UA.chrome)).toBe('chromium');
    expect(detectBrowserId(UA.edge)).toBe('chromium');
    expect(detectBrowserId(UA.opera)).toBe('chromium');
  });

  it('detects Firefox', () => {
    expect(detectBrowserId(UA.firefox)).toBe('firefox');
  });

  it('detects Safari only when no Chromium token is present', () => {
    expect(detectBrowserId(UA.safari)).toBe('webkit');
  });

  it('throws on unrecognized UAs', () => {
    expect(() => detectBrowserId('Lynx/2.8.9')).toThrow(/unrecognized browser/);
  });
});

describe('createAdapter', () => {
  it('builds the requested adapter with the resolved namespace', () => {
    const host = { browser: fakeApi() };
    const adapter = createAdapter('chromium', host);
    expect(adapter.id).toBe('chromium');
    expect(adapter.capabilities.backgroundModel).toBe('extension-service-worker');
    expect(adapter.capabilities.blockingWebRequests).toBe(false);
  });

  it('falls back to chrome.* when browser.* is absent (pre-148 Chromium)', () => {
    const host = { chrome: fakeApi() };
    const adapter = createAdapter('firefox', host);
    expect(adapter.id).toBe('firefox');
    expect(adapter.capabilities.backgroundModel).toBe('background-page');
    expect(adapter.capabilities.blockingWebRequests).toBe(true);
  });

  it('truthfully declares WebKit limitations', () => {
    const adapter = createAdapter('webkit', { browser: fakeApi() });
    expect(adapter.capabilities.webRequestUnavailableOnIOS).toBe(true);
    expect(adapter.capabilities.blockingWebRequests).toBe(false);
  });
});