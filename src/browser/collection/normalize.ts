import type { PageSecurityData } from '../../core/types/page-security-data';
import type { ResourceInfo, ResourceKind } from '../../core/types/resource-info';
import type { ContentObservation, ObservedResource } from '../../lib/protocol';
import { sanitizeText } from '../../lib/sanitize';
import { UnsupportedPageError } from './errors';

const MAX_LABEL_LENGTH = 120;
const MAX_RESOURCES = 300;

export interface NormalizedPageUrl {
  readonly url: string;
  readonly protocol: 'http:' | 'https:';
  readonly hostname: string;
  readonly origin: string;
  readonly usesHttps: boolean;
}

/**
 * Parses the page URL supplied by the content script.
 *
 * Only http/https pages are analyzable. Everything else (chrome://, file://,
 * about:, extension pages, …) raises UnsupportedPageError so the background
 * can report it distinctly to the UI.
 */
export function parsePageUrl(rawUrl: string): NormalizedPageUrl {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsupportedPageError('The page address could not be parsed.');
  }
  const protocol = parsed.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new UnsupportedPageError(`Pages using the ${protocol || 'unknown'} scheme cannot be analyzed.`);
  }
  if (parsed.hostname === '') {
    throw new UnsupportedPageError('The page address has no hostname.');
  }
  return {
    url: parsed.toString(),
    protocol,
    hostname: parsed.hostname,
    origin: parsed.origin,
    usesHttps: protocol === 'https:',
  };
}

function normalizeResources(observed: readonly ObservedResource[], pageOrigin: string): readonly ResourceInfo[] {
  const seen = new Set<string>();
  const resources: ResourceInfo[] = [];

  for (const item of observed) {
    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      continue; // Drop unparseable resource URLs rather than guessing.
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    if (parsed.hostname === '') continue;

    const key = `${item.kind}|${parsed.toString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    resources.push({
      url: parsed.toString(),
      origin: parsed.origin,
      hostname: parsed.hostname,
      scheme: parsed.protocol,
      kind: item.kind,
    });
    if (resources.length >= MAX_RESOURCES) break;
  }

  // Deterministic order for stable detector output.
  resources.sort((a, b) => a.url.localeCompare(b.url));
  return resources;
}

/**
 * Normalizes a content-script observation into the browser-agnostic
 * PageSecurityData consumed by the security engine.
 */
export function normalizeObservation(observation: ContentObservation): PageSecurityData {
  const { url, origin, protocol, hostname, usesHttps } = parsePageUrl(observation.url);
  return {
    url,
    protocol,
    hostname,
    origin,
    usesHttps,
    title: sanitizeText(observation.title, MAX_LABEL_LENGTH),
    collectedAt: new Date().toISOString(),
    resources: normalizeResources(observation.resources, origin),
  };
}

export type { ResourceKind };