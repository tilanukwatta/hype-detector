import type { ExtractionOutcome } from '@/extraction';

/**
 * Typed message protocol between extension surfaces. Keeping every message in a
 * single discriminated union means senders and receivers can be exhaustively
 * type-checked.
 */
export type ExtensionMessage = { type: 'GET_PRODUCT' };

export type MessageResponse = {
  GET_PRODUCT: ExtractionOutcome;
};

/** The active tab in the current window, or null if none is addressable. */
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/**
 * Send a message to a specific tab's content script, resolving to null if the
 * content script is not present (e.g. the user is on a non-shopping page).
 */
export function sendToTab<T extends ExtensionMessage>(
  tabId: number,
  message: T
): Promise<MessageResponse[T['type']] | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response ?? null);
    });
  });
}
