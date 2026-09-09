import type { FindingCategory } from './category';
import type { Severity } from './severity';

/**
 * A single normalized security finding — the common currency of the engine.
 *
 * Every detector (regardless of the browser whose data it consumed) returns
 * findings of exactly this shape. The scorer and the report UI depend only on
 * this contract, never on browser-specific objects.
 *
 *   severity    -> how bad it is
 *   category    -> what area of security it belongs to
 *   title       -> short human label
 *   description -> what was observed and why it matters
 *   evidence    -> optional display-safe observed artifact
 *   scoreImpact -> 0..1 multiplier on top of the severity weight
 */
export interface Finding {
  /** Stable identifier for deduplication and anchoring in the report. */
  readonly id: string;
  /** Detector that produced this finding (empty for engine-level errors). */
  readonly detectorId: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly title: string;
  readonly description: string;
  /** Optional observed artifact. MUST be display-safe before it reaches UI. */
  readonly evidence?: string;
  /** 0..1 multiplier applied onto the severity weight by the scorer. */
  readonly scoreImpact: number;
  readonly createdAt: string;
}