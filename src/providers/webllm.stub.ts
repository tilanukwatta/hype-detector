import type { LLMProvider } from './types';

/**
 * Store-build placeholder for the WebLLM provider. In the Chrome Web Store build
 * (`VITE_STORE_BUILD=1`) Vite aliases `@/providers/webllm` to this file, so the
 * real WebLLM module — and `@mlc-ai/web-llm` plus its Web Worker — are never
 * pulled into the bundle. It is never registered (the registry omits WebLLM in
 * that build), so this value is unused at runtime.
 */
export const webllmProvider = undefined as unknown as LLMProvider;
