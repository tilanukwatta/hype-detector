# Privacy Policy — Hype Detector

**Effective date:** 11 July 2026

Hype Detector is an open-source browser extension that analyzes the claims in a
product listing using a Large Language Model (LLM) that **you** configure with your own
API key. This policy explains exactly what the extension does and does not do with your
data.

**Short version:** Hype Detector has no servers. We do not collect, transmit, store, or
sell any of your data. Everything runs locally in your browser, except for the analysis
request you explicitly trigger, which goes directly from your browser to the LLM provider
you chose.

## We operate no backend

There is no Hype Detector server, database, or account system. The developers of Hype
Detector never receive your API key, your browsing activity, the pages you analyze, or
the results. There is nothing for us to collect because no data is ever sent to us.

## Data stored on your device

The extension stores the following using your browser's local extension storage
(`chrome.storage.local`). It never leaves your device except as described below:

- **Your settings**: chosen provider, model, and preferences (theme, etc.).
- **Your API key**: stored locally so you don't have to re-enter it. It is sent only to
  the provider you selected, when you run an analysis.
- **Cached analyses**: recent results, kept so re-opening a product doesn't re-run (and
  re-bill) an identical analysis. You can clear these any time from the Options page.

## Data sent to your chosen LLM provider

Analysis only happens when you click **Analyze**. It is never automatic. When you do:

- The extension extracts a **structured summary** of the current product listing (title,
  brand, price, bullet points, description, and specifications). It does **not** send raw
  page HTML, and it does **not** scrape or send customer reviews.
- That structured product data, together with your API key, is sent **directly from your
  browser to the API endpoint of the provider you configured** (for example OpenAI,
  Anthropic, Google, OpenRouter, or a local Ollama server).

Your use of a third-party provider is governed by **that provider's** privacy policy and
terms. Please review the policy of whichever provider you choose. If you use a local
provider such as Ollama, the data does not leave your machine at all.

## What we do not do

- No analytics, telemetry, or usage tracking.
- No advertising or advertising identifiers.
- No cookies.
- No remote logging or error reporting.
- No selling, sharing, or transfer of data to us or any third party (other than the LLM
  request you initiate, described above).
- No collection of browsing history.

## Permissions and why they are needed

- **storage** — save your settings, API key, and cached results locally.
- **activeTab** / **scripting** — read the product details from the page you are viewing,
  only when you ask for an analysis.
- **sidePanel** — display results in the browser side panel.
- **Host permissions** for provider API endpoints (and `localhost` for Ollama) — allow
  the browser to send your analysis request to the provider you selected. These hosts are
  only contacted when you run an analysis.

## Children

Hype Detector is not directed to children and does not knowingly process data from
children.

## Changes to this policy

If this policy changes, the updated version will be published in the project's public
repository with a new effective date.

## Contact

Questions about privacy? Open an issue at
<https://github.com/tilanukwatta/hype-detector/issues> or email
**tilan.ukwatta@gmail.com**.
