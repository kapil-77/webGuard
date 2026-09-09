import type { ResourceKind } from '../../core/types/resource-info';
import type { ContentObservation, ObservedResource } from '../../lib/protocol';

/**
 * Content-script page observer.
 *
 * Scans the current document for sub-resources (scripts, images, frames,
 * stylesheets, media, forms) and returns a raw `ContentObservation`. The
 * observer itself is deliberately *dumb*: no security judgement, no analysis —
 * it only reports what is in the DOM. All security logic lives in core/.
 *
 * Honest limitations (also documented in ARCHITECTURE.md):
 * - Only the top frame is scanned (the content script is not injected into
 *   sub-frames for this slice).
 * - Only resources present in the DOM at scan time are observed. Requests
 *   made later by JavaScript are invisible here.
 * - Anchor links (`<a href>`) are intentionally NOT reported: they are not
 *   loaded by the page, so treating them as loaded resources would produce
 *   fake positives.
 */

const RESOURCE_SELECTORS: ReadonlyArray<{ kind: ResourceKind; attr: 'src' | 'href' | 'data' | 'action'; selector: string }> = [
  { kind: 'script', attr: 'src', selector: 'script[src]' },
  { kind: 'img', attr: 'src', selector: 'img[src], input[type="image"][src]' },
  { kind: 'iframe', attr: 'src', selector: 'iframe[src]' },
  { kind: 'link', attr: 'href', selector: 'link[href]' },
  { kind: 'media', attr: 'src', selector: 'audio[src], video[src], source[src], track[src], embed[src]' },
  { kind: 'media', attr: 'data', selector: 'object[data]' },
  { kind: 'form', attr: 'action', selector: 'form[action]' },
];

const MAX_OBSERVED_RESOURCES = 500;

export interface ObservePageEnv {
  document?: Document;
  /** Page URL (unfragmented) — `window.location.href` in a real content script. */
  locationHref?: string;
}

/** Resolves a raw attribute against the document base URL; http(s) only. */
function resolveUrl(raw: string, baseHref: string): string | null {
  try {
    const url = new URL(raw, baseHref);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function observePage(env: ObservePageEnv = {}): ContentObservation {
  const doc = env.document ?? document;
  const pageHref = env.locationHref ?? ((typeof window !== 'undefined' && window.location.href) || '');
  const baseHref = doc.baseURI || pageHref;

  const resources: ObservedResource[] = [];
  const seen = new Set<string>();

  for (const { kind, attr, selector } of RESOURCE_SELECTORS) {
    const elements = doc.querySelectorAll(selector);
    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i];
      if (!element) continue;
      const raw = element.getAttribute(attr);
      if (!raw || raw.trim() === '') continue;
      const url = resolveUrl(raw, baseHref);
      if (!url) continue;
      const key = `${kind}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resources.push({ url, kind });
    }
  }

  resources.sort((a, b) => a.url.localeCompare(b.url));
  return {
    url: pageHref,
    title: doc.title ?? '',
    resources: resources.slice(0, MAX_OBSERVED_RESOURCES),
  };
}