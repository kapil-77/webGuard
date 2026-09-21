import { describe, expect, it } from 'vitest';
import type { Finding } from '../../core/types/finding';
import type { PageSecurityData } from '../../core/types/page-security-data';
import type { ResourceInfo, ResourceKind } from '../../core/types/resource-info';
import type { SecurityReport } from '../../core/types/security-report';
import type { SecurityStatus } from '../../core/risk-scoring/security-status';
import {
  MAX_DISPLAYED_FIRST_PARTY_NODES,
  MAX_DISPLAYED_THIRD_PARTY_NODES,
  buildThreatSurface,
  findingsMentioningOrigin,
  reasonsForNode,
  riskForCentral,
  riskForResources,
} from './threat-surface-model';

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

function page(overrides: Partial<PageSecurityData> = {}): PageSecurityData {
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

function finding(title: string, evidence?: string): Finding {
  return {
    id: `f:${title}`,
    detectorId: 'test-detector',
    severity: 'info',
    category: 'other',
    title,
    description: 'Description.',
    scoreImpact: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...(evidence ? { evidence } : {}),
  };
}

function report(pageData: PageSecurityData, findings: readonly Finding[], status: SecurityStatus): SecurityReport {
  return {
    page: pageData,
    findings,
    score: {
      value: status === 'secure' ? 100 : status === 'caution' ? 80 : status === 'risk' ? 55 : 20,
      status,
      confidence: 1,
      findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    },
    generatedAt: '2026-01-01T00:00:00.000Z',
    engineVersion: '0.2.0',
  };
}

function zeroKindCounts(overrides: Partial<Record<ResourceKind, number>> = {}): Record<ResourceKind, number> {
  return { script: 0, img: 0, iframe: 0, link: 0, media: 0, form: 0, other: 0, ...overrides };
}
describe('riskForCentral', () => {
  it('maps report statuses onto the three surface indicators', () => {
    expect(riskForCentral('secure')).toBe('safe');
    expect(riskForCentral('caution')).toBe('warning');
    expect(riskForCentral('risk')).toBe('risk');
    expect(riskForCentral('dangerous')).toBe('risk');
  });
});

describe('riskForResources', () => {
  it('marks any origin hosting plain HTTP resources as risk', () => {
    expect(riskForResources(1, 'first-party')).toBe('risk');
    expect(riskForResources(3, 'third-party')).toBe('risk');
  });

  it('marks all-HTTPS third-party origins as warning', () => {
    expect(riskForResources(0, 'third-party')).toBe('warning');
  });

  it('marks all-HTTPS first-party origins as safe', () => {
    expect(riskForResources(0, 'first-party')).toBe('safe');
  });
describe('buildThreatSurface', () => {
  it('places same-origin resources under the first-party branch', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [resource('https://example.com/app.js', 'script'), resource('https://example.com/logo.png')] }), [], 'secure'),
    );
    expect(surface.central.label).toBe('example.com');
    expect(surface.central.resourceCount).toBe(2);
    expect(surface.firstParty).toHaveLength(1);
    expect(surface.firstParty[0]?.label).toBe('example.com');
    expect(surface.firstParty[0]?.resourceCount).toBe(2);
    expect(surface.firstParty[0]?.risk).toBe('safe');
    expect(surface.thirdParty).toHaveLength(0);
  });

  it('groups third-party resources by origin and counts them', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [
        resource('https://cdn.a.com/1.js', 'script'),
        resource('https://cdn.a.com/2.js', 'script'),
        resource('https://cdn.b.com/3.js', 'script'),
      ] }), [], 'secure'),
    );
    expect(surface.thirdParty).toHaveLength(2);
    const a = surface.thirdParty.find((node) => node.origin === 'https://cdn.a.com');
    expect(a?.resourceCount).toBe(2);
    expect(a?.risk).toBe('warning');
    const b = surface.thirdParty.find((node) => node.origin === 'https://cdn.b.com');
    expect(b?.resourceCount).toBe(1);
    expect(surface.totalOrigins).toBe(2);
  });

  it('flags third-party HTTP resources on an HTTPS page as risk', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [resource('http://cdn.a.com/pixel.gif')] }), [], 'secure'),
    );
    const node = surface.thirdParty[0];
    expect(node?.risk).toBe('risk');
    expect(node?.httpCount).toBe(1);
    expect(node?.reasons[0]).toContain('over plain HTTP on an HTTPS page');
  });

  it('flags any HTTP resource on an HTTP page as risk', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [resource('http://example.com/a.js', 'script')], usesHttps: false, protocol: 'http:', url: 'http://example.com/', origin: 'http://example.com' }), [], 'dangerous'),
    );
    expect(surface.central.risk).toBe('risk');
    expect(surface.firstParty[0]?.risk).toBe('risk');
    expect(surface.firstParty[0]?.reasons[0]).toContain('no transport encryption');
  });

  it('sorts third-party nodes by resource count desc, then hostname', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [
        resource('https://z.com/1.js', 'script'),
        resource('https://a.com/2.js', 'script'),
        resource('https://a.com/3.js', 'script'),
        resource('https://m.com/4.js', 'script'),
      ] }), [], 'secure'),
    );
    expect(surface.thirdParty.map((node) => node.origin)).toEqual(['https://a.com', 'https://m.com', 'https://z.com']);
  });

  it('caps displayed nodes and reports hidden counts', () => {
    const resources: ResourceInfo[] = [];
    for (let i = 0; i < MAX_DISPLAYED_THIRD_PARTY_NODES + 2; i += 1) {
      resources.push(resource(`https://cdn${i}.example.net/a.js`, 'script'));
    }
    const surface = buildThreatSurface(report(page({ resources }), [], 'secure'));
    expect(surface.thirdParty).toHaveLength(MAX_DISPLAYED_THIRD_PARTY_NODES);
    expect(surface.hiddenThirdPartyCount).toBe(2);
    expect(surface.hiddenThirdPartyResources).toBe(2);
    expect(surface.totalOrigins).toBe(MAX_DISPLAYED_THIRD_PARTY_NODES + 2);
  });

  it('computes kind counts from observed resources', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [
        resource('https://cdn.a.com/x.js', 'script'),
        resource('https://cdn.a.com/y.png'),
        resource('https://cdn.a.com/z.gif'),
      ] }), [], 'secure'),
    );
    const node = surface.thirdParty[0];
    expect(node?.kindCounts.script).toBe(1);
    expect(node?.kindCounts.img).toBe(2);
  });

  it('derives central risk from the report score status', () => {
    const surface = buildThreatSurface(report(page(), [], 'caution'));
    expect(surface.central.risk).toBe('warning');
    expect(surface.central.reasons[1]).toContain('80/100');
    expect(surface.central.reasons[0]).toContain('HTTPS');
  });

  it('marks a clean page and its own assets as safe', () => {
    const surface = buildThreatSurface(
      report(page({ resources: [resource('https://example.com/app.js', 'script')] }), [], 'secure'),
    );
    expect(surface.central.risk).toBe('safe');
    expect(surface.firstParty[0]?.risk).toBe('safe');
    expect(surface.thirdParty).toHaveLength(0);
  });
});
});

