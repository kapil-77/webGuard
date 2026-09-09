/** Severity levels for normalized security findings. */
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

export type Severity = (typeof SEVERITIES)[number];

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && SEVERITIES.includes(value as Severity);
}

/**
 * Severity weight used by the risk scorer. The weight is the maximum number of
 * risk points a single finding of that severity can contribute (when its
 * `scoreImpact` is 1).
 */
export const SEVERITY_WEIGHTS: Readonly<Record<Severity, number>> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
  info: 0,
};