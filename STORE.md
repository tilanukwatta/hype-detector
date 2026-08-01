# Chrome Web Store submission — copy & answers

Everything to paste into the Developer Dashboard for **Hype Detector**. Fields map to the
console's "Store listing" and "Privacy practices" tabs.

---

## Which build to upload

Upload the **store build**, which excludes the experimental WebLLM provider so the package
contains **no remotely hosted code** (a Manifest V3 requirement):

```bash
npm run zip:store   # → web-ext-artifacts/hype-detector-vX.Y.Z-store.zip
```

The full build (with WebLLM) is distributed only via the GitHub Release / unpacked install —
do **not** upload it to the store, or the "remote code" answer becomes "Yes" and review is
likely to reject it.

---

## Store listing tab

**Item name:** Hype Detector

**Summary** (short description, ≤132 chars):

> Separate evidence from marketing: analyze the claims in a product listing with your own LLM key or a local model.

**Category:** Shopping (alternative: Productivity)

**Language:** English (United States)

**Detailed description:**

```
Hype Detector helps you think critically about online product listings. Instead of telling
you what to buy, it analyzes the claims the seller makes — flagging vague marketing language,
unsupported or scientific claims, and missing evidence — and explains its reasoning so you
can decide for yourself.

Its goal is to answer one question: how trustworthy are the claims in this listing?

• Bring your own LLM — OpenAI, Anthropic, Google Gemini, or OpenRouter with your own API key,
  a local Ollama server, or a fully in-browser model (WebLLM/WebGPU, experimental).
• Private by design — no accounts, no analytics, no tracking, no telemetry. Your API key is
  stored only on your device, and your data goes directly to the provider you choose (or, for
  local models, never leaves your device).
• Balanced, evidence-oriented — it distinguishes facts from marketing, highlights missing
  evidence, summarizes what reviewers say (pros and cons of the product and seller), and never
  claims a product is "fake" — only whether evidence is present.

How to use:
1. Open the Options page and enter an API key (or choose a local model).
2. Visit an Amazon product page.
3. Click the toolbar icon → Analyze this page.
4. Read the credibility breakdown in the side panel.

Analysis only runs when you click Analyze — never automatically. Currently supports Amazon;
more sites planned.

Open source (MIT): https://github.com/tilanukwatta/hype-detector
```

**Privacy policy URL** (required): host `PRIVACY.md` and paste its URL — e.g. enable GitHub
Pages on the repo, or use the raw/rendered file. Example: `https://tilanukwatta.github.io/hype-detector/PRIVACY` (set up Pages first).

---

## Assets

- **Store icon — 128×128 PNG:** use **`src/assets/icon-128.png`** (also in a build at
  `dist/src/assets/icon-128.png`). This is the icon shown on the listing.
- **Screenshots — required, 1–5, 1280×800** (or 640×400), PNG/JPEG: capture the side panel
  showing a real analysis (credibility rating, summary, "What reviewers say", claims).
  Needs a real API key + an Amazon page — the one manual step.
- **Small promo tile — 440×280** (optional but recommended for better placement).
- **Marquee — 1400×560** (optional).

---

## Permission justifications (Privacy practices tab)

The console asks you to justify each permission. Suggested text:

- **storage:** Save the user's settings, API key, and cached analysis results locally on the
  device.
- **activeTab:** Read the current product page only when the user clicks Analyze.
- **scripting:** Inject the product-data extractor into the current tab on demand to read the
  listing.
- **sidePanel:** Display the analysis results in the browser side panel.
- **Host permission — amazon.\* :** Extract the structured product listing (title, price,
  bullets, description, specifications, visible reviews) to analyze.
- **Host permissions — api.openai.com, api.anthropic.com, generativelanguage.googleapis.com,
  openrouter.ai:** Send the analysis request to the LLM provider the user selected, using the
  user's own API key.
- **Host permissions — localhost / 127.0.0.1:** Connect to a user-run local Ollama server.

_(The store build has no WebLLM, so it does **not** request the huggingface.co /
raw.githubusercontent.com hosts — don't list them.)_

**Single purpose:**

> Analyze the trustworthiness of the claims in an online product listing, helping the user
> separate evidence from marketing.

---

## Data-use disclosures (Privacy practices tab)

Hype Detector collects **no** data for the developer. The only data movement is from the
user's browser directly to the LLM provider the user chose (or nowhere, for local models).

**"What user data do you collect?"** — declare only these categories:

- **Authentication information** — YES. The user's API key. Stored locally; sent only to the
  provider the user selects, to authenticate their own requests. Used only for app
  functionality.
- **Website content** — YES. Structured product-listing data (and a bounded sample of visible
  reviews) from the page. Sent to the user's chosen LLM provider to produce the analysis. Used
  only for app functionality.
- All other categories (PII, health, financial, location, web history, personal
  communications, user activity) — NO.

**Certifications (check all three — true for this extension):**

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
      (Data goes only to the LLM provider the user chose, to perform the analysis they
      requested — the item's single purpose.)
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending.

---

## Remote code question

**Answer: No, I am not using remote code.** (Leave the justification box empty.)

This is true because you upload the **store build**, which excludes WebLLM. Cloud and Ollama
providers only exchange **data**, never code. WebLLM (the only part that would download
`.wasm` at runtime) is not in the store build — it's tree-shaken out, and the manifest omits
the huggingface.co / raw.githubusercontent.com hosts and the `wasm-unsafe-eval` CSP. WebLLM
still ships in the GitHub Release / unpacked build for power users.

If you ever upload the **full** build instead, the honest answer becomes "Yes" and MV3's
no-remotely-hosted-code policy will likely reject it — so keep uploading the store build.

---

## Distribution

- Start **Unlisted** for a soft launch (real install link, not in public search), then flip to
  **Public** when ready.
- Trader status: **Non-trader** (free, non-commercial, open-source).
