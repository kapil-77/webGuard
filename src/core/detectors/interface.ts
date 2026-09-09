import type { FindingCategory } from '../types/category';
import type { Finding } from '../types/finding';
import type { PageSnapshot } from '../types/page-snapshot';

export interface DetectorMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: FindingCategory;
}

/**
 * A security detector analyzes a normalized page snapshot and returns
 * normalized findings.
 *
 * CONTRACT: detectors are browser-agnostic. They must never import from
 * `src/browser` or touch WebExtension APIs directly. All browser data arrives
 * pre-normalized as a PageSnapshot.
 *
 * Milestone 0: this contract exists and is unit-tested; no detectors are
 * implemented yet.
 */
export interface Detector {
  readonly meta: DetectorMeta;
  analyze(snapshot: PageSnapshot): Promise<readonly Finding[]> | readonly Finding[];
}