import type { AnalysisResult, Product, Settings } from '@/types';
import { AnalysisSchema } from '@/types';
import { getProvider, ProviderError } from '@/providers';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from '@/prompts';
import { parseAnalysis } from '@/parser';

/**
 * End-to-end analysis of a single product: build the prompt, call the selected
 * provider, and parse the result. Network/provider errors are converted into an
 * `ok: false` {@link AnalysisResult} so callers have a single result shape to
 * render. This is the one function the UI needs.
 */
export async function analyzeProduct(
  product: Product,
  settings: Settings,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const provider = getProvider(settings.provider);

  if (provider.requiresApiKey && !settings.apiKey.trim()) {
    return {
      ok: false,
      error: `An API key is required for ${provider.label}. Add one in the extension options.`,
      analysis: AnalysisSchema.parse({}),
      raw: '',
    };
  }

  try {
    const raw = await provider.complete({
      system: SYSTEM_PROMPT,
      user: buildAnalysisPrompt(product),
      settings,
      signal,
    });
    return parseAnalysis(raw);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    const message =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Analysis failed for an unknown reason.';
    return { ok: false, error: message, analysis: AnalysisSchema.parse({}), raw: '' };
  }
}
