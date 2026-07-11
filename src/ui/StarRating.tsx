import { scoreToStars } from '@/parser';

const LABELS: Record<number, string> = {
  5: 'Strongly supported',
  4: 'Mostly supported',
  3: 'Mixed evidence',
  2: 'Weak evidence',
  1: 'Highly questionable',
};

export function credibilityLabel(score: number): string {
  return LABELS[scoreToStars(score)];
}

/**
 * Renders the 1–5 star credibility scale. The score is exposed to assistive
 * technology via an accessible label rather than relying on the star glyphs.
 */
export function StarRating({ score }: { score: number }) {
  const stars = scoreToStars(score);
  const label = credibilityLabel(score);
  return (
    <div
      className="star-rating"
      role="img"
      aria-label={`Credibility ${stars} out of 5 stars: ${label}`}
    >
      <span
        aria-hidden="true"
        style={{ color: 'var(--star)', fontSize: '20px', letterSpacing: '2px' }}
      >
        {'★'.repeat(stars)}
        <span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - stars)}</span>
      </span>
      <span className="muted" style={{ fontSize: '13px' }}>
        {label} · {score}/100
      </span>
    </div>
  );
}
