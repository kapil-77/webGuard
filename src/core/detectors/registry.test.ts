import { describe, expect, it } from 'vitest';
import type { Detector } from './interface';
import { DetectorRegistry } from './registry';

function stubDetector(id: string): Detector {
  return {
    meta: { id, name: id, description: 'stub', category: 'other' },
    analyze: () => [],
  };
}

describe('DetectorRegistry', () => {
  it('registers and lists detectors in order', () => {
    const registry = new DetectorRegistry();
    registry.register(stubDetector('a'));
    registry.register(stubDetector('b'));
    expect(registry.size).toBe(2);
    expect(registry.getAll().map((d) => d.meta.id)).toEqual(['a', 'b']);
  });

  it('looks up a detector by id', () => {
    const registry = new DetectorRegistry();
    registry.register(stubDetector('tls'));
    expect(registry.get('tls')?.meta.id).toBe('tls');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    const registry = new DetectorRegistry();
    registry.register(stubDetector('dup'));
    expect(() => registry.register(stubDetector('dup'))).toThrow(/already registered/);
  });

  it('rejects detectors without a meta.id', () => {
    const registry = new DetectorRegistry();
    const broken = { meta: { id: '' as string }, analyze: () => [] } as unknown as Detector;
    expect(() => registry.register(broken)).toThrow(/meta.id is required/);
  });
});