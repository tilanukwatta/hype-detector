import type { Product } from '@/types';
import type { Extracted, SiteAdapter } from './types';
import { amazonAdapter } from './amazon';
import { walmartAdapter } from './walmart';
import { extractGenericPage } from './generic';

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
  reason:
    | 'unsupported-site'
    | 'not-product-page'
    | 'extraction-failed'
    | 'no-content-script'
    | 'restricted-page'
    | 'thin-content';
  message: string;
}
export type ExtractionOutcome = ExtractionSuccess | ExtractionFailure;

export interface PageExtractionSuccess {
  ok: true;
  extracted: Extracted;
}
export type PageExtractionOutcome = PageExtractionSuccess | ExtractionFailure;

/**
 * Pages the extension must never read: non-web schemes (chrome://, about:,
 * file:, view-source:, the extension's own pages) and obvious sensitive hosts.
 * `activeTab` only grants access after an explicit click, but we still refuse
 * these defensively so the extractor never touches mail or banking sessions.
 */
const SENSITIVE_HOST = /(^|\.)(mail|inbox|banking|bank|account|accounts|login|signin)\./i;

export function isRestrictedUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  return SENSITIVE_HOST.test(url.hostname);
}

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

/**
 * Universal extraction: a shopping-site adapter when the page is a product
 * detail page, otherwise the generic readability extractor. Pure and DOM-driven
 * so it can be unit tested with jsdom. Callers get a single {@link Extracted}
 * union to hand to the prompt/analysis layer.
 */
export function extractPage(doc: Document, url: URL): PageExtractionOutcome {
  if (isRestrictedUrl(url)) {
    return {
      ok: false,
      reason: 'restricted-page',
      message: 'Hype Detector will not read this page.',
    };
  }

  // Prefer a specialised product adapter on its own product pages; fall through
  // to generic extraction for everything else (including non-product pages on a
  // supported shopping site).
  const adapter = getAdapter(url);
  if (adapter && adapter.isProductPage(doc)) {
    const product = adapter.extract(doc, url);
    if (product) return { ok: true, extracted: { kind: 'product', product } };
  }

  const page = extractGenericPage(doc, url);
  if (!page) {
    return {
      ok: false,
      reason: 'thin-content',
      message: 'There was not enough readable content on this page to analyze.',
    };
  }
  return { ok: true, extracted: { kind: 'page', page } };
}

export type { Extracted, SiteAdapter } from './types';
