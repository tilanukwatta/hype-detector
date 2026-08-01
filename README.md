# Hype Detector

> Separate evidence from marketing.

**Hype Detector** is an open-source browser extension (Chrome / Edge / Brave, Manifest V3)
that helps you critically evaluate online product listings using an LLM of your choice.

It does **not** tell you whether to buy something. Instead it analyzes the **claims the
seller makes** — flagging vague marketing language, unsupported or scientific claims, and
missing evidence — and explains its reasoning so you can decide for yourself.

- **No backend.** Everything runs in your browser.
- **Bring your own API key** — OpenAI, Anthropic, Google Gemini, OpenRouter — or run a
  model **locally** with Ollama or fully **in-browser** (WebLLM/WebGPU, no key, no server).
  No subscription, no middleman.
- **Private by design.** No analytics, tracking, telemetry, or remote logging. Your API
  key and browsing stay on your device.

> This is a v0.1 MVP. Currently supports **Amazon** product pages.

## How it works

1. A content script extracts a structured product object from the page (title, brand,
   price, bullets, description, specifications) — **never raw HTML, and never reviews**.
2. The extension builds a prompt and sends it, with your API key, **directly** to your
   chosen provider.
3. The response is parsed into a structured assessment and shown in a side panel with a
   credibility rating and collapsible sections.

The extension only analyzes when you click **Analyze** — it never runs automatically on
every page, and results are cached locally until the page content changes.

## Install

There is no web-store listing yet, so installation currently requires turning on your
browser's **Developer mode**. Pick one of the two options below to get the extension files,
then continue to [Add your API key](#add-your-api-key).

A Chromium browser is required: **Chrome**, **Edge**, or **Brave**.

### Option A — Download a prebuilt release (no build needed)

1. Go to the [**Releases**](https://github.com/tilanukwatta/hype-detector/releases/latest)
   page and download the latest `hype-detector-vX.Y.Z.zip`.
2. Unzip it into a folder you'll keep (deleting the folder later uninstalls the extension).
3. Open your extensions page — `chrome://extensions` (Edge: `edge://extensions`, Brave:
   `brave://extensions`) — turn on **Developer mode** (top-right), click **Load unpacked**
   (top-left), and select the **unzipped folder**.
4. _(Optional)_ Click the puzzle-piece icon in the toolbar and **pin** Hype Detector.

### Option B — Build from source

Requires **Node.js 22+** and npm.

```bash
git clone https://github.com/tilanukwatta/hype-detector.git
cd hype-detector
npm install
npm run build      # outputs the unpacked extension to ./dist
```

Then load it: open your extensions page, turn on **Developer mode**, click **Load unpacked**,
and select the **`dist`** folder created by the build.

The extension card should show no errors. (If it ever does, click **Clear all**, then reload.)

### Add your API key

1. Click the **Hype Detector** toolbar icon → **Options**.
2. Choose a **provider**, paste your **API key**, and set a **model**. Suggested pairings:
   - **Anthropic** — `claude-sonnet-5`
   - **OpenAI** — `gpt-4o-mini`
   - **Google Gemini** — `gemini-1.5-flash`
   - **In-browser (WebLLM)** (no key, runs on your GPU) — see below
   - **Ollama** (local server, no key) — see below
3. Click **Save settings**, then **Test connection** to confirm the key _and_ the selected model work before analyzing.

Your API key is stored only on your device — see the [Privacy Policy](./PRIVACY.md).

### Analyze a product

1. Open an **Amazon product page** (a product detail page, e.g. `amazon.com/dp/...`).
2. Click the toolbar icon → **Analyze this page**. The side panel opens with the credibility breakdown.
3. Use **Re-analyze** to force a fresh run (results are cached until the page content changes).

### Running a model locally (no API key)

Two ways to run without any cloud provider or API key:

**In-browser (WebLLM)** — zero setup beyond picking a model. In Options choose
**In-browser (WebLLM)** and a model. Requires **WebGPU** (Chrome/Edge/Brave with hardware
acceleration). The model **downloads once** on the first analysis (~1–5 GB depending on the
model) and is cached for offline use afterward; a progress indicator shows the download.
Nothing you analyze ever leaves your device.

**Ollama** — if you already run [Ollama](https://ollama.com): pull a model
(e.g. `ollama pull llama3.1`), then in Options choose the **Ollama (local)** provider. The
default endpoint is `http://localhost:11434`.

### Updating after code changes

The unpacked extension is a static build, so after pulling changes or editing code:

```bash
npm run build
```

Then return to your extensions page and click the **↻ reload** icon on the Hype Detector
card. For active development with hot reload, use `npm run dev` instead.

### Troubleshooting

- **"Could not read this page" / no result** — make sure you're on a supported product page.
  If the tab was already open when you loaded or updated the extension, **reload the page**
  and try again.
- **Authentication or model errors** — use **Test connection** in Options. It distinguishes an
  invalid key from a valid key that lacks access to the selected model; switch the model or
  provider if needed.
- **Errors on the extension card after an update** — click **Clear all**, then the **↻ reload**
  icon. For a fully clean reload, **Remove** the extension and **Load unpacked** again.

## Scripts

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR                    |
| `npm run build`     | Type-check and build the unpacked extension |
| `npm run zip`       | Build and package a store-ready `.zip`      |
| `npm test`          | Run the Vitest test suite                   |
| `npm run typecheck` | Type-check only                             |
| `npm run lint`      | ESLint                                      |
| `npm run format`    | Format with Prettier                        |

## Architecture

```
src/
  background/    thin service worker (side-panel wiring)
  content/       extracts a structured product from the page DOM
  popup/         toolbar popup: quick "Analyze" launcher
  sidepanel/     full, collapsible analysis UI
  options/       settings (provider, key, model, theme…)
  providers/     one file per LLM provider behind a shared interface
  extraction/    per-site adapters (amazon.ts, walmart stub) + registry
  prompts/       system prompt + prompt builder
  parser/        tolerant JSON extraction + schema validation
  ui/            shared React components + theming
  utils/         storage, messaging, caching
```

Adding a new provider or shopping site is a self-contained change — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Privacy

Hype Detector has no server. Your API key is stored with the browser's extension storage
and is sent only to the provider you configure. There is no analytics, tracking,
telemetry, cookies, or remote logging. See the full [Privacy Policy](./PRIVACY.md).

## Releasing

Publishing a new version (for maintainers):

```bash
npm version patch      # bumps package.json and creates a vX.Y.Z tag
git push --follow-tags # the Release workflow builds, zips, and attaches it to a GitHub Release
```

Download the `.zip` from the resulting GitHub Release and upload it to the
[Chrome Web Store](https://chrome.google.com/webstore/devconsole) and
[Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge).

## License

[MIT](./LICENSE)
