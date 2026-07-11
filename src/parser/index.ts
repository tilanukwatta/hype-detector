import { AnalysisSchema, type Analysis, type AnalysisResult } from '@/types';

/**
 * Turn raw LLM text into a validated {@link AnalysisResult}. Models are
 * unreliable about returning clean JSON, so this is deliberately tolerant:
 *
 *  1. Strip ```json fences / surrounding prose.
 *  2. Extract the first balanced `{ ... }` block.
 *  3. Parse and validate with zod, filling safe defaults for missing fields.
 *
 * On any failure it returns `ok: false` with a best-effort (defaulted) analysis
 * and the raw text, rather than throwing — the UI can then show the raw output.
 */
export function parseAnalysis(raw: string): AnalysisResult {
  const candidate = extractJsonBlock(raw);

  if (candidate === null) {
    return {
      ok: false,
      error: 'The model did not return any JSON to parse.',
      analysis: AnalysisSchema.parse({}),
      raw,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return {
      ok: false,
      error: 'The model returned malformed JSON.',
      analysis: AnalysisSchema.parse({}),
      raw,
    };
  }

  const result = AnalysisSchema.safeParse(coerce(parsed));
  if (!result.success) {
    // Validation failed on some fields; recover what we can by re-parsing a
    // sanitised object so valid fields survive and invalid ones get defaults.
    const recovered = AnalysisSchema.parse(pickValid(parsed));
    return {
      ok: false,
      error: 'The model output did not match the expected format; showing a partial result.',
      analysis: recovered,
      raw,
    };
  }

  return { ok: true, analysis: result.data, raw };
}

/**
 * Extract the first balanced JSON object from a string, ignoring braces that
 * appear inside string literals. Handles code fences and leading/trailing prose.
 */
export function extractJsonBlock(input: string): string | null {
  const text = input.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null; // Unbalanced (e.g. truncated response).
}

/** Normalise common model quirks before validation. */
function coerce(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const obj = { ...(value as Record<string, unknown>) };

  if (typeof obj.credibility_score === 'string') {
    const n = Number(obj.credibility_score);
    if (!Number.isNaN(n)) obj.credibility_score = n;
  }
  if (typeof obj.marketing_hype === 'string') {
    const level = obj.marketing_hype.toLowerCase();
    obj.marketing_hype = level.startsWith('l') ? 'Low' : level.startsWith('h') ? 'High' : 'Medium';
  }

  for (const key of ['unsupported_claims', 'scientific_claims'] as const) {
    if (Array.isArray(obj[key])) {
      obj[key] = (obj[key] as unknown[]).map((item) =>
        typeof item === 'string' ? { claim: item, reasoning: '' } : item
      );
    }
  }

  return obj;
}

/**
 * Keep only the top-level keys that individually pass validation, so a single
 * malformed field doesn't discard the whole (otherwise useful) response.
 */
function pickValid(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {};
  const coerced = coerce(value) as Record<string, unknown>;
  const shape = AnalysisSchema.shape;
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (!(key in coerced)) continue;
    const fieldResult = shape[key].safeParse(coerced[key]);
    if (fieldResult.success) out[key] = fieldResult.data;
  }
  return out;
}

/** Convenience helper: map a 0–100 score to a 1–5 star rating. */
export function scoreToStars(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.max(1, Math.min(5, Math.round(clamped / 20)));
}

export type { Analysis };
