import { extractProduct, extractPage } from '@/extraction';
import type { ExtensionMessage } from '@/utils/messaging';

declare global {
  interface Window {
    __hypeDetectorContentLoaded?: boolean;
  }
}

/**
 * Content script. It responds to extraction requests by reading the live DOM:
 * `GET_PRODUCT` returns a structured product (shopping sites), `GET_PAGE` returns
 * either a product or generic page content for any site. It runs no network
 * requests and holds no secrets — extraction is fully local and lazy (nothing
 * happens until the user asks for an analysis).
 *
 * The guard makes the script idempotent: it may be auto-injected on page load
 * AND injected again on demand via `chrome.scripting.executeScript`, so we must
 * avoid registering the message listener twice (which would send duplicate
 * responses).
 */
if (!window.__hypeDetectorContentLoaded) {
  window.__hypeDetectorContentLoaded = true;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'GET_PRODUCT') {
      try {
        sendResponse(extractProduct(document, new URL(location.href)));
      } catch (error) {
        sendResponse({
          ok: false,
          reason: 'extraction-failed',
          message: error instanceof Error ? error.message : 'Extraction failed.',
        });
      }
      return true; // keep the message channel open for the async response
    }
    if (message.type === 'GET_PAGE') {
      try {
        sendResponse(extractPage(document, new URL(location.href)));
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
}
