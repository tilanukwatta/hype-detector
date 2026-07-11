import { postJson, ProviderError, resolveBaseUrl, type LLMProvider } from './types';

interface OllamaResponse {
  message?: { content?: string };
}

/**
 * Local Ollama via `/api/chat`. Requires no API key and talks to a local
 * server, so it is the fully offline / zero-cost path. `stream: false` gives a
 * single JSON response; `format: 'json'` asks the model for strict JSON.
 */
export const ollamaProvider: LLMProvider = {
  id: 'ollama',
  label: 'Ollama (local)',
  requiresApiKey: false,
  defaultBaseUrl: 'http://localhost:11434',
  suggestedModels: ['llama3.1', 'qwen2.5', 'mistral'],

  async complete(req) {
    const { settings } = req;
    const url = `${resolveBaseUrl(this, settings)}/api/chat`;

    const data = (await postJson(
      url,
      {
        model: settings.model,
        stream: false,
        format: 'json',
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens,
        },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      },
      { provider: this.id, signal: req.signal }
    )) as OllamaResponse;

    const text = data.message?.content;
    if (!text) {
      throw new ProviderError('The model returned an empty response.', { provider: this.id });
    }
    return text;
  },
};
