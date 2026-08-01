import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/types';

// Mock the heavy WebLLM SDK. The provider dynamically imports it and talks to a
// Web Worker; here we replace the engine factory with a controllable stub.
const { createEngine, engine } = vi.hoisted(() => {
  const engine = {
    chat: { completions: { create: vi.fn() } },
    reload: vi.fn(async () => {}),
    setInitProgressCallback: vi.fn(),
    interruptGenerate: vi.fn(),
  };
  return { createEngine: vi.fn(async () => engine), engine };
});

vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: createEngine,
  WebWorkerMLCEngineHandler: class {},
}));

import { webllmProvider } from './webllm';

function settingsFor(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, provider: 'webllm', apiKey: '', ...overrides };
}

/** A fake streaming completion: yields the text in a few delta chunks. */
function streamOf(text: string) {
  const parts = text
    ? [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))]
    : [];
  return {
    async *[Symbol.asyncIterator]() {
      for (const content of parts) yield { choices: [{ delta: { content } }] };
    },
  };
}

type GpuMode = 'hardware' | 'fallback' | 'no-adapter' | 'software-named' | 'absent';

function setWebGpu(mode: GpuMode) {
  if (mode === 'absent') {
    // @ts-expect-error test cleanup
    delete globalThis.navigator.gpu;
    return;
  }
  const requestAdapter = async () => {
    if (mode === 'no-adapter') return null;
    if (mode === 'software-named') {
      return {
        isFallbackAdapter: false,
        info: { vendor: 'google', description: 'SwiftShader Device' },
      };
    }
    return {
      isFallbackAdapter: mode === 'fallback',
      info: { vendor: 'intel', architecture: 'gen-12' },
    };
  };
  Object.defineProperty(globalThis.navigator, 'gpu', {
    value: { requestAdapter },
    configurable: true,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'Worker',
    class {
      constructor(_url: URL, _opts: unknown) {}
      terminate() {}
    }
  );
  engine.chat.completions.create.mockReset();
  createEngine.mockClear();
});

afterEach(() => {
  setWebGpu('absent');
  vi.unstubAllGlobals();
});

describe('webllm provider', () => {
  it('is keyless and exposes a range of model sizes', () => {
    expect(webllmProvider.requiresApiKey).toBe(false);
    expect(webllmProvider.suggestedModels.length).toBeGreaterThanOrEqual(3);
    expect(webllmProvider.suggestedModels.some((m) => /1B/.test(m))).toBe(true);
    expect(webllmProvider.suggestedModels.some((m) => /8B/.test(m))).toBe(true);
  });

  it('validate() reports WebGPU availability', async () => {
    setWebGpu('hardware');
    expect((await webllmProvider.validate(settingsFor())).ok).toBe(true);
    setWebGpu('absent');
    const missing = await webllmProvider.validate(settingsFor());
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/WebGPU is not available/);
  });

  it('validate() rejects a software (CPU) fallback adapter', async () => {
    setWebGpu('fallback');
    const result = await webllmProvider.validate(settingsFor());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/software \(CPU\)/i);
  });

  it('validate() rejects when no GPU adapter is found', async () => {
    setWebGpu('no-adapter');
    const result = await webllmProvider.validate(settingsFor());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No WebGPU adapter/);
  });

  it('validate() rejects a software renderer detected by name (e.g. SwiftShader)', async () => {
    setWebGpu('software-named');
    const result = await webllmProvider.validate(settingsFor());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/software \(CPU\)/i);
    expect(result.message).toMatch(/SwiftShader/);
  });

  it('validate() surfaces the adapter name when usable', async () => {
    setWebGpu('hardware');
    const result = await webllmProvider.validate(settingsFor());
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/intel/i);
  });

  it('complete() refuses (before downloading) when WebGPU is unavailable', async () => {
    setWebGpu('absent');
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/WebGPU is not available/);
    expect(createEngine).not.toHaveBeenCalled();
  });

  it('complete() refuses on a software fallback (no multi-GB download)', async () => {
    setWebGpu('fallback');
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/software \(CPU\)/i);
    expect(createEngine).not.toHaveBeenCalled();
  });

  it('wraps a model-load failure in a descriptive error (and resets for retry)', async () => {
    setWebGpu('hardware');
    createEngine.mockRejectedValueOnce(new Error('Failed to fetch model shard (404)'));
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/Could not load the in-browser model.*404/);
  });

  it('complete() runs a JSON chat completion with the selected model', async () => {
    setWebGpu('hardware');
    engine.chat.completions.create.mockResolvedValue(streamOf('{"credibility_score":70}'));
    const onProgress = vi.fn();

    const out = await webllmProvider.complete({
      system: 'sys',
      user: 'analyze this',
      settings: settingsFor({ model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' }),
      onProgress,
    });

    expect(createEngine).toHaveBeenCalled();
    const createArgs = createEngine.mock.calls[0] as unknown[];
    expect(createArgs[1]).toBe('Llama-3.2-3B-Instruct-q4f16_1-MLC'); // model id
    const body = (engine.chat.completions.create.mock.calls[0] as unknown[])[0] as {
      response_format: unknown;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(out).toBe('{"credibility_score":70}'); // reassembled from stream chunks
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'generate' }));
  });

  it('wraps a generation failure in a descriptive error', async () => {
    setWebGpu('hardware');
    // Engine is cached from the previous test; make generation fail.
    engine.chat.completions.create.mockRejectedValue(new Error('WebGPU shader compile failed'));
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/in-browser model failed.*shader compile/);
  });

  it('complete() throws on empty output', async () => {
    setWebGpu('hardware');
    engine.chat.completions.create.mockResolvedValue(streamOf(''));
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/empty response/);
  });
});
