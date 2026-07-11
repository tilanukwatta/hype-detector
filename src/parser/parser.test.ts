import { describe, it, expect } from 'vitest';
import { parseAnalysis, extractJsonBlock, scoreToStars } from './index';

const validPayload = {
  overall_assessment: 'Several claims lack supporting evidence.',
  credibility_score: 62,
  marketing_hype: 'High',
  unsupported_claims: [{ claim: 'Reduces wrinkles by 300%', reasoning: 'No study cited.' }],
  scientific_claims: [{ claim: 'Boosts collagen instantly', reasoning: 'Not measurable.' }],
  missing_evidence: ['Clinical trial data'],
  good_signs: ['Lists exact volume'],
  summary: 'Marketing-heavy listing with a few concrete specs.',
};

describe('extractJsonBlock', () => {
  it('extracts a bare object', () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });

  it('strips code fences', () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('ignores prose around the object', () => {
    expect(extractJsonBlock('Here you go:\n{"a":1}\nHope that helps!')).toBe('{"a":1}');
  });

  it('ignores braces inside strings', () => {
    const s = '{"note":"use {curly} braces"}';
    expect(extractJsonBlock(s)).toBe(s);
  });

  it('returns null for truncated json', () => {
    expect(extractJsonBlock('{"a": 1, "b": ')).toBeNull();
  });

  it('returns null when no object present', () => {
    expect(extractJsonBlock('no json here')).toBeNull();
  });
});

describe('parseAnalysis', () => {
  it('parses clean json', () => {
    const result = parseAnalysis(JSON.stringify(validPayload));
    expect(result.ok).toBe(true);
    expect(result.analysis.credibility_score).toBe(62);
    expect(result.analysis.unsupported_claims).toHaveLength(1);
  });

  it('parses fenced json with prose', () => {
    const raw = `Sure!\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``;
    const result = parseAnalysis(raw);
    expect(result.ok).toBe(true);
  });

  it('fails gracefully on malformed json', () => {
    const result = parseAnalysis('{ this is not: json ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/json/i);
    // Still returns a defaulted analysis object.
    expect(result.analysis.credibility_score).toBe(50);
  });

  it('fails gracefully when no json present', () => {
    const result = parseAnalysis('I cannot help with that.');
    expect(result.ok).toBe(false);
  });

  it('coerces string score and loose hype level', () => {
    const result = parseAnalysis(
      JSON.stringify({ ...validPayload, credibility_score: '80', marketing_hype: 'high' })
    );
    expect(result.ok).toBe(true);
    expect(result.analysis.credibility_score).toBe(80);
    expect(result.analysis.marketing_hype).toBe('High');
  });

  it('coerces string claims into objects', () => {
    const result = parseAnalysis(
      JSON.stringify({ ...validPayload, unsupported_claims: ['bare string claim'] })
    );
    expect(result.ok).toBe(true);
    expect(result.analysis.unsupported_claims[0]).toEqual({
      claim: 'bare string claim',
      reasoning: '',
    });
  });

  it('recovers valid fields when one field is the wrong type', () => {
    const result = parseAnalysis(
      JSON.stringify({ ...validPayload, missing_evidence: 'should be an array' })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Valid fields survive; the bad one falls back to its default.
    expect(result.analysis.summary).toBe(validPayload.summary);
    expect(result.analysis.missing_evidence).toEqual([]);
  });

  it('fills defaults for missing optional fields', () => {
    const result = parseAnalysis(JSON.stringify({ summary: 'only a summary' }));
    expect(result.ok).toBe(true);
    expect(result.analysis.summary).toBe('only a summary');
    expect(result.analysis.good_signs).toEqual([]);
    expect(result.analysis.marketing_hype).toBe('Medium');
  });
});

describe('scoreToStars', () => {
  it.each([
    [0, 1],
    [10, 1],
    [30, 2],
    [50, 3],
    [72, 4],
    [95, 5],
    [100, 5],
  ])('maps %i -> %i stars', (score, stars) => {
    expect(scoreToStars(score)).toBe(stars);
  });
});
