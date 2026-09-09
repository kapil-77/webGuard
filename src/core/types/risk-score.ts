import type { SecurityStatus } from '../risk-scoring/security-status.ts';
import type { Severity } from './severity';

/**
 * Overall security score for a page.
 *
 *   value      -> 0 (worst) .. 100 (best); see src/core/risk-scoring
 *   status     -> SECURE / CAUTION / RISK / DANGEROUS (see security-status.ts)
 *   confidence -> 0..1 fraction of registered detectors that completed
 *   findingCounts -> breakdown per severity
 */
export interface RiskScore {
  readonly value: number;
  readonly status: SecurityStatus;
  readonly confidence: number;
  readonly findingCounts: Readonly<Record<Severity, number>>;
}