import type { Detector } from './interface';

/**
 * Ordered registry of security detectors. The engine runs them in
 * registration order and isolates their failures.
 *
 * Milestone 0: the registry exists, is validated and tested, but is seeded
 * with zero detectors on purpose.
 */
export class DetectorRegistry {
  readonly #detectors: Detector[] = [];

  register(detector: Detector): void {
    if (!detector.meta?.id) {
      throw new Error('Detector meta.id is required before registration');
    }
    if (this.#detectors.some((d) => d.meta.id === detector.meta.id)) {
      throw new Error(`Detector already registered: ${detector.meta.id}`);
    }
    this.#detectors.push(detector);
  }

  get(id: string): Detector | undefined {
    return this.#detectors.find((d) => d.meta.id === id);
  }

  getAll(): readonly Detector[] {
    return this.#detectors;
  }

  get size(): number {
    return this.#detectors.length;
  }
}