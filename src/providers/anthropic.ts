import {
  extractErrorDetail,
  keyCheckMessage,
  postJson,
  ProviderError,
  resolveBaseUrl,
  type LLMProvider,
  type ValidationResult,
} from './types';

const ANTHROPIC_HEADERS = {
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
};

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Anthropic Messages API. Differences from OpenAI: a top-level `system` field,
 * `x-api-key` + `anthropic-version` headers, and content returned as an array
 * of typed blocks.
 *
 * `anthropic-dangerous-direct-browser-access` opts in to CORS from an extension
 * page context; keys still never leave the user's device.
 */
export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  requiresApiKey: true,
  defaultBaseUrl: 'https://api.anthropic.com/v1',
  suggestedModels: ['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],

  async complete(req) {
    const { settings } = req;
    const url = `${resolveBaseUrl(this, settings)}/messages`;

    const data = (await postJson(
      url,
      {
        model: settings.model,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      },
      {
        provider: this.id,
        signal: req.signal,
        headers: { 'x-api-key': settings.apiKey, ...ANTHROPIC_HEADERS },
      }
    )) as AnthropicResponse;

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('');

    if (!text) {
      throw new ProviderError('The model returned an empty response.', { provider: this.id });
    }
    return text;
  },

  // Anthropic has no cheap key-check endpoint, so send a 1-token message. This
  // also validates the model name (a bad model returns 404).
  async validate(settings, signal): Promise<ValidationResult> {
    const url = `${resolveBaseUrl(this, settings)}/messages`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          ...ANTHROPIC_HEADERS,
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      return { ok: false, message: 'Could not reach Anthropic. Check your connection.' };
    }
    if (res.ok) return { ok: true, message: 'API key and model look valid.' };
    if (res.status === 429)
      return { ok: true, message: 'Key recognized (currently rate-limited).' };
    return {
      ok: false,
      message: keyCheckMessage(res.status, extractErrorDetail(await res.text())),
    };
  },
};
