import { useCallback, useRef, useState } from 'react';
import type { Analysis, ChatTurn, Settings } from '@/types';
import type { Extracted } from '@/extraction';
import { askFollowUp } from '@/chat';
import { getProvider } from '@/providers';

/**
 * Follow-up chat about the analysed page. Each question is answered from the
 * page content + the prior analysis only (no browsing, no external lookup), so
 * answers are freeform prose and are never cached. The whole component resets
 * when the parent remounts it (keyed per analysis), clearing history for a new
 * page.
 */
export function ChatBox({
  extracted,
  analysis,
  settings,
}: {
  extracted: Extracted;
  analysis: Analysis;
  settings: Settings;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const provider = getProvider(settings.provider);
  const needsKey = provider.requiresApiKey && !settings.apiKey.trim();

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setInput('');

    // Snapshot history before this turn; append the user turn to the view.
    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await askFollowUp(
        extracted,
        analysis,
        history,
        question,
        settings,
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (result.ok) {
        setMessages((m) => [...m, { role: 'assistant', content: result.answer }]);
      } else {
        setError(result.error);
      }
    } catch (err) {
      // Aborted via Stop — leave the conversation as-is.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'The follow-up request failed.');
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, extracted, analysis, settings]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section style={{ display: 'grid', gap: '8px' }} aria-label="Ask a follow-up question">
      <strong style={{ fontSize: '13px' }}>Ask a follow-up</strong>

      {messages.length > 0 && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              className="card"
              style={{
                fontSize: '13px',
                padding: '8px 10px',
                background: m.role === 'user' ? 'var(--bg-subtle)' : 'var(--surface)',
              }}
            >
              <div
                className="muted"
                style={{ fontSize: '11px', marginBottom: '2px', textTransform: 'uppercase' }}
              >
                {m.role === 'user' ? 'You' : 'Answer'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>
      )}

      {busy && (
        <div className="muted" style={{ fontSize: '12px' }}>
          Thinking with {provider.label}…
        </div>
      )}

      {error && (
        <div className="card" role="alert" style={{ color: 'var(--danger)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {needsKey ? (
        <div className="muted" style={{ fontSize: '12px' }}>
          Add your {provider.label} API key in options to ask questions.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '6px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. What evidence does this page give for its main claim?"
            rows={2}
            aria-label="Your question about this page"
            style={{
              width: '100%',
              resize: 'vertical',
              font: 'inherit',
              fontSize: '13px',
              padding: '8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
              {busy ? 'Asking…' : 'Ask'}
            </button>
            {busy && (
              <button className="btn btn-secondary" onClick={stop}>
                Stop
              </button>
            )}
          </div>
          <p className="muted" style={{ fontSize: '11px', margin: 0 }}>
            Answered only from this page and the analysis above — not an external fact-check.
          </p>
        </div>
      )}
    </section>
  );
}
