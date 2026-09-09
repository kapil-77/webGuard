/**
 * Display sanitizers.
 *
 * Nothing scraped from a web page or received over extension messaging is
 * rendered verbatim. These helpers normalize text and URLs before they reach
 * any UI, which — combined with React's default output escaping — keeps the
 * popup/report XSS-free.
 */

const MAX_LABEL_LENGTH = 120;

/** Strips control characters, collapses whitespace, truncates visibly. */
export function sanitizeText(value: string, maxLength: number = MAX_LABEL_LENGTH): string {
  const cleaned = value
    // Replace control characters (except whitespace handled below) with a
    // single space so words never get glued together.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Renders a URL safely for display: non-http(s) schemes are replaced with a
 * neutral label, anything unparseable is truncated text, never raw HTML.
 */
export function displayUrl(value: string | null | undefined): string {
  if (!value) return '[no address]';

  const colon = value.indexOf(':');
  const protocol = colon === -1 ? '' : value.slice(0, colon + 1);
  if (protocol === 'http:' || protocol === 'https:') {
    try {
      const parsed = new URL(value);
      return parsed.hostname !== '' ? parsed.hostname : sanitizeText(value);
    } catch {
      return sanitizeText(value);
    }
  }
  if (protocol !== '') {
    return `[${protocol.slice(0, -1)} page]`;
  }
  return sanitizeText(value);
}