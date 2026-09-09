/**
 * Content script — passive and privacy-first.
 *
 * Registered at document_idle on every page (see manifests/base.json).
 *
 * Milestone 0: deliberate no-op. Nothing is read from the page, nothing is
 * mutated, nothing is sent anywhere. Page observation and snapshot collection
 * will be added in a later milestone, and only behind the browser adapter
 * layer so this script never touches browser APIs directly.
 */