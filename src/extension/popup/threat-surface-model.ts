import { STATUS_DISPLAY_NAMES, type SecurityStatus } from '../../core/risk-scoring/security-status';
import type { Finding } from '../../core/types/finding';
import type { PageProtocol } from '../../core/types/page-security-data';
import type { ResourceInfo, ResourceKind } from '../../core/types/resource-info';
import type { SecurityReport } from '../../core/types/security-report';
import { sanitizeText } from '../../lib/sanitize';

/**
 * Threat-surface model - presentation only.
 *
 * Derives the visualization graph from a real SecurityReport: the page origin
 * becomes the central node, same-origin resources form the first-party branch
 * and every other observed origin forms the third-party branch. Risk levels
 * are computed from the observed resources and the report score exactly the
 * way the detectors reason about them, so the map never invents data and
 * stays consistent with the findings list below it.
 *
 * This module is pure TypeScript (no DOM, no React) so the classification is
 * deterministic and unit-testable. It lives in the popup layer on purpose:
 * it changes nothing in src/core, src/browser, or the background.
 */

export const THREAT_RISKS = ['safe', 'warning', 'risk'] as const;

export type ThreatRisk = (typeof THREAT_RISKS)[number];

export const THREAT_GROUPS = ['first-party', 'third-party'] as const;

export type ThreatGroup = (typeof THREAT_GROUPS)[number];

/**
 * Render caps keep the map compact on very busy pages. They only limit how
 * many nodes are drawn on screen - the hidden counters below carry the real
 * totals, so no information is fabricated or dropped silently.
 */
export const MAX_DISPLAYED_FIRST_PARTY_NODES = 3;
export const MAX_DISPLAYED_THIRD_PARTY_NODES = 6;

const MAX_MATCHING_FINDING_TITLES = 3;
const MAX_NODE_LABEL_LENGTH = 36;

export interface ThreatNode {
  /** Stable display key, e.g. "third:https://cdn.example.com". */
  readonly id: string;
  /** Human label (hostname, truncated). */
  readonly label: string;
  /** RFC 6454 origin of this node, e.g. "https://cdn.example.com". */
  readonly origin: string;
  readonly group: ThreatGroup;
  readonly risk: ThreatRisk;
  readonly resourceCount: number;
  readonly httpCount: number;
  readonly httpsCount: number;
  readonly kindCounts: Readonly<Record<ResourceKind, number>>;
  /** Human-readable reasons this node is flagged (or safe). */
  readonly reasons: readonly string[];
  /** Titles of report findings whose evidence references this origin. */
  readonly findingTitles: readonly string[];
}

export interface ThreatCentral {
  /** Page hostname (truncated) as the central-node label. */
  readonly label: string;
  readonly hostname: string;
  readonly protocol: PageProtocol;
  readonly resourceCount: number;
  readonly risk: ThreatRisk;
  readonly status: SecurityStatus;
  readonly reasons: readonly string[];
}

export interface ThreatSurface {
  readonly central: ThreatCentral;
  readonly firstParty: readonly ThreatNode[];
  readonly thirdParty: readonly ThreatNode[];
  readonly hiddenFirstPartyCount: number;
  readonly hiddenFirstPartyResources: number;
  readonly hiddenThirdPartyCount: number;
  readonly hiddenThirdPartyResources: number;
  readonly totalResources: number;
  readonly totalOrigins: number;
}

/** Maps the report status onto the three surface indicators. */
export function riskForCentral(status: SecurityStatus): ThreatRisk {
  switch (status) {
    case 'caution':
      return 'warning';
    case 'risk':
    case 'dangerous':
      return 'risk';
    default:
      return 'safe';
  }
}

/**
 * Node risk from observed resources - mirrors what the detectors flag:
 * - any plain HTTP resource is a genuine transport risk (mixed content on
 *   HTTPS pages, or plaintext on HTTP pages),
 * - otherwise a third-party origin carries privacy/supply-chain exposure,
 * - same-origin HTTPS-only nodes are clean.
 */
export function riskForResources(httpCount: number, group: ThreatGroup): ThreatRisk {
  if (httpCount > 0) return 'risk';
  if (group === 'third-party') return 'warning';
  return 'safe';
}

export function buildKindCounts(resources: readonly ResourceInfo[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { script: 0, img: 0, iframe: 0, link: 0, media: 0, form: 0, other: 0 };
  for (const item of resources) {
    counts[item.kind] = counts[item.kind] + 1;
  }
  return counts;
}

/**
 * Finds report findings whose evidence references this origin, so the map
 * "why flagged" text stays consistent with the findings list. Evidence tokens
 * are matched exactly (`origin`, `http://host`, `https://host`) - a hostname
 * that merely appears as a suffix of another host is never a false match.
 */
export function findingsMentioningOrigin(
  findings: readonly Finding[],
  origin: string,
  hostname: string,
): readonly string[] {
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    const evidence = finding.evidence;
    if (!evidence) continue;
    const tokens = evidence.split(/[\s,]+/);
    const hit = tokens.some(
      (token) => token === origin || token === `http://${hostname}` || token === `https://${hostname}`,
    );
    if (hit && !seen.has(finding.title)) {
      seen.add(finding.title);
      matches.push(finding.title);
      if (matches.length >= MAX_MATCHING_FINDING_TITLES) break;
    }
  }
  return matches;
}

