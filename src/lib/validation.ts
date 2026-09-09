import type { Finding } from '../core/types/finding';
import { isFindingCategory } from '../core/types/category';
import { isSeverity } from '../core/types/severity';

/** Structural guards for untrusted extension messages. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The validated wire envelope used for ALL extension messaging.
 * Every runtime message must pass `isValidEnvelope` before dispatch.
 */
export interface MessageEnvelope {
  readonly type: string;
  readonly id: string;
  readonly payload?: unknown;
}

export function isValidEnvelope(value: unknown): value is MessageEnvelope {
  return isRecord(value) && isNonEmptyString(value.type) && isNonEmptyString(value.id);
}

/**
 * Runtime validation for anything claiming to be a normalized Finding.
 * Used before persisting findings and before rendering them.
 */
export function isValidFinding(value: unknown): value is Finding {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.detectorId === 'string' &&
    isSeverity(value.severity) &&
    isFindingCategory(value.category) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isFiniteNumber(value.scoreImpact) &&
    isNonEmptyString(value.createdAt) &&
    (value.evidence === undefined || typeof value.evidence === 'string')
  );
}