import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';
import type { ResourceInfo } from '../types/resource-info';
import type { Detector } from './interface';

const MAX_EVIDENCE_HOSTS = 5;

function evidenceHosts(resources: readonly ResourceInfo[]): string {
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const resource of resources) {
    const label = `http://${resource.hostname}`;
    if (!seen.has(label)) {
      seen.add(label);
      hosts.push(label);
      if (hosts.length >= MAX_EVIDENCE_HOSTS) break;
    }
  }
  return hosts.join(', ');
}

/**
 * Mixed content detector.
 *
 * Detects sub-resources (scripts, images, frames, media, stylesheets) loaded
 * over plain HTTP by an HTTPS page. Modern browsers block some of these, but
 * anything that still loads can be modified by an active network attacker.
 *
 * LIMITATION (documented): detection is based on the DOM at scan time, so it
 * only sees resources declared in markup/DOM. Requests made by JS after the
 * scan, or in nested frames, are not observed. Network-level observation is a
 * later milestone (webRequest is observation-only on Chromium and unavailable
 * on iOS).
 *
 * Forms are intentionally excluded here — they are covered by the dedicated
 * InsecureFormDetector so a form endpoint is never double-counted.
 */
export class MixedContentDetector implements Detector {
  readonly meta = {
    id: 'mixed-content',
    name: 'Mixed content',
    description: 'Detects HTTP sub-resources loaded by an HTTPS page.',
    category: 'transport-security',
  } as const;

  analyze(page: PageSecurityData): readonly Finding[] {
    if (!page.usesHttps) {
      return [
        {
          id: 'mixed-content:not-assessed',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'Mixed content not assessed',
          description:
            'Mixed content is only meaningful on HTTPS pages. This page is served over HTTP, so the HTTPS detector already covers transport risk.',
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    const insecure = page.resources.filter((r) => r.scheme === 'http:' && r.kind !== 'form');

    if (insecure.length === 0) {
      return [
        {
          id: 'mixed-content:none',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'No mixed content detected',
          description: 'Every sub-resource observed on this HTTPS page was loaded over HTTPS.',
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    const count = insecure.length;
    return [
      {
        id: 'mixed-content:present',
        detectorId: this.meta.id,
        severity: 'high',
        category: this.meta.category,
        title: `${count} insecure resource${count === 1 ? '' : 's'} loaded over HTTP`,
        description:
          `An HTTPS page loaded ${count} sub-resource${count === 1 ? '' : 's'} over unencrypted HTTP. These requests can be intercepted or tampered with by an attacker on the network path, which can compromise the otherwise-encrypted page.`,
        evidence: evidenceHosts(insecure),
        scoreImpact: 1,
        createdAt: page.collectedAt,
      },
    ];
  }
}