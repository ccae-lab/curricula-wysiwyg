import React, { useState } from 'react';

/**
 * glossaryTermPlugin: +GLOSSARY TERM toolbar button.
 *
 * Opens a panel with term + definition (+ optional category) fields. On
 * save, calls the GlossaryAdapter to persist the entry. By default
 * nothing is inserted inline, because glossary terms usually surface via
 * a separate GlossaryTerm / tooltip component in the reader. The
 * adapter or the caller can opt into inline insertion by returning
 * `inlineInsertion` or passing `insertInline`.
 *
 * Usage:
 *
 *   import { glossaryTermPlugin } from '@curricula/wysiwyg';
 *   import { engageGlossaryAdapter } from '@/lib/content/engageGlossaryAdapter';
 *
 *   <EditableField toolbar={[ glossaryTermPlugin({ adapter: engageGlossaryAdapter }) ]} />
 */

function AddGlossaryPanel({ draft, setDraft, onClose, adapter, theme, insertInline, showCategory }) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const t = {
    mono: "'SF Mono', 'Fira Code', Menlo, monospace",
    font: "'Inter', 'Segoe UI', sans-serif",
    bg: '#f5f5f0',
    card: '#fafaf7',
    border: '#e5e3db',
    ink: '#1a1a1a',
    accent: '#8b5cf6',
    ...(theme || {}),
  };

  const canSave = term.trim().length > 0 && definition.trim().length > 0 && status !== 'saving';

  async function onSave() {
    if (!canSave) return;
    if (!adapter || typeof adapter.addTerm !== 'function') {
      setError('No glossary adapter configured.');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const result = await adapter.addTerm({
        term: term.trim(),
        definition: definition.trim(),
        category: category.trim() || undefined,
      });
      const inline = insertInline
        ? insertInline({ term: term.trim(), result })
        : (result && result.inlineInsertion) || '';
      if (inline) {
        setDraft((d) => (d || '') + inline);
      }
      setTerm('');
      setDefinition('');
      setCategory('');
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
        ADD TO SHARED GLOSSARY
      </div>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Term, e.g. Epistemic Humility"
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
      />
      <textarea
        value={definition}
        onChange={(e) => setDefinition(e.target.value)}
        placeholder="Definition: academically precise but accessible (1-2 sentences)."
        rows={3}
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
      />
      {showCategory && (
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional): concept, methodology, theory, framework"
          style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{ background: t.accent, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.4 }}
        >
          {status === 'saving' ? 'SAVING…' : 'SAVE TERM'}
        </button>
        {status === 'error' && (
          <span style={{ color: '#b91c1c', fontFamily: t.mono, fontSize: 10 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

export function glossaryTermPlugin({
  adapter,
  label = '+ GLOSSARY TERM',
  color = '#8b5cf6',
  theme,
  insertInline,
  showCategory = true,
} = {}) {
  return {
    key: 'glossary-term',
    label,
    color,
    title: 'Add a term to the shared glossary. Reader-side tooltips pick it up.',
    panel: (props) => (
      <AddGlossaryPanel
        {...props}
        adapter={adapter}
        theme={theme}
        insertInline={insertInline}
        showCategory={showCategory}
      />
    ),
  };
}
