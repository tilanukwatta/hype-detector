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

export const AnalysisSchema = z.object({
  overall_assessment: z.string().default(''),
  /** 0–100. Mapped to a 1–5 star scale in the UI. */
  credibility_score: z.number().min(0).max(100).default(50),
  marketing_hype: HypeLevelSchema.default('Medium'),
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
  productHash: string;
  provider: ProviderId;
  model: string;
  analysis: Analysis;
  createdAt: number;
}
