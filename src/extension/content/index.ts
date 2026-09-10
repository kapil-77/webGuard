import { onMessage } from '../../browser/runtime/messaging';
import { MESSAGE_TYPES } from '../../lib/protocol';
import { observePage } from './observer';

onMessage((message) => {
  if (message.type !== MESSAGE_TYPES.COLLECT_PAGE_DATA) {
    return undefined;
  }
  return observePage();
});
