import { describe, expect, it } from 'vitest';
import type { PageSecurityData } from '../types/page-security-data';
import type { ResourceInfo, ResourceKind } from '../types/resource-info';
import { HttpsDetector } from './https-detector';
import { InsecureFormDetector } from './insecure-form-detector';
import { MixedContentDetector } from './mixed-content-detector';
import { ThirdPartyResourceDetector } from './third-party-resource-detector';

function makePage(overrides: Partial<PageSecurityData> = {}): PageSecurityData {
  return {
    url: 'https://example.com/',
    protocol: 'https:',
    hostname: 'example.com',
    origin: 'https://example.com',
    usesHttps: true,
    title: 'Fixture',
    collectedAt: '2026-01-01T00:00:00.000Z',
    resources: [],
    ...overrides,
  };
}

function resource(url: string, kind: ResourceKind = 'img'): ResourceInfo {
  const parsed = new URL(url);
  return {
    url,
    origin: parsed.origin,
    hostname: parsed.hostname,
    scheme: parsed.protocol as 'http:' | 'https:',
    kind,
  };
}

describe('HttpsDetector', () => {
  it('returns a positive info finding for HTTPS', () => {
    const [finding] = new HttpsDetector().analyze(makePage());
    expect(finding?.id).toBe('https:enabled');
    expect(finding?.severity).toBe('info');
    expect(finding?.scoreImpact).toBe(0);
    expect(finding?.evidence).toBe('https://example.com');
  });

  it('returns a critical finding for plain HTTP', () => {
    const [finding] = new HttpsDetector().analyze(
      makePage({ url: 'http://example.com/', protocol: 'http:', origin: 'http://example.com', usesHttps: false }),
    );
    expect(finding?.id).toBe('https:disabled');
    expect(finding?.severity).toBe('critical');
    expect(finding?.scoreImpact).toBe(1);
    expect(finding?.evidence).toBe('http://example.com');
  });
});

describe('MixedContentDetector', () => {
  it('flags HTTPS pages that load HTTP sub-resources', () => {
    const [finding] = new MixedContentDetector().analyze(
      makePage({ resources: [resource('http://cdn.example.com/a.js', 'script'), resource('https://cdn.example.com/b.js', 'script')] }),
    );
    expect(finding?.id).toBe('mixed-content:present');
    expect(finding?.severity).toBe('high');
    expect(finding?.scoreImpact).toBe(1);
    expect(finding?.evidence).toContain('http://cdn.example.com');
  });

  it('reports clean HTTPS pages as info (no mixed content)', () => {
    const [finding] = new MixedContentDetector().analyze(
      makePage({ resources: [resource('https://cdn.example.com/a.js', 'script')] }),
    );
    expect(finding?.id).toBe('mixed-content:none');
    expect(finding?.severity).toBe('info');
  });

  it('does not count insecure forms (dedicated detector covers them)', () => {
    const [finding] = new MixedContentDetector().analyze(
      makePage({ resources: [resource('http://example.com/login', 'form')] }),
    );
    expect(finding?.id).toBe('mixed-content:none');
  });

  it('does not assess mixed content on HTTP pages (HTTP already critical)', () => {
    const [finding] = new MixedContentDetector().analyze(
      makePage({ url: 'http://example.com/', protocol: 'http:', usesHttps: false }),
    );
    expect(finding?.id).toBe('mixed-content:not-assessed');
    expect(finding?.severity).toBe('info');
  });
});

describe('InsecureFormDetector', () => {
  it('flags HTTPS pages with HTTP form actions', () => {
    const [finding] = new InsecureFormDetector().analyze(
      makePage({ resources: [resource('http://example.com/login', 'form')] }),
    );
    expect(finding?.id).toBe('insecure-form:present');
    expect(finding?.severity).toBe('high');
    expect(finding?.evidence).toContain('http://example.com');
  });

  it('reports clean forms as info', () => {
    const [finding] = new InsecureFormDetector().analyze(
      makePage({ resources: [resource('https://example.com/login', 'form')] }),
    );
    expect(finding?.id).toBe('insecure-form:none');
    expect(finding?.severity).toBe('info');
  });

  it('does not assess forms on HTTP pages', () => {
    const [finding] = new InsecureFormDetector().analyze(
      makePage({ usesHttps: false }),
    );
    expect(finding?.id).toBe('insecure-form:not-assessed');
  });

  it('agrees with mixed-content: forms and sub-resources are counted independently', () => {
    const page = makePage({
      resources: [resource('http://example.com/login', 'form'), resource('http://example.com/track.gif', 'img')],
    });
    const [mixed] = new MixedContentDetector().analyze(page);
    const [forms] = new InsecureFormDetector().analyze(page);
    expect(mixed?.id).toBe('mixed-content:present');
    expect(forms?.id).toBe('insecure-form:present');
  });
});

describe('ThirdPartyResourceDetector', () => {
  it('flags resources from origins other than the page origin', () => {
    const [finding] = new ThirdPartyResourceDetector().analyze(
      makePage({ resources: [resource('https://cdn.example.net/app.js', 'script')] }),
    );
    expect(finding?.id).toBe('third-party:present');
    expect(finding?.severity).toBe('info');
    expect(finding?.scoreImpact).toBe(0);
    expect(finding?.evidence).toContain('https://cdn.example.net');
  });

  it('reports same-origin resources as clean', () => {
    const [finding] = new ThirdPartyResourceDetector().analyze(
      makePage({ resources: [resource('https://example.com/app.js', 'script')] }),
    );
    expect(finding?.id).toBe('third-party:none');
  });

  it('does not count form endpoints as third-party sub-resources', () => {
    const [finding] = new ThirdPartyResourceDetector().analyze(
      makePage({ resources: [resource('https://other.example.com/submit', 'form')] }),
    );
    expect(finding?.id).toBe('third-party:none');
  });
});