# Contributing to Hype Detector

Thanks for helping build an open, transparent tool for consumer literacy. A few
principles guide the codebase:

- **Keep provider-specific code isolated.** One file per provider in `src/providers/`.
- **Keep extraction logic isolated.** One adapter per site in `src/extraction/`, with all
  CSS selectors in a local config object — never hard-code site selectors in shared logic.
- **Every feature ships with tests.** Mock LLM responses; never call a real API in tests.
- **Prefer readable code over clever code, and minimize dependencies.**
- **Respect the philosophy.** The extension analyzes claims; it never recommends buying or
  avoiding a product, and never asserts a product is "fake". Distinguish _unsupported_,
  _disproven_, and _uncertain_.

## Getting started

```bash
npm install
npm test            # watch mode: npm run test:watch
npm run build
```

Before opening a PR, make sure these all pass (CI runs the same):

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Adding a new LLM provider

1. Create `src/providers/<name>.ts` exporting an object that implements `LLMProvider`
   (see `src/providers/types.ts`). Reuse `postJson` for transport and `chatCompletion`
   if the API is OpenAI-compatible.
2. Register it in `src/providers/index.ts` (`PROVIDERS` + `PROVIDER_LIST`) and add the id
   to `PROVIDER_IDS` in `src/types.ts`.
3. Add its API host to `host_permissions` in `manifest.config.ts`.
4. Add a test to `src/providers/providers.test.ts` asserting the request shape and
   response parsing (mock `fetch`).

## Adding a new shopping site

1. Create `src/extraction/<site>.ts` exporting a `SiteAdapter`. Put all selectors in a
   local `SELECTORS` config object.
2. Register it in `src/extraction/index.ts` and add the site's URL patterns to
   `content_scripts[].matches` in `manifest.config.ts`.
3. Save a representative page to `src/__fixtures__/` and add a jsdom-based extraction test.

## Commit / PR conventions

- Keep PRs focused and include tests.
- Describe user-facing behavior changes in the PR description.
