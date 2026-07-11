import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Product } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { analyzeProduct } from './analyze';

const product: Product = {
  website: 'Amazon',
  title: 'Test',
  bullets: [],
  specifications: {},
};

afterEach(() => vi.restoreAllMocks());

describe('analyzeProduct', () => {
  it('returns a parsed analysis on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ content: [{ type: 'text', text: '{"credibility_score": 70}' }] })
          )
      )
    );
    const result = await analyzeProduct(product, {
      ...DEFAULT_SETTINGS,
      provider: 'anthropic',
      apiKey: 'k',
    });
    expect(result.ok).toBe(true);
    expect(result.analysis.credibility_score).toBe(70);
  });

  it('short-circuits when a required api key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await analyzeProduct(product, {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      apiKey: '  ',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/API key is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('converts provider errors into an ok:false result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":{"message":"nope"}}', { status: 401 }))
    );
    const result = await analyzeProduct(product, {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      apiKey: 'k',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Authentication failed/);
  });

  it('does not require a key for ollama', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: { content: '{}' } })))
    );
    const result = await analyzeProduct(product, {
      ...DEFAULT_SETTINGS,
      provider: 'ollama',
      apiKey: '',
    });
    expect(result.ok).toBe(true);
  });
});
