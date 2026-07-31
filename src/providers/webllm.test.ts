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

function setWebGpu(present: boolean) {
  if (present) {
    Object.defineProperty(globalThis.navigator, 'gpu', { value: {}, configurable: true });
  } else {
    // @ts-expect-error test cleanup
    delete globalThis.navigator.gpu;
  }
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
  setWebGpu(false);
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
    setWebGpu(true);
    expect((await webllmProvider.validate(settingsFor())).ok).toBe(true);
    setWebGpu(false);
    const missing = await webllmProvider.validate(settingsFor());
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/WebGPU is not available/);
  });

  it('complete() fails clearly when WebGPU is unavailable', async () => {
    setWebGpu(false);
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/WebGPU is not available/);
  });

  it('complete() runs a JSON chat completion with the selected model', async () => {
    setWebGpu(true);
    engine.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: '{"credibility_score":70}' } }],
    });
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
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(out).toBe('{"credibility_score":70}');
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'generate' }));
  });

  it('complete() throws on empty output', async () => {
    setWebGpu(true);
    engine.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: '' } }] });
    await expect(
      webllmProvider.complete({ system: 's', user: 'u', settings: settingsFor() })
    ).rejects.toThrow(/empty response/);
  });
});
