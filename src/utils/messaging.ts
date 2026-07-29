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

/**
 * Ask a tab for its extracted product. If the content script does not answer —
 * which happens when the tab was already open before the extension was
 * loaded/updated, so Chrome never auto-injected the script — inject the built
 * content script on demand and retry once.
 *
 * Returns null only when the tab genuinely has no reachable content script
 * (e.g. a restricted page the extension has no host access to).
 */
export async function requestProduct(tabId: number): Promise<ExtractionOutcome> {
  const first = await sendToTab(tabId, { type: 'GET_PRODUCT' });
  if (first) return first;

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  if (files.length === 0) {
    return noReader('The page reader is missing from this build.');
  }

  // The content script may not be present (e.g. the tab predates the extension
  // load). Inject it on demand, then retry. Surface the real error so failures
  // are diagnosable rather than a silent "nothing happened".
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return noReader(`Could not load the page reader — ${detail}`);
  }

  const second = await sendToTab(tabId, { type: 'GET_PRODUCT' });
  if (second) return second;
  return noReader('The page reader was injected but did not respond.');
}

function noReader(message: string): ExtractionOutcome {
  return { ok: false, reason: 'no-content-script', message };
}
