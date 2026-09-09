import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';
import type { ResourceInfo } from '../types/resource-info';
import type { Detector } from './interface';

const MAX_EVIDENCE_ORIGINS = 5;

/**
 * Third-party resource detector.
 *
 * Identifies sub-resources (scripts, images, frames, media, stylesheets) whose
 * origin differs from the page's own origin. Loading third-party code and
 * content can introduce tracking and supply-chain risk: the page's security
 * posture then depends on every origin it trusts.
 *
 * LIMITATION (documented): only resources present in the DOM at scan time are
 * considered. Same as the mixed-content detector, dynamically injected
 * resources after the scan are not observed.
 *
 * Forms are excluded: a form's endpoint is a data destination, not a
 * page sub-resource, and is already covered by the insecure-form detector.
 */
export class ThirdPartyResourceDetector implements Detector {
  readonly meta = {
    id: 'third-party-resource',
    name: 'Third-party resources',
    description: 'Identifies sub-resources loaded from origins other than the page origin.',
    category: 'privacy',
  } as const;

  analyze(page: PageSecurityData): readonly Finding[] {
    const thirdParty = page.resources.filter((r) => r.kind !== 'form' && r.origin !== page.origin);

    if (thirdParty.length === 0) {
      return [
        {
          id: 'third-party:none',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'No third-party resources',
          description: 'Every observed sub-resource on this page comes from the page\u2019s own origin.',
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    const count = thirdParty.length;
    const origins = distinctOrigins(thirdParty);
    return [
      {
        id: 'third-party:present',
        detectorId: this.meta.id,
        severity: 'info',
        category: this.meta.category,
        title: `${count} resource${count === 1 ? '' : 's'} loaded from third-party origin${origins.length === 1 ? '' : 's'}`,
        description:
          `The page loads ${count} sub-resource${count === 1 ? '' : 's'} from ${origins.length} third-party origin${origins.length === 1 ? '' : 's'}. Third-party code and content can track visitors and introduce supply-chain risk, because the page\u2019s security then depends on every origin it trusts.`,
        evidence: origins.join(', '),
        scoreImpact: 0,
        createdAt: page.collectedAt,
      },
    ];
  }
}

function distinctOrigins(resources: readonly ResourceInfo[]): string[] {
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const resource of resources) {
    if (!seen.has(resource.origin)) {
      seen.add(resource.origin);
      origins.push(resource.origin);
      if (origins.length >= MAX_EVIDENCE_ORIGINS) break;
    }
  }
  return origins;
}