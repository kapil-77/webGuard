import { describe, expect, it } from 'vitest';
import type { Finding } from '../types/finding';
import { scoreFindings } from './scorer';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    detectorId: 'detector-a',
    severity: 'low',
    category: 'other',
    title: 'A finding',
    description: 'Observed something.',
    scoreImpact: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('scoreFindings', () => {
  it('returns 100 for a clean report', () => {
    const score = scoreFindings([]);
    expect(score.value).toBe(100);
    expect(score.confidence).toBe(1);
  });

  it('applies the severity weight scaled by scoreImpact', () => {
    // critical weight = 40 -> score 60.
    const score = scoreFindings([finding({ severity: 'critical', scoreImpact: 1 })]);
    expect(score.value).toBe(60);
    expect(score.findingCounts.critical).toBe(1);
  });

  it('scales partial scoreImpact', () => {
    // high weight = 25, impact 0.5 -> 12.5 risk -> 88 (rounded).
    const score = scoreFindings([finding({ severity: 'high', scoreImpact: 0.5 })]);
    expect(score.value).toBe(88);
  });

  it('does not penalize info findings', () => {
    const score = scoreFindings([finding({ severity: 'info', scoreImpact: 1 })]);
    expect(score.value).toBe(100);
  });

  it('clamps at 0', () => {
    const score = scoreFindings([
      finding({ id: 'a', severity: 'critical' }),
      finding({ id: 'b', severity: 'critical' }),
      finding({ id: 'c', severity: 'critical' }),
    ]);
    expect(score.value).toBe(0);
  });

  it('ignores non-finite scoreImpact defensively', () => {
    const score = scoreFindings([finding({ severity: 'high', scoreImpact: Number.NaN })]);
    expect(score.value).toBe(100);
  });

  it('keeps confidence within [0,1]', () => {
    expect(scoreFindings([], { confidence: 0.4 }).confidence).toBe(0.4);
    expect(scoreFindings([], { confidence: 2 }).confidence).toBe(1);
    expect(scoreFindings([], { confidence: -1 }).confidence).toBe(0);
  });
});