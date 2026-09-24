import type { PageContent, PageSection } from '@/types';
import { PageContentSchema } from '@/types';

/**
 * Generic webpage extractor. Turns an arbitrary HTML document into bounded,
 * noise-stripped {@link PageContent} suitable for credibility analysis. Runs
 * fully in the page (or in jsdom for tests): pure, DOM-driven, no network.
 *
 * Extraction priority mirrors well-known readability heuristics:
 *   1. Structured metadata (JSON-LD, OpenGraph, <meta>, <title>).
 *   2. A semantic main region (<main>, <article>, [role="main"]).
 *   3. A density-scored container fallback when no semantic region exists.
 *
 * Everything the user did not come to read — navigation, footers, sidebars,
 * cookie/consent banners, forms, scripts, hidden nodes — is removed before any
 * text is collected. We never emit raw HTML and never read form/user input.
 */

/** Below this many characters of readable text we treat the page as "thin". */
const MIN_CONTENT_CHARS = 200;

/** Bounds so a huge page cannot produce an unbounded PageContent object. */
const MAX_HEADINGS = 60;
const MAX_SECTIONS = 80;
const MAX_HEADING_CHARS = 300;
/** Per-section and whole-page text caps. The prompt layer trims further to fit
 * a model's token budget; these keep the extracted object itself bounded. */
const MAX_SECTION_CHARS = 6000;
const MAX_TOTAL_CHARS = 24000;

/** Elements that are never content, removed wholesale before text collection. */
const NOISE_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'footer',
  'aside',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'svg',
  'iframe',
  'dialog',
];

/** ARIA landmark roles that mark non-article regions. */
const NOISE_ROLES = [
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'form',
  'dialog',
  'alertdialog',
];

/** class/id substrings that strongly signal chrome rather than content. */
const NOISE_PATTERN =
  /(^|[-_\s])(nav|navbar|menu|footer|sidebar|side-bar|site-header|siteheader|cookie|consent|gdpr|banner|promo|advert|advertisement|newsletter|subscribe|social|share|breadcrumb|pagination|comment|comments|related|recommended|popup|modal|masthead|skip-link)([-_\s]|$)/i;

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** First non-empty, trimmed value — treats '' the same as undefined. */
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    const t = clean(v ?? '');
    if (t) return t;
  }
  return undefined;
}

/** Blocks whose text we collect, in document order. Headings delimit sections. */
const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, dd, figcaption';
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** True if an element is hidden via attribute or inline style (jsdom-safe). */
function isHidden(el: Element): boolean {
  if (el.hasAttribute('hidden')) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.getAttribute('style') ?? '';
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

/** True if an element's role/class/id marks it as page chrome, not content. */
function isNoiseByAttr(el: Element): boolean {
  const role = el.getAttribute('role');
  if (role && NOISE_ROLES.includes(role)) return true;
  const idClass = `${el.id} ${el.className}`;
  return NOISE_PATTERN.test(idClass);
}

/** True if the element is an editable region (user-entered text, never content). */
function isEditable(el: Element): boolean {
  const ce = el.getAttribute('contenteditable');
  return ce !== null && ce !== 'false';
}

/** Remove all non-content nodes from a detached clone, in place. */
function stripNoise(root: Element): void {
  root.querySelectorAll(NOISE_TAGS.join(',')).forEach((el) => el.remove());
  // Attribute/role/hidden heuristics need a live-list-safe second pass.
  root.querySelectorAll('*').forEach((el) => {
    // The static NodeList still lists descendants of already-removed nodes; skip
    // them. `contains` works on a detached tree, unlike `isConnected`.
    if (!root.contains(el)) return;
    if (isHidden(el) || isNoiseByAttr(el) || isEditable(el)) el.remove();
  });
}

/** Total length of paragraph text under an element — a crude content score. */
function densityScore(el: Element): number {
  let total = 0;
  el.querySelectorAll('p').forEach((p) => {
    total += clean(p.textContent ?? '').length;
  });
  return total;
}

/** Fraction of the body's paragraph text a container must hold to be the root. */
const ROOT_TEXT_SHARE = 0.6;

/**
 * Choose the element most likely to hold the main content of an already-cleaned
 * body: a semantic region if present, else the *tightest* container that still
 * holds most of the paragraph text. Cumulative density alone always favours
 * `<body>` (it contains every candidate), so we instead pick the smallest
 * subtree above the share threshold — that trims peripheral blocks without
 * dropping the article.
 */
function pickRoot(body: Element): Element {
  const semantic = body.querySelector('main, article, [role="main"]');
  if (semantic && densityScore(semantic) > 0) return semantic;

  const bodyText = densityScore(body);
  if (bodyText === 0) return body;

  let best = body;
  let bestSize = body.querySelectorAll('*').length;
  body.querySelectorAll('div, section, article, main').forEach((el) => {
    if (densityScore(el) < bodyText * ROOT_TEXT_SHARE) return;
    const size = el.querySelectorAll('*').length;
    if (size < bestSize) {
      best = el;
      bestSize = size;
    }
  });
  return best;
}

/** Collect visible heading text in document order (bounded). */
function collectHeadings(root: Element): string[] {
  const out: string[] = [];
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const t = clean(h.textContent ?? '');
    if (t) out.push(t.slice(0, MAX_HEADING_CHARS));
  });
  return out.slice(0, MAX_HEADINGS);
}

