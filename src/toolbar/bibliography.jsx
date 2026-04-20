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

  /** Merge parsed + (optionally) enriched into a row for preview / save. */
  const composeEntry = (enrichmentOverride) => {
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
    // Allow caller to pass `null` to explicitly skip enrichment merge.
    const source = enrichmentOverride === undefined
      ? (enrichment?.result || null)
      : enrichmentOverride;
    if (!source) return base;
    const e = source;
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
    let resolved = entry;

    // If the existing row is a legacy-style bibliography entry (only the
    // free-text `citation` field, no structured authors/year/doi), try to
    // enrich it on-demand so we can emit a proper APA link with a DOI
    // hyperlink. Upgrade the stored row too, so this one-time cost isn't
    // repeated for the next editor.
    const needsEnrich = enrichmentAdapter
      && typeof enrichmentAdapter.enrich === 'function'
      && entry
      && entry.citation
      && (!entry.authors || !entry.year || !(entry.doi || entry.doi_url));
    if (needsEnrich) {
      setStatus('saving');
      try {
        const seedDoi = extractDoi(entry.citation) || entry.doi || entry.doi_url || undefined;
        const enriched = await enrichmentAdapter.enrich({
          citation: entry.citation,
          doi: seedDoi,
        });
        if (enriched && typeof enriched === 'object') {
          const confidence = Number(enriched.matchConfidence || 0);
          const parsed = parseAPA(entry.citation);
          const baseline = {
            authors: entry.authors || parsed.authors,
            year: entry.year || parsed.year,
            title: entry.title || parsed.title,
            source: entry.source || parsed.source,
            doi: entry.doi || entry.doi_url || parsed.doi,
          };
          const patch = buildPatch(enriched, baseline, confidence, confidenceThreshold);
          if (patch && entry.id && typeof adapter.enrichReference === 'function') {
            try {
              const updated = await adapter.enrichReference(entry.id, patch);
              if (updated && typeof updated === 'object') resolved = updated;
              else resolved = { ...entry, ...patch };
            } catch (err) {
              console.warn('[referencePlugin] enrichReference failed on existing row:', err);
              resolved = { ...entry, ...patch };
            }
          } else if (patch) {
            resolved = { ...entry, ...patch };
          }
        }
      } catch (err) {
        console.warn('[referencePlugin] enrich-on-pick failed:', err);
      } finally {
        setStatus('idle');
      }
    }

    const inline = insertInline
      ? insertInline({ citation: citation.trim(), result: resolved, existing: true })
      : resolveFormatInline(resolved);
    if (inline) setDraft((d) => (d || '') + inline);
    resetAndClose();
  }

  async function saveNew(options) {
    if (!adapter) return;
    const ignoreEnrichment = !!(options && options.ignoreEnrichment);
    setStatus('saving');
    try {
      const composed = ignoreEnrichment
        ? composeEntry(null)
        : composeEntry();
      const confidence = ignoreEnrichment ? 0 : (enrichment?.confidence || 0);

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
          {matches.map((m) => {
            // Rescue legacy rows where authors/year/title were never
            // populated by parsing the free-text citation on-the-fly for
            // display. Keeps the row's identity (we still pass `m` to
            // useExisting so the real row gets enriched).
            const needsParse = m && m.citation
              && !m.authors && !m.year && !m.title
              && !m.doi && !m.doi_url;
            const display = needsParse ? parseAPA(m.citation) : m;
            const surname = firstAuthorSurname(display.authors) || m.citation_key || null;
            const titleText = display.title || m.citation || '(no title)';
            return (
              <div key={m.id || (m.citation_key + m.title)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                <button
                  onClick={() => useExisting(m)}
                  style={{ flex: '0 0 auto', background: t.good, color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontFamily: t.mono, fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em' }}
                >
                  USE THIS
                </button>
                <div style={{ fontFamily: t.font, fontSize: 13, color: t.ink, lineHeight: 1.4 }}>
                  <strong>{surname || '—'}</strong>
                  {display.year ? `, ${display.year}` : ''} — {titleText}
                  {(m.doi_url || m.doi || display.doi) && (
                    <a
                      href={doiToUrl(m.doi_url || m.doi || display.doi)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 6, color: t.accent, fontSize: 11 }}
                    >doi</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {checked && enrichment?.result && (
        <div style={{ marginBottom: 8, border: `1px solid ${t.accent}44`, background: '#eef2ff', borderRadius: 4, padding: 8 }}>
          <div style={{ fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.1em', marginBottom: 6 }}>
            FRESH FROM OPENALEX · CONFIDENCE {(enrichment.confidence * 100).toFixed(0)}%
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <button
              onClick={saveNew}
              disabled={!canAct}
              style={{ flex: '0 0 auto', background: t.accent, color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontFamily: t.mono, fontSize: 9, cursor: canAct ? 'pointer' : 'default', letterSpacing: '0.08em', opacity: canAct ? 1 : 0.4 }}
            >
              {status === 'saving' ? 'SAVING…' : 'USE THIS'}
            </button>
            <div style={{ fontFamily: t.font, fontSize: 13, color: t.ink, lineHeight: 1.4, flex: 1 }}>
              <div><strong>{firstAuthorSurname(previewEntry.authors) || '—'}</strong>{previewEntry.year ? `, ${previewEntry.year}` : ''} · {previewEntry.title || previewEntry.citation}</div>
              {previewEntry.source && <div style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>{previewEntry.source}</div>}
              {previewEntry.doi && (
                <div style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
                  <a href={doiToUrl(previewEntry.doi)} target="_blank" rel="noopener noreferrer" style={{ color: t.accent }}>doi.org/{previewEntry.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {checked && !enrichment?.result && (
        <div style={{ marginBottom: 8, fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: '0.05em' }}>
          NO OPENALEX MATCH · YOU CAN STILL ADD IT AS TYPED
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
            onClick={() => saveNew({ ignoreEnrichment: !!enrichment?.result })}
            disabled={!canAct}
            style={{ background: t.good, border: 'none', borderRadius: 3, padding: '5px 14px', color: '#fff', fontFamily: t.mono, fontSize: 10, cursor: canAct ? 'pointer' : 'default', opacity: canAct ? 1 : 0.4 }}
          >
            {status === 'saving' ? 'SAVING…' : (enrichment?.result ? 'ADD AS TYPED (IGNORE OPENALEX)' : 'ADD AS TYPED')}
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
