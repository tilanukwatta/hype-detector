import { z } from 'zod';

/**
 * Canonical domain types for Hype Detector, plus the zod schemas used to
 * validate settings and LLM output. Keeping schema and type together means a
 * single source of truth: the TypeScript types are inferred from the schemas.
 */

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const PROVIDER_IDS = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'ollama',
  'webllm',
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

// ---------------------------------------------------------------------------
// Product (what the extractor produces; never raw HTML, never reviews)
// ---------------------------------------------------------------------------

/** A single customer review as scraped from the page (bounded/truncated). */
export const ReviewSchema = z.object({
  rating: z.string().optional(),
  title: z.string().optional(),
  body: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ProductSchema = z.object({
  website: z.string(),
  url: z.string().optional(),
  title: z.string(),
  brand: z.string().optional(),
  price: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  specifications: z.record(z.string(), z.string()).default({}),
  /** Overall star rating text, e.g. "4.5 out of 5 stars". */
  rating: z.string().optional(),
  /** Total review count text, e.g. "1,234 ratings". */
  reviewCount: z.string().optional(),
  /** A bounded sample of visible customer reviews (capped + truncated). */
  reviews: z.array(ReviewSchema).default([]),
});

export type Product = z.infer<typeof ProductSchema>;

// ---------------------------------------------------------------------------
// Generic page (what the generic extractor produces for non-product pages;
// never raw HTML — bounded, noise-stripped text only)
// ---------------------------------------------------------------------------

/** One logical section of a page: the text under a heading (or a lead section). */
export const PageSectionSchema = z.object({
  /** The heading that introduces this section; absent for lead/untitled content. */
  heading: z.string().optional(),
  text: z.string(),
});
export type PageSection = z.infer<typeof PageSectionSchema>;

export const PageContentSchema = z.object({
  url: z.string(),
  title: z.string(),
  /** Publisher/site name from OpenGraph or JSON-LD, e.g. "The Verge". */
  siteName: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  /** Coarse classification: 'article' | 'blog' | 'product' | 'marketing' | 'other'. */
  contentType: z.string().optional(),
  headings: z.array(z.string()).default([]),
  /** Readable body split into meaningful sections (bounded before prompting). */
  sections: z.array(PageSectionSchema).default([]),
  /** Extra document metadata (description, lang, og:type, JSON-LD @type, …). */
  metadata: z.record(z.string(), z.string()).default({}),
});
export type PageContent = z.infer<typeof PageContentSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  apiKey: z.string(),
  model: z.string(),
  /** Optional override, mostly for Ollama / self-hosted OpenAI-compatible endpoints. */
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  theme: ThemeSchema,
  highContrast: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-5',
  temperature: 0.2,
  maxTokens: 1536,
  theme: 'system',
  highContrast: false,
};

// ---------------------------------------------------------------------------
// Analysis result (the shape we ask the LLM to return)
// ---------------------------------------------------------------------------

export const HypeLevelSchema = z.enum(['Low', 'Medium', 'High']);
export type HypeLevel = z.infer<typeof HypeLevelSchema>;

/** A single claim/observation the model surfaces, with its reasoning. */
export const ClaimSchema = z.object({
  claim: z.string(),
  reasoning: z.string().default(''),
});
export type Claim = z.infer<typeof ClaimSchema>;

/**
 * How a claim holds up against the evidence *on the page itself*. This is a
 * content assessment, never an external fact-check — `unsupported` means the
 * page offers no evidence, not that the claim is false; `contradicted` means the
 * page contradicts itself. External verification is deliberately out of scope.
 */
export const AssessmentSchema = z.enum([
  'supported',
  'unsupported',
  'contradicted',
  'uncertain',
  'opinion',
]);
export type Assessment = z.infer<typeof AssessmentSchema>;

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** A claim evaluated against on-page evidence (generic webpage analysis). */
export const EvaluatedClaimSchema = z.object({
  claim: z.string(),
  assessment: AssessmentSchema.default('uncertain'),
  reasoning: z.string().default(''),
  /** Short quote or paraphrase of the supporting/contradicting text on the page. */
  evidence_on_page: z.string().default(''),
  confidence: ConfidenceSchema.default('low'),
});
export type EvaluatedClaim = z.infer<typeof EvaluatedClaimSchema>;

/**
 * Summary of what customer reviews say, split into product vs seller pros/cons.
 * Derived only from the reviews provided; all fields empty when there are none.
 */
export const ReviewSummarySchema = z.object({
  summary: z.string().default(''),
  product_pros: z.array(z.string()).default([]),
  product_cons: z.array(z.string()).default([]),
  seller_pros: z.array(z.string()).default([]),
  seller_cons: z.array(z.string()).default([]),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;

/**
 * Superset analysis schema. It serves both product listings and generic pages:
 * shopping-site analysis populates the product-oriented fields (`marketing_hype`,
 * `review_summary`, …) while generic-page analysis populates the credibility
 * fields (`key_claims`, `evidence_quality`, …). Every field is default-safe so a
 * model may omit the fields that do not apply, and so cached entries written by
 * an older version still validate on read.
 */
export const AnalysisSchema = z.object({
  overall_assessment: z.string().default(''),
  /** 0–100. Mapped to a 1–5 star scale in the UI. */
  credibility_score: z.number().min(0).max(100).default(50),
  /** Coarse page/content type, e.g. 'product' | 'article' | 'blog' | 'other'. */
  content_type: z.string().default(''),
  marketing_hype: HypeLevelSchema.default('Medium'),

  // Generic credibility assessment (populated for any page).
  key_claims: z.array(EvaluatedClaimSchema).default([]),
  supported_claims: z.array(EvaluatedClaimSchema).default([]),
  questionable_claims: z.array(EvaluatedClaimSchema).default([]),
  evidence_quality: z.array(z.string()).default([]),
  source_transparency: z.array(z.string()).default([]),
  persuasive_techniques: z.array(z.string()).default([]),
  missing_context: z.array(z.string()).default([]),
  /** What the model could NOT assess from the page alone (verification limits). */
  limitations: z.array(z.string()).default([]),

  // Product-oriented fields (populated for shopping listings).
  unsupported_claims: z.array(ClaimSchema).default([]),
  scientific_claims: z.array(ClaimSchema).default([]),
  missing_evidence: z.array(z.string()).default([]),
  good_signs: z.array(z.string()).default([]),
  summary: z.string().default(''),
  /** Pros/cons synthesized from customer reviews (empty when no reviews). */
  review_summary: ReviewSummarySchema.default({
    summary: '',
    product_pros: [],
    product_cons: [],
    seller_pros: [],
    seller_cons: [],
  }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/**
 * Result of an analysis run as surfaced to the UI. `ok: false` still carries a
 * best-effort partial `analysis` (defaults filled) plus the raw text so the
 * user can see what the model actually returned.
 */
export type AnalysisResult =
  | { ok: true; analysis: Analysis; raw: string }
  | { ok: false; error: string; analysis: Analysis; raw: string };

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export interface CachedAnalysis {
  /** Hash of the extracted content (product or generic page). */
  contentHash: string;
  provider: ProviderId;
  model: string;
  analysis: Analysis;
  createdAt: number;
}
