import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

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
    service_worker: 'src/background/index.ts',
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
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'activeTab', 'sidePanel', 'scripting'],
  host_permissions: [
    'https://api.openai.com/*',
    'https://api.anthropic.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://openrouter.ai/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
  ],
});
