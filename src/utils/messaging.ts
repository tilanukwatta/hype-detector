import type { ExtractionFailure, ExtractionOutcome, PageExtractionOutcome } from '@/extraction';

/**
 * Typed message protocol between extension surfaces. Keeping every message in a
 * single discriminated union means senders and receivers can be exhaustively
 * type-checked.
 */
export type ExtensionMessage = { type: 'GET_PRODUCT' } | { type: 'GET_PAGE' };

export type MessageResponse = {
  GET_PRODUCT: ExtractionOutcome;
  GET_PAGE: PageExtractionOutcome;
};

/**
 * The on-demand page reader, built as a self-contained IIFE by
 * vite.content.config.ts and exposed via web_accessible_resources. Injected with
 * `chrome.scripting.executeScript` using the active tab's `activeTab` grant.
 */
export const CONTENT_SCRIPT_FILE = 'content-inject.js';

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
 * Send an extraction request to a tab. If the content script does not answer —
 * which happens when the tab was already open before the extension was
 * loaded/updated, so Chrome never auto-injected the script — inject the built
 * content script on demand (using the toolbar-click `activeTab` grant) and retry
 * once. The `no-content-script` failure branch is shared by both response types.
 */
async function requestExtraction<T extends ExtensionMessage['type']>(
  tabId: number,
  type: T
): Promise<MessageResponse[T]> {
  const first = await sendToTab(tabId, { type } as ExtensionMessage);
  if (first) return first as MessageResponse[T];

  // The reader is not present (e.g. a fresh tab, or one predating the extension
  // load). Inject the self-contained IIFE, then retry. The IIFE registers its
  // listener synchronously, so it is ready by the time executeScript resolves.
  // Surface the real error so failures are diagnosable.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return noReader(`Could not load the page reader — ${detail}`) as MessageResponse[T];
  }

  const second = await sendToTab(tabId, { type } as ExtensionMessage);
  if (second) return second as MessageResponse[T];
  return noReader('The page reader was injected but did not respond.') as MessageResponse[T];
}

/** Ask a tab for its extracted product (shopping-site adapters only). */
export function requestProduct(tabId: number): Promise<ExtractionOutcome> {
  return requestExtraction(tabId, 'GET_PRODUCT');
}

/** Ask a tab for extracted content — a product on shopping sites, else generic page content. */
export function requestPage(tabId: number): Promise<PageExtractionOutcome> {
  return requestExtraction(tabId, 'GET_PAGE');
}

function noReader(message: string): ExtractionFailure {
  return { ok: false, reason: 'no-content-script', message };
}