describe('reasonsForNode', () => {
  it('explains insecure forms alongside HTTP resources', () => {
    const reasons = reasonsForNode({
      group: 'third-party',
      httpCount: 1,
      httpsCount: 0,
      kindCounts: zeroKindCounts({ form: 1 }),
      pageUsesHttps: true,
    });
    expect(reasons.some((reason) => reason.includes('form'))).toBe(true);
  });

  it('explains third-party tracking risk', () => {
    const reasons = reasonsForNode({
      group: 'third-party',
      httpCount: 0,
      httpsCount: 2,
      kindCounts: zeroKindCounts({ script: 2 }),
      pageUsesHttps: true,
    });
    expect(reasons[0] ?? '').toContain('Third-party');
    expect(reasons[0] ?? '').toContain('supply-chain');
  });

  it('keeps same-origin HTTPS nodes safe', () => {
    const reasons = reasonsForNode({
      group: 'first-party',
      httpCount: 0,
      httpsCount: 2,
      kindCounts: zeroKindCounts(),
      pageUsesHttps: true,
    });
    expect(reasons[0] ?? '').toContain('HTTPS');
  });
});

describe('findingsMentioningOrigin', () => {
  it('matches origin tokens in evidence', () => {
    const titles = findingsMentioningOrigin(
      [finding('Third-party resources', 'https://tracker.example.org')],
      'https://tracker.example.org',
      'tracker.example.org',
    );
    expect(titles).toEqual(['Third-party resources']);
  });

  it('matches http://host tokens (mixed content evidence)', () => {
    const titles = findingsMentioningOrigin(
      [finding('Mixed content', 'http://cdn.example.com, http://other.org')],
      'https://cdn.example.com',
      'cdn.example.com',
    );
    expect(titles).toContain('Mixed content');
  });

  it('never matches a shorter host that merely shares a suffix', () => {
    const titles = findingsMentioningOrigin(
      [finding('Mixed content', 'http://cdn.example.com')],
      'https://example.com',
      'example.com',
    );
    expect(titles).toEqual([]);
  });

  it('deduplicates finding titles and tolerates findings without evidence', () => {
    const flagged = finding('Repeated', 'https://a.com, https://a.com');
    const titles = findingsMentioningOrigin([flagged, flagged], 'https://a.com', 'a.com');
    expect(titles).toEqual(['Repeated']);
    expect(findingsMentioningOrigin([finding('No evidence')], 'https://a.com', 'a.com')).toEqual([]);
  });
});