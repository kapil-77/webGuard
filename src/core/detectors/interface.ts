import type { FindingCategory } from '../types/category';
import type { Finding } from '../types/finding';
import type { PageSecurityData } from '../types/page-security-data';

export interface DetectorMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: FindingCategory;
}

/**
 * A security detector analyzes normalized page data and returns normalized
 * findings.
 *
 * CONTRACT: detectors are browser-agnostic. They must never import from
 * `src/browser` or touch WebExtension APIs directly. All browser data arrives
 * pre-normalized as a PageSecurityData.
 */
export interface Detector {
  readonly meta: DetectorMeta;
  analyze(page: PageSecurityData): Promise<readonly Finding[]> | readonly Finding[];
}