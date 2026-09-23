import type { Analysis, ChatTurn, Settings } from '@/types';
import type { Extracted } from '@/extraction';
import { getProvider, ProviderError, type ProgressCallback } from '@/providers';
import { buildChatPrompt, CHAT_SYSTEM_PROMPT } from '@/prompts';

/** A follow-up answer, or a user-facing error. Mirrors the analyze result shape. */
export type ChatResult = { ok: true; answer: string } | { ok: false; error: string };

/**
 * Answer a follow-up question about an already-extracted page. The page content,
 * the prior analysis, and the recent conversation are flattened into a single
 * prompt so this works through the existing single-shot provider interface with
 * no per-provider multi-turn plumbing. Returns freeform prose (no JSON parsing);
 * chat turns are never cached. Aborts propagate; other failures become
 * `{ ok: false }`.
 */
export async function askFollowUp(
  extracted: Extracted,
  analysis: Analysis | null,
  history: ChatTurn[],
  question: string,
  settings: Settings,
  signal?: AbortSignal,
  onProgress?: ProgressCallback
): Promise<ChatResult> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, error: 'Type a question first.' };

  const provider = getProvider(settings.provider);
  if (provider.requiresApiKey && !settings.apiKey.trim()) {
    return {
      ok: false,
      error: `An API key is required for ${provider.label}. Add one in the extension options.`,
    };
  }

  try {
    const answer = await provider.complete({
      system: CHAT_SYSTEM_PROMPT,
      user: buildChatPrompt(extracted, analysis, history, trimmed, {
        compact: provider.smallContext,
      }),
      settings,
      signal,
      onProgress,
    });
    return { ok: true, answer: answer.trim() };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    const message =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'The follow-up request failed for an unknown reason.';
    return { ok: false, error: message };
  }
}
