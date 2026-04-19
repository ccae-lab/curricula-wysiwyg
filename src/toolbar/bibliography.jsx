import React, { useState } from 'react';
import {
  parseAPA,
  extractDoi,
  firstAuthorSurname,
  doiToUrl,
  defaultFormatInline,
} from '../citations/helpers.js';

/**
 * referencePlugin: +REFERENCE toolbar button (0.3.1).
 *
 * Flow:
 *   1. CHECK: user types citation/DOI/title, clicks CHECK. The plugin
 *      runs `searchReferences` (dedupe) and `enrich` (metadata lookup)
 *      in parallel, then shows whichever applies.
 *   2. If existing matches surface, the user clicks USE THIS to insert
 *      a formatted link and skip the write.
 *   3. If enrichment returned metadata, the preview card shows the
 *      proposed "Author, Year — Title" plus the inline link the user is
 *      about to drop. User confirms with SAVE, which calls `addReference`
 *      with the enriched fields merged in (so the row lands fully-formed
 *      on first write) and then `enrichReference` if any more fields
 *      came back. No second network dance post-write.
 *   4. If nothing enriched (confidence too low or no match), SAVE still
 *      works — the raw citation is saved, and the inline format falls
 *      back to DOI / title / citation (see defaultFormatInline).
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
  const [matches, setMatches] = useState(null);
  const [enrichment, setEnrichment] = useState(null); // { result, confidence }
  const [checked, setChecked] = useState(false);

  const t = {
    mono: "'SF Mono', 'Fira Code', Menlo, monospace",
    font: "'Inter', 'Segoe UI', sans-serif",
    bg: '#f5f5f0',
    card: '#fafaf7',
    border: '#e5e3db',
    ink: '#1a1a1a',
    accent: '#6366f1',
    good: '#059669',
    muted: '#6b7280',
    ...(theme || {}),
  };

  const resolveFormatInline = (entry) => {
    if (formatInline) return formatInline(entry);
    if (adapter?.formatInline) return adapter.formatInline(entry);
    return defaultFormatInline(entry);
  };

  /** Merge parsed + enriched into a row for preview / save. */
  const composeEntry = () => {
    const parsed = parseAPA(citation);
    const doi = extractDoi(citation) || parsed.doi || null;
    const base = {
      citation: citation.trim(),
      authors: parsed.authors || null,
      year: parsed.year || null,
      title: parsed.title || null,
      source: parsed.source || null,
      doi: doi,
      url: null,
      abstract: null,
    };
    if (!enrichment || !enrichment.result) return base;
    const e = enrichment.result;
    const authors = Array.isArray(e.authors) ? e.authors.join(', ') : (e.authors || null);
    return {
      ...base,
      authors: authors || base.authors,
      year: e.year || base.year,
      title: e.title || base.title,
      source: e.venue || base.source,
      doi: e.doi || base.doi,
      url: e.url || base.url,
      abstract: e.abstract || base.abstract,
    };
  };

  const canAct = citation.trim().length > 0 && status !== 'checking' && status !== 'saving';

  async function runCheck() {
    if (!canAct) return;
    if (!adapter || typeof adapter.addReference !== 'function') {
      setError('No bibliography adapter configured.');
      setStatus('error');
      return;
    }
    setError(null);
    setStatus('checking');

    const parsed = parseAPA(citation);
    const searchArgs = {
      citation: citation.trim(),
      doi: extractDoi(citation) || parsed.doi || undefined,
      firstAuthor: firstAuthorSurname(parsed.authors) || undefined,
      year: parsed.year || undefined,
      title: parsed.title || undefined,
    };

    const searchP = typeof adapter.searchReferences === 'function'
      ? adapter.searchReferences(searchArgs).catch((err) => {
          console.warn('[referencePlugin] searchReferences failed:', err);
          return [];
        })
      : Promise.resolve([]);

    const enrichP = enrichmentAdapter && typeof enrichmentAdapter.enrich === 'function'
      ? enrichmentAdapter.enrich({ citation: citation.trim(), doi: searchArgs.doi }).catch((err) => {
          console.warn('[referencePlugin] enrichment failed:', err);
          return null;
        })
      : Promise.resolve(null);

    const [foundList, enriched] = await Promise.all([searchP, enrichP]);
    setMatches(Array.isArray(foundList) ? foundList : []);
    setEnrichment(enriched && typeof enriched === 'object'
      ? { result: enriched, confidence: Number(enriched.matchConfidence || 0) }
      : null);
    setChecked(true);
    setStatus('idle');
  }

  async function useExisting(entry) {
    if (status === 'saving') return;
    const inline = insertInline
      ? insertInline({ citation: citation.trim(), result: entry, existing: true })
      : resolveFormatInline(entry);
    if (inline) setDraft((d) => (d || '') + inline);
    resetAndClose();
  }

  async function saveNew() {
    if (!adapter) return;
    setStatus('saving');
    try {
      const composed = composeEntry();
      const confidence = enrichment?.confidence || 0;

      // Add the row with everything we know upfront, so formatInline
      // works correctly whether or not a second enrichReference runs.
      const created = await adapter.addReference({
        citation: composed.citation,
        annotation: annotation.trim() || undefined,
        year: composed.year || undefined,
        // Adapters that accept extra fields can consume these via meta.
        meta: {
          authors: composed.authors,
          title: composed.title,
          source: composed.source,
          doi: composed.doi,
          url: composed.url,
          abstract: composed.abstract,
          verification_status: confidence >= confidenceThreshold ? 'verified' : undefined,
        },
      });
      let entry = (created && typeof created === 'object') ? created : composed;

      // If the adapter's addReference didn't absorb the extra fields,
      // patch them in via enrichReference so the stored row is complete.
      if (
        enrichment?.result &&
        entry.id &&
        typeof adapter.enrichReference === 'function' &&
        rowNeedsPatch(entry, composed, confidence, confidenceThreshold)
      ) {
        const patch = buildPatch(enrichment.result, composed, confidence, confidenceThreshold);
        if (patch) {
          try {
            const updated = await adapter.enrichReference(entry.id, patch);
            if (updated && typeof updated === 'object') entry = updated;
            else entry = { ...entry, ...patch };
          } catch (err) {
            console.warn('[referencePlugin] enrichReference failed:', err);
            entry = { ...entry, ...patch };
          }
        }
      } else if (!entry.authors && composed.authors) {
        // Adapter returned something shallow; union with composed so
        // the inline formatter has good data.
        entry = { ...composed, ...entry, authors: entry.authors || composed.authors };
      }

      const inline = insertInline
        ? insertInline({ citation: composed.citation, result: entry, existing: false })
        : (entry.inlineInsertion || resolveFormatInline(entry));
      if (inline) setDraft((d) => (d || '') + inline);
      resetAndClose();
    } catch (err) {
      setError(err?.message || 'Save failed');
      setStatus('error');
    }
  }

  function resetAndClose() {
    setCitation('');
    setAnnotation('');
    setMatches(null);
    setEnrichment(null);
    setChecked(false);
    setStatus('done');
    onClose?.();
  }

  const previewEntry = composeEntry();
  const preview = resolveFormatInline(previewEntry).trim();

  return (
    <div style={{ background: t.bg, border: `1px solid ${t.accent}44`, borderRadius: 6, padding: 16, marginTop: 12 }}>
      <div style={{ fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.1em', marginBottom: 10 }}>
        ADD TO SHARED BIBLIOGRAPHY (APA 7)
      </div>
      <input
        value={citation}
        onChange={(e) => {
          setCitation(e.target.value);
          setMatches(null);
          setEnrichment(null);
          setChecked(false);
        }}
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
                {(m.doi_url || m.doi) && (
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

      {checked && enrichment?.result && (
        <div style={{ marginBottom: 8, border: `1px solid ${t.accent}44`, background: '#eef2ff', borderRadius: 4, padding: 8 }}>
          <div style={{ fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.1em', marginBottom: 6 }}>
            ENRICHED FROM OPENALEX · CONFIDENCE {(enrichment.confidence * 100).toFixed(0)}%
          </div>
          <div style={{ fontFamily: t.font, fontSize: 13, color: t.ink, lineHeight: 1.4 }}>
            <div><strong>{firstAuthorSurname(previewEntry.authors) || '—'}</strong>{previewEntry.year ? `, ${previewEntry.year}` : ''} · {previewEntry.title || previewEntry.citation}</div>
            {previewEntry.source && <div style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>{previewEntry.source}</div>}
          </div>
        </div>
      )}

      {checked && !enrichment?.result && (
        <div style={{ marginBottom: 8, fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: '0.05em' }}>
          NO ENRICHMENT FOUND · WILL SAVE AS TYPED
        </div>
      )}

      {checked && preview && (
        <div style={{ marginBottom: 8, fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: '0.05em' }}>
          INLINE PREVIEW: <span style={{ color: t.ink, fontFamily: t.font, fontSize: 13 }}>{preview}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {!checked && (
          <button
            onClick={runCheck}
            disabled={!canAct}
            style={{ background: t.accent, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canAct ? 'pointer' : 'default', opacity: canAct ? 1 : 0.4 }}
          >
            {status === 'checking' ? 'CHECKING…' : 'CHECK SOURCE'}
          </button>
        )}
        {checked && (
          <button
            onClick={saveNew}
            disabled={!canAct}
            style={{ background: t.good, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canAct ? 'pointer' : 'default', opacity: canAct ? 1 : 0.4 }}
          >
            {status === 'saving' ? 'SAVING…' : 'SAVE REFERENCE'}
          </button>
        )}
        {status === 'error' && (
          <span style={{ color: '#b91c1c', fontFamily: t.mono, fontSize: 10 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

function rowNeedsPatch(stored, composed, confidence, threshold) {
  if (!stored) return false;
  if (!stored.authors && composed.authors) return true;
  if (!stored.year && composed.year) return true;
  if (!stored.title && composed.title) return true;
  if (!stored.doi && composed.doi) return true;
  if (!stored.abstract && composed.abstract) return true;
  if (confidence >= threshold && stored.verification_status !== 'verified') return true;
  return false;
}

function buildPatch(enriched, composed, confidence, threshold) {
  if (!enriched && !composed) return null;
  const patch = {};
  const authors = enriched?.authors
    ? (Array.isArray(enriched.authors) ? enriched.authors.join(', ') : String(enriched.authors))
    : composed.authors;
  if (authors) patch.authors = authors;
  if (enriched?.year || composed.year) patch.year = Number(enriched?.year || composed.year);
  if (enriched?.title || composed.title) patch.title = String(enriched?.title || composed.title);
  if (enriched?.doi || composed.doi) patch.doi = String(enriched?.doi || composed.doi);
  if (enriched?.url || composed.url) patch.url = String(enriched?.url || composed.url);
  if (enriched?.abstract || composed.abstract) patch.abstract = String(enriched?.abstract || composed.abstract);
  if (enriched?.venue || composed.source) patch.source = String(enriched?.venue || composed.source);
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
    title: 'Add a source. Check first (OpenAlex + existing refs), then save with enriched APA metadata.',
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
