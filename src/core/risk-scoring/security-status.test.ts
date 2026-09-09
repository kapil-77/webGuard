import { describe, expect, it } from 'vitest';
import { STATUS_DISPLAY_NAMES, statusForScore } from './security-status';

describe('statusForScore (threshold boundaries)', () => {
  it('maps 90..100 to SECURE', () => {
    expect(statusForScore(100)).toBe('secure');
    expect(statusForScore(90)).toBe('secure');
  });

  it('maps 70..89 to CAUTION', () => {
    expect(statusForScore(89)).toBe('caution');
    expect(statusForScore(70)).toBe('caution');
  });

  it('maps 40..69 to RISK', () => {
    expect(statusForScore(69)).toBe('risk');
    expect(statusForScore(40)).toBe('risk');
  });

  it('maps 0..39 to DANGEROUS', () => {
    expect(statusForScore(39)).toBe('dangerous');
    expect(statusForScore(0)).toBe('dangerous');
  });

  it('treats non-finite scores as DANGEROUS (defensive)', () => {
    expect(statusForScore(Number.NaN)).toBe('dangerous');
    expect(statusForScore(Number.POSITIVE_INFINITY)).toBe('dangerous');
  });
});

describe('STATUS_DISPLAY_NAMES', () => {
  it('uses the required labels', () => {
    expect(STATUS_DISPLAY_NAMES.secure).toBe('SECURE');
    expect(STATUS_DISPLAY_NAMES.caution).toBe('CAUTION');
    expect(STATUS_DISPLAY_NAMES.risk).toBe('RISK');
    expect(STATUS_DISPLAY_NAMES.dangerous).toBe('DANGEROUS');
  });
});