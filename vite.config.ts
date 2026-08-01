import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

const storeBuild = process.env.VITE_STORE_BUILD === '1';
const src = fileURLToPath(new URL('./src', import.meta.url));
const webllmStub = fileURLToPath(new URL('./src/providers/webllm.stub.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Store build: swap the WebLLM provider for a stub so @mlc-ai/web-llm and
      // its worker are excluded from the bundle (no remotely hosted code).
      ...(storeBuild ? [{ find: /^@\/providers\/webllm$/, replacement: webllmStub }] : []),
      { find: '@', replacement: src },
    ],
  },
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
