import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { extractProduct } from './index';
import { amazonAdapter } from './amazon';

const html = readFileSync(
  fileURLToPath(new NodeURL('../__fixtures__/amazon-product.html', import.meta.url)),
  'utf-8'
);

function loadDoc(): Document {
  return new JSDOM(html).window.document;
}

const PRODUCT_URL = new URL('https://www.amazon.com/dp/B0EXAMPLE');

describe('amazon extraction', () => {
  let doc: Document;
  beforeEach(() => {
    doc = loadDoc();
  });

  it('recognises the amazon host', () => {
    expect(amazonAdapter.matches(PRODUCT_URL)).toBe(true);
    expect(amazonAdapter.matches(new URL('https://www.walmart.com/ip/123'))).toBe(false);
  });

  it('extracts core fields', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { product } = outcome;

    expect(product.website).toBe('Amazon');
    expect(product.title).toBe(
      'QuantumGlow Vitamin C Serum – Clinically Proven Anti-Aging Formula'
    );
    expect(product.brand).toBe('QuantumGlow');
    expect(product.price).toBe('$29.99');
    expect(product.url).toBe(PRODUCT_URL.href);
  });

  it('normalises the breadcrumb category', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.product.category).toBe('Beauty & Personal Care > Skin Care > Face Serums');
  });

  it('extracts and de-duplicates bullets', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    const { bullets } = outcome.product;
    expect(bullets).toContain('Reduces wrinkles by 300% in just 7 days');
    // The fixture repeats one bullet; it should appear only once.
    const dupes = bullets.filter((b) => b.includes('20% pure Vitamin C'));
    expect(dupes).toHaveLength(1);
  });

  it('extracts specifications as key/value pairs', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.product.specifications).toMatchObject({
      Volume: '30 Milliliters',
      'Skin Type': 'All',
      'Item Form': 'Serum',
    });
  });

  it('extracts overall rating and review count', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.product.rating).toBe('4.1 out of 5 stars');
    expect(outcome.product.reviewCount).toBe('2,317 ratings');
  });

  it('extracts a bounded sample of reviews with rating/title/body', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    const { reviews } = outcome.product;
    expect(reviews).toHaveLength(2);
    expect(reviews[0].body).toContain('brighter after two weeks');
    expect(reviews[0].rating).toContain('4.0 out of 5');
    expect(reviews[0].title).toContain('Nice glow');
    expect(reviews[1].body).toContain('arrived with the seal broken');
  });

  it('returns no reviews when the page has none', () => {
    const noReviews = new JSDOM(
      '<!DOCTYPE html><body><h1 id="title"><span id="productTitle">X</span></h1></body>'
    ).window.document;
    const outcome = extractProduct(noReviews, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.product.reviews).toEqual([]);
  });

  it('falls back to the "Customers say" AI summary when the raw list is absent', () => {
    const withAiSummary = new JSDOM(
      `<!DOCTYPE html><body>
         <h1 id="title"><span id="productTitle">X</span></h1>
         <div data-hook="cr-summarization-attributes-summary">
           Customers report the sprouts grow quickly and taste fresh, but some received
           leaking packages.
         </div>
       </body>`
    ).window.document;
    const outcome = extractProduct(withAiSummary, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.product.reviews).toHaveLength(1);
    expect(outcome.product.reviews[0].title).toMatch(/Customers say/);
    expect(outcome.product.reviews[0].body).toContain('grow quickly');
  });

  it('never includes raw HTML', () => {
    const outcome = extractProduct(doc, PRODUCT_URL);
    if (!outcome.ok) throw new Error('expected success');
    const serialised = JSON.stringify(outcome.product);
    expect(serialised).not.toContain('<');
    expect(serialised).not.toContain('a-offscreen');
  });

  it('reports unsupported sites', () => {
    const outcome = extractProduct(doc, new URL('https://www.example.com/x'));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('unsupported-site');
  });

  it('reports non-product amazon pages', () => {
    const empty = new JSDOM('<!DOCTYPE html><body><div>search</div></body>').window.document;
    const outcome = extractProduct(empty, PRODUCT_URL);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('not-product-page');
  });
});
