import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';
import type { Detector } from './interface';

/**
 * HTTPS detector.
 *
 * HTTPS is the single most important transport control: without it, traffic —
 * including credentials and cookies — can be read and modified by anyone on
 * the network path.
 */
export class HttpsDetector implements Detector {
  readonly meta = {
    id: 'https',
    name: 'HTTPS',
    description: 'Confirms the page is transported over TLS (HTTPS).',
    category: 'transport-security',
  } as const;

  analyze(page: PageSecurityData): readonly Finding[] {
    if (page.usesHttps) {
      return [
        {
          id: 'https:enabled',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'HTTPS is enabled',
          description:
            'The page is served over an encrypted HTTPS connection, so its content cannot be read or modified in transit by network observers.',
          evidence: `${page.protocol}//${page.hostname}`,
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    return [
      {
        id: 'https:disabled',
        detectorId: this.meta.id,
        severity: 'critical',
        category: this.meta.category,
        title: 'Page is not served over HTTPS',
        description:
          'The page is served over plain HTTP. Traffic — including any credentials or cookies — can be intercepted or modified by anyone on the network path. The site should enforce an HTTPS redirect.',
        evidence: `${page.protocol}//${page.hostname}`,
        scoreImpact: 1,
        createdAt: page.collectedAt,
      },
    ];
  }
}