import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Separate build for the on-demand page reader. crxjs emits content scripts as
 * ES modules behind an async loader whose chunk is only web-accessible on the
 * declared `content_scripts.matches` (Amazon). Since we inject the reader on ANY
 * site the user clicks Analyze on (via `activeTab`), we instead build it as a
 * single self-contained IIFE at a fixed path (`content-inject.js`), list that
 * file in `web_accessible_resources` with `<all_urls>`, and inject it directly.
 *
 * IIFE (not ESM) means it registers its message listener synchronously on
 * injection — no dynamic import, no cross-origin chunk load, and no race between
 * `executeScript` resolving and the listener being ready.
 *
 * Runs BEFORE the main crxjs build and outputs into `public/`, so Vite copies it
 * into `dist/` and crxjs can resolve the `web_accessible_resources` reference to
 * it (crxjs validates that manifest assets exist at build time).
 */
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: { alias: [{ find: '@', replacement: src }] },
  build: {
    target: 'es2022',
    outDir: 'public',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/content/content-script.ts', import.meta.url)),
      formats: ['iife'],
      name: 'HypeDetectorContent',
      fileName: () => 'content-inject.js',
    },
    rollupOptions: {
      output: { entryFileNames: 'content-inject.js' },
    },
  },
});
