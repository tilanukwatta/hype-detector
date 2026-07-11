# Hype Detector

> Separate evidence from marketing.

**Hype Detector** is an open-source browser extension (Chrome / Edge / Brave, Manifest V3)
that helps you critically evaluate online product listings using an LLM of your choice.

It does **not** tell you whether to buy something. Instead it analyzes the **claims the
seller makes** — flagging vague marketing language, unsupported or scientific claims, and
missing evidence — and explains its reasoning so you can decide for yourself.

- **No backend.** Everything runs in your browser.
- **Bring your own API key.** OpenAI, Anthropic, Google Gemini, OpenRouter, or a local
  Ollama model. No subscription, no middleman.
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

## Install (from source)

Requires Node 22+.

```bash
git clone https://github.com/tilanukwatta/hype-detector.git
cd hype-detector
npm install
npm run build      # outputs the unpacked extension to ./dist
```

Then load it in your browser:

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

For live development with hot reload:

```bash
npm run dev
```

## Setup

1. Click the Hype Detector toolbar icon → **Options**.
2. Choose a provider, paste your API key, and pick a model.
3. Visit an Amazon product page, click the toolbar icon → **Analyze this page**.

### Using a local model (no API key, fully offline)

Install [Ollama](https://ollama.com), pull a model (e.g. `ollama pull llama3.1`), then in
Options choose the **Ollama (local)** provider. The default endpoint is
`http://localhost:11434`.

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
