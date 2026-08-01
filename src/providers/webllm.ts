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

/** Extract a readable message from any thrown value (WebLLM/worker errors are
 * often plain objects or ErrorEvents once proxied across the worker boundary). */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const obj = error as { message?: unknown; error?: unknown };
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    try {
      return JSON.stringify(error);
    } catch {
      /* fall through */
    }
  }
  return String(error);
}

/** Dispose the cached worker/engine so the next attempt starts clean. */
function resetEngine(): void {
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
  engine = null;
  loadedModel = null;
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
  label: 'In-browser / WebLLM (experimental)',
  requiresApiKey: false,
  defaultBaseUrl: '',
  // Prebuilt WebLLM models have a small (~4096-token) context window, so the
  // prompt builder produces a compact prompt for this provider.
  smallContext: true,
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

    let mlcEngine: MLCEngineInterface;
    try {
      mlcEngine = await getEngine(req.settings.model, req.onProgress);
    } catch (error) {
      resetEngine(); // so a retry re-initializes from scratch
      throw new ProviderError(
        `Could not load the in-browser model (${req.settings.model}): ${describeError(error)}`,
        { provider: this.id, cause: error }
      );
    }

    req.onProgress?.({ stage: 'generate', text: 'Generating the analysis…' });

    // Interrupt immediately on abort — including while the model is still in
    // prefill (before any tokens stream), where the per-chunk check can't fire.
    const onAbort = () => void mlcEngine.interruptGenerate();
    req.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      // Stream so the UI shows live progress instead of a frozen spinner during
      // the slow local generation.
      const stream = await mlcEngine.chat.completions.create({
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: req.settings.temperature,
        // Clamp output so prompt + output fits the model's ~4096-token window.
        max_tokens: Math.min(req.settings.maxTokens, 2048),
        response_format: { type: 'json_object' },
        stream: true,
      });

      let content = '';
      let tokens = 0;
      for await (const chunk of stream) {
        if (req.signal?.aborted) {
          await mlcEngine.interruptGenerate();
          throw new DOMException('Aborted', 'AbortError');
        }
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          content += delta;
          tokens += 1;
          if (tokens % 8 === 0) {
            req.onProgress?.({
              stage: 'generate',
              text: `Generating the analysis… (${tokens} tokens)`,
            });
          }
        }
      }

      if (!content) {
        throw new ProviderError('The model returned an empty response.', { provider: this.id });
      }
      return content;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(`The in-browser model failed: ${describeError(error)}`, {
        provider: this.id,
        cause: error,
      });
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
