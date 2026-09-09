import { describe, expect, it } from 'vitest';
import type { Detector } from '../detectors/interface';
import { DetectorRegistry } from '../detectors/registry';
import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';
import { SecurityEngine } from './engine';

const page: PageSecurityData = {
  url: 'https://example.com/',
  protocol: 'https:',
  hostname: 'example.com',
  origin: 'https://example.com',
  usesHttps: true,
  title: 'Example Domain',
  collectedAt: '2026-01-01T00:00:00.000Z',
  resources: [],
};

function finding(detectorId: string, severity: Finding['severity'] = 'low'): Finding {
  return {
    id: `f:${detectorId}`,
    detectorId,
    severity,
    category: 'other',
    title: `${detectorId} finding`,
    description: 'Description.',
    scoreImpact: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function stubDetector(id: string, findings: readonly Finding[]): Detector {
  return {
    meta: { id, name: id, description: 'stub', category: 'other' },
    analyze: () => findings,
  };
}

describe('SecurityEngine', () => {
  it('produces a clean report for an empty registry', async () => {
    const report = await new SecurityEngine().analyze(page);
    expect(report.findings).toHaveLength(0);
    expect(report.score.value).toBe(100);
    expect(report.score.status).toBe('secure');
    expect(report.score.confidence).toBe(1);
    expect(report.engineVersion).toBe('0.2.0');
    expect(report.page).toBe(page);
  });

  it('runs detectors in registration order and merges findings', async () => {
    const registry = new DetectorRegistry();
    registry.register(stubDetector('a', [finding('a')]));
    registry.register(stubDetector('b', [finding('b', 'high')]));

    const report = await new SecurityEngine(registry).analyze(page);
    expect(report.findings.map((f) => f.detectorId)).toEqual(['a', 'b']);
    expect(report.score.confidence).toBe(1);
  });

  it('isolates a failing detector without breaking the report', async () => {
    const registry = new DetectorRegistry();
    registry.register(stubDetector('ok', [finding('ok')]));
    registry.register({
      meta: { id: 'boom', name: 'Boom', description: 'fails', category: 'other' },
      analyze: () => {
        throw new Error('boom');
      },
    });

    const report = await new SecurityEngine(registry).analyze(page);
    expect(report.findings).toHaveLength(2);
    expect(report.findings.some((f) => f.title.includes('failed'))).toBe(true);
    expect(report.score.confidence).toBeCloseTo(0.5);
  });

  it('times out hung detectors', async () => {
    const registry = new DetectorRegistry();
    registry.register({
      meta: { id: 'hang', name: 'Hang', description: 'never resolves', category: 'other' },
      analyze: () => new Promise<readonly Finding[]>(() => {}),
    });

    const report = await new SecurityEngine(registry, { detectorTimeoutMs: 25 }).analyze(page);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.title).toContain('failed');
  });
});