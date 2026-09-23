import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestProduct, requestPage } from './messaging';

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
      files: ['content-inject.js'],
    });
    expect(out).toMatchObject({ ok: false, reason: 'not-product-page' });
  });

  it('surfaces the real error when injection is not permitted', async () => {
    chrome.tabs.sendMessage = makeSendMessage([
      { lastError: { message: 'Could not establish connection' } },
    ]) as never;
    chrome.scripting.executeScript = vi.fn(async () => {
      throw new Error('Cannot access contents of the page');
    }) as never;

    const out = await requestProduct(1);
    expect(out).toMatchObject({ ok: false, reason: 'no-content-script' });
    if (!out.ok) expect(out.message).toMatch(/Cannot access contents of the page/);
  });

  it('reports when injection succeeds but the reader stays silent', async () => {
    chrome.tabs.sendMessage = makeSendMessage([
      { lastError: { message: 'no receiver' } },
      { lastError: { message: 'still no receiver' } },
    ]) as never;

    const out = await requestProduct(1);
    expect(out).toMatchObject({ ok: false, reason: 'no-content-script' });
    if (!out.ok) expect(out.message).toMatch(/did not respond/);
  });
});

describe('requestPage', () => {
  it('sends GET_PAGE and returns generic page content without injecting', async () => {
    const extracted = { kind: 'page', page: { url: 'https://x/', title: 'X' } };
    chrome.tabs.sendMessage = makeSendMessage([{ response: { ok: true, extracted } }]) as never;

    const out = await requestPage(2);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      2,
      { type: 'GET_PAGE' },
      expect.any(Function)
    );
    expect(out).toEqual({ ok: true, extracted });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('injects and retries when the reader is missing', async () => {
    chrome.tabs.sendMessage = makeSendMessage([
      { lastError: { message: 'Could not establish connection' } },
      { response: { ok: false, reason: 'thin-content', message: 'too little' } },
    ]) as never;

    const out = await requestPage(9);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 9 },
      files: ['content-inject.js'],
    });
    expect(out).toMatchObject({ ok: false, reason: 'thin-content' });
  });

  it('reports no-content-script when injection fails', async () => {
    chrome.tabs.sendMessage = makeSendMessage([{ lastError: { message: 'no receiver' } }]) as never;
    chrome.scripting.executeScript = vi.fn(async () => {
      throw new Error('Cannot access contents of the page');
    }) as never;

    const out = await requestPage(1);
    expect(out).toMatchObject({ ok: false, reason: 'no-content-script' });
  });
});
