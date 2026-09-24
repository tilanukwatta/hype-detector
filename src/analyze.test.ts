import { describe, it, expect, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import type { Product } from '@/types';
import type { Extracted } from '@/extraction';
import { extractPage } from '@/extraction';
import { DEFAULT_SETTINGS } from '@/types';
import { analyzePage } from './analyze';

const product: Product = {
  website: 'Amazon',
  title: 'Test',
  bullets: [],
  specifications: {},
  reviews: [],
};
const extracted: Extracted = { kind: 'product', product };

afterEach(() => vi.restoreAllMocks());

describe('analyzePage', () => {
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
    const result = await analyzePage(extracted, {
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
    const result = await analyzePage(extracted, {
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
    const result = await analyzePage(extracted, {
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
    const result = await analyzePage(extracted, {
      ...DEFAULT_SETTINGS,
      provider: 'ollama',
      apiKey: '',
    });
    expect(result.ok).toBe(true);
  });

  it('analyzes a generic page end-to-end (extractPage → prompt → parse)', async () => {
    const html = `<!doctype html><html lang="en"><head>
      <title>Study Roundup</title>
      <meta property="og:title" content="What the coffee studies actually show" />
    </head><body><main><article>
      <h1>Coffee</h1>
      <p>${'Observational studies report a correlation between coffee and outcomes, but the page cites no trial. '.repeat(3)}</p>
    </article></main></body></html>`;
    const doc = new JSDOM(html).window.document;
    const outcome = extractPage(doc, new URL('https://example.com/coffee'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.extracted.kind).toBe('page');

    const modelJson = JSON.stringify({
      content_type: 'article',
      credibility_score: 55,
      key_claims: [
        {
          claim: 'Coffee improves outcomes',
          assessment: 'unsupported',
          reasoning: 'No trial cited.',
          evidence_on_page: 'no trial',
          confidence: 'low',
        },
      ],
      limitations: ['Needs the underlying studies to verify'],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ content: [{ type: 'text', text: modelJson }] }))
      )
    );

    const result = await analyzePage(outcome.extracted, {
      ...DEFAULT_SETTINGS,
      provider: 'anthropic',
      apiKey: 'k',
    });
    expect(result.ok).toBe(true);
    expect(result.analysis.content_type).toBe('article');
    expect(result.analysis.key_claims[0].assessment).toBe('unsupported');
    expect(result.analysis.limitations).toHaveLength(1);
  });
});
