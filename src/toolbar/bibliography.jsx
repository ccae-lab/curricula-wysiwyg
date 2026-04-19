import React, { useState } from 'react';
import {
  parseAPA,
  extractDoi,
  firstAuthorSurname,
  doiToUrl,
  defaultFormatInline,
} from '../citations/helpers.js';

/**
 * referencePlugin: +REFERENCE toolbar button (0.3.0).
 *
 * Flow:
 *   1. User types a citation (+optional annotation), clicks SAVE.
 *   2. If the adapter exposes `searchReferences`, the plugin searches
 *      for existing rows by DOI / first-author+year / title. Matches
 *      render in a list; the user picks one or "add new anyway".
 *   3. On pick-existing: skip insert, call `formatInline(entry)`, drop
 *      `[Author, Year](doi)` into the draft.
 *   4. On add-new: `addReference` persists; if an `enrichmentAdapter`
 *      is provided, its `enrich()` is called against the new entry and
 *      (when matchConfidence ≥ threshold) the row is patched via
 *      `enrichReference` with the returned metadata — bumping
 *      verification_status to 'verified' and filling any missing
 *      fields. The inline link reflects the enriched entry.
 *
 * The plugin never hardcodes site schema. Format, write, and enrich are
 * all adapter-owned.
 *
 * Factory options:
 *   adapter               BibliographyAdapter (required)
 *   enrichmentAdapter?    EnrichmentAdapter (optional)
 *   label?, color?, theme?
 *   insertInline?         ({ citation, result }) => string — overrides default link
 *   confidenceThreshold?  default 0.7 — minimum enrich confidence to flip to verified
 *   formatInline?         (entry) => string — overrides adapter.formatInline and helpers default
 */

