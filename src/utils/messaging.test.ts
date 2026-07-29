import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestProduct } from './messaging';

/**
 * Drive `chrome.tabs.sendMessage`'s callback deterministically. Each entry is
 * consumed by one call: `lastError` simulates "no content script listening",
 * `response` is what the (present) content script replies.
 */
function makeSendMessage(steps: Array<{ lastError?: { message: string }; response?: unknown }>) {
  let i = 0;
  return vi.fn((_tabId: number, _msg: unknown, cb: (r: unknown) => void) => {
    const step = steps[i++] ?? {};
    (chrome.runtime as unknown as { lastError?: unknown }).lastError = step.lastError;
    cb(step.response);
    (chrome.runtime as unknown as { lastError?: unknown }).lastError = undefined;
  });
}

beforeEach(() => {
  (chrome.runtime as unknown as { getManifest: () => unknown }).getManifest = () => ({
    content_scripts: [{ js: ['content.js'] }],
  });
  chrome.scripting.executeScript = vi.fn(async () => []) as never;
});

describe('requestProduct', () => {
  it('returns the content script response without injecting when present', async () => {
    const product = { website: 'Amazon', title: 'X', bullets: [], specifications: {} };
    chrome.tabs.sendMessage = makeSendMessage([{ response: { ok: true, product } }]) as never;

    const out = await requestProduct(1);

    expect(out).toEqual({ ok: true, product });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('injects the content script and retries when it is missing', async () => {
    chrome.tabs.sendMessage = makeSendMessage([
      { lastError: { message: 'Could not establish connection' } },
      { response: { ok: false, reason: 'not-product-page', message: 'nope' } },
    ]) as never;

    const out = await requestProduct(7);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content.js'],
    });
    expect(out).toMatchObject({ ok: false, reason: 'not-product-page' });
  });

  it('returns null when injection is not permitted', async () => {
    chrome.tabs.sendMessage = makeSendMessage([
      { lastError: { message: 'Could not establish connection' } },
    ]) as never;
    chrome.scripting.executeScript = vi.fn(async () => {
      throw new Error('Cannot access contents of the page');
    }) as never;

    expect(await requestProduct(1)).toBeNull();
  });
});
