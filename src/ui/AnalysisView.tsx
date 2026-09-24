import type {
  Analysis,
  Assessment,
  Claim,
  EvaluatedClaim,
  PageContent,
  Product,
  ReviewSummary,
} from '@/types';
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

const ASSESSMENT_STYLE: Record<Assessment, { bg: string; fg: string; label: string }> = {
  supported: { bg: 'var(--good-bg)', fg: 'var(--good)', label: 'Supported' },
  unsupported: { bg: 'var(--warn-bg)', fg: 'var(--warn)', label: 'Unsupported' },
  contradicted: { bg: 'var(--danger-bg)', fg: 'var(--danger)', label: 'Contradicted' },
  uncertain: { bg: 'var(--warn-bg)', fg: 'var(--warn)', label: 'Uncertain' },
  opinion: { bg: 'var(--bg-subtle)', fg: 'var(--text)', label: 'Opinion' },
};

/** Small pill showing how a claim held up against the page's own evidence. */
function AssessmentBadge({ assessment }: { assessment: Assessment }) {
  const s = ASSESSMENT_STYLE[assessment];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: '999px',
        padding: '1px 8px',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

function EvaluatedClaimList({ claims }: { claims: EvaluatedClaim[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '10px' }}>
      {claims.map((c, i) => (
        <li key={i}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ flex: 1 }}>{c.claim}</span>
            <AssessmentBadge assessment={c.assessment} />
          </div>
          {c.reasoning && (
            <div className="muted" style={{ fontSize: '13px', marginTop: '2px' }}>
              {c.reasoning}
            </div>
          )}
          {c.evidence_on_page && (
            <div
              style={{
                fontSize: '12px',
                marginTop: '4px',
                paddingLeft: '8px',
                borderLeft: '2px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              “{c.evidence_on_page}”
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
export function AnalysisView({
  analysis,
  product,
  page,
}: {
  analysis: Analysis;
  product?: Product;
  page?: PageContent;
}) {
  // Product presentation is the default; only an explicit `page` switches to the
  // generic-content vocabulary and disclaimer.
  const isProduct = !page;
  const byline = page ? [page.siteName, page.author].filter(Boolean).join(' · ') : product?.brand;

  return (
    <div style={{ display: 'grid', gap: 'var(--space)' }}>
      {(product || page) && (
        <div>
          <h2 style={{ fontSize: '15px' }}>{product ? product.title : page?.title}</h2>
          {byline && <div className="muted">{byline}</div>}
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
          {isProduct ? (
            <HypeBadge level={analysis.marketing_hype} />
          ) : (
            analysis.content_type && (
              <span
                className="muted"
                style={{
                  fontSize: '12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {analysis.content_type}
              </span>
            )
          )}
        </div>
        <StarRating score={analysis.credibility_score} />
        {analysis.overall_assessment && <p style={{ margin: 0 }}>{analysis.overall_assessment}</p>}
      </div>

      {analysis.summary && (
        <Section title="Summary" tone="neutral">
          <p style={{ margin: 0 }}>{analysis.summary}</p>
        </Section>
      )}

      {analysis.key_claims.length > 0 && (
        <Section title="Key claims" tone="neutral" count={analysis.key_claims.length}>
          <EvaluatedClaimList claims={analysis.key_claims} />
          <p className="muted" style={{ fontSize: '12px', margin: '10px 0 0' }}>
            Assessed from the page&rsquo;s own content — not an external fact-check.
          </p>
        </Section>
      )}

      {analysis.supported_claims.length > 0 && (
        <Section title="Supported claims" tone="good" count={analysis.supported_claims.length}>
          <EvaluatedClaimList claims={analysis.supported_claims} />
        </Section>
      )}

      {analysis.questionable_claims.length > 0 && (
        <Section
          title="Questionable claims"
          tone="danger"
          count={analysis.questionable_claims.length}
        >
          <EvaluatedClaimList claims={analysis.questionable_claims} />
        </Section>
      )}

      {analysis.evidence_quality.length > 0 && (
        <Section title="Evidence quality" tone="warn" count={analysis.evidence_quality.length}>
          <StringList items={analysis.evidence_quality} />
        </Section>
      )}

      {analysis.source_transparency.length > 0 && (
        <Section
          title="Source & transparency"
          tone="neutral"
          count={analysis.source_transparency.length}
        >
          <StringList items={analysis.source_transparency} />
        </Section>
      )}

      {analysis.persuasive_techniques.length > 0 && (
        <Section
          title="Persuasive techniques"
          tone="warn"
          count={analysis.persuasive_techniques.length}
        >
          <StringList items={analysis.persuasive_techniques} />
        </Section>
      )}

      {analysis.missing_context.length > 0 && (
        <Section title="Missing context" tone="warn" count={analysis.missing_context.length}>
          <StringList items={analysis.missing_context} />
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

      {analysis.limitations.length > 0 && (
        <Section
          title="Could not verify"
          tone="neutral"
          count={analysis.limitations.length}
          defaultOpen={false}
        >
          <StringList items={analysis.limitations} />
          <p className="muted" style={{ fontSize: '12px', margin: '10px 0 0' }}>
            These need independent sources to confirm — the extension checks only the page itself.
          </p>
        </Section>
      )}

      <p className="muted" style={{ fontSize: '12px', margin: 0 }}>
        {isProduct
          ? 'This is an automated analysis of the listing’s wording, not a verdict on the product. Unsupported means evidence was not found in the listing — not that a claim is false.'
          : 'This is an automated assessment of the page’s own content, not an external fact-check. Unsupported means evidence was not found on the page — not that a claim is false.'}
      </p>
    </div>
  );
}
