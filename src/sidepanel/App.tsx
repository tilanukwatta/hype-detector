import { useCallback, useEffect, useState } from 'react';
import type { Analysis, Product, Settings } from '@/types';
import { analyzeProduct } from '@/analyze';
import { getProvider } from '@/providers';
import { hashProduct } from '@/utils/cache';
import { getActiveTab, sendToTab } from '@/utils/messaging';
import { getCachedAnalysis, putCachedAnalysis } from '@/utils/storage';
import { AnalysisView } from '@/ui/AnalysisView';
import { useApplyTheme, useSettings } from '@/ui/hooks';

type State =
  | { phase: 'idle' }
  | { phase: 'extracting' }
  | { phase: 'analyzing'; product: Product }
  | { phase: 'done'; product: Product; analysis: Analysis; cached: boolean }
  | { phase: 'notice'; message: string; tone: 'info' | 'error' };

export function App() {
  const { settings, loaded } = useSettings();
  useApplyTheme(settings.theme, settings.highContrast);

  const [state, setState] = useState<State>({ phase: 'idle' });

  const run = useCallback(async (currentSettings: Settings, force: boolean) => {
    const provider = getProvider(currentSettings.provider);
    if (provider.requiresApiKey && !currentSettings.apiKey.trim()) {
      setState({
        phase: 'notice',
        tone: 'info',
        message: `Add your ${provider.label} API key in the options page to start analyzing.`,
      });
      return;
    }

    setState({ phase: 'extracting' });

    const tab = await getActiveTab();
    if (!tab?.id) {
      setState({ phase: 'notice', tone: 'error', message: 'No active tab was found.' });
      return;
    }

    const outcome = await sendToTab(tab.id, { type: 'GET_PRODUCT' });
    if (!outcome) {
      setState({
        phase: 'notice',
        tone: 'info',
        message: 'Open a supported product page (Amazon) and try again.',
      });
      return;
    }
    if (!outcome.ok) {
      setState({ phase: 'notice', tone: 'info', message: outcome.message });
      return;
    }

    const { product } = outcome;
    const hash = hashProduct(product);

    if (!force) {
      const cached = await getCachedAnalysis(hash, currentSettings.provider, currentSettings.model);
      if (cached) {
        setState({ phase: 'done', product, analysis: cached.analysis, cached: true });
        return;
      }
    }

    setState({ phase: 'analyzing', product });
    const result = await analyzeProduct(product, currentSettings);
    if (!result.ok) {
      setState({ phase: 'notice', tone: 'error', message: result.error });
      return;
    }

    await putCachedAnalysis({
      productHash: hash,
      provider: currentSettings.provider,
      model: currentSettings.model,
      analysis: result.analysis,
      createdAt: Date.now(),
    });
    setState({ phase: 'done', product, analysis: result.analysis, cached: false });
  }, []);

  // Auto-run once settings have loaded.
  useEffect(() => {
    if (loaded) void run(settings, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const busy = state.phase === 'extracting' || state.phase === 'analyzing';

  return (
    <main style={{ padding: 'var(--space)', display: 'grid', gap: 'var(--space)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '16px' }}>Hype Detector</h1>
          <div className="muted" style={{ fontSize: '12px' }}>
            Separate evidence from marketing
          </div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => void run(settings, true)}
          disabled={busy || !loaded}
        >
          {busy ? 'Working…' : 'Re-analyze'}
        </button>
      </header>

      {state.phase === 'extracting' && <p className="muted">Reading the product page…</p>}
      {state.phase === 'analyzing' && (
        <p className="muted">Analyzing claims with {getProvider(settings.provider).label}…</p>
      )}

      {state.phase === 'notice' && (
        <div
          className="card"
          role={state.tone === 'error' ? 'alert' : 'status'}
          style={{
            borderColor: state.tone === 'error' ? 'var(--danger)' : 'var(--border)',
            color: state.tone === 'error' ? 'var(--danger)' : 'var(--text)',
          }}
        >
          {state.message}
          {state.tone === 'info' && (
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                Open options
              </button>
            </div>
          )}
        </div>
      )}

      {state.phase === 'done' && (
        <>
          {state.cached && (
            <div className="muted" style={{ fontSize: '12px' }}>
              Showing a cached result. Use Re-analyze to run again.
            </div>
          )}
          <AnalysisView analysis={state.analysis} product={state.product} />
        </>
      )}
    </main>
  );
}
