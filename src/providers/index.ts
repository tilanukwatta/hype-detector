import type { ProviderId } from '@/types';
import type { LLMProvider } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { openrouterProvider } from './openrouter';
import { ollamaProvider } from './ollama';

/** Registry of all supported providers, keyed by id. */
export const PROVIDERS: Record<ProviderId, LLMProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  ollama: ollamaProvider,
};

export function getProvider(id: ProviderId): LLMProvider {
  return PROVIDERS[id];
}

/** Ordered list for building select menus. */
export const PROVIDER_LIST: readonly LLMProvider[] = [
  openaiProvider,
  anthropicProvider,
  geminiProvider,
  openrouterProvider,
  ollamaProvider,
];

export { ProviderError } from './types';
export type { LLMProvider, CompletionRequest } from './types';
