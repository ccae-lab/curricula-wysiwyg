import React, { useState } from 'react';

/**
 * referencePlugin: +REFERENCE toolbar button.
 *
 * Opens a panel with citation + annotation fields. On save, calls the
 * BibliographyAdapter to persist the row, then inserts a short inline
 * marker into the draft so readers can see the cite in situ.
 *
 * Usage:
 *
 *   import { referencePlugin } from '@curricula/wysiwyg';
 *   import { engageBibliographyAdapter } from '@/lib/content/engageBibliographyAdapter';
 *
 *   <EditableField toolbar={[ referencePlugin({ adapter: engageBibliographyAdapter }) ]} />
 *
 * The adapter controls schema; this plugin only knows about the two UI
 * fields the author types. The adapter can return `inlineInsertion` to
 * override the default short-cite insertion; otherwise the plugin falls
 * back to a best-effort `(Author YYYY)` form.
 */

function parseYear(citation) {
  const m = (citation || '').match(/\((\d{4})\)/);
  return m ? parseInt(m[1], 10) : null;
}

function defaultInlineInsertion(citation) {
  const raw = (citation || '').trim();
  if (!raw) return '';
  const beforeFirstPeriod = raw.split('.')[0].trim();
  return beforeFirstPeriod ? ` (${beforeFirstPeriod})` : '';
}

function AddReferencePanel({ draft, setDraft, onClose, adapter, theme, insertInline }) {
  const [citation, setCitation] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const t = {
    mono: "'SF Mono', 'Fira Code', Menlo, monospace",
    font: "'Inter', 'Segoe UI', sans-serif",
    bg: '#f5f5f0',
    card: '#fafaf7',
    border: '#e5e3db',
    ink: '#1a1a1a',
    accent: '#6366f1',
    ...(theme || {}),
  };

  const canSave = citation.trim().length > 0 && status !== 'saving';

  async function onSave() {
    if (!canSave) return;
    if (!adapter || typeof adapter.addReference !== 'function') {
      setError('No bibliography adapter configured.');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const result = await adapter.addReference({
        citation: citation.trim(),
        annotation: annotation.trim() || undefined,
        year: parseYear(citation) || undefined,
      });
      const inline = insertInline
        ? insertInline({ citation: citation.trim(), result })
        : (result && result.inlineInsertion) || defaultInlineInsertion(citation);
      if (inline) {
        setDraft((d) => (d || '') + inline);
      }
      setCitation('');
      setAnnotation('');
      setStatus('done');
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Save failed');
      setStatus('error');
    }
  }

  return (
    <div style={{ background: t.bg, border: `1px solid ${t.accent}44`, borderRadius: 6, padding: 16, marginTop: 12 }}>
      <div style={{ fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.1em', marginBottom: 10 }}>
        ADD TO SHARED BIBLIOGRAPHY (APA 7)
      </div>
      <input
        value={citation}
        onChange={(e) => setCitation(e.target.value)}
        placeholder="Full APA 7 citation, e.g. Meadows, D. H. (2008). Thinking in systems. Chelsea Green."
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
      />
      <textarea
        value={annotation}
        onChange={(e) => setAnnotation(e.target.value)}
        placeholder="Annotation: why is this source relevant? (2-3 sentences)"
        rows={2}
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{ background: t.accent, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.4 }}
        >
          {status === 'saving' ? 'SAVING…' : 'SAVE REFERENCE'}
        </button>
        {status === 'error' && (
          <span style={{ color: '#b91c1c', fontFamily: t.mono, fontSize: 10 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

export function referencePlugin({
  adapter,
  label = '+ REFERENCE',
  color = '#6366f1',
  theme,
  insertInline,
} = {}) {
  return {
    key: 'reference',
    label,
    color,
    title: 'Add a source to the shared bibliography and drop an inline cite.',
    panel: (props) => (
      <AddReferencePanel {...props} adapter={adapter} theme={theme} insertInline={insertInline} />
    ),
  };
}
