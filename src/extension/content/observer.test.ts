import { describe, expect, it } from 'vitest';
import { observePage } from './observer';

interface FakeElement {
  attr: string;
  value: string;
}

function fakeElement({ attr, value }: FakeElement): Element {
  return {
    getAttribute: (name: string) => (name === attr ? value : null),
  } as unknown as Element;
}

function fakeDocument(elements: Record<string, readonly FakeElement[]>): Document {
  return {
    baseURI: 'https://example.com/',
    title: 'Fixture',
    querySelectorAll: (selector: string) => (elements[selector] ?? []).map(fakeElement) as unknown as NodeListOf<Element>,
  } as unknown as Document;
}

describe('observePage', () => {
  it('resolves relative resource URLs against the document base', () => {
    const doc = fakeDocument({ 'script[src]': [{ attr: 'src', value: '/app.js' }] });
    const observation = observePage({ document: doc, locationHref: 'https://example.com/' });
    expect(observation.resources.map((r) => r.url)).toEqual(['https://example.com/app.js']);
    expect(observation.resources[0]?.kind).toBe('script');
  });

  it('reports the page url and title', () => {
    const doc = fakeDocument({});
    const observation = observePage({ document: doc, locationHref: 'https://example.com/path' });
    expect(observation.url).toBe('https://example.com/path');
    expect(observation.title).toBe('Fixture');
  });

  it('drops non-http(s) resources like data: URLs', () => {
    const doc = fakeDocument({ 'img[src], input[type="image"][src]': [{ attr: 'src', value: 'data:image/png;base64,AA==' }] });
    const observation = observePage({ document: doc, locationHref: 'https://example.com/' });
    expect(observation.resources).toHaveLength(0);
  });

  it('deduplicates identical kind+url pairs', () => {
    const elements = [{ attr: 'src', value: '/x.png' }, { attr: 'src', value: '/x.png' }];
    const doc = fakeDocument({ 'img[src], input[type="image"][src]': elements });
    const observation = observePage({ document: doc, locationHref: 'https://example.com/' });
    expect(observation.resources).toHaveLength(1);
  });

  it('categorizes forms separately and does not report anchors as loaded resources', () => {
    const doc = fakeDocument({
      'form[action]': [{ attr: 'action', value: 'http://example.com/login' }],
      'link[href]': [{ attr: 'href', value: '/site.webmanifest' }],
    });
    const observation = observePage({ document: doc, locationHref: 'https://example.com/' });
    const kinds = observation.resources.map((r) => r.kind);
    expect(kinds).toContain('form');
    expect(kinds).toContain('link');
    expect(observation.resources.some((r) => r.kind === 'link' && r.url.includes('javascript:'))).toBe(false);
  });

  it('sorts resources deterministically by url', () => {
    const doc = fakeDocument({ 'script[src]': [{ attr: 'src', value: '/z.js' }, { attr: 'src', value: '/a.js' }] });
    const observation = observePage({ document: doc, locationHref: 'https://example.com/' });
    expect(observation.resources.map((r) => r.url)).toEqual(['https://example.com/a.js', 'https://example.com/z.js']);
  });
});