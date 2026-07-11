import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

/**
 * A minimal in-memory stub of the `chrome.storage.local` API plus the handful
 * of extension APIs the code touches. Tests that need richer behaviour can
 * override individual methods via `vi.spyOn`.
 */
function createChromeStub() {
  const store = new Map<string, unknown>();
  return {
    storage: {
      local: {
        async get(keys?: string | string[] | Record<string, unknown> | null) {
          if (keys == null) return Object.fromEntries(store);
          const names =
            typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
          const out: Record<string, unknown> = {};
          for (const name of names) {
            if (store.has(name)) out[name] = store.get(name);
            else if (keys && typeof keys === 'object' && !Array.isArray(keys))
              out[name] = keys[name];
          }
          return out;
        },
        async set(items: Record<string, unknown>) {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
        async remove(keys: string | string[]) {
          const names = typeof keys === 'string' ? [keys] : keys;
          for (const name of names) store.delete(name);
        },
        async clear() {
          store.clear();
        },
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      lastError: undefined as chrome.runtime.LastError | undefined,
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
    sidePanel: {
      open: vi.fn(),
      setPanelBehavior: vi.fn(),
    },
    action: { onClicked: { addListener: vi.fn() } },
  };
}

vi.stubGlobal('chrome', createChromeStub());

afterEach(() => {
  vi.stubGlobal('chrome', createChromeStub());
  vi.restoreAllMocks();
});
