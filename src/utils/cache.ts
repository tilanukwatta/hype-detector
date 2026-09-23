import type { Product, PageContent } from '@/types';
import type { Extracted } from '@/extraction';

/**
 * Bump when the prompt or analysis schema changes in a way that makes older
 * cached analyses render incorrectly. It is part of the cache key, so a bump
 * transparently invalidates every prior entry (e.g. product-shaped results that
 * predate the generic schema) without a manual cache wipe.
 */
export const ANALYSIS_VERSION = 2;

/**
 * Deterministic hash of a product's meaningful content. Used to decide whether a
 * cached analysis is still valid: if the page content changes, the hash changes
 * and we re-analyze. Ordering of keys/specs is normalised so cosmetic
 * reordering does not invalidate the cache.
 */
export function hashProduct(product: Product): string {
  const normalised = {
    title: product.title,
    brand: product.brand ?? '',
    price: product.price ?? '',
    description: product.description ?? '',
    bullets: product.bullets,
    specifications: Object.fromEntries(
      Object.entries(product.specifications).sort(([a], [b]) => a.localeCompare(b))
    ),
    // Include reviews so that when they load (e.g. after scrolling) the cache is
    // invalidated and the analysis re-runs instead of reusing a no-review result.
    reviews: product.reviews.map((r) => r.body),
  };
  return fnv1a(JSON.stringify(normalised));
}

/**
 * Deterministic hash of a generic page's meaningful content. Includes the URL
 * path (so the same boilerplate on different pages does not collide) plus the
 * title, headings, and section text.
 */
export function hashPage(page: PageContent): string {
  let url = page.url;
  try {
    const u = new URL(page.url);
    url = `${u.host}${u.pathname}`;
  } catch {
    // Non-parseable URL — hash it as-is.
  }
  const normalised = {
    url,
    title: page.title,
    headings: page.headings,
    sections: page.sections.map((s) => `${s.heading ?? ''}::${s.text}`),
  };
  return fnv1a(JSON.stringify(normalised));
}

/** Hash whichever kind of extracted content we have. */
export function hashExtracted(extracted: Extracted): string {
  return extracted.kind === 'product' ? hashProduct(extracted.product) : hashPage(extracted.page);
}

/** FNV-1a 32-bit hash, returned as an 8-char hex string. Small and dependency-free. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit range via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
