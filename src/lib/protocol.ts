import type { ResourceKind } from '../core/types/resource-info';
import type { SecurityReport } from '../core/types/security-report';
import { RESOURCE_KINDS } from '../core/types/resource-info';
import { isNonEmptyString, isRecord } from './validation';

/**
 * Extension message protocol.
 *
 * Every message type used across popup / background / content is declared
 * here, strongly typed, together with structural validators. This is the
 * single source of truth for the wire contract — the UI and the privileged
 * background never negotiate types ad-hoc.
 *
 * Wire envelope (from lib/validation): { type, id, payload? }
 */

export const MESSAGE_TYPES = {
  /** popup -> background: analyze the active tab. */
  ANALYZE: 'webguard/analyze',
  /** background -> content: collect observed page data from the DOM. */
  COLLECT_PAGE_DATA: 'webguard/collect-page-data',
} as const;

/** Reasons the background may fail to produce a report. */
export const ANALYZE_FAILURE_REASONS = ['no-active-tab', 'unsupported-page', 'collection-failed', 'internal-error'] as const;

export type AnalyzeFailureReason = (typeof ANALYZE_FAILURE_REASONS)[number];

export interface AnalyzeResponseOk {
  readonly ok: true;
  readonly report: SecurityReport;
}

export interface AnalyzeResponseError {
  readonly ok: false;
  readonly reason: AnalyzeFailureReason;
  readonly detail: string;
}

export type AnalyzeResponse = AnalyzeResponseOk | AnalyzeResponseError;

/**
 * A single raw resource observed in the page DOM by the content script.
 * `kind` mirrors ResourceInfo.kind so detectors classify forms separately.
 */
export interface ObservedResource {
  readonly url: string;
  readonly kind: ResourceKind;
}

/**
 * Raw, un-normalized observation returned by the content script.
 * The browser adapter layer normalizes this into PageSecurityData.
 */
export interface ContentObservation {
  /** Page URL exactly as reported by the tab's location. */
  readonly url: string;
  readonly title: string;
  readonly resources: readonly ObservedResource[];
}

export function isObservedResource(value: unknown): value is ObservedResource {
  return (
    isRecord(value) &&
    isNonEmptyString(value.url) &&
    typeof value.kind === 'string' &&
    RESOURCE_KINDS.includes(value.kind as ResourceKind)
  );
}

export function isContentObservation(value: unknown): value is ContentObservation {
  return (
    isRecord(value) &&
    isNonEmptyString(value.url) &&
    typeof value.title === 'string' &&
    Array.isArray(value.resources) &&
    value.resources.every(isObservedResource)
  );
}

/**
 * Validates and normalizes an unknown analyze response from the background.
 * Any malformed payload is collapsed into an internal-error so the UI never
 * receives an unexpected shape.
 */
export function parseAnalyzeResponse(value: unknown): AnalyzeResponse {
  if (isRecord(value) && value.ok === true && isRecord(value.report) && isRecord(value.report.page) && isRecord(value.report.score)) {
    return { ok: true, report: value.report as unknown as SecurityReport };
  }
  if (isRecord(value) && value.ok === false) {
    const reason = value.reason;
    const detail = typeof value.detail === 'string' ? value.detail : 'Unknown error.';
    if (typeof reason === 'string' && ANALYZE_FAILURE_REASONS.includes(reason as AnalyzeFailureReason)) {
      return { ok: false, reason: reason as AnalyzeFailureReason, detail };
    }
    return { ok: false, reason: 'internal-error', detail: 'Malformed error response.' };
  }
  return { ok: false, reason: 'internal-error', detail: 'The background returned an unexpected response.' };
}