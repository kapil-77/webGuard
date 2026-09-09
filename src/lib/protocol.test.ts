import { describe, expect, it } from 'vitest';
import { isContentObservation, parseAnalyzeResponse } from './protocol';

describe('isContentObservation', () => {
  it('accepts a well-formed observation', () => {
    expect(
      isContentObservation({
        url: 'https://example.com/',
        title: 'T',
        resources: [{ url: 'https://example.com/a.js', kind: 'script' }],
      }),
    ).toBe(true);
  });

  it('accepts an empty resource list (pages with no declared resources)', () => {
    expect(isContentObservation({ url: 'https://example.com/', title: '', resources: [] })).toBe(true);
  });

  it('rejects malformed observations', () => {
    expect(isContentObservation(undefined)).toBe(false);
    expect(isContentObservation('x')).toBe(false);
    expect(isContentObservation({ url: 'https://example.com/', resources: [] })).toBe(false);
    expect(isContentObservation({ url: '', title: 'T', resources: [] })).toBe(false);
    expect(
      isContentObservation({ url: 'https://example.com/', title: 'T', resources: [{ url: 'x', kind: 'nope' }] }),
    ).toBe(false);
  });
});

describe('parseAnalyzeResponse', () => {
  it('passes a well-formed success response through', () => {
    const report = { page: { url: 'https://a/' }, score: { value: 100 }, findings: [] };
    const parsed = parseAnalyzeResponse({ ok: true, report });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.report).toEqual(report);
    }
  });

  it('preserves known failure reasons', () => {
    const parsed = parseAnalyzeResponse({ ok: false, reason: 'unsupported-page', detail: 'nope' });
    expect(parsed).toEqual({ ok: false, reason: 'unsupported-page', detail: 'nope' });
  });

  it('collapses unknown reasons into internal-error', () => {
    const parsed = parseAnalyzeResponse({ ok: false, reason: 'mystery', detail: 'x' });
    expect(parsed.ok).toBe(false);
    expect(parsed).toMatchObject({ reason: 'internal-error' });
  });

  it('collapses unparseable payloads into internal-error', () => {
    expect(parseAnalyzeResponse(null).ok).toBe(false);
    expect(parseAnalyzeResponse('hi').ok).toBe(false);
    expect(parseAnalyzeResponse({ ok: true, report: 'nope' }).ok).toBe(false);
  });
});