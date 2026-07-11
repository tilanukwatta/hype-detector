# Hype Detector

**Version:** 0.1 (MVP)  
**Status:** Open Source Specification

---

# Overview

**Hype Detector** is an open-source browser extension that helps consumers critically evaluate online product listings using Large Language Models (LLMs).

Instead of recommending whether to buy a product, the extension analyzes the **claims made by the seller**, identifies unsupported or exaggerated marketing language, and provides an evidence-oriented explanation.

The extension **does not use a hosted backend**.

Users provide their own API keys (OpenAI, Anthropic, Gemini, OpenRouter, Ollama, etc.), ensuring:

- No subscription required
- Minimal infrastructure costs
- Full transparency
- User control over privacy
- Easy community contributions

The project is intended to become a trusted open-source tool for improving consumer literacy and encouraging evidence-based purchasing decisions.

---

# Philosophy

The extension should never attempt to convince users to buy or avoid products.

Its goal is to answer one question:

> **"How trustworthy are the claims made in this product listing?"**

The extension should:

- Explain reasoning
- Identify marketing language
- Highlight missing evidence
- Distinguish facts from opinions
- Avoid hallucinations
- Acknowledge uncertainty

**Tagline:** _Separate evidence from marketing._

---

# License

Apache 2.0 (preferred)

or

MIT License

The project should remain fully open source.

---

# Primary Goals

- Analyze product descriptions
- Identify measurable claims
- Identify vague marketing language
- Detect unsupported scientific claims
- Produce balanced summaries
- Work on multiple shopping websites
- Support multiple LLM providers
- Never require a backend

---

# Non Goals

The extension is NOT intended to:

- Automatically recommend purchases
- Replace expert reviews
- Rank products
- Detect fake reviews (future feature)
- Track users
- Collect analytics
- Store browsing history

---

# Supported Browsers

Initial MVP

- Chrome
- Edge
- Brave

Future

- Firefox
- Safari

Use WebExtensions where possible.

Manifest V3.

---

# Supported Websites (MVP)

- Amazon

Future

- Walmart
- Costco
- Best Buy
- Home Depot
- Target
- eBay

Architecture should make new site adapters easy.

---

# High Level Architecture

Browser Extension

- Content Script
- Product Extractor
- Prompt Builder
- LLM Provider
- Response Parser
- UI

No backend server.

No database.

No telemetry.

---

# Folder Structure

```text
src/
    background/
    content/
    popup/
    options/
    providers/
        openai.ts
        anthropic.ts
        gemini.ts
        openrouter.ts
        ollama.ts
    extraction/
        amazon.ts
        walmart.ts
    prompts/
    parser/
    ui/
    utils/
```

---

# Product Extraction

For Amazon MVP extract:

- Title
- Brand
- Price
- Bullet list
- Product description
- Specifications
- "About this item"

Do NOT scrape reviews in MVP.

Reviews dramatically increase token usage.

---

# Structured Product Object

```json
{
  "website": "Amazon",
  "title": "...",
  "brand": "...",
  "price": "...",
  "category": "...",
  "description": "...",
  "bullets": [],
  "specifications": {}
}
```

Never send raw HTML.

---

# LLM Providers

Provider abstraction:

```text
analyzeProduct(product, settings)
```

Support:

- OpenAI
- Anthropic
- Gemini
- OpenRouter
- Ollama

Future providers should be easy to add.

---

# User Settings

- Provider
- API Key
- Model
- Temperature
- Max Tokens
- Theme
- Dark Mode

---

# Default Prompt

You are an independent consumer advocate.

Your job is NOT to recommend buying or avoiding products.

Instead:

- Identify factual statements.
- Identify measurable claims.
- Identify scientific claims.
- Identify marketing language.
- Explain missing evidence.
- Explain uncertainty.
- Do not invent facts.
- If evidence is unavailable, explicitly say so.

Be skeptical without being cynical.

Always explain your reasoning.

---

# Expected Response Format

```json
{
  "overall_assessment": "...",
  "credibility_score": 72,
  "marketing_hype": "Medium",
  "unsupported_claims": [],
  "scientific_claims": [],
  "missing_evidence": [],
  "good_signs": [],
  "summary": "..."
}
```

Parser should gracefully handle malformed JSON.

---

# UI

Clicking the extension opens a side panel.

Display:

- Overall Credibility
- Summary
- Good Signs
- Warnings
- Marketing Language
- Unsupported Claims
- Missing Evidence

Collapsible sections preferred.

---

# Credibility Scale

★★★★★ Strongly supported

★★★★☆ Mostly supported

★★★☆☆ Mixed evidence

★★☆☆☆ Weak evidence

★☆☆☆☆ Highly questionable

---

# Important Design Principles

Never say:

> "This product is fake."

Instead say:

> "I could not find evidence supporting this claim."

Always distinguish between:

- Unsupported
- Disproven
- Uncertain

Never overstate certainty.

---

# Privacy

- No analytics
- No tracking
- No telemetry
- No cookies
- No remote logging

API keys remain on the user's device using browser secure storage.

---

# Performance

- Analyze only when the user clicks **Analyze**
- Never automatically analyze every page
- Cache results locally
- Re-analyze only if page content changes

---

# Accessibility

- Keyboard accessible
- Screen reader friendly
- High contrast support

---

# Future Features

- Review analysis
- Price history
- Scientific paper lookup
- FDA recall lookup
- Product recall databases
- Regulatory databases
- Fake review detection
- Nutrition analysis
- Supplement claim verification
- Medical claim verification
- Side-by-side product comparison
- PDF export
- Share analysis
- Community prompts
- Prompt marketplace
- Local LLM optimization

---

# Contribution Guidelines

- Keep provider-specific code isolated
- Keep extraction logic isolated
- Do not hardcode site selectors inside business logic
- Every feature should include tests
- Prefer readable code over clever code
- Minimize dependencies

---

# Testing

- Unit tests
- Extraction
- Parser
- Provider interface
- Prompt generation
- UI rendering

Mock LLM responses.

---

# Tech Stack

- TypeScript
- React
- Vite
- Manifest V3
- WebExtensions API
- ESLint
- Prettier
- Vitest
- GitHub Actions

---

# MVP Success Criteria

A user should be able to:

1. Install the extension.
2. Enter an API key.
3. Visit an Amazon product.
4. Click **Analyze**.
5. Receive a balanced explanation of the claims.
6. Understand why the extension reached its conclusions.

No backend should ever be required.

---

# Vision

**Hype Detector** aims to become the open, transparent, community-driven standard for helping people distinguish evidence from marketing hype.

It empowers users to think critically about product claims while respecting privacy, avoiding commercial bias, and remaining completely open source.
