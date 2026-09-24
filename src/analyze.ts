import type { AnalysisResult, Settings } from '@/types';
import type { Extracted } from '@/extraction';
import { AnalysisSchema } from '@/types';
import { getProvider, ProviderError, type ProgressCallback } from '@/providers';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from '@/prompts';
import { parseAnalysis } from '@/parser';

/**
 * End-to-end analysis of extracted content (a product listing or a generic
 * page): build the prompt, call the selected provider, and parse the result.
 * Network/provider errors are converted into an `ok: false` {@link AnalysisResult}
 * so callers have a single result shape to render. This is the one function the
 * UI needs.
 */
export async function analyzePage(
  extracted: Extracted,
  settings: Settings,
  signal?: AbortSignal,
  onProgress?: ProgressCallback
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
      user: buildAnalysisPrompt(extracted, { compact: provider.smallContext }),
      settings,
      signal,
      onProgress,
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
