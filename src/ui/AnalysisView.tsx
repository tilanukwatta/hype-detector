import type { Analysis, Claim, Product, ReviewSummary } from '@/types';
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

/** Pros/cons pair for one subject (product or seller); renders nothing if empty. */
function ProsCons({ label, pros, cons }: { label: string; pros: string[]; cons: string[] }) {
  if (pros.length === 0 && cons.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <strong>{label}</strong>
      {pros.length > 0 && (
        <div>
          <div style={{ color: 'var(--good)', fontSize: '13px' }}>Pros</div>
          <StringList items={pros} />
        </div>
      )}
      {cons.length > 0 && (
        <div>
          <div style={{ color: 'var(--danger)', fontSize: '13px' }}>Cons</div>
          <StringList items={cons} />
        </div>
      )}
    </div>
  );
}

function hasReviewContent(rs: ReviewSummary): boolean {
  return Boolean(
    rs.summary ||
    rs.product_pros.length ||
    rs.product_cons.length ||
    rs.seller_pros.length ||
    rs.seller_cons.length
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

      {product &&
        !hasReviewContent(analysis.review_summary) &&
        product.reviews.length === 0 &&
        product.reviewCount && (
          <div className="card" role="status" style={{ fontSize: '13px' }}>
            <strong>Reviews not read</strong>
            <p style={{ margin: '6px 0 0' }}>
              This page reports reviews ({product.reviewCount}), but none could be read from the
              page. Scroll down to the &ldquo;Customer reviews&rdquo; section so they load, then
              click <strong>Re-analyze</strong>.
            </p>
          </div>
        )}

      {product && !hasReviewContent(analysis.review_summary) && product.reviews.length > 0 && (
        <div className="muted" style={{ fontSize: '12px' }}>
          Read {product.reviews.length} review(s) from the page, but no review summary was returned.
        </div>
      )}

      {hasReviewContent(analysis.review_summary) && (
        <Section title="What reviewers say" tone="neutral">
          <div style={{ display: 'grid', gap: 'var(--space)' }}>
            {analysis.review_summary.summary && (
              <p style={{ margin: 0 }}>{analysis.review_summary.summary}</p>
            )}
            <ProsCons
              label="Product"
              pros={analysis.review_summary.product_pros}
              cons={analysis.review_summary.product_cons}
            />
            <ProsCons
              label="Seller"
              pros={analysis.review_summary.seller_pros}
              cons={analysis.review_summary.seller_cons}
            />
            <p className="muted" style={{ fontSize: '12px', margin: 0 }}>
              Based only on the customer reviews visible on this page.
            </p>
          </div>
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
