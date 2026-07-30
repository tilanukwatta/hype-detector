import type { Product, Review } from '@/types';
import { type SiteAdapter, selectText, text } from './types';

/** Bound how many reviews and how much text we send, to cap token usage. */
const MAX_REVIEWS = 10;
const MAX_REVIEW_CHARS = 500;

/**
 * All Amazon-specific selectors live here, isolated from the extraction logic
 * below. Amazon frequently ships small markup variations across locales and
 * A/B tests, so each field lists several fallbacks tried in order.
 */
const SELECTORS = {
  title: ['#productTitle', '#title', 'h1#title span'],
  brand: ['#bylineInfo', 'a#brand', 'tr.po-brand td.a-span9 span', '#brand'],
  price: [
    '#corePrice_feature_div .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    'span.priceToPay .a-offscreen',
    '.a-price .a-offscreen',
  ],
  category: ['#wayfinding-breadcrumbs_feature_div ul', '#nav-subnav'],
  description: ['#productDescription', '#aplus', '#dpx-product-description_feature_div'],
  bulletContainer: ['#feature-bullets ul', '#feature-bullets', '#featurebullets_feature_div ul'],
  bulletItem: 'li span.a-list-item, li',
  aboutHeading: '#feature-bullets h1, #feature-bullets h2',
  specTables: [
    '#productDetails_techSpec_section_1',
    '#productDetails_detailBullets_sections1',
    'table.a-keyvalue',
    '#technicalSpecifications_section_1',
  ],
  detailBulletsList: '#detailBullets_feature_div ul',
  overallRating: [
    '[data-hook="rating-out-of-text"]',
    '#acrPopover .a-icon-alt',
    'span[data-hook="rating-out-of-text"]',
  ],
  reviewCount: ['#acrCustomerReviewText', '[data-hook="total-review-count"]'],
  reviewItem:
    '[data-hook="review"], [data-hook="cmps-review"], #cm-cr-dp-review-list [data-hook="review"], div[id^="customer_review"]',
  reviewTitle: '[data-hook="review-title"], a.review-title, span.review-title',
  reviewBody: '[data-hook="review-body"], span.review-text-content, div.reviewText',
  reviewStar:
    '[data-hook="review-star-rating"], [data-hook="cmps-review-star-rating"], i[class*="a-star-"] .a-icon-alt',
  /** Amazon's "Customers say" AI summary — reliably in the DOM even before reviews load. */
  reviewsAiSummary: [
    '[data-hook="cr-summarization-attributes-summary"]',
    '#product-summary .a-expander-content',
    '#cr-summarization-content',
  ],
} as const;

const BRAND_PREFIX = /^(visit the|brand:|by)\s+/i;
const BRAND_SUFFIX = /\s+store$/i;

function extractBrand(doc: Document): string | undefined {
  const raw = selectText(doc, SELECTORS.brand);
  if (!raw) return undefined;
  const cleaned = raw.replace(BRAND_PREFIX, '').replace(BRAND_SUFFIX, '').trim();
  return cleaned || undefined;
}

function extractBullets(doc: Document): string[] {
  for (const containerSel of SELECTORS.bulletContainer) {
    const container = doc.querySelector(containerSel);
    if (!container) continue;
    const items = Array.from(container.querySelectorAll(SELECTORS.bulletItem))
      .map((el) => text(el))
      .filter((t) => t.length > 0);
    // De-duplicate (nested `li > span` selectors can double-count).
    const unique = [...new Set(items)];
    if (unique.length) return unique;
  }
  return [];
}

function extractSpecifications(doc: Document): Record<string, string> {
  const specs: Record<string, string> = {};

  for (const tableSel of SELECTORS.specTables) {
    const table = doc.querySelector(tableSel);
    if (!table) continue;
    for (const row of Array.from(table.querySelectorAll('tr'))) {
      const key = text(row.querySelector('th, td.a-span3, .a-text-bold'));
      const valueCell = row.querySelector('td:last-child, td.a-span9');
      const value = text(valueCell);
      if (key && value && key !== value && !(key in specs)) specs[key] = value;
    }
  }

  // "Detail bullets" style specs: `<li><span class="a-text-bold">Key</span> Value</li>`.
  const detailList = doc.querySelector(SELECTORS.detailBulletsList);
  if (detailList) {
    for (const li of Array.from(detailList.querySelectorAll('li'))) {
      const label = text(li.querySelector('.a-text-bold'));
      if (!label) continue;
      const key = label.replace(/[:‏‎‏]+$/g, '').trim();
      const value = text(li)
        .replace(label, '')
        .replace(/^[:\s]+/, '')
        .trim();
      if (key && value && !(key in specs)) specs[key] = value;
    }
  }

  return specs;
}

const truncate = (s: string): string =>
  s.length > MAX_REVIEW_CHARS ? `${s.slice(0, MAX_REVIEW_CHARS)}…` : s;

function extractReviews(doc: Document): Review[] {
  const reviews: Review[] = [];

  // Amazon's "Customers say" block is an AI summary of the reviews and is
  // usually present even before the raw review list lazy-loads. Include it so we
  // still have review-derived signal in that common case.
  const aiSummary = selectText(doc, SELECTORS.reviewsAiSummary);
  if (aiSummary) {
    reviews.push({ title: 'Customers say (Amazon review summary)', body: truncate(aiSummary) });
  }

  for (const item of Array.from(doc.querySelectorAll(SELECTORS.reviewItem))) {
    if (reviews.length >= MAX_REVIEWS) break;
    // Prefer the dedicated body element; fall back to the item's text if the
    // body selector misses (markup varies by locale / A-B test).
    const body = text(item.querySelector(SELECTORS.reviewBody)) || text(item);
    if (!body) continue;
    reviews.push({
      rating: text(item.querySelector(SELECTORS.reviewStar)) || undefined,
      title: text(item.querySelector(SELECTORS.reviewTitle)) || undefined,
      body: truncate(body),
    });
  }
  return reviews;
}

function extractCategory(doc: Document): string | undefined {
  const raw = selectText(doc, SELECTORS.category);
  if (!raw) return undefined;
  // Breadcrumb items are separated by "›" / "‹" arrows; normalise to " > ".
  return raw
    .split(/[›‹>]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' > ');
}

export const amazonAdapter: SiteAdapter = {
  website: 'Amazon',
  hostPatterns: ['amazon.'],

  matches(url) {
    return this.hostPatterns.some((p) => url.hostname.includes(p));
  },

  isProductPage(doc) {
    return Boolean(selectText(doc, SELECTORS.title));
  },

  extract(doc, url) {
    const title = selectText(doc, SELECTORS.title);
    if (!title) return null;

    const product: Product = {
      website: this.website,
      url: url.href,
      title,
      brand: extractBrand(doc),
      price: selectText(doc, SELECTORS.price) || undefined,
      category: extractCategory(doc),
      description: selectText(doc, SELECTORS.description) || undefined,
      bullets: extractBullets(doc),
      specifications: extractSpecifications(doc),
      rating: selectText(doc, SELECTORS.overallRating) || undefined,
      reviewCount: selectText(doc, SELECTORS.reviewCount) || undefined,
      reviews: extractReviews(doc),
    };

    return product;
  },
};
