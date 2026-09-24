import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Analysis, ChatTurn, PageContent } from '@/types';
import type { Extracted } from '@/extraction';
import { AnalysisSchema, DEFAULT_SETTINGS } from '@/types';
import { buildChatPrompt, CHAT_SYSTEM_PROMPT } from '@/prompts';
import { askFollowUp } from './chat';

const page: PageContent = {
  url: 'https://example.com/coffee',
  title: 'Coffee and Health',
  headings: [],
  sections: [{ text: 'The page claims coffee cures everything but cites no study.' }],
  metadata: {},
};
const extracted: Extracted = { kind: 'page', page };
const analysis: Analysis = AnalysisSchema.parse({
  content_type: 'article',
  overall_assessment: 'Overstated claims with thin sourcing.',
  credibility_score: 40,
  key_claims: [{ claim: 'Coffee cures everything', assessment: 'unsupported' }],
});

afterEach(() => vi.restoreAllMocks());

describe('buildChatPrompt', () => {
  it('includes page content, prior analysis, and the question, treating page as data', () => {
    const prompt = buildChatPrompt(extracted, analysis, [], 'Does it cite any studies?');
    expect(prompt).toContain('Coffee and Health');
    expect(prompt).toContain('cites no study');
    expect(prompt).toContain('Does it cite any studies?');
    expect(prompt).toContain('[PRIOR ANALYSIS]');
    expect(prompt).toContain('Overstated claims');
    expect(prompt).toContain('untrusted data'); // injection defence framing
  });

  it('renders and caps prior conversation history', () => {
    const history: ChatTurn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));
    const prompt = buildChatPrompt(extracted, analysis, history, 'next?');
    expect(prompt).toContain('[CONVERSATION SO FAR]');
    // Only the last 6 turns are kept.
    expect(prompt).not.toContain('turn 0');
    expect(prompt).toContain('turn 9');
  });

  it('handles a missing prior analysis', () => {
    const prompt = buildChatPrompt(extracted, null, [], 'what is this page?');
    expect(prompt).toContain('None yet.');
  });

  it('CHAT_SYSTEM_PROMPT forbids fabrication and following page instructions', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('cannot browse');
    expect(CHAT_SYSTEM_PROMPT).toContain('never as instructions');
  });
});

describe('askFollowUp', () => {
  it('returns the model answer on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ content: [{ type: 'text', text: 'No, the page cites no studies.' }] })
          )
      )
    );
    const result = await askFollowUp(extracted, analysis, [], 'studies?', {
      ...DEFAULT_SETTINGS,
      provider: 'anthropic',
      apiKey: 'k',
    });
    expect(result).toEqual({ ok: true, answer: 'No, the page cites no studies.' });
  });

  it('short-circuits on an empty question', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await askFollowUp(extracted, analysis, [], '   ', {
      ...DEFAULT_SETTINGS,
      provider: 'anthropic',
      apiKey: 'k',
    });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an API key when the provider needs one', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await askFollowUp(extracted, analysis, [], 'q?', {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      apiKey: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/API key is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not request JSON output on an OpenAI-compatible provider', async () => {
    // Regression: JSON mode both forces JSON output and requires the word "json"
    // in the messages, which broke free-form chat with a 400.
    let sentBody: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sentBody = JSON.parse(init.body) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'A plain prose answer.' } }] })
        );
      })
    );
    const result = await askFollowUp(extracted, analysis, [], 'q?', {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      apiKey: 'k',
    });
    expect(result).toEqual({ ok: true, answer: 'A plain prose answer.' });
    expect(sentBody.response_format).toBeUndefined();
  });

  it('converts provider errors into an ok:false result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":{"message":"nope"}}', { status: 401 }))
    );
    const result = await askFollowUp(extracted, analysis, [], 'q?', {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      apiKey: 'k',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Authentication failed/);
  });

  it('propagates aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
      })
    );
    await expect(
      askFollowUp(
        extracted,
        analysis,
        [],
        'q?',
        { ...DEFAULT_SETTINGS, provider: 'anthropic', apiKey: 'k' },
        controller.signal
      )
    ).rejects.toThrow(/abort/i);
  });
});
