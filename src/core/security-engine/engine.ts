import type { Detector } from '../detectors/interface';
import { DetectorRegistry } from '../detectors/registry';
import type { Finding } from '../types/finding';
import type { PageSnapshot } from '../types/page-snapshot';
import type { SecurityReport } from '../types/security-report';
import { sanitizeText } from '../../lib/sanitize';
import { scoreFindings } from '../risk-scoring/scorer';

/** Bumped whenever the engine contract or scoring math changes. */
export const ENGINE_VERSION = '0.1.0';

export interface AnalyzeOptions {
  /** Per-detector timeout in ms; isolates the report from hung detectors. */
  readonly detectorTimeoutMs?: number;
}

const DEFAULT_DETECTOR_TIMEOUT_MS = 2_000;

/**
 * The browser-agnostic security engine.
 *
 * Pipeline (ARCHITECTURE.md):
 *   PageSnapshot -> Detectors -> Finding[] -> RiskScore -> SecurityReport
 *
 * The engine owns no browser APIs and no display logic. It orchestrates
 * detectors, tolerates their failures, and delegates scoring.
 */
export class SecurityEngine {
  readonly #registry: DetectorRegistry;
  readonly #detectorTimeoutMs: number;

  constructor(registry: DetectorRegistry = new DetectorRegistry(), options: AnalyzeOptions = {}) {
    this.#registry = registry;
    this.#detectorTimeoutMs = options.detectorTimeoutMs ?? DEFAULT_DETECTOR_TIMEOUT_MS;
  }

  get detectorCount(): number {
    return this.#registry.size;
  }

  async analyze(snapshot: PageSnapshot): Promise<SecurityReport> {
    const detectors = this.#registry.getAll();
    const findings: Finding[] = [];
    let succeeded = 0;

    for (const detector of detectors) {
      try {
        const result = await Promise.race([
          Promise.resolve(detector.analyze(snapshot)),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`timed out after ${this.#detectorTimeoutMs}ms`)), this.#detectorTimeoutMs);
          }),
        ]);
        findings.push(...result);
        succeeded += 1;
      } catch (error) {
        // Detector isolation: a failing detector must never break the report.
        findings.push(this.#detectorFailureFinding(detector.meta.id, error));
      }
    }

    const confidence = detectors.length === 0 ? 1 : succeeded / detectors.length;
    const score = scoreFindings(findings, { confidence });

    return {
      snapshot,
      findings,
      score,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
    };
  }

  #detectorFailureFinding(detectorId: string, error: unknown): Finding {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      id: `detector-error:${detectorId}:${Date.now()}`,
      detectorId: '',
      severity: 'info' as const,
      category: 'other' as const,
      title: `Detector "${detectorId}" failed`,
      description: `The detector raised an error and was skipped: ${sanitizeText(detail, 160)}`,
      scoreImpact: 0,
      createdAt: new Date().toISOString(),
    };
  }
}