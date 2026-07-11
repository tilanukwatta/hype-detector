import type { SiteAdapter } from './types';
import { selectText } from './types';

/**
 * Stub Walmart adapter. It is intentionally minimal — its purpose in the MVP is
 * to demonstrate that adding a new site is a self-contained change (register an
 * adapter, keep selectors local) rather than a change to shared logic. The
 * selectors below are a starting point and should be hardened before Walmart is
 * advertised as supported.
 */
const SELECTORS = {
  title: ['h1[itemprop="name"]', '#main-title', 'h1.prod-ProductTitle'],
} as const;

export const walmartAdapter: SiteAdapter = {
  website: 'Walmart',
  hostPatterns: ['walmart.'],

  matches(url) {
    return this.hostPatterns.some((p) => url.hostname.includes(p));
  },

  isProductPage(doc) {
    return Boolean(selectText(doc, SELECTORS.title));
  },

  extract() {
    // Not implemented for the MVP. Returning null lets callers fall back to a
    // clear "unsupported page" message rather than sending empty data to an LLM.
    return null;
  },
};
