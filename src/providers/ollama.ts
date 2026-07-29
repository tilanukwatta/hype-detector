import {
  postJson,
  ProviderError,
  resolveBaseUrl,
  type LLMProvider,
  type ValidationResult,
} from './types';

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

  // No API key to check; instead confirm the local server is reachable and warn
  // if the configured model has not been pulled yet.
  async validate(settings, signal): Promise<ValidationResult> {
    const base = resolveBaseUrl(this, settings);
    let res: Response;
    try {
      res = await fetch(`${base}/api/tags`, { signal });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      return { ok: false, message: `Could not reach Ollama at ${base}. Is it running?` };
    }
    if (!res.ok) return { ok: false, message: `Ollama responded with ${res.status}.` };

    const data = (await res.json().catch(() => ({}))) as { models?: Array<{ name?: string }> };
    const names = (data.models ?? []).map((m) => m.name ?? '');
    const pulled = names.some((n) => n === settings.model || n.startsWith(`${settings.model}:`));
    if (settings.model && !pulled) {
      return {
        ok: true,
        message: `Server reachable, but model "${settings.model}" is not pulled. Run: ollama pull ${settings.model}`,
      };
    }
    return { ok: true, message: 'Ollama server is reachable.' };
  },
};
