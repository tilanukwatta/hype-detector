import type { Analysis, Claim, Product } from '@/types';
import { StarRating } from './StarRating';
import { Section, HypeBadge } from './Section';

function ClaimList({ claims }: { claims: Claim[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
      {claims.map((c, i) => (
        <li key={i}>
          <div>{c.claim}</div>
          {c.reasoning && (
            <div className="muted" style={{ fontSize: '13px' }}>
              {c.reasoning}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function StringList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px' }}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The full, collapsible presentation of an {@link Analysis}. Shared by the side
 * panel and covered directly by unit tests. Empty sections are omitted rather
 * than shown as "0 items", keeping the panel focused on what the model found.
 */
export function AnalysisView({ analysis, product }: { analysis: Analysis; product?: Product }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space)' }}>
      {product && (
        <div>
          <h2 style={{ fontSize: '15px' }}>{product.title}</h2>
          {product.brand && <div className="muted">{product.brand}</div>}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <strong>Overall credibility</strong>
          <HypeBadge level={analysis.marketing_hype} />
        </div>
        <StarRating score={analysis.credibility_score} />
        {analysis.overall_assessment && <p style={{ margin: 0 }}>{analysis.overall_assessment}</p>}
      </div>

      {analysis.summary && (
        <Section title="Summary" tone="neutral">
          <p style={{ margin: 0 }}>{analysis.summary}</p>
        </Section>
      )}

      {analysis.good_signs.length > 0 && (
        <Section title="Good signs" tone="good" count={analysis.good_signs.length}>
          <StringList items={analysis.good_signs} />
        </Section>
      )}

      {analysis.unsupported_claims.length > 0 && (
        <Section
          title="Unsupported claims"
          tone="danger"
          count={analysis.unsupported_claims.length}
        >
          <ClaimList claims={analysis.unsupported_claims} />
        </Section>
      )}

      {analysis.scientific_claims.length > 0 && (
        <Section title="Scientific claims" tone="warn" count={analysis.scientific_claims.length}>
          <ClaimList claims={analysis.scientific_claims} />
        </Section>
      )}

      {analysis.missing_evidence.length > 0 && (
        <Section title="Missing evidence" tone="warn" count={analysis.missing_evidence.length}>
          <StringList items={analysis.missing_evidence} />
        </Section>
      )}

      <p className="muted" style={{ fontSize: '12px', margin: 0 }}>
        This is an automated analysis of the listing&rsquo;s wording, not a verdict on the product.
        Unsupported means evidence was not found in the listing — not that a claim is false.
      </p>
    </div>
  );
}
