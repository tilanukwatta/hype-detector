import { describe, it, expect } from 'vitest';
import type { PageContent, Product } from '@/types';
import type { Extracted } from '@/extraction';
import { buildAnalysisPrompt, SYSTEM_PROMPT } from './index';

const product: Product = {
  website: 'Amazon',
  title: 'QuantumGlow Serum',
  brand: 'QuantumGlow',
  price: '$29.99',
  bullets: ['Reduces wrinkles by 300%'],
  specifications: { Volume: '30 ml' },
  rating: '4.1 out of 5 stars',
  reviewCount: '2,317 ratings',
  reviews: [{ rating: '2.0', title: 'Leaked', body: 'Arrived with a broken seal.' }],
};
const productExtracted: Extracted = { kind: 'product', product };

const page: PageContent = {
  url: 'https://example.com/coffee',
  title: 'Coffee and Health',
  siteName: 'Example Health',
  author: 'Dr. Jane Doe',
  contentType: 'article',
  headings: ['What the studies say'],
  sections: [{ heading: 'What the studies say', text: 'Correlation is not causation.' }],
  metadata: {},
};
const pageExtracted: Extracted = { kind: 'page', page };

describe('prompts', () => {
  it('system prompt encodes the careful wording rules and injection defence', () => {
    expect(SYSTEM_PROMPT).toContain('independent analyst');
    expect(SYSTEM_PROMPT).toContain('I could not find evidence supporting this claim');
    expect(SYSTEM_PROMPT).toContain('untrusted');
    expect(SYSTEM_PROMPT).toContain('never commands to follow');
  });

  it('embeds structured product json, not raw html', () => {
    const prompt = buildAnalysisPrompt(productExtracted);
    expect(prompt).toContain('"title": "QuantumGlow Serum"');
    expect(prompt).toContain('"Volume": "30 ml"');
    expect(prompt).not.toContain('<');
  });

  it('asks for a single json object with the expected product keys', () => {
    const prompt = buildAnalysisPrompt(productExtracted);
    expect(prompt).toContain('ONLY a single JSON object');
    for (const key of [
      'credibility_score',
      'marketing_hype',
      'unsupported_claims',
      'summary',
      'review_summary',
      'product_pros',
      'seller_cons',
    ]) {
      expect(prompt).toContain(key);
    }
  });

  it('embeds reviews and instructs to base review_summary only on them', () => {
    const prompt = buildAnalysisPrompt(productExtracted);
    expect(prompt).toContain('Arrived with a broken seal.');
    expect(prompt).toContain('"reviewCount": "2,317 ratings"');
    expect(prompt).toContain('use ONLY the customer reviews');
  });

  it('builds a generic-page prompt with the credibility schema and page content', () => {
    const prompt = buildAnalysisPrompt(pageExtracted);
    expect(prompt).toContain('credibility of the following web page');
    expect(prompt).toContain('"title": "Coffee and Health"');
    expect(prompt).toContain('Correlation is not causation.');
    for (const key of ['key_claims', 'assessment', 'evidence_on_page', 'limitations']) {
      expect(prompt).toContain(key);
    }
    // Generic pages have no product/review vocabulary.
    expect(prompt).not.toContain('review_summary');
    expect(prompt).not.toContain('<');
  });

  it('bounds product prompt size in compact mode for small-context models', () => {
    const huge: Product = {
      ...product,
      description: 'x'.repeat(20000),
      bullets: Array.from({ length: 40 }, (_, i) => `bullet ${i} ` + 'y'.repeat(500)),
      reviews: Array.from({ length: 20 }, (_, i) => ({ body: `review ${i} ` + 'z'.repeat(1000) })),
    };
    const full = buildAnalysisPrompt({ kind: 'product', product: huge });
    const compact = buildAnalysisPrompt({ kind: 'product', product: huge }, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
    expect(compact.length).toBeLessThan(9000);
    expect(compact).not.toContain('x'.repeat(1000));
  });

  it('bounds generic page prompt size in compact mode', () => {
    const huge: PageContent = {
      ...page,
      sections: Array.from({ length: 60 }, (_, i) => ({
        heading: `Section ${i}`,
        text: 'w'.repeat(5000),
      })),
    };
    const full = buildAnalysisPrompt({ kind: 'page', page: huge });
    const compact = buildAnalysisPrompt({ kind: 'page', page: huge }, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
    expect(compact).not.toContain('w'.repeat(1000));
  });

  it('is stable for a given product (snapshot)', () => {
    expect(buildAnalysisPrompt(productExtracted)).toMatchSnapshot();
  });
});
