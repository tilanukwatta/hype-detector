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

function renderProduct(product: Product): string {
  // Send structured JSON only — never raw HTML.
  const compact = {
    website: product.website,
    title: product.title,
    brand: product.brand ?? null,
    price: product.price ?? null,
    category: product.category ?? null,
    description: product.description ?? null,
    bullets: product.bullets,
    specifications: product.specifications,
    rating: product.rating ?? null,
    reviewCount: product.reviewCount ?? null,
    reviews: product.reviews,
  };
  return JSON.stringify(compact, null, 2);
}

/** Build the user message for a product analysis request. */
export function buildAnalysisPrompt(product: Product): string {
  return `Analyze the claims in the following product listing.

For "review_summary", use ONLY the customer reviews provided in the product data below — do not infer pros/cons from the marketing copy. If no reviews are provided, return an empty summary string and empty arrays. Keep the same careful wording rules: report what reviewers said without asserting a product or seller is fraudulent.

Return ONLY a single JSON object, with no markdown fences or commentary, matching exactly this schema:

${RESPONSE_SCHEMA}

Product listing (structured data extracted from the page):

${renderProduct(product)}`;
}
