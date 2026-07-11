import { useEffect, useState } from 'react';
import type { ProviderId, Settings } from '@/types';
import { PROVIDER_LIST, getProvider } from '@/providers';
import { loadSettings, saveSettings, clearCache } from '@/utils/storage';
import { useApplyTheme } from '@/ui/hooks';

const FIELD_STYLE = { display: 'grid', gap: '4px' } as const;

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  useApplyTheme(settings?.theme ?? 'system', settings?.highContrast ?? false);

  if (!settings) return <main style={{ padding: 24 }}>Loading…</main>;

  const provider = getProvider(settings.provider);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setStatus(null);
  }

  function changeProvider(id: ProviderId) {
    const next = getProvider(id);
    setSettings((s) => (s ? { ...s, provider: id, model: next.suggestedModels[0] ?? s.model } : s));
    setStatus(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    await saveSettings(settings);
    setStatus('Settings saved.');
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20 }}>Hype Detector — Options</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Your API key is stored only on this device and is sent directly to your chosen provider.
          Nothing goes through any Hype Detector server.
        </p>
      </div>

      <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
        <label style={FIELD_STYLE}>
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={(e) => changeProvider(e.target.value as ProviderId)}
          >
            {PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {provider.requiresApiKey && (
          <label style={FIELD_STYLE}>
            <span>API key</span>
            <input
              type="password"
              autoComplete="off"
              value={settings.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder={`Your ${provider.label} API key`}
            />
          </label>
        )}

        <label style={FIELD_STYLE}>
          <span>Model</span>
          <input
            list="model-suggestions"
            value={settings.model}
            onChange={(e) => update('model', e.target.value)}
          />
          <datalist id="model-suggestions">
            {provider.suggestedModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label style={FIELD_STYLE}>
          <span>
            Base URL{' '}
            <span className="muted">
              (optional override
              {provider.requiresApiKey ? '' : ` — default ${provider.defaultBaseUrl}`})
            </span>
          </span>
          <input
            value={settings.baseUrl ?? ''}
            onChange={(e) => update('baseUrl', e.target.value || undefined)}
            placeholder={provider.defaultBaseUrl}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label style={FIELD_STYLE}>
            <span>Temperature: {settings.temperature.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => update('temperature', Number(e.target.value))}
            />
          </label>
          <label style={FIELD_STYLE}>
            <span>Max tokens</span>
            <input
              type="number"
              min={256}
              max={8192}
              step={64}
              value={settings.maxTokens}
              onChange={(e) => update('maxTokens', Number(e.target.value))}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label style={FIELD_STYLE}>
            <span>Theme</span>
            <select
              value={settings.theme}
              onChange={(e) => update('theme', e.target.value as Settings['theme'])}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => update('highContrast', e.target.checked)}
            />
            <span>High contrast</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn">
            Save settings
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void clearCache().then(() => setStatus('Cached analyses cleared.'))}
          >
            Clear cache
          </button>
          {status && (
            <span role="status" style={{ color: 'var(--good)' }}>
              {status}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
