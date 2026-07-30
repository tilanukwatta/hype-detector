import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisSchema, type Analysis } from '@/types';
import { AnalysisView } from './AnalysisView';
import { StarRating, credibilityLabel } from './StarRating';

function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return AnalysisSchema.parse({
    overall_assessment: 'Mixed support for the listing claims.',
    credibility_score: 72,
    marketing_hype: 'Medium',
    unsupported_claims: [{ claim: 'Reduces wrinkles by 300%', reasoning: 'No study cited.' }],
    scientific_claims: [],
    missing_evidence: ['Clinical trial data'],
    good_signs: ['Lists exact volume'],
    summary: 'A marketing-heavy listing.',
    ...overrides,
  });
}

describe('StarRating', () => {
  it('maps scores to the spec credibility labels', () => {
    expect(credibilityLabel(95)).toBe('Strongly supported');
    expect(credibilityLabel(72)).toBe('Mostly supported');
    expect(credibilityLabel(50)).toBe('Mixed evidence');
    expect(credibilityLabel(10)).toBe('Highly questionable');
  });

  it('exposes an accessible label', () => {
    render(<StarRating score={72} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/4 out of 5 stars/i);
  });
});

describe('AnalysisView', () => {
  it('renders each populated section', () => {
    render(<AnalysisView analysis={analysis()} />);
    expect(screen.getByText('Overall credibility')).toBeInTheDocument();
    expect(screen.getByText('Good signs')).toBeInTheDocument();
    expect(screen.getByText('Unsupported claims')).toBeInTheDocument();
    expect(screen.getByText('Missing evidence')).toBeInTheDocument();
    expect(screen.getByText('Reduces wrinkles by 300%')).toBeInTheDocument();
  });

  it('omits empty sections', () => {
    render(<AnalysisView analysis={analysis({ good_signs: [], scientific_claims: [] })} />);
    expect(screen.queryByText('Good signs')).not.toBeInTheDocument();
    expect(screen.queryByText('Scientific claims')).not.toBeInTheDocument();
  });

  it('renders the careful "not a verdict" disclaimer', () => {
    render(<AnalysisView analysis={analysis()} />);
    expect(screen.getByText(/not a verdict on the product/i)).toBeInTheDocument();
    // Never asserts a product is fake.
    expect(screen.queryByText(/fake/i)).not.toBeInTheDocument();
  });

  it('renders the review summary section when reviews are present', () => {
    render(
      <AnalysisView
        analysis={analysis({
          review_summary: {
            summary: 'Reviewers like the glow but report shipping issues.',
            product_pros: ['Brightens skin'],
            product_cons: ['Messy dropper'],
            seller_pros: [],
            seller_cons: ['Arrived leaking'],
          },
        })}
      />
    );
    expect(screen.getByText('What reviewers say')).toBeInTheDocument();
    expect(screen.getByText('Brightens skin')).toBeInTheDocument();
    expect(screen.getByText('Arrived leaking')).toBeInTheDocument();
    expect(screen.getByText(/only on the customer reviews/i)).toBeInTheDocument();
  });

  it('omits the review section when there are no reviews', () => {
    render(<AnalysisView analysis={analysis()} />);
    expect(screen.queryByText('What reviewers say')).not.toBeInTheDocument();
  });
});
