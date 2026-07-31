import type { Product } from '@/types';

/**
 * System prompt. Encodes the project's philosophy: analyse the seller's claims,
 * never recommend buying/avoiding, distinguish unsupported from disproven from
 * uncertain, and never overstate certainty.
 */
export const SYSTEM_PROMPT = `You are an independent consumer advocate.

Your job is NOT to recommend buying or avoiding products.

Instead:
- Identify factual statements.
- Identify measurable claims.
- Identify scientific claims.
- Identify marketing language.
- Explain missing evidence.
- Explain uncertainty.
- Do not invent facts.
- If evidence is unavailable, explicitly say so.

Be skeptical without being cynical. Always explain your reasoning.

Critical wording rules:
- Never say a product is "fake". Instead say "I could not find evidence supporting this claim."
- Always distinguish between unsupported, disproven, and uncertain claims.
- Never overstate certainty. Acknowledge what you cannot know from a listing alone.`;

/** JSON schema shown to the model, kept in sync with AnalysisSchema. */
const RESPONSE_SCHEMA = `{
  "overall_assessment": "one or two sentence neutral summary of how well the listing's claims are supported",
  "credibility_score": 0-100 integer (higher = better supported claims),
  "marketing_hype": "Low" | "Medium" | "High",
  "unsupported_claims": [{ "claim": "...", "reasoning": "why it lacks support" }],
  "scientific_claims": [{ "claim": "...", "reasoning": "what evidence would be needed" }],
  "missing_evidence": ["specific evidence a buyer would want but the listing omits"],
  "good_signs": ["concrete, verifiable, or appropriately-hedged statements"],
  "summary": "a short plain-language wrap-up for the shopper",
  "review_summary": {
    "summary": "1-2 sentence neutral summary of what reviewers report; empty string if no reviews were provided",
    "product_pros": ["strengths reviewers mention about the product"],
    "product_cons": ["problems or complaints reviewers mention about the product"],
    "seller_pros": ["positives reviewers mention about the seller, shipping, packaging, or service"],
    "seller_cons": ["problems reviewers mention about the seller, shipping, service, or authenticity"]
  }
}`;

/**
 * Caps on how much product content goes into the prompt, bounding token usage.
 * `default` keeps cloud prompts reasonable (and cheaper); `compact` is tight for
 * small-context local models (e.g. WebLLM models with a 4096-token window).
 */
interface PromptLimits {
  description: number;
  bullets: number;
  bulletChars: number;
  specs: number;
  specChars: number;
  reviews: number;
  reviewChars: number;
}

const DEFAULT_LIMITS: PromptLimits = {
  description: 4000,
  bullets: 20,
  bulletChars: 300,
  specs: 30,
  specChars: 200,
  reviews: 8,
  reviewChars: 400,
};

/** Tight budget for small-context models: keeps prompt + output under ~4096 tokens. */
const COMPACT_LIMITS: PromptLimits = {
  description: 800,
  bullets: 8,
  bulletChars: 120,
  specs: 12,
  specChars: 120,
  reviews: 4,
  reviewChars: 220,
};

const trunc = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s);

function renderProduct(product: Product, limits: PromptLimits): string {
  // Send structured JSON only — never raw HTML. Every field is bounded so a page
  // with huge A+ content or many reviews can't produce an oversized prompt.
  const compact = {
    website: product.website,
    title: trunc(product.title, 300),
    brand: product.brand ?? null,
    price: product.price ?? null,
    category: product.category ?? null,
    description: product.description ? trunc(product.description, limits.description) : null,
    bullets: product.bullets.slice(0, limits.bullets).map((b) => trunc(b, limits.bulletChars)),
    specifications: Object.fromEntries(
      Object.entries(product.specifications)
        .slice(0, limits.specs)
        .map(([k, v]) => [trunc(k, 80), trunc(v, limits.specChars)])
    ),
    rating: product.rating ?? null,
    reviewCount: product.reviewCount ?? null,
    reviews: product.reviews.slice(0, limits.reviews).map((r) => ({
      rating: r.rating,
      title: r.title,
      body: trunc(r.body, limits.reviewChars),
    })),
  };
  return JSON.stringify(compact, null, 2);
}

/**
 * Build the user message for a product analysis request. Pass `compact: true`
 * for small-context models (WebLLM) to fit the model's limited window.
 */
export function buildAnalysisPrompt(product: Product, opts: { compact?: boolean } = {}): string {
  const limits = opts.compact ? COMPACT_LIMITS : DEFAULT_LIMITS;
  return `Analyze the claims in the following product listing.

For "review_summary", use ONLY the customer reviews provided in the product data below — do not infer pros/cons from the marketing copy. If no reviews are provided, return an empty summary string and empty arrays. Keep the same careful wording rules: report what reviewers said without asserting a product or seller is fraudulent.

Return ONLY a single JSON object, with no markdown fences or commentary, matching exactly this schema:

${RESPONSE_SCHEMA}

Product listing (structured data extracted from the page):

${renderProduct(product, limits)}`;
}