/**
 * Split the root's readable blocks into sections delimited by headings. Content
 * before the first heading becomes an untitled lead section. Nested blocks are
 * de-duplicated by skipping a block whose text is already contained in the
 * section being built.
 */
function collectSections(root: Element): PageSection[] {
  const sections: PageSection[] = [];
  let current: PageSection = { text: '' };
  let total = 0;
  const push = () => {
    current.text = clean(current.text);
    if (current.heading || current.text) sections.push(current);
  };

  for (const el of Array.from(root.querySelectorAll(BLOCK_SELECTOR))) {
    if (total >= MAX_TOTAL_CHARS) break;
    const t = clean(el.textContent ?? '');
    if (!t) continue;
    if (HEADING_TAGS.has(el.tagName)) {
      push();
      current = { heading: t.slice(0, MAX_HEADING_CHARS), text: '' };
    } else {
      // Skip blocks fully nested in an already-captured block (e.g. <li><p>).
      if (current.text.includes(t)) continue;
      const room = Math.min(MAX_SECTION_CHARS - current.text.length, MAX_TOTAL_CHARS - total);
      if (room <= 0) continue;
      const piece = t.length > room ? t.slice(0, room) : t;
      current.text = current.text ? `${current.text} ${piece}` : piece;
      total += piece.length;
    }
  }
  push();
  return sections.slice(0, MAX_SECTIONS);
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

function metaContent(doc: Document, selectors: readonly string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const v = clean(el?.getAttribute('content') ?? '');
    if (v) return v;
  }
  return undefined;
}

interface JsonLd {
  type?: string;
  author?: string;
  datePublished?: string;
  headline?: string;
}

/** @type values that describe the page itself (vs. breadcrumbs/org/site chrome). */
const RELEVANT_LD_TYPE = /(article|posting|product|recipe|review|webpage)/i;

/** Pull the fields we care about out of a single JSON-LD node. */
function nodeInfo(node: Record<string, unknown>): JsonLd {
  const type = Array.isArray(node['@type'])
    ? String(node['@type'][0] ?? '')
    : typeof node['@type'] === 'string'
      ? node['@type']
      : undefined;
  return {
    type,
    author: readAuthor(node.author),
    datePublished: typeof node.datePublished === 'string' ? node.datePublished : undefined,
    headline: typeof node.headline === 'string' ? node.headline : undefined,
  };
}

