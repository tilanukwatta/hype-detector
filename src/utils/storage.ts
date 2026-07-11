import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  type CachedAnalysis,
  type ProviderId,
  type Settings,
} from '@/types';

/**
 * Thin, typed wrappers over `chrome.storage.local`. All persistent state lives
 * here: user settings (including API keys) and cached analyses. Nothing is ever
 * sent off-device — this is the extension's only storage.
 */

const SETTINGS_KEY = 'settings';
const CACHE_KEY = 'analysisCache';
/** Cap the cache so it cannot grow unbounded; oldest entries are evicted. */
const MAX_CACHE_ENTRIES = 50;

/** Load settings, merging stored values over defaults and validating them. */
export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  const merged = { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
  const result = SettingsSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: SettingsSchema.parse(settings) });
}

/** Subscribe to settings changes (e.g. so an open panel re-themes live). */
export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
    const parsed = SettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ...(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined),
    });
    if (parsed.success) callback(parsed.data);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ---------------------------------------------------------------------------
// Analysis cache (keyed by product hash + provider + model)
// ---------------------------------------------------------------------------

function cacheKey(hash: string, provider: ProviderId, model: string): string {
  return `${hash}:${provider}:${model}`;
}

async function readCache(): Promise<Record<string, CachedAnalysis>> {
  return ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] ?? {}) as Record<
    string,
    CachedAnalysis
  >;
}

/** Return a cached analysis matching the hash/provider/model, or null. */
export async function getCachedAnalysis(
  hash: string,
  provider: ProviderId,
  model: string
): Promise<CachedAnalysis | null> {
  const cache = await readCache();
  return cache[cacheKey(hash, provider, model)] ?? null;
}

export async function putCachedAnalysis(entry: CachedAnalysis): Promise<void> {
  const cache = await readCache();
  cache[cacheKey(entry.productHash, entry.provider, entry.model)] = entry;

  // Evict oldest entries if over capacity.
  const entries = Object.entries(cache);
  if (entries.length > MAX_CACHE_ENTRIES) {
    entries
      .sort(([, a], [, b]) => a.createdAt - b.createdAt)
      .slice(0, entries.length - MAX_CACHE_ENTRIES)
      .forEach(([key]) => delete cache[key]);
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}
