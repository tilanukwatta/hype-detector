import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/**
 * The Chrome Web Store build excludes the WebLLM provider (Manifest V3 forbids
 * the remotely hosted WASM it downloads). In that build we also drop the model
 * download hosts and the `wasm-unsafe-eval` CSP, so the package uses no remote
 * code. Build it with `VITE_STORE_BUILD=1`.
 */
const storeBuild = process.env.VITE_STORE_BUILD === '1';

const webllmHosts = [
  'https://huggingface.co/*',
  'https://*.huggingface.co/*',
  'https://*.hf.co/*',
  'https://raw.githubusercontent.com/*',
];

/**
 * Manifest V3 definition for Hype Detector.
 *
 * Design notes:
 * - `sidePanel` hosts the full analysis UI; the toolbar `action` opens a popup
 *   with a quick "Analyze" trigger.
 * - `host_permissions` only lists the LLM provider endpoints the extension may
 *   call. Amazon is covered by the content script `matches` + `activeType`.
 * - No analytics, tracking, or remote logging hosts. No backend of our own.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Hype Detector',
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: '116',
  icons: {
    16: 'src/assets/icon-16.png',
    48: 'src/assets/icon-48.png',
    128: 'src/assets/icon-128.png',
  },
  action: {
    default_title: 'Hype Detector',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'src/assets/icon-16.png',
      48: 'src/assets/icon-48.png',
      128: 'src/assets/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        'https://www.amazon.com/*',
        'https://www.amazon.co.uk/*',
        'https://www.amazon.ca/*',
        'https://www.amazon.de/*',
        'https://www.amazon.com.au/*',
      ],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'activeTab', 'sidePanel', 'scripting'],
  host_permissions: [
    // Shopping sites — needed so the side panel can inject the extractor on
    // demand (e.g. into tabs that were already open before the extension loaded).
    'https://www.amazon.com/*',
    'https://www.amazon.co.uk/*',
    'https://www.amazon.ca/*',
    'https://www.amazon.de/*',
    'https://www.amazon.com.au/*',
    // LLM provider endpoints (contacted only when you run an analysis).
    'https://api.openai.com/*',
    'https://api.anthropic.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://openrouter.ai/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
    // WebLLM model downloads (one-time, then cached): weights from HuggingFace,
    // wasm libraries from GitHub. No inference data is sent to these hosts.
    // Omitted from the store build (no WebLLM there).
    ...(storeBuild ? [] : webllmHosts),
  ],
  // WebLLM runs WebAssembly in the extension pages, which needs
  // 'wasm-unsafe-eval'. The store build has no WebLLM, so it uses the default CSP.
  ...(storeBuild
    ? {}
    : {
        content_security_policy: {
          extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
        },
      }),
});