function ReferencePanel({
  draft,
  setDraft,
  onClose,
  adapter,
  enrichmentAdapter,
  theme,
  insertInline,
  formatInline,
  confidenceThreshold = 0.7,
}) {
  const [citation, setCitation] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState(null); // null = not searched; [] = no matches; [rows...] = matches

  const t = {
    mono: "'SF Mono', 'Fira Code', Menlo, monospace",
    font: "'Inter', 'Segoe UI', sans-serif",
    bg: '#f5f5f0',
    card: '#fafaf7',
    border: '#e5e3db',
    ink: '#1a1a1a',
    accent: '#6366f1',
    good: '#059669',
    ...(theme || {}),
  };

  const resolveFormatInline = (entry) => {
    if (formatInline) return formatInline(entry);
    if (adapter?.formatInline) return adapter.formatInline(entry);
    return defaultFormatInline(entry);
  };

  const canAct = citation.trim().length > 0 && status !== 'saving' && status !== 'searching';

  async function runSearchOrSave() {
    if (!canAct) return;
    if (!adapter || typeof adapter.addReference !== 'function') {
      setError('No bibliography adapter configured.');
      setStatus('error');
      return;
    }
    setError(null);

    // Step 1: search (if supported)
    if (typeof adapter.searchReferences === 'function' && matches === null) {
      setStatus('searching');
      const parsed = parseAPA(citation);
      try {
        const found = await adapter.searchReferences({
          citation: citation.trim(),
          doi: extractDoi(citation) || parsed.doi || undefined,
          firstAuthor: firstAuthorSurname(parsed.authors) || undefined,
          year: parsed.year || undefined,
          title: parsed.title || undefined,
        });
        const list = Array.isArray(found) ? found : [];
        setMatches(list);
        setStatus('idle');
        if (list.length > 0) return; // let the user pick
      } catch (err) {
        // Search is best-effort: on failure, fall through to save.
        console.warn('[referencePlugin] searchReferences failed:', err);
        setMatches([]);
      }
    }

    await saveNew();
  }

  async function useExisting(entry) {
    if (status === 'saving') return;
    const inline = insertInline
      ? insertInline({ citation: citation.trim(), result: entry, existing: true })
      : resolveFormatInline(entry);
    if (inline) setDraft((d) => (d || '') + inline);
    setCitation('');
    setAnnotation('');
    setMatches(null);
    setStatus('done');
    onClose?.();
  }

  async function saveNew() {
    if (!adapter) return;
    setStatus('saving');
    try {
      const parsed = parseAPA(citation);
      const created = await adapter.addReference({
        citation: citation.trim(),
        annotation: annotation.trim() || undefined,
        year: parsed.year || undefined,
      });
      let entry = (created && typeof created === 'object') ? created : { citation: citation.trim() };

      // Enrichment pass (best-effort)
      if (enrichmentAdapter && typeof enrichmentAdapter.enrich === 'function' && entry.id) {
        try {
          const enriched = await enrichmentAdapter.enrich({
            citation: citation.trim(),
            doi: extractDoi(citation) || parsed.doi || undefined,
          });
          if (enriched && typeof enriched === 'object') {
            const patch = buildPatch(enriched, confidenceThreshold);
            if (patch && typeof adapter.enrichReference === 'function') {
              const updated = await adapter.enrichReference(entry.id, patch);
              if (updated && typeof updated === 'object') entry = updated;
              else entry = { ...entry, ...patch };
            }
          }
        } catch (err) {
          // Don't block the commit on enrichment failure.
          console.warn('[referencePlugin] enrichment failed:', err);
        }
      }

      const inline = insertInline
        ? insertInline({ citation: citation.trim(), result: entry, existing: false })
        : (entry.inlineInsertion || resolveFormatInline(entry));
      if (inline) setDraft((d) => (d || '') + inline);
      setCitation('');
      setAnnotation('');
      setMatches(null);
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
        onChange={(e) => { setCitation(e.target.value); setMatches(null); }}
        placeholder="Full APA 7 citation, or paste a DOI / URL."
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
      />
      <textarea
        value={annotation}
        onChange={(e) => setAnnotation(e.target.value)}
        placeholder="Annotation: why is this source relevant? (2-3 sentences)"
        rows={2}
        style={{ width: '100%', background: t.card, border: `1px solid ${t.border}`, borderRadius: 4, padding: '8px 12px', color: t.ink, fontFamily: t.font, fontSize: 14, marginBottom: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
      />

      {matches && matches.length > 0 && (
        <div style={{ marginBottom: 8, border: `1px solid ${t.good}44`, background: '#ecfdf5', borderRadius: 4, padding: 8 }}>
          <div style={{ fontFamily: t.mono, fontSize: 9, color: t.good, letterSpacing: '0.1em', marginBottom: 6 }}>
            ALREADY IN THE BIBLIOGRAPHY · {matches.length} MATCH{matches.length === 1 ? '' : 'ES'}
          </div>
          {matches.map((m) => (
            <div key={m.id || (m.citation_key + m.title)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <button
                onClick={() => useExisting(m)}
                style={{ flex: '0 0 auto', background: t.good, color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontFamily: t.mono, fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em' }}
              >
                USE THIS
              </button>
              <div style={{ fontFamily: t.font, fontSize: 13, color: t.ink, lineHeight: 1.4 }}>
                <strong>{firstAuthorSurname(m.authors) || m.citation_key || 'Source'}</strong>
                {m.year ? `, ${m.year}` : ''} — {m.title || m.citation || '(no title)'}
                {m.doi && (
                  <a
                    href={doiToUrl(m.doi_url || m.doi)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 6, color: t.accent, fontSize: 11 }}
                  >doi</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={runSearchOrSave}
          disabled={!canAct}
          style={{ background: t.accent, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canAct ? 'pointer' : 'default', opacity: canAct ? 1 : 0.4 }}
        >
          {status === 'searching' ? 'SEARCHING…' : status === 'saving' ? 'SAVING…' : matches === null ? 'CHECK + SAVE' : 'ADD NEW ANYWAY'}
        </button>
        {matches && matches.length === 0 && status === 'idle' && (
          <span style={{ color: t.good, fontFamily: t.mono, fontSize: 10 }}>NO EXISTING MATCH · CLICK TO ADD</span>
        )}
        {status === 'error' && (
          <span style={{ color: '#b91c1c', fontFamily: t.mono, fontSize: 10 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Build a patch from an enrichment result, only overwriting fields that
 * matter and only if confidence is high enough. Missing verification
 * bumps to 'verified' at threshold.
 */
function buildPatch(enriched, threshold) {
  if (!enriched) return null;
  const confidence = Number(enriched.matchConfidence ?? 0);
  const patch = {};
  if (enriched.doi) patch.doi = String(enriched.doi);
  if (enriched.url) patch.url = String(enriched.url);
  if (enriched.title) patch.title = String(enriched.title);
  if (enriched.year) patch.year = Number(enriched.year);
  if (enriched.abstract) patch.abstract = String(enriched.abstract);
  if (enriched.venue) patch.source = String(enriched.venue);
  if (enriched.authors) {
    patch.authors = Array.isArray(enriched.authors)
      ? enriched.authors.join(', ')
      : String(enriched.authors);
  }
  if (confidence >= threshold) patch.verification_status = 'verified';
  return Object.keys(patch).length ? patch : null;
}

export function referencePlugin({
  adapter,
  enrichmentAdapter,
  label = '+ REFERENCE',
  color = '#6366f1',
  theme,
  insertInline,
  formatInline,
  confidenceThreshold = 0.7,
} = {}) {
  return {
    key: 'reference',
    label,
    color,
    title: 'Add a source. If it already exists in the bibliography, link to it; otherwise create + enrich.',
    panel: (props) => (
      <ReferencePanel
        {...props}
        adapter={adapter}
        enrichmentAdapter={enrichmentAdapter}
        theme={theme}
        insertInline={insertInline}
        formatInline={formatInline}
        confidenceThreshold={confidenceThreshold}
      />
    ),
  };
}
