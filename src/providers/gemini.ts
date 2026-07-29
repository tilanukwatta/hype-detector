import { postJson, ProviderError, resolveBaseUrl, validationPing, type LLMProvider } from './types';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * Google Gemini `generateContent`. The API key is passed as a query parameter,
 * the system prompt goes in `systemInstruction`, and generation options live
 * under `generationConfig`. Requesting `application/json` asks Gemini to return
 * strict JSON.
 */
export const geminiProvider: LLMProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  requiresApiKey: true,
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  suggestedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],

  async complete(req) {
    const { settings } = req;
    const base = resolveBaseUrl(this, settings);
    const url = `${base}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

    const data = (await postJson(
      url,
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens,
          responseMimeType: 'application/json',
        },
      },
      { provider: this.id, signal: req.signal }
    )) as GeminiResponse;

    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');

    if (!text) {
      throw new ProviderError('The model returned an empty response.', { provider: this.id });
    }
    return text;
  },

  validate(settings, signal) {
    // A 1-token generateContent call validates both the key and the selected
    // model (a bad key/model surfaces as 400/403/404).
    const base = resolveBaseUrl(this, settings);
    const url = `${base}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    return validationPing(this.label, url, {
      signal,
      body: {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      },
    });
  },
};
