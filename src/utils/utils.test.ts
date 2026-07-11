import { describe, it, expect } from 'vitest';
import type { Product } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { AnalysisSchema } from '@/types';
import { hashProduct } from './cache';
import { loadSettings, saveSettings, getCachedAnalysis, putCachedAnalysis } from './storage';

const baseProduct: Product = {
  website: 'Amazon',
  title: 'Serum',
  bullets: ['a', 'b'],
  specifications: { Volume: '30ml', Form: 'Serum' },
};

describe('hashProduct', () => {
  it('is stable for identical content', () => {
    expect(hashProduct(baseProduct)).toBe(hashProduct({ ...baseProduct }));
  });

  it('is insensitive to specification ordering', () => {
    const reordered: Product = {
      ...baseProduct,
      specifications: { Form: 'Serum', Volume: '30ml' },
    };
    expect(hashProduct(reordered)).toBe(hashProduct(baseProduct));
  });

  it('changes when content changes', () => {
    expect(hashProduct({ ...baseProduct, title: 'Different' })).not.toBe(hashProduct(baseProduct));
  });
});

describe('settings storage', () => {
  it('returns defaults when nothing stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const settings = { ...DEFAULT_SETTINGS, provider: 'openai' as const, apiKey: 'sk-123' };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
  });

  it('merges partial stored settings over defaults', async () => {
    await chrome.storage.local.set({ settings: { apiKey: 'partial' } });
    const loaded = await loadSettings();
    expect(loaded.apiKey).toBe('partial');
    expect(loaded.provider).toBe(DEFAULT_SETTINGS.provider);
  });
});

describe('analysis cache', () => {
  const analysis = AnalysisSchema.parse({});

  it('stores and retrieves by hash/provider/model', async () => {
    await putCachedAnalysis({
      productHash: 'abc',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      analysis: analysis as never,
      createdAt: Date.now(),
    });
    const hit = await getCachedAnalysis('abc', 'anthropic', 'claude-sonnet-5');
    expect(hit).not.toBeNull();
    expect(hit?.productHash).toBe('abc');
  });

  it('misses on a different model', async () => {
    await putCachedAnalysis({
      productHash: 'abc',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      analysis: analysis as never,
      createdAt: Date.now(),
    });
    expect(await getCachedAnalysis('abc', 'anthropic', 'gpt-4o')).toBeNull();
  });
});
