import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { getProvider, PROVIDER_LIST, ProviderError } from './index';
import type { CompletionRequest } from './types';

function settingsFor(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, apiKey: 'test-key', ...overrides };
}

function req(settings: Settings): CompletionRequest {
  return { system: 'sys', user: 'analyze this', settings };
}

/** Build a fetch mock that captures the last request and returns `body`. */
function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn(async () => {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status: init.status ?? 200,
      statusText: 'OK',
    }) as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function lastCall(fn: ReturnType<typeof mockFetch>) {
  const call = fn.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  const [url, init] = call as unknown as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
}

afterEach(() => vi.restoreAllMocks());

describe('registry', () => {
  it('exposes all five providers', () => {
    expect(PROVIDER_LIST.map((p) => p.id).sort()).toEqual(
      ['anthropic', 'gemini', 'ollama', 'openai', 'openrouter'].sort()
    );
  });
});

describe('openai provider', () => {
  it('posts chat/completions with bearer auth', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: '{"ok":true}' } }] });
    const provider = getProvider('openai');
    const out = await provider.complete(req(settingsFor({ provider: 'openai', model: 'gpt-4o' })));

    const { url, init, body } = await lastCall(fetchMock);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(body.model).toBe('gpt-4o');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(out).toBe('{"ok":true}');
  });
});

describe('openrouter provider', () => {
  it('uses the openrouter base url and attribution headers', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: 'hi' } }] });
    await getProvider('openrouter').complete(req(settingsFor({ provider: 'openrouter' })));

    const { url, init } = await lastCall(fetchMock);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['X-Title']).toBe('Hype Detector');
  });
});

describe('anthropic provider', () => {
  it('posts messages with x-api-key and version headers', async () => {
    const fetchMock = mockFetch({ content: [{ type: 'text', text: 'result' }] });
    const out = await getProvider('anthropic').complete(
      req(settingsFor({ provider: 'anthropic', model: 'claude-sonnet-5' }))
    );

    const { url, init, body } = await lastCall(fetchMock);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(body.system).toBe('sys');
    expect(out).toBe('result');
  });
});

describe('gemini provider', () => {
  it('passes the key in the query string and reads candidate parts', async () => {
    const fetchMock = mockFetch({
      candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }],
    });
    const out = await getProvider('gemini').complete(
      req(settingsFor({ provider: 'gemini', model: 'gemini-1.5-flash' }))
    );

    const { url, body } = await lastCall(fetchMock);
    expect(url).toContain('/models/gemini-1.5-flash:generateContent');
    expect(url).toContain('key=test-key');
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(out).toBe('ab');
  });
});

describe('ollama provider', () => {
  it('posts to /api/chat without auth and reads message.content', async () => {
    const fetchMock = mockFetch({ message: { content: 'local result' } });
    const out = await getProvider('ollama').complete(
      req(settingsFor({ provider: 'ollama', apiKey: '', model: 'llama3.1' }))
    );

    const { url, init, body } = await lastCall(fetchMock);
    expect(url).toBe('http://localhost:11434/api/chat');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(body.stream).toBe(false);
    expect(out).toBe('local result');
  });

  it('respects a custom baseUrl override', async () => {
    const fetchMock = mockFetch({ message: { content: 'x' } });
    await getProvider('ollama').complete(
      req(settingsFor({ provider: 'ollama', apiKey: '', baseUrl: 'http://127.0.0.1:1234/' }))
    );
    const { url } = await lastCall(fetchMock);
    expect(url).toBe('http://127.0.0.1:1234/api/chat');
  });
});

describe('error handling', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('maps 401 to an auth message', async () => {
    mockFetch({ error: { message: 'bad key' } }, { ok: false, status: 401 });
    await expect(
      getProvider('openai').complete(req(settingsFor({ provider: 'openai' })))
    ).rejects.toThrow(ProviderError);
    await expect(
      getProvider('openai').complete(req(settingsFor({ provider: 'openai' })))
    ).rejects.toThrow(/Authentication failed/);
  });

  it('throws on empty model output', async () => {
    mockFetch({ choices: [{ message: { content: '' } }] });
    await expect(
      getProvider('openai').complete(req(settingsFor({ provider: 'openai' })))
    ).rejects.toThrow(/empty response/);
  });

  it('wraps network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    await expect(
      getProvider('openai').complete(req(settingsFor({ provider: 'openai' })))
    ).rejects.toThrow(/Network request failed/);
  });
});
