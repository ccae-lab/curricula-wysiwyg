import React, { useState } from 'react';
import { doiToUrl } from '../citations/helpers.js';

/**
 * AITransparencyPanel (0.7.0)
 *
 * A reusable card that makes the AI and data-graph operations on a page
 * legible to the reader. Aligns with the AI Fluency framing (Long and
 * Magerko 2020) and the DigComp 3.0 competence areas referenced in the
 * caller's `frameworks` prop.
 *
 * Each feature describes one operation (DRAFT WITH AI, TWINS, etc):
 *   - what it does in one sentence
 *   - which model / API is used, and where
 *   - how the reader can verify the output
 *   - the DigComp 3.0 area(s) it touches
 *   - seminal + current references that ground the concept
 *
 * The panel renders as a collapsed bar by default; one click opens the
 * full explanation. Caller-supplied; no site-specific knowledge here.
 */

const DEFAULT_THEME = {
  mono: "'SF Mono', 'Fira Code', Menlo, monospace",
  font: "'Inter', 'Segoe UI', sans-serif",
  border: '#e5e3db',
  card: '#fafaf7',
  card2: '#f2f1ec',
  ink: '#1a1a1a',
  muted: '#6b7280',
  accent: '#6366f1',
  good: '#059669',
};

function RefCite({ cite, theme, label }) {
  if (!cite) return null;
  const href = doiToUrl(cite.doi) || cite.url || null;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, color: theme.ink, margin: '2px 0' }}>
      {label && (
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 9,
            color: theme.accent,
            background: `${theme.accent}14`,
            border: `1px solid ${theme.accent}44`,
            borderRadius: 2,
            padding: '1px 6px',
            marginRight: 6,
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      )}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.ink, textDecoration: 'underline' }}>
          {cite.cite}
        </a>
      ) : (
        <span>{cite.cite}</span>
      )}
    </div>
  );
}

function Feature({ feature, theme }) {
  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, padding: '10px 0' }}>
      <div style={{ fontFamily: theme.mono, fontSize: 10, color: theme.accent, letterSpacing: '0.1em', marginBottom: 4 }}>
        {feature.name}
      </div>
      <p style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.55, color: theme.ink }}>
        {feature.what}
      </p>
      <dl style={{ margin: '6px 0', padding: 0, fontSize: 12, lineHeight: 1.5, color: theme.ink }}>
        {feature.model && (
          <div style={{ display: 'flex', gap: 8, margin: '2px 0' }}>
            <dt style={{ flex: '0 0 auto', color: theme.muted, fontFamily: theme.mono, fontSize: 9, letterSpacing: '0.08em', paddingTop: 2 }}>MODEL / API</dt>
            <dd style={{ margin: 0 }}>{feature.model}</dd>
          </div>
        )}
        {feature.via && (
          <div style={{ display: 'flex', gap: 8, margin: '2px 0' }}>
            <dt style={{ flex: '0 0 auto', color: theme.muted, fontFamily: theme.mono, fontSize: 9, letterSpacing: '0.08em', paddingTop: 2 }}>ROUTED VIA</dt>
            <dd style={{ margin: 0 }}>{feature.via}</dd>
          </div>
        )}
        {feature.verify && (
          <div style={{ display: 'flex', gap: 8, margin: '2px 0' }}>
            <dt style={{ flex: '0 0 auto', color: theme.muted, fontFamily: theme.mono, fontSize: 9, letterSpacing: '0.08em', paddingTop: 2 }}>HOW TO VERIFY</dt>
            <dd style={{ margin: 0 }}>{feature.verify}</dd>
          </div>
        )}
        {Array.isArray(feature.digcomp) && feature.digcomp.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '2px 0' }}>
            <dt style={{ flex: '0 0 auto', color: theme.muted, fontFamily: theme.mono, fontSize: 9, letterSpacing: '0.08em', paddingTop: 2 }}>DIGCOMP</dt>
            <dd style={{ margin: 0 }}>{feature.digcomp.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {(feature.seminal || feature.current) && (
        <div style={{ marginTop: 6 }}>
          <RefCite cite={feature.seminal} label="SEMINAL" theme={theme} />
          <RefCite cite={feature.current} label="CURRENT" theme={theme} />
        </div>
      )}
    </div>
  );
}

export default function AITransparencyPanel({
  title = 'Transparency: AI and data operations on this page',
  intro,
  features = [],
  frameworks,
  defaultOpen = false,
  theme,
  className,
  style,
}) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div
      className={className}
      style={{
        background: t.card2,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 14,
        ...(style || {}),
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: t.ink,
          fontFamily: t.font,
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'left',
          width: '100%',
        }}
        aria-expanded={open}
      >
        <span
          style={{
            display: 'inline-block',
            width: 14,
            textAlign: 'center',
            fontFamily: t.mono,
            color: t.accent,
          }}
        >
          {open ? '−' : '+'}
        </span>
        <span>{title}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: t.mono,
            fontSize: 9,
            color: t.muted,
            letterSpacing: '0.08em',
          }}
        >
          {open ? 'HIDE' : 'OPEN'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8, fontFamily: t.font, color: t.ink }}>
          {intro && (
            <p style={{ margin: '4px 0 8px', fontSize: 13, lineHeight: 1.55, color: t.ink }}>
              {intro}
            </p>
          )}
          {features.map((f) => (
            <Feature key={f.name} feature={f} theme={t} />
          ))}
          {frameworks && (
            <div style={{ borderTop: `1px solid ${t.border}`, padding: '10px 0 2px' }}>
              <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accent, letterSpacing: '0.1em', marginBottom: 6 }}>
                FRAMEWORKS
              </div>
              {Array.isArray(frameworks.aiFluency) && frameworks.aiFluency.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontFamily: t.mono, fontSize: 9, color: t.muted, letterSpacing: '0.08em', marginBottom: 2 }}>
                    AI FLUENCY
                  </div>
                  {frameworks.aiFluency.map((c, i) => <RefCite key={i} cite={c} theme={t} />)}
                </div>
              )}
              {Array.isArray(frameworks.digComp) && frameworks.digComp.length > 0 && (
                <div>
                  <div style={{ fontFamily: t.mono, fontSize: 9, color: t.muted, letterSpacing: '0.08em', marginBottom: 2 }}>
                    DIGCOMP 3.0
                  </div>
                  {frameworks.digComp.map((c, i) => <RefCite key={i} cite={c} theme={t} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
