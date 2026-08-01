import { describe, it, expect } from 'vitest';
import type { Product } from '@/types';
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

describe('prompts', () => {
  it('system prompt encodes the careful wording rules', () => {
    expect(SYSTEM_PROMPT).toContain('independent consumer advocate');
    expect(SYSTEM_PROMPT).toContain('could not find evidence');
    expect(SYSTEM_PROMPT).toContain('unsupported, disproven, and uncertain');
  });

  it('embeds structured product json, not raw html', () => {
    const prompt = buildAnalysisPrompt(product);
    expect(prompt).toContain('"title": "QuantumGlow Serum"');
    expect(prompt).toContain('"Volume": "30 ml"');
    expect(prompt).not.toContain('<');
  });

  it('asks for a single json object with the expected keys', () => {
    const prompt = buildAnalysisPrompt(product);
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
    const prompt = buildAnalysisPrompt(product);
    expect(prompt).toContain('Arrived with a broken seal.');
    expect(prompt).toContain('"reviewCount": "2,317 ratings"');
    expect(prompt).toContain('use ONLY the customer reviews');
  });

  it('bounds prompt size in compact mode for small-context models', () => {
    const huge: Product = {
      ...product,
      description: 'x'.repeat(20000),
      bullets: Array.from({ length: 40 }, (_, i) => `bullet ${i} ` + 'y'.repeat(500)),
      reviews: Array.from({ length: 20 }, (_, i) => ({ body: `review ${i} ` + 'z'.repeat(1000) })),
    };
    const full = buildAnalysisPrompt(huge);
    const compact = buildAnalysisPrompt(huge, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
    // Compact stays small enough to fit a ~4096-token window with room for output.
    expect(compact.length).toBeLessThan(9000);
    // Description is truncated, not sent whole.
    expect(compact).not.toContain('x'.repeat(1000));
  });

  it('is stable for a given product (snapshot)', () => {
    expect(buildAnalysisPrompt(product)).toMatchSnapshot();
  });
});
