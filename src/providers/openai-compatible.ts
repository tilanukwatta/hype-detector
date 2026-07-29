import type { Settings } from '@/types';
import type { CompletionRequest, ValidationResult } from './types';
import { postJson, ProviderError, resolveBaseUrl, validationPing, type LLMProvider } from './types';

/**
 * Shared implementation of the OpenAI `chat/completions` API shape, reused by
 * both the OpenAI and OpenRouter providers (OpenRouter is wire-compatible).
 */
interface ChatChoice {
  message?: { content?: string | null };
}
interface ChatResponse {
  choices?: ChatChoice[];
}

export async function chatCompletion(
  provider: LLMProvider,
  req: CompletionRequest,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const { settings } = req;
  const url = `${resolveBaseUrl(provider, settings)}/chat/completions`;

  const data = (await postJson(
    url,
    {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      // Nudges compatible models to emit strict JSON when supported; harmless otherwise.
      response_format: { type: 'json_object' },
    },
    {
      provider: provider.id,
      signal: req.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        ...extraHeaders,
      },
    }
  )) as ChatResponse;

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new ProviderError('The model returned an empty response.', { provider: provider.id });
  }
  return content;
}

/**
 * Validate an OpenAI-compatible key by sending a 1-token completion with the
 * selected model. Unlike listing models, this verifies the key actually has
 * access to that specific model (catching e.g. a 403 "project does not have
 * access to model ...").
 */
export function validateViaChat(
  provider: LLMProvider,
  settings: Settings,
  extraHeaders: Record<string, string> = {},
  signal?: AbortSignal
): Promise<ValidationResult> {
  const url = `${resolveBaseUrl(provider, settings)}/chat/completions`;
  return validationPing(provider.label, url, {
    signal,
    headers: { Authorization: `Bearer ${settings.apiKey}`, ...extraHeaders },
    body: {
      model: settings.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    },
  });
}
