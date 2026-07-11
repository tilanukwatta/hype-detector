import { postJson, ProviderError, resolveBaseUrl, type LLMProvider } from './types';

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
        headers: {
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
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
};
