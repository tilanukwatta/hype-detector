import { useState } from 'react';
import { getProvider } from '@/providers';
import { getActiveTab } from '@/utils/messaging';
import { useApplyTheme, useSettings } from '@/ui/hooks';

/**
 * The toolbar popup: a compact launcher. It reports the active provider/model,
 * and its primary action opens the side panel (a user-gesture-only API, hence
 * called directly here) where the full analysis runs.
 */
export function App() {
  const { settings, loaded } = useSettings();
  useApplyTheme(settings.theme, settings.highContrast);
  const [error, setError] = useState<string | null>(null);

  const provider = getProvider(settings.provider);
  const needsKey = provider.requiresApiKey && !settings.apiKey.trim();

  async function analyze() {
    setError(null);
    const tab = await getActiveTab();
    if (!tab?.id || !tab.windowId) {
      setError('No active tab was found.');
      return;
    }
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    } catch {
      setError('Could not open the side panel. Please try again.');
    }
  }

  return (
    <main style={{ width: '300px', padding: 'var(--space)', display: 'grid', gap: 'var(--space)' }}>
      <div>
        <h1 style={{ fontSize: '15px' }}>Hype Detector</h1>
        <div className="muted" style={{ fontSize: '12px' }}>
          Separate evidence from marketing
        </div>
      </div>

      <div className="card" style={{ fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="muted">Provider</span>
          <strong>{provider.label}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="muted">Model</span>
          <strong
            style={{
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {settings.model || '—'}
          </strong>
        </div>
      </div>

      {needsKey ? (
        <div className="card" role="status" style={{ fontSize: '13px' }}>
          Add your {provider.label} API key to get started.
        </div>
      ) : null}

      {error && (
        <div className="card" role="alert" style={{ color: 'var(--danger)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={analyze} disabled={!loaded || needsKey}>
        Analyze this page
      </button>
      <button className="btn btn-secondary" onClick={() => chrome.runtime.openOptionsPage()}>
        Options
      </button>
    </main>
  );
}
