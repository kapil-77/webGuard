import { describe, expect, it } from 'vitest';
import { createDefaultDetectorRegistry } from '../detectors/registry-factory';
import type { PageSecurityData } from '../types/page-security-data';
import type { ResourceInfo, ResourceKind } from '../types/resource-info';
import { SecurityEngine } from './engine';

/**
 * End-to-end pipeline tests: PageSecurityData -> detectors -> scoring.
 * These use the real default detector registry and real fixtures, so they
 * double as documentation of the slice's expected results.
 */

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
  return { url, origin: parsed.origin, hostname: parsed.hostname, scheme: parsed.protocol as 'http:' | 'https:', kind };
}

const engine = new SecurityEngine(createDefaultDetectorRegistry());

describe('SecurityEngine pipeline (default detectors)', () => {
  it('clean HTTPS page -> 100 SECURE with 4 info findings', async () => {
    const report = await engine.analyze(makePage());
    expect(report.findings).toHaveLength(4);
    expect(report.findings.every((f) => f.severity === 'info')).toBe(true);
    expect(report.score.value).toBe(100);
    expect(report.score.status).toBe('secure');
    expect(report.score.confidence).toBe(1);
  });

  it('HTTPS page with insecure form -> CAUTION', async () => {
    const report = await engine.analyze(makePage({ resources: [resource('http://example.com/login', 'form')] }));
    expect(report.score.value).toBe(75);
    expect(report.score.status).toBe('caution');
    expect(report.findings.some((f) => f.id === 'insecure-form:present')).toBe(true);
  });

  it('plain HTTP page -> RISK', async () => {
    const report = await engine.analyze(
      makePage({ url: 'http://example.com/', protocol: 'http:', origin: 'http://example.com', usesHttps: false }),
    );
    expect(report.score.value).toBe(60);
    expect(report.score.status).toBe('risk');
    expect(report.findings.some((f) => f.id === 'https:disabled')).toBe(true);
  });

  it('HTTPS page with mixed content and insecure form -> RISK', async () => {
    const report = await engine.analyze(
      makePage({ resources: [resource('http://example.com/track.gif', 'img'), resource('http://example.com/login', 'form')] }),
    );
    // 100 - high(mixed) 25 - high(form) 25 = 50 -> RISK.
    expect(report.score.value).toBe(50);
    expect(report.score.status).toBe('risk');
    expect(report.findings.some((f) => f.id === 'mixed-content:present')).toBe(true);
    expect(report.findings.some((f) => f.id === 'insecure-form:present')).toBe(true);
  });
});