/**
 * Human-readable security status derived from the 0..100 risk score.
 *
 * Thresholds (documented in ARCHITECTURE.md):
 *   90–100  SECURE    — no significant risk observed
 *   70–89   CAUTION   — minor or partial risks present
 *   40–69   RISK      — serious risks present
 *   0–39    DANGEROUS — critical risks present
 */

export const SECURITY_STATUSES = ['secure', 'caution', 'risk', 'dangerous'] as const;

export type SecurityStatus = (typeof SECURITY_STATUSES)[number];

export const STATUS_DISPLAY_NAMES: Readonly<Record<SecurityStatus, string>> = {
  secure: 'SECURE',
  caution: 'CAUTION',
  risk: 'RISK',
  dangerous: 'DANGEROUS',
};

export function isSecurityStatus(value: unknown): value is SecurityStatus {
  return typeof value === 'string' && SECURITY_STATUSES.includes(value as SecurityStatus);
}

/**
 * Maps a 0..100 score to a status. Non-finite values are treated as
 * DANGEROUS (defensive: never trust a corrupt score blindly).
 * `statusForScore` is intentionally a pure function of the score, so the
 * mapping is deterministic and unit-testable.
 */
export function statusForScore(value: number): SecurityStatus {
  if (!Number.isFinite(value)) return 'dangerous';
  if (value >= 90) return 'secure';
  if (value >= 70) return 'caution';
  if (value >= 40) return 'risk';
  return 'dangerous';
}