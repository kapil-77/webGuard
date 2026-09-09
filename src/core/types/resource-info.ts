/**
 * A single observed sub-resource of the analyzed page.
 *
 * `ResourceInfo` is the *normalized* form: the browser layer resolves raw DOM
 * attributes into absolute URLs and derives origin/hostname/scheme. Detectors
 * consume only this shape — never raw element attributes.
 *
 * Extensible by design: later milestones can add headers, sizes, timing, etc.
 */
export const RESOURCE_KINDS = ['script', 'img', 'iframe', 'link', 'media', 'form', 'other'] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface ResourceInfo {
  /** Absolute URL (fragment stripped) exactly as resolved by the observer. */
  readonly url: string;
  /** RFC 6454 origin, e.g. "https://cdn.example.com" (default ports omitted). */
  readonly origin: string;
  readonly hostname: string;
  readonly scheme: 'http:' | 'https:';
  /** What kind of DOM node produced this resource. */
  readonly kind: ResourceKind;
}