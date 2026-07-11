import type { Product } from '@/types';

/**
 * A site adapter knows how to recognise a shopping site and pull a structured
 * {@link Product} out of its DOM. Adapters must keep all site-specific CSS
 * selectors in a local config object (see `amazon.ts`) rather than sprinkling
 * them through the extraction logic — this keeps selectors easy to update when
 * a site changes its markup, per the project's contribution guidelines.
 */
export interface SiteAdapter {
  /** Human-readable site name stored on the product (e.g. "Amazon"). */
  readonly website: string;
  /** Hostname substrings this adapter handles, e.g. ["amazon."]. */
  readonly hostPatterns: readonly string[];
  /** Returns true if this adapter can extract from the given location. */
  matches(url: URL): boolean;
  /** True when the current document looks like a product detail page. */
  isProductPage(doc: Document): boolean;
  /** Extract a structured product. Returns null if nothing usable was found. */
  extract(doc: Document, url: URL): Product | null;
}

/** Shared helpers used by adapters. Exported for unit testing. */
export const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** First non-empty match for a list of selectors. */
export function selectText(root: ParentNode, selectors: readonly string[]): string {
  for (const sel of selectors) {
    const value = text(root.querySelector(sel));
    if (value) return value;
  }
  return '';
}