/**
 * Best-effort parse of JSON-LD. Prefers a node whose @type describes the page
 * (Article/Product/…) over incidental blocks like BreadcrumbList, Organization,
 * or WebSite that pages commonly emit first. Never throws.
 */
function readJsonLd(doc: Document): JsonLd {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  let fallback: JsonLd | undefined;
  for (const script of scripts) {
    try {
      const parsed: unknown = JSON.parse(script.textContent ?? '');
      const nodes = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed['@graph'])
          ? (parsed['@graph'] as unknown[])
          : [parsed];
      for (const node of nodes) {
        if (!isRecord(node)) continue;
        const info = nodeInfo(node);
        if (!info.type && !info.author && !info.datePublished && !info.headline) continue;
        // A page-describing type wins outright; otherwise keep the first
        // informative node as a fallback and keep scanning for a better one.
        if (info.type && RELEVANT_LD_TYPE.test(info.type)) return info;
        fallback ??= info;
      }
    } catch {
      // Malformed JSON-LD — ignore and try the next block.
    }
  }
  return fallback ?? {};
}

function readAuthor(author: unknown): string | undefined {
  if (typeof author === 'string') return clean(author) || undefined;
  if (Array.isArray(author)) return readAuthor(author[0]);
  if (isRecord(author) && typeof author.name === 'string') return clean(author.name) || undefined;
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Map an og:type / JSON-LD @type to our coarse contentType buckets. */
function classify(ogType: string | undefined, ldType: string | undefined): string {
  const t = `${ogType ?? ''} ${ldType ?? ''}`.toLowerCase();
  if (/product|offer/.test(t)) return 'product';
  if (/newsarticle|news/.test(t)) return 'article';
  if (/blogposting|blog/.test(t)) return 'blog';
  if (/article/.test(t)) return 'article';
  if (/website|webpage/.test(t)) return 'other';
  return 'other';
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Extract generic {@link PageContent} from a document, or null when the page has
 * too little readable content to analyse (login walls, app shells, etc.).
 */
export function extractGenericPage(doc: Document, url: URL): PageContent | null {
  const body = doc.body;
  if (!body) return null;

  const cleaned = body.cloneNode(true) as HTMLElement;
  stripNoise(cleaned);

  const root = pickRoot(cleaned);
  const sections = collectSections(root);
  const readable = sections
    .map((s) => s.text)
    .join(' ')
    .trim();
  if (readable.length < MIN_CONTENT_CHARS) return null;

  const ld = readJsonLd(doc);
  const ogType = metaContent(doc, ['meta[property="og:type"]']);
  const description = metaContent(doc, [
    'meta[name="description"]',
    'meta[property="og:description"]',
  ]);
  const lang = clean(doc.documentElement?.getAttribute('lang') ?? '');

  const title =
    firstNonEmpty(
      metaContent(doc, ['meta[property="og:title"]']),
      ld.headline,
      doc.querySelector('h1')?.textContent ?? undefined,
      doc.title
    ) ?? url.hostname;

  const metadata: Record<string, string> = {};
  if (description) metadata.description = description;
  if (lang) metadata.lang = lang;
  if (ogType) metadata['og:type'] = ogType;
  if (ld.type) metadata['schema:type'] = ld.type;

  const parsed = PageContentSchema.safeParse({
    url: url.href,
    title,
    siteName: metaContent(doc, ['meta[property="og:site_name"]']),
    author: firstNonEmpty(
      metaContent(doc, ['meta[name="author"]', 'meta[property="article:author"]']),
      ld.author
    ),
    publishedAt: firstNonEmpty(
      metaContent(doc, ['meta[property="article:published_time"]', 'meta[name="date"]']),
      doc.querySelector('time[datetime]')?.getAttribute('datetime') ?? undefined,
      ld.datePublished
    ),
    contentType: classify(ogType, ld.type),
    headings: collectHeadings(root),
    sections,
    metadata,
  });

  return parsed.success ? parsed.data : null;
}
