import { createEnvelope, sendMessage } from '../../browser/runtime/messaging';
import type { AnalyzeResponse } from '../../lib/protocol';
import { MESSAGE_TYPES, parseAnalyzeResponse } from '../../lib/protocol';

/**
 * Popup -> background client.
 *
 * The only thing the popup is allowed to do is ask the background for an
 * analysis. It never touches `tabs.*` or any other privileged API.
 */
export async function requestAnalysis(): Promise<AnalyzeResponse> {
  const envelope = createEnvelope(MESSAGE_TYPES.ANALYZE);
  const raw = await sendMessage(envelope);
  return parseAnalyzeResponse(raw);
}