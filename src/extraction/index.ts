import type { Product } from '@/types';
import type { SiteAdapter } from './types';
import { amazonAdapter } from './amazon';
import { walmartAdapter } from './walmart';

/**
 * Registry of site adapters. Order matters only insofar as `matches` should be
 * mutually exclusive by hostname; the first match wins.
 */
export const ADAPTERS: readonly SiteAdapter[] = [amazonAdapter, walmartAdapter];

/** Returns the adapter that handles the given URL, or null. */
export function getAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}

export interface ExtractionSuccess {
  ok: true;
  product: Product;
}
export interface ExtractionFailure {
  ok: false;
  /** Machine-readable reason so the UI can show tailored guidance. */
  reason: 'unsupported-site' | 'not-product-page' | 'extraction-failed';
  message: string;
}
export type ExtractionOutcome = ExtractionSuccess | ExtractionFailure;

/**
 * Attempt to extract a product from the given document/URL using the best
 * matching adapter. Pure and DOM-driven so it can be unit tested with jsdom.
 */
export function extractProduct(doc: Document, url: URL): ExtractionOutcome {
  const adapter = getAdapter(url);
  if (!adapter) {
    return {
      ok: false,
      reason: 'unsupported-site',
      message: 'Hype Detector does not support this site yet.',
    };
  }

  if (!adapter.isProductPage(doc)) {
    return {
      ok: false,
      reason: 'not-product-page',
      message: `This does not look like a ${adapter.website} product page.`,
    };
  }

  const product = adapter.extract(doc, url);
  if (!product) {
    return {
      ok: false,
      reason: 'extraction-failed',
      message: 'Could not read the product details from this page.',
    };
  }

  return { ok: true, product };
}

export type { SiteAdapter } from './types';
