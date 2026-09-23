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
 * - Reading the current page uses `activeTab` + `scripting`: the page reader
 *   (`content-inject.js`, built separately as a self-contained IIFE) is injected
 *   on demand when the user invokes the extension, so no site is listed in
 *   `host_permissions` and there is no broad "read all your data" grant. The
 *   reader is a `web_accessible_resource` for `<all_urls>` so it can be injected
 *   anywhere; that alone grants no host access.
 * - `host_permissions` only lists the LLM provider endpoints the extension may
 *   call.
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
  // The page reader is injected on demand (via activeTab) on any site the user
  // clicks Analyze on, so it must be web-accessible everywhere. `content-inject.js`
  // is produced by the separate vite.content.config.ts build. Being web-accessible
  // grants no host access on its own — execution is gated by activeTab.
  web_accessible_resources: [
    {
      resources: ['content-inject.js'],
      matches: ['<all_urls>'],
    },
  ],
  permissions: ['storage', 'activeTab', 'sidePanel', 'scripting'],
  host_permissions: [
    // LLM provider endpoints (contacted only when you run an analysis). Web
    // pages themselves are read via `activeTab`, so no page host is listed here.
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
