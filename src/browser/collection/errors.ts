/**
 * Typed collection errors raised by the browser adapter layer.
 *
 * These travel across the messaging boundary as `detail` strings (the wire
 * format is JSON), but inside a single extension context they let the
 * background classify a failure precisely (unsupported page vs. content
 * script failure vs. internal error).
 */

export class UnsupportedPageError extends Error {
  constructor(message = 'WebGuard: this page cannot be analyzed.') {
    super(message);
    this.name = 'UnsupportedPageError';
  }
}

export class CollectionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionFailedError';
  }
}