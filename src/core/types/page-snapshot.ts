/**
 * Normalized, browser-agnostic view of the page under analysis.
 *
 * Browser adapters convert browser-specific tab data into this shape. The
 * security engine and every detector see ONLY this object — never a raw
 * WebExtension API type.
 */
export interface PageSnapshot {
  /** Full URL exactly as observed (http/https only at scan time). */
  readonly url: string;
  readonly host: string;
  readonly protocol: string;
  readonly title: string;
  /** ISO-8601 timestamp of when the snapshot was collected. */
  readonly collectedAt: string;
}