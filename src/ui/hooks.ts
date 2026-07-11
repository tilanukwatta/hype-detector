import { useEffect, useState } from 'react';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { loadSettings, onSettingsChanged } from '@/utils/storage';

/**
 * Load settings once and keep them in sync with storage changes (so, e.g.,
 * changing the theme in options live-updates an open side panel). `loaded`
 * distinguishes "still reading storage" from "loaded defaults".
 */
export function useSettings(): { settings: Settings; loaded: boolean } {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings().then((s) => {
      if (active) {
        setSettings(s);
        setLoaded(true);
      }
    });
    const unsubscribe = onSettingsChanged((s) => active && setSettings(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { settings, loaded };
}

/** Apply the user's theme + contrast preference to the document root. */
export function useApplyTheme(theme: Settings['theme'], highContrast: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
  }, [theme, highContrast]);
}
