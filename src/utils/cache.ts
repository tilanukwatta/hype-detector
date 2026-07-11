import type { Product } from '@/types';

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
  };
  return fnv1a(JSON.stringify(normalised));
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
