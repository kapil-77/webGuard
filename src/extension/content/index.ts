import { onMessage } from '../../browser/runtime/messaging';
import { MESSAGE_TYPES } from '../../lib/protocol';
import { observePage } from './observer';

/**
 * Content script — passive, privacy-first, and browser-agnostic.
 *
 * Runs at document_idle on every page (see manifests/base.json). It exposes a
 * single capability: when the background asks it (via tabs.sendMessage), it
 * returns a raw observation of the page DOM. It never initiates messages,
 * never touches storage, and never mutates the page.
 *
 * The response is a synchronous plain object, which is the most broadly
 * compatible messaging pattern across Chromium, Firefox and Safari.
 */
onMessage((message) => {
  if (message.type !== MESSAGE_TYPES.COLLECT_PAGE_DATA) {
    return undefined;
  }
  return observePage();
});
