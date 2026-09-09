import type { Finding } from '../types/finding';
import type { RiskScore } from '../types/risk-score';
import { SEVERITY_WEIGHTS, type Severity } from '../types/severity';

export interface ScoringOptions {
  /** 0..1 confidence (fraction of detectors that completed successfully). */
  readonly confidence?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function scaledImpact(finding: Finding): number {
  const impact = finding.scoreImpact;
  return Number.isFinite(impact) ? clamp01(impact) : 0;
}

/**
 * Collapses normalized findings into a single 0..100 security score.
 *
 * - Each finding contributes `severityWeight * clamp01(scoreImpact)` risk
 *   points.
 * - Higher risk lowers the score: 100 = clean report, 0 = critical posture.
 * - Findings with unknown severities are counted but never influence the
 *   score (defensive: never trust foreign severity values blindly).
 */
export function scoreFindings(findings: readonly Finding[], options: ScoringOptions = {}): RiskScore {
  let riskPoints = 0;
  const findingCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const finding of findings) {
    const count = findingCounts[finding.severity];
    if (count === undefined) {
      // Unknown severity: defensive skip (do not trust arbitrary input).
      continue;
    }
    findingCounts[finding.severity] = count + 1;
    riskPoints += SEVERITY_WEIGHTS[finding.severity] * scaledImpact(finding);
  }

  const value = Math.max(0, Math.min(100, Math.round(100 - riskPoints)));
  return {
    value,
    confidence: clamp01(options.confidence ?? 1),
    findingCounts,
  };
}