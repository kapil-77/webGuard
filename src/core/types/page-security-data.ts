import type { ResourceInfo } from './resource-info';

export const PAGE_PROTOCOLS = ['http:', 'https:'] as const;

export type PageProtocol = (typeof PAGE_PROTOCOLS)[number];

/**
 * Normalized, browser-agnostic view of the page under analysis.
 *
 * The browser adapter converts browser-specific tab/content-script data into
 * exactly this shape. The security engine and every detector see ONLY this
 * object — never a raw WebExtension API type or DOM element.
 */
export interface PageSecurityData {
  /** Full normalized URL (http/https only at scan time). */
  readonly url: string;
  readonly protocol: PageProtocol;
  readonly hostname: string;
  /** RFC 6454 origin, e.g. "https://example.com". */
  readonly origin: string;
  readonly usesHttps: boolean;
  readonly title: string;
  /** ISO-8601 timestamp of when the snapshot was collected. */
  readonly collectedAt: string;
  /** Observed sub-resources (scripts, images, frames, forms, …). */
  readonly resources: readonly ResourceInfo[];
}