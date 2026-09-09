import { HttpsDetector } from './https-detector';
import { InsecureFormDetector } from './insecure-form-detector';
import { MixedContentDetector } from './mixed-content-detector';
import { DetectorRegistry } from './registry';
import { ThirdPartyResourceDetector } from './third-party-resource-detector';

/**
 * The default detector set, in deterministic execution order.
 * Detectors are ordered from the most fundamental control (transport) to the
 * more informational checks, so the findings list reads naturally.
 */
export function createDefaultDetectorRegistry(): DetectorRegistry {
  const registry = new DetectorRegistry();
  registry.register(new HttpsDetector());
  registry.register(new MixedContentDetector());
  registry.register(new InsecureFormDetector());
  registry.register(new ThirdPartyResourceDetector());
  return registry;
}