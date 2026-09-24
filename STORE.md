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

> Analyze the credibility of any web page — separate evidence from hype — with your own LLM key or a local model.

**Category:** Productivity (alternative: Shopping)

**Language:** English (United States)

**Detailed description:**

```
Hype Detector helps you think critically about what you read online. Instead of telling you
what to believe or buy, it analyzes the claims on a page — flagging vague or loaded language,
unsupported claims, missing evidence, and persuasive techniques — and explains its reasoning
so you can decide for yourself. You can also ask follow-up questions about the page.

Its goal is to answer one question: how well does this page's own content support its claims?

It assesses only what is on the page — it does not verify facts against outside sources, and
it clearly separates what it evaluated from the page from what it could not verify.

• Works on any page — articles, blogs, marketing pages, and product listings. On shopping
  sites it also summarizes what reviewers say (pros and cons of the product and seller).
• Ask follow-up questions — get answers grounded only in the page and the analysis, not the
  open web.
• Bring your own LLM — OpenAI, Anthropic, Google Gemini, or OpenRouter with your own API key,
  or a local Ollama server. No subscription, no middleman.
• Private by design — no accounts, no analytics, no tracking, no telemetry. Your API key is
  stored only on your device, and your data goes directly to the provider you choose (and never
  leaves your device with a local Ollama model).
• Careful wording — it distinguishes facts from opinion and rhetoric, and never claims content
  is "fake" — only whether the page provides evidence for it.

How to use:
1. Open the Options page and enter an API key (or choose a local model).
2. Visit any web page.
3. Click the toolbar icon → Analyze this page.
4. Read the credibility breakdown in the side panel, and ask follow-up questions.

Analysis only runs when you click Analyze — never automatically, and never in the background.

Open source (MIT): https://github.com/tilanukwatta/hype-detector
```

**Privacy policy URL** (required):

> https://github.com/tilanukwatta/hype-detector/blob/main/PRIVACY.md

(The GitHub-rendered page is public and accepted by the store. Use this URL, not the
`raw.githubusercontent.com` one. A nicer GitHub Pages URL is optional.)

---

## Assets

- **Store icon — 128×128 PNG:** use **`src/assets/icon-128.png`** (also in a build at
  `dist/src/assets/icon-128.png`). This is the icon shown on the listing.
- **Screenshots — required, 1–5, 1280×800** (or 640×400), PNG/JPEG: capture the side panel
  showing a real analysis (credibility rating, summary, key claims with their assessments) and
  the follow-up chat. A news article and an Amazon product page make good, varied examples.
  Needs a real API key — the one manual step.
- **Small promo tile — 440×280** (optional but recommended for better placement).
- **Marquee — 1400×560** (optional).

---

## Permission justifications (Privacy practices tab)

The console asks you to justify each permission. Suggested text:

- **storage:** Save the user's settings, API key, and cached analysis results locally on the
  device.
- **activeTab:** Read the current page's content only when the user clicks Analyze. This is
  what grants access to the page, on demand, for that one tab.
- **scripting:** Inject the page-content extractor into the current tab on demand (using the
  access granted by activeTab) to read the page the user asked to analyze.
- **sidePanel:** Display the analysis results and follow-up chat in the browser side panel.
- **Host permissions — api.openai.com, api.anthropic.com, generativelanguage.googleapis.com,
  openrouter.ai:** Send the analysis request to the LLM provider the user selected, using the
  user's own API key.
- **Host permissions — localhost / 127.0.0.1:** Connect to a user-run local Ollama server.

_(Note: the extension requests **no** website host permissions. Reading the current page is
done through activeTab + scripting, which only apply after the user clicks Analyze. The store
build has no WebLLM, so it also does **not** request the huggingface.co /
raw.githubusercontent.com hosts — don't list them.)_

**Single purpose:**

> Assess how well a web page's own content supports its claims, helping the user separate
> evidence from hype, and answer the user's follow-up questions about that page.

---

## Data-use disclosures (Privacy practices tab)

Hype Detector collects **no** data for the developer. The only data movement is from the
user's browser directly to the LLM provider the user chose (or nowhere, for local models).

**"What user data do you collect?"** — declare only these categories:

- **Authentication information** — YES. The user's API key. Stored locally; sent only to the
  provider the user selects, to authenticate their own requests. Used only for app
  functionality.
- **Website content** — YES. The readable content of the page the user chooses to analyze:
  the main article text (title, author/date, headings, body sections) on general pages, or
  structured product-listing data plus a bounded sample of visible reviews on shopping sites —
  and the user's follow-up questions. Navigation, ads, forms, hidden elements, and typed/form
  input are excluded, and raw HTML is never sent. Sent to the user's chosen LLM provider to
  produce the analysis. Used only for app functionality.
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