export function reasonsForNode(input: {
  readonly group: ThreatGroup;
  readonly httpCount: number;
  readonly httpsCount: number;
  readonly kindCounts: Readonly<Record<ResourceKind, number>>;
  readonly pageUsesHttps: boolean;
}): readonly string[] {
  const { group, httpCount, httpsCount, kindCounts, pageUsesHttps } = input;
  const total = httpCount + httpsCount;
  const plural = (n: number): string => (n === 1 ? '' : 's');

  if (httpCount > 0) {
    const reasons = [
      pageUsesHttps
        ? `${httpCount} resource${plural(httpCount)} load${httpCount === 1 ? 's' : ''} over plain HTTP on an HTTPS page — requests can be intercepted or modified in transit.`
        : `${httpCount} resource${plural(httpCount)} load${httpCount === 1 ? 's' : ''} over plain HTTP — no transport encryption.`,
    ];
    if (kindCounts.form > 0) {
      reasons.push(`${kindCounts.form} form${plural(kindCounts.form)} submit user data to an insecure endpoint.`);
    }
    if (kindCounts.script > 0) {
      reasons.push(
        `A network attacker could tamper with ${kindCounts.script} insecure script${plural(kindCounts.script)} loaded here.`,
      );
    }
    return reasons;
  }

  if (group === 'third-party') {
    return [
      'Third-party origin loaded by the page — it can track visitors and expand the page\u2019s supply-chain trust.',
    ];
  }

  return [`All ${total} resource${plural(total)} share the page origin and load over HTTPS.`];
}

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return sanitizeText(origin, MAX_NODE_LABEL_LENGTH);
  }
}

function buildCentralReasons(report: SecurityReport): readonly string[] {
  const { page, score } = report;
  return [
    page.usesHttps
      ? 'Served over HTTPS — transport between browser and site is encrypted.'
      : 'Served over plain HTTP — no transport encryption on this page.',
    `Security score ${score.value}/100 — ${STATUS_DISPLAY_NAMES[score.status]}.`,
  ];
}

/**
 * Builds the full threat-surface graph from a real report.
 * Purely derived from `page.resources`, `page.origin/usesHttps`, `findings`
 * and `score` — no hardcoded domains, no mocked data.
 */
export function buildThreatSurface(report: SecurityReport): ThreatSurface {
  const { page, findings } = report;

  const firstByOrigin = new Map<string, ResourceInfo[]>();
  const thirdByOrigin = new Map<string, ResourceInfo[]>();
  for (const item of page.resources) {
    const bucket = item.origin === page.origin ? firstByOrigin : thirdByOrigin;
    const list = bucket.get(item.origin);
    if (list) {
      list.push(item);
    } else {
      bucket.set(item.origin, [item]);
    }
  }

  const firstEntries = [...firstByOrigin.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const thirdEntries = [...thirdByOrigin.entries()].sort((a, b) => {
    const byCount = b[1].length - a[1].length;
    return byCount !== 0 ? byCount : a[0].localeCompare(b[0]);
  });

  const toNode = (origin: string, resources: readonly ResourceInfo[], group: ThreatGroup): ThreatNode => {
    const kindCounts = buildKindCounts(resources);
    const httpCount = resources.filter((item) => item.scheme === 'http:').length;
    const httpsCount = resources.length - httpCount;
    const hostname = hostnameOf(origin);
    return {
      id: `${group}:${origin}`,
      label: sanitizeText(hostname, MAX_NODE_LABEL_LENGTH),
      origin,
      group,
      risk: riskForResources(httpCount, group),
      resourceCount: resources.length,
      httpCount,
      httpsCount,
      kindCounts,
      reasons: reasonsForNode({ group, httpCount, httpsCount, kindCounts, pageUsesHttps: page.usesHttps }),
      findingTitles: findingsMentioningOrigin(findings, origin, hostname),
    };
  };

  const allFirst = firstEntries.map(([origin, resources]) => toNode(origin, resources, 'first-party'));
  const allThird = thirdEntries.map(([origin, resources]) => toNode(origin, resources, 'third-party'));

  const firstParty = allFirst.slice(0, MAX_DISPLAYED_FIRST_PARTY_NODES);
  const thirdParty = allThird.slice(0, MAX_DISPLAYED_THIRD_PARTY_NODES);

  const hiddenFirstPartyCount = allFirst.length - firstParty.length;
  const hiddenThirdPartyCount = allThird.length - thirdParty.length;
  const hiddenFirstPartyResources = allFirst
    .slice(firstParty.length)
    .reduce((sum, node) => sum + node.resourceCount, 0);
  const hiddenThirdPartyResources = allThird
    .slice(thirdParty.length)
    .reduce((sum, node) => sum + node.resourceCount, 0);

  return {
    central: {
      label: sanitizeText(page.hostname, MAX_NODE_LABEL_LENGTH),
      hostname: page.hostname,
      protocol: page.protocol,
      resourceCount: page.resources.length,
      risk: riskForCentral(report.score.status),
      status: report.score.status,
      reasons: buildCentralReasons(report),
    },
    firstParty,
    thirdParty,
    hiddenFirstPartyCount,
    hiddenFirstPartyResources,
    hiddenThirdPartyCount,
    hiddenThirdPartyResources,
    totalResources: page.resources.length,
    totalOrigins: allFirst.length + allThird.length,
  };
}