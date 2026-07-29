import type { LLMProvider } from './types';
import { chatCompletion, validateViaModels } from './openai-compatible';

const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://github.com/tilanukwatta/hype-detector',
  'X-Title': 'Hype Detector',
};

/**
 * OpenRouter exposes an OpenAI-compatible endpoint. The optional referer/title
 * headers help OpenRouter attribute traffic and are safe to send.
 */
export const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  label: 'OpenRouter',
  requiresApiKey: true,
  defaultBaseUrl: 'https://openrouter.ai/api/v1',
  suggestedModels: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5'],
  complete(req) {
    return chatCompletion(this, req, OPENROUTER_HEADERS);
  },
  validate(settings, signal) {
    return validateViaModels(this, settings, OPENROUTER_HEADERS, signal);
  },
};
