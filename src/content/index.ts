import { extractProduct } from '@/extraction';
import type { ExtensionMessage } from '@/utils/messaging';

/**
 * Content script. Its only job is to respond to `GET_PRODUCT` by extracting a
 * structured product from the live DOM. It runs no network requests and holds
 * no secrets — extraction is fully local and lazy (nothing happens until the
 * user asks for an analysis).
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'GET_PRODUCT') {
    try {
      const outcome = extractProduct(document, new URL(location.href));
      sendResponse(outcome);
    } catch (error) {
      sendResponse({
        ok: false,
        reason: 'extraction-failed',
        message: error instanceof Error ? error.message : 'Extraction failed.',
      });
    }
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
