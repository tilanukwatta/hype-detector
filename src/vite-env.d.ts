/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to '1' for the Chrome Web Store build (excludes the WebLLM provider). */
  readonly VITE_STORE_BUILD?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
