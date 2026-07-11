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
    for (const key of ['credibility_score', 'marketing_hype', 'unsupported_claims', 'summary']) {
      expect(prompt).toContain(key);
    }
  });

  it('is stable for a given product (snapshot)', () => {
    expect(buildAnalysisPrompt(product)).toMatchSnapshot();
  });
});
