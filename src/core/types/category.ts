/**
 * Coarse categorization of security findings. Categories keep detectors honest
 * and give the future report UI stable groupings to render against.
 */
export const FINDING_CATEGORIES = [
  'transport-security',
  'content-security',
  'cookie-security',
  'privacy',
  'integrity',
  'identity',
  'network',
  'other',
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export function isFindingCategory(value: unknown): value is FindingCategory {
  return typeof value === 'string' && FINDING_CATEGORIES.includes(value as FindingCategory);
}