import { describe, expect, it } from 'vitest';
import { displayUrl, sanitizeText } from './sanitize';

describe('sanitizeText', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(sanitizeText('a\u0000b\u0007c\n\td')).toBe('a b c d');
  });

  it('truncates long values with an ellipsis', () => {
    const value = 'x'.repeat(300);
    const result = sanitizeText(value, 50);
    expect(result).toHaveLength(51);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate short values', () => {
    expect(sanitizeText('short')).toBe('short');
  });
});

describe('displayUrl', () => {
  it('renders the hostname for http(s) URLs', () => {
    expect(displayUrl('https://Example.com/path?q=1')).toBe('example.com');
  });

  it('neutralizes non-http(s) schemes', () => {
    expect(displayUrl('javascript:alert(document.cookie)')).toBe('[javascript page]');
    expect(displayUrl('data:text/plain,x')).toBe('[data page]');
  });

  it('handles missing and unparseable input', () => {
    expect(displayUrl(null)).toBe('[no address]');
    expect(displayUrl(undefined)).toBe('[no address]');
    expect(displayUrl('')).toBe('[no address]');
  });
});