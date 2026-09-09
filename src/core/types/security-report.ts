import type { Finding } from './finding';
import type { PageSnapshot } from './page-snapshot';
import type { RiskScore } from './risk-score';

/**
 * Final, fully serializable output of the security engine.
 * Safe to persist to extension storage and to pass across extension contexts.
 */
export interface SecurityReport {
  readonly snapshot: PageSnapshot;
  readonly findings: readonly Finding[];
  readonly score: RiskScore;
  readonly generatedAt: string;
  readonly engineVersion: string;
}