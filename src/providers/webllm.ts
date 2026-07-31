import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ProgressCallback } from './types';
import { ProviderError, type LLMProvider } from './types';

/**
 * WebLLM provider: runs an LLM fully in the browser via WebGPU — no API key, no
 * server, and no inference data ever leaves the device. The model is downloaded
 * once (from HuggingFace/GitHub) and cached on disk; afterwards it runs offline.
 *
 * Inference runs in a dedicated Web Worker (`webllm.worker.ts`) so it doesn't
 * block the side panel UI. `@mlc-ai/web-llm` is dynamically imported so its
 * large bundle only loads when this provider is actually used.
 */

/** Module-level singletons: the worker + engine are reused across analyses. */
let worker: Worker | null = null;
let engine: MLCEngineInterface | null = null;
let loadedModel: string | null = null;

function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

async function getEngine(
  model: string,
  onProgress?: ProgressCallback
): Promise<MLCEngineInterface> {
  const webllm = await import('@mlc-ai/web-llm');

  const initProgressCallback = (report: { progress: number; text: string }) => {
    onProgress?.({
      stage: 'download',
      text: report.text,
      percent: Math.round((report.progress ?? 0) * 100),
    });
  };

  if (!engine) {
    worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
    engine = await webllm.CreateWebWorkerMLCEngine(worker, model, { initProgressCallback });
    loadedModel = model;
  } else if (loadedModel !== model) {
    engine.setInitProgressCallback(initProgressCallback);
    await engine.reload(model);
    loadedModel = model;
  }
  return engine;
}

export const webllmProvider: LLMProvider = {
  id: 'webllm',
  label: 'In-browser (WebLLM)',
  requiresApiKey: false,
  defaultBaseUrl: '',
  suggestedModels: [
    'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
    'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  ],

  async complete(req) {
    if (!hasWebGpu()) {
      throw new ProviderError(
        'WebGPU is not available in this browser, so the in-browser model cannot run. Use a Chromium browser with hardware acceleration enabled.',
        { provider: this.id }
      );
    }

    const mlcEngine = await getEngine(req.settings.model, req.onProgress);

    // Non-streaming create() has no signal param; interrupt on abort instead.
    const onAbort = () => mlcEngine.interruptGenerate();
    req.signal?.addEventListener('abort', onAbort, { once: true });
    req.onProgress?.({ stage: 'generate', text: 'Analyzing with the local model…' });

    try {
      const response = await mlcEngine.chat.completions.create({
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: req.settings.temperature,
        max_tokens: req.settings.maxTokens,
        response_format: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new ProviderError('The model returned an empty response.', { provider: this.id });
      }
      return content;
    } finally {
      req.signal?.removeEventListener('abort', onAbort);
    }
  },

  // Can't cheaply verify a model without downloading it, so validate WebGPU
  // availability — the actual prerequisite for this provider.
  async validate() {
    if (hasWebGpu()) {
      return {
        ok: true,
        message:
          'WebGPU is available. The selected model downloads on the first analysis (one-time), then runs fully offline.',
      };
    }
    return {
      ok: false,
      message:
        'WebGPU is not available in this browser. Use Chrome/Edge/Brave with hardware acceleration enabled.',
    };
  },
};
