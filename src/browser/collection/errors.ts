/**
 * Typed collection errors raised by the browser adapter layer.
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