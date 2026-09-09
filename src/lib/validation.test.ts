import { describe, expect, it } from 'vitest';
import type { Finding } from '../core/types/finding';
import { isFindingCategory } from '../core/types/category';
import { isSeverity } from '../core/types/severity';
import { isFiniteNumber, isNonEmptyString, isRecord, isValidEnvelope, isValidFinding } from './validation';

describe('validation primitives', () => {
  it('isRecord rejects arrays, null and primitives', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('isNonEmptyString trims before judging', () => {
    expect(isNonEmptyString('x')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString(0)).toBe(false);
  });

  it('isFiniteNumber rejects NaN and non-numbers', () => {
    expect(isFiniteNumber(1.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });

  it('severity/category matchers are consistent with internals', () => {
    expect(isSeverity('critical')).toBe(true);
    expect(isSeverity('nope')).toBe(false);
    expect(isFindingCategory('privacy')).toBe(true);
    expect(isFindingCategory('nope')).toBe(false);
  });
});

describe('isValidEnvelope (extension messaging contract)', () => {
  it('accepts a well-formed envelope', () => {
    expect(isValidEnvelope({ type: 'webguard/hello', id: 'abc' })).toBe(true);
  });

  it('rejects malformed messages', () => {
    expect(isValidEnvelope(undefined)).toBe(false);
    expect(isValidEnvelope('hello')).toBe(false);
    expect(isValidEnvelope({ type: 'webguard/hello' })).toBe(false);
    expect(isValidEnvelope({ id: 'abc' })).toBe(false);
    expect(isValidEnvelope({ type: '', id: 'abc' })).toBe(false);
    expect(isValidEnvelope([])).toBe(false);
  });
});

describe('isValidFinding (finding contract)', () => {
  function sample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'f-1',
      detectorId: 'd-1',
      severity: 'medium',
      category: 'privacy',
      title: 'T',
      description: 'D',
      scoreImpact: 0.7,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('accepts a well-formed finding', () => {
    expect(isValidFinding(sample())).toBe(true);
  });

  it('rejects invalid severities, categories and shapes', () => {
    expect(isValidFinding(sample({ severity: 'severe' }))).toBe(false);
    expect(isValidFinding(sample({ category: 'nope' }))).toBe(false);
    expect(isValidFinding(sample({ scoreImpact: 'high' }))).toBe(false);
    expect(isValidFinding(sample({ scoreImpact: Number.NaN }))).toBe(false);
    expect(isValidFinding(sample({ title: '' }))).toBe(false);
    expect(isValidFinding({ ...sample(), extra: true })).toBe(true);
    expect(isValidFinding(null)).toBe(false);
    expect(isValidFinding('finding')).toBe(false);
  });

  it('type-narrows evidence to string when present', () => {
    const withEvidence = sample({ evidence: 'GET /x 403' });
    expect(isValidFinding(withEvidence)).toBe(true);
    expect(isValidFinding(sample({ evidence: 42 }))).toBe(false);
  });
});