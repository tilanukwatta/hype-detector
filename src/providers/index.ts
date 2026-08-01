import type { ProviderId } from '@/types';
import type { LLMProvider } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { openrouterProvider } from './openrouter';
import { ollamaProvider } from './ollama';
// Imported via the '@' alias so the store build can swap it for a stub,
// keeping @mlc-ai/web-llm out of that bundle entirely.
import { webllmProvider } from '@/providers/webllm';

/**
 * WebLLM downloads a WebAssembly model at runtime, which Manifest V3's
 * "no remotely hosted code" policy disallows. The Chrome Web Store build
 * (VITE_STORE_BUILD=1) therefore excludes it — and because the reference is
 * statically false, the bundler tree-shakes `@mlc-ai/web-llm` out entirely.
 * WebLLM remains available in the default (non-store) build.
 */
const includeWebllm = import.meta.env.VITE_STORE_BUILD !== '1';

const list: LLMProvider[] = [
  openaiProvider,
  anthropicProvider,
  geminiProvider,
  openrouterProvider,
  ollamaProvider,
];
if (includeWebllm) list.push(webllmProvider);

/** Ordered list for building select menus. */
export const PROVIDER_LIST: readonly LLMProvider[] = list;

/** Registry of active providers, keyed by id. */
export const PROVIDERS = Object.fromEntries(list.map((p) => [p.id, p])) as Record<
  ProviderId,
  LLMProvider
>;

export function getProvider(id: ProviderId): LLMProvider {
  return PROVIDERS[id];
}

export { ProviderError } from './types';
export type {
  LLMProvider,
  CompletionRequest,
  ValidationResult,
  ProviderProgress,
  ProgressCallback,
} from './types';
