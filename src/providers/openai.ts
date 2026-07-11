import type { LLMProvider } from './types';
import { chatCompletion } from './openai-compatible';

export const openaiProvider: LLMProvider = {
  id: 'openai',
  label: 'OpenAI',
  requiresApiKey: true,
  defaultBaseUrl: 'https://api.openai.com/v1',
  suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  complete(req) {
    return chatCompletion(this, req);
  },
};
