import { describe, expect, it } from 'vitest';
import { UnsupportedPageError } from './errors';
import { normalizeObservation, parsePageUrl } from './normalize';
import type { ContentObservation, ObservedResource } from '../../lib/protocol';

function observed(url: string, kind: ObservedResource['kind'] = 'img'): ObservedResource {
  return { url, kind };
}

function observation(overrides: Partial<ContentObservation> = {}): ContentObservation {
  return {
    url: 'https://example.com/',
    title: ' Example   Domain ',
    resources: [],
    ...overrides,
  };
}

describe('parsePageUrl', () => {
  it('parses HTTPS pages', () => {
    const parsed = parsePageUrl('https://Example.com/page?q=1#frag');
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('example.com');
    expect(parsed.origin).toBe('https://example.com');
    expect(parsed.usesHttps).toBe(true);
  });

  it('parses HTTP pages', () => {
    const parsed = parsePageUrl('http://example.com/');
    expect(parsed.protocol).toBe('http:');
    expect(parsed.usesHttps).toBe(false);
  });

  it('rejects non-http(s) pages as unsupported', () => {
    for (const url of ['chrome://settings/', 'about:blank', 'file:///c:/x.html', 'data:text/plain,hi']) {
      expect(() => parsePageUrl(url)).toThrow(UnsupportedPageError);
    }
  });

  it('rejects unparseable addresses', () => {
    expect(() => parsePageUrl('not a url')).toThrow(UnsupportedPageError);
  });
});

describe('normalizeObservation', () => {
  it('normalizes protocol/host/origin and sanitizes the title', () => {
    const page = normalizeObservation(observation());
    expect(page.protocol).toBe('https:');
    expect(page.hostname).toBe('example.com');
    expect(page.origin).toBe('https://example.com');
    expect(page.usesHttps).toBe(true);
    expect(page.title).toBe('Example Domain');
    expect(page.collectedAt).toBeTruthy();
  });

  it('derives origin/hostname/scheme for each resource and sorts deterministically', () => {
    const page = normalizeObservation(
      observation({
        resources: [observed('https://cdn.example.net/b.js', 'script'), observed('https://cdn.example.net/a.js', 'script')],
      }),
    );
    expect(page.resources.map((r) => r.url)).toEqual([
      'https://cdn.example.net/a.js',
      'https://cdn.example.net/b.js',
    ]);
    expect(page.resources[0]?.origin).toBe('https://cdn.example.net');
    expect(page.resources[0]?.scheme).toBe('https:');
  });

  it('drops non-http(s), unparseable and duplicate resources', () => {
    const page = normalizeObservation(
      observation({
        resources: [
          observed('data:text/plain,x', 'img'),
          observed('not a url', 'img'),
          observed('https://example.com/x.png', 'img'),
          observed('https://example.com/x.png', 'img'),
        ],
      }),
    );
    expect(page.resources).toHaveLength(1);
  });

  it('preserves form resources for the insecure-form detector', () => {
    const page = normalizeObservation(observation({ resources: [observed('http://example.com/login', 'form')] }));
    expect(page.resources).toHaveLength(1);
    expect(page.resources[0]?.kind).toBe('form');
  });
});