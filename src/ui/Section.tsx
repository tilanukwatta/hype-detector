import type { ReactNode } from 'react';
import type { HypeLevel } from '@/types';

/**
 * A collapsible section built on native <details>/<summary> so it is keyboard
 * accessible and screen-reader friendly out of the box. An optional `count`
 * badge and `tone` colour the header.
 */
export function Section({
  title,
  count,
  tone = 'neutral',
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const toneColor =
    tone === 'good'
      ? 'var(--good)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'danger'
          ? 'var(--danger)'
          : 'var(--text)';

  return (
    <details className="section card" open={defaultOpen} style={{ padding: 0 }}>
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          padding: 'var(--space)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontWeight: 600,
        }}
      >
        <span style={{ color: toneColor }}>{title}</span>
        {typeof count === 'number' && (
          <span
            className="muted"
            aria-label={`${count} items`}
            style={{
              fontSize: '12px',
              background: 'var(--bg-subtle)',
              borderRadius: '999px',
              padding: '1px 8px',
            }}
          >
            {count}
          </span>
        )}
      </summary>
      <div style={{ padding: '0 var(--space) var(--space)' }}>{children}</div>
    </details>
  );
}

const HYPE_TONE: Record<HypeLevel, { bg: string; fg: string }> = {
  Low: { bg: 'var(--good-bg)', fg: 'var(--good)' },
  Medium: { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  High: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

/** Coloured badge for the marketing-hype level. */
export function HypeBadge({ level }: { level: HypeLevel }) {
  const tone = HYPE_TONE[level];
  return (
    <span
      style={{
        background: tone.bg,
        color: tone.fg,
        borderRadius: '999px',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {level} hype
    </span>
  );
}
