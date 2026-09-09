import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';
import type { ResourceInfo } from '../types/resource-info';
import type { Detector } from './interface';

const MAX_EVIDENCE_HOSTS = 5;

function evidenceHosts(forms: readonly ResourceInfo[]): string {
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const form of forms) {
    const label = `http://${form.hostname}`;
    if (!seen.has(label)) {
      seen.add(label);
      hosts.push(label);
      if (hosts.length >= MAX_EVIDENCE_HOSTS) break;
    }
  }
  return hosts.join(', ');
}

/**
 * Insecure form detector.
 *
 * Finds `<form>` elements whose resolved `action` is a plain HTTP endpoint on
 * an HTTPS page. Submitting such a form sends user data in clear text.
 *
 * LIMITATION (documented): only forms with an explicit `action` attribute are
 * observed. A form without an action submits to the current URL — safe on an
 * HTTPS page — and is therefore not reported. Forms built entirely in
 * JavaScript after the scan are not observed.
 */
export class InsecureFormDetector implements Detector {
  readonly meta = {
    id: 'insecure-form',
    name: 'Insecure forms',
    description: 'Detects forms that submit user data to insecure HTTP endpoints.',
    category: 'transport-security',
  } as const;

  analyze(page: PageSecurityData): readonly Finding[] {
    if (!page.usesHttps) {
      return [
        {
          id: 'insecure-form:not-assessed',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'Insecure forms not assessed',
          description: 'Form security is only assessed on HTTPS pages. This page is served over HTTP.',
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    const insecureForms = page.resources.filter((r) => r.kind === 'form' && r.scheme === 'http:');

    if (insecureForms.length === 0) {
      return [
        {
          id: 'insecure-form:none',
          detectorId: this.meta.id,
          severity: 'info',
          category: this.meta.category,
          title: 'No insecure forms',
          description: 'Every observed form on this page submits to an HTTPS endpoint.',
          scoreImpact: 0,
          createdAt: page.collectedAt,
        },
      ];
    }

    const count = insecureForms.length;
    return [
      {
        id: 'insecure-form:present',
        detectorId: this.meta.id,
        severity: 'high',
        category: this.meta.category,
        title: `${count} form${count === 1 ? '' : 's'} submit data over insecure HTTP`,
        description:
          `${count === 1 ? 'A form on this page submits' : `${count} forms on this page submit`} user input to a plain HTTP endpoint. Submitted data — including passwords or personal information — would be sent unencrypted.`,
        evidence: evidenceHosts(insecureForms),
        scoreImpact: 1,
        createdAt: page.collectedAt,
      },
    ];
  }
}