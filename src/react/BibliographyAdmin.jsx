import React, { useEffect, useMemo, useState } from 'react';
import {
  parseAPA,
  firstAuthorSurname,
  doiToUrl,
  extractDoi,
} from '../citations/helpers.js';

/**
 * BibliographyAdmin (0.5.0)
 *
 * Shared data-cleansing dashboard for a project's bibliography. Renders
 * a filter bar (counts per health condition), a row grid with legacy-row
 * parse fallback, per-row Enrich (OpenAlex-backed via EnrichmentAdapter)
 * and an inline annotation editor.
 *
 * Required adapter shape:
 *   bibliographyAdapter.listReferences(opts) => entry[]
 *   bibliographyAdapter.updateReference(id, patch) => entry | void
 *   bibliographyAdapter.enrichReference(id, patch) => entry | void      (optional, used by Enrich)
 *
 * Optional:
 *   enrichmentAdapter.enrich({ citation, doi }) => enrichment result
 *
 * Everything is adapter-owned: the component doesn't know the schema.
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
  warn: '#d97706',
  bad: '#b91c1c',
  bg: '#f5f5f0',
};

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const DEFAULT_FILTERS = [
  { id: 'all',             label: 'All',            match: () => true },
  { id: 'pending',         label: 'Unverified',     match: (r) => (r.verification_status || 'pending') !== 'verified' },
  { id: 'verified',        label: 'Verified',       match: (r) => r.verification_status === 'verified' },
  { id: 'no-doi',          label: 'No DOI',         match: (r) => !(r.doi || r.doi_url) },
  { id: 'no-authors',      label: 'No authors',     match: (r) => !r.authors },
  { id: 'no-annotation',   label: 'No annotation',  match: (r) => !r.annotation },
  { id: 'stale',           label: 'Stale (>2y)',    match: (r) => r.created_at && (Date.now() - new Date(r.created_at).getTime()) > TWO_YEARS_MS },
];

function displayRow(row) {
  if (!row) return null;
  const needsParse = row.citation && !row.authors && !row.year && !row.title
    && !row.doi && !row.doi_url;
  const parsed = needsParse ? parseAPA(row.citation) : null;
  return {
    authors: row.authors || parsed?.authors || null,
    year: row.year || parsed?.year || null,
    title: row.title || parsed?.title || row.citation || '(no title)',
    doi: row.doi || row.doi_url || parsed?.doi || null,
  };
}

export default function BibliographyAdmin({
  adapter,
  enrichmentAdapter,
  filters = DEFAULT_FILTERS,
  pageSize = 25,
  theme,
  confidenceThreshold = 0.7,
  title = 'Bibliography admin',
}) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterId, setFilterId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowState, setRowState] = useState({}); // id -> { annotation, annotationDirty, status, enrichPreview }

  useEffect(() => {
    if (!adapter || typeof adapter.listReferences !== 'function') {
      setError('Adapter does not support listReferences.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.resolve(adapter.listReferences({ limit: 1000, descending: true, orderBy: 'created_at' }))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setRows(list);
        // Seed rowState with annotations for dirty tracking.
        const seed = {};
        for (const r of list) {
          if (r?.id != null) seed[r.id] = { annotation: r.annotation || '', annotationDirty: false, status: 'idle' };
        }
        setRowState(seed);
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load bibliography.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adapter]);

  const filterCounts = useMemo(() => {
    const out = {};
    for (const f of filters) out[f.id] = rows.filter(f.match).length;
    return out;
  }, [rows, filters]);

  const activeFilter = filters.find((f) => f.id === filterId) || filters[0];

  const filtered = useMemo(() => {
    let list = rows.filter(activeFilter.match);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => {
        const hay = [r.authors, r.title, r.citation, r.citation_key, r.annotation]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, activeFilter, search]);

  useEffect(() => { setPage(0); }, [filterId, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function patchRowState(id, patch) {
    setRowState((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  function applyRowPatch(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function onSaveAnnotation(row) {
    if (!adapter || typeof adapter.updateReference !== 'function') return;
    const state = rowState[row.id] || {};
    if (!state.annotationDirty) return;
    patchRowState(row.id, { status: 'saving', error: null });
    try {
      const updated = await adapter.updateReference(row.id, { annotation: state.annotation || null });
      const next = (updated && typeof updated === 'object') ? updated : { ...row, annotation: state.annotation };
      applyRowPatch(row.id, next);
      patchRowState(row.id, { annotation: next.annotation || '', annotationDirty: false, status: 'done' });
    } catch (err) {
      patchRowState(row.id, { status: 'error', error: err?.message || 'Save failed' });
    }
  }

  async function onEnrich(row) {
    if (!enrichmentAdapter || typeof enrichmentAdapter.enrich !== 'function') return;
    patchRowState(row.id, { status: 'enriching', error: null });
    try {
      const citationText = row.citation || [row.authors, row.year, row.title].filter(Boolean).join(' ');
      const doi = row.doi || row.doi_url || extractDoi(citationText || '');
      const enriched = await enrichmentAdapter.enrich({ citation: citationText, doi });
      if (!enriched) {
        patchRowState(row.id, { status: 'no-match', enrichPreview: null });
        return;
      }
      patchRowState(row.id, { status: 'enrich-preview', enrichPreview: enriched, error: null });
    } catch (err) {
      patchRowState(row.id, { status: 'error', error: err?.message || 'Enrichment failed' });
    }
  }

  async function applyEnrichment(row) {
    const state = rowState[row.id];
    const enriched = state?.enrichPreview;
    if (!enriched) return;
    const patch = buildPatch(enriched, row, confidenceThreshold);
    if (!patch) {
      patchRowState(row.id, { status: 'no-match', enrichPreview: null });
      return;
    }
    patchRowState(row.id, { status: 'saving' });
    try {
      const updater = adapter.updateReference || adapter.enrichReference;
      if (typeof updater !== 'function') throw new Error('Adapter cannot write.');
      const updated = await updater.call(adapter, row.id, patch);
      const next = (updated && typeof updated === 'object') ? updated : { ...row, ...patch };
      applyRowPatch(row.id, next);
      patchRowState(row.id, {
        annotation: next.annotation || '',
        annotationDirty: false,
        status: 'done',
        enrichPreview: null,
      });
    } catch (err) {
      patchRowState(row.id, { status: 'error', error: err?.message || 'Save failed' });
    }
  }

  async function applyAllConfident() {
    if (!enrichmentAdapter) return;
    const targets = filtered.filter((r) => {
      if (r.verification_status === 'verified') return false;
      return true;
    });
    for (const row of targets) {
      // Skip if already enriching or just done
      const state = rowState[row.id];
      if (state?.status === 'enriching' || state?.status === 'saving') continue;
      patchRowState(row.id, { status: 'enriching', error: null });
      try {
        const citationText = row.citation || [row.authors, row.year, row.title].filter(Boolean).join(' ');
        const doi = row.doi || row.doi_url || extractDoi(citationText || '');
        const enriched = await enrichmentAdapter.enrich({ citation: citationText, doi });
        if (!enriched || Number(enriched.matchConfidence || 0) < confidenceThreshold) {
          patchRowState(row.id, { status: 'idle', error: null });
          continue;
        }
        const patch = buildPatch(enriched, row, confidenceThreshold);
        if (!patch) {
          patchRowState(row.id, { status: 'idle' });
          continue;
        }
        const updater = adapter.updateReference || adapter.enrichReference;
        const updated = await updater.call(adapter, row.id, patch);
        const next = (updated && typeof updated === 'object') ? updated : { ...row, ...patch };
        applyRowPatch(row.id, next);
        patchRowState(row.id, { annotation: next.annotation || '', annotationDirty: false, status: 'done' });
      } catch (err) {
        patchRowState(row.id, { status: 'error', error: err?.message || 'Enrichment failed' });
      }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, fontFamily: t.mono, fontSize: 12, color: t.muted }}>
        LOADING BIBLIOGRAPHY…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: t.mono, fontSize: 12, color: t.bad }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ background: t.bg, borderRadius: 6, padding: 16, fontFamily: t.font, color: t.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: '0.1em' }}>
          {title.toUpperCase()} · {rows.length} ROWS
        </div>
        {enrichmentAdapter && (
          <button
            onClick={applyAllConfident}
            style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontFamily: t.mono, fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em' }}
          >
            ENRICH ALL UNVERIFIED (CONFIDENT)
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {filters.map((f) => {
          const active = filterId === f.id;
          const count = filterCounts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => setFilterId(f.id)}
              style={{
                background: active ? `${t.accent}18` : 'none',
                border: `1px solid ${active ? t.accent : t.border}`,
                borderRadius: 4,
                padding: '4px 10px',
                color: active ? t.accent : t.muted,
                fontFamily: t.mono,
                fontSize: 9,
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              {f.label.toUpperCase()} · {count}
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by author, title, citation text, annotation…"
        style={{
          width: '100%',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 4,
          padding: '8px 12px',
          color: t.ink,
          fontFamily: t.font,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 10,
        }}
      />

      {filtered.length === 0 && (
        <div style={{ padding: 24, fontFamily: t.mono, fontSize: 11, color: t.muted, textAlign: 'center' }}>
          NO ROWS MATCH THIS FILTER.
        </div>
      )}

      {pageRows.map((row) => {
        const d = displayRow(row);
        const surname = firstAuthorSurname(d.authors) || row.citation_key || null;
        const href = doiToUrl(d.doi);
        const state = rowState[row.id] || {};
        const verified = row.verification_status === 'verified';
        return (
          <div
            key={row.id}
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 9,
                      color: verified ? t.good : t.warn,
                      background: verified ? `${t.good}12` : `${t.warn}12`,
                      border: `1px solid ${verified ? t.good : t.warn}44`,
                      borderRadius: 2,
                      padding: '2px 6px',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {verified ? 'VERIFIED' : (row.verification_status || 'PENDING').toUpperCase()}
                  </span>
                  <strong style={{ fontSize: 14 }}>{surname || '—'}</strong>
                  {d.year && <span style={{ color: t.muted, fontSize: 13 }}>, {d.year}</span>}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: t.accent, fontSize: 11, fontFamily: t.mono, letterSpacing: '0.05em' }}
                    >doi</a>
                  )}
                </div>
                <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.5, marginTop: 4 }}>
                  {d.title}
                </div>
                {row.source && (
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{row.source}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                {enrichmentAdapter && (
                  <button
                    onClick={() => onEnrich(row)}
                    disabled={state.status === 'enriching' || state.status === 'saving'}
                    style={{
                      background: t.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 3,
                      padding: '4px 10px',
                      fontFamily: t.mono,
                      fontSize: 9,
                      cursor: 'pointer',
                      letterSpacing: '0.08em',
                      opacity: (state.status === 'enriching' || state.status === 'saving') ? 0.5 : 1,
                    }}
                  >
                    {state.status === 'enriching' ? 'CHECKING…' : 'ENRICH'}
                  </button>
                )}
              </div>
            </div>

            {state.enrichPreview && state.status === 'enrich-preview' && (
              <div style={{ marginTop: 8, background: `${t.accent}10`, border: `1px solid ${t.accent}44`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.08em', marginBottom: 4 }}>
                  OPENALEX MATCH · CONFIDENCE {(Number(state.enrichPreview.matchConfidence || 0) * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 6 }}>
                  <strong>{firstAuthorSurname(Array.isArray(state.enrichPreview.authors) ? state.enrichPreview.authors.join(', ') : state.enrichPreview.authors) || '—'}</strong>
                  {state.enrichPreview.year ? `, ${state.enrichPreview.year}` : ''} — {state.enrichPreview.title || '—'}
                  {state.enrichPreview.venue && <div style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>{state.enrichPreview.venue}</div>}
                  {state.enrichPreview.doi && (
                    <div style={{ marginTop: 2 }}>
                      <a href={doiToUrl(state.enrichPreview.doi)} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, fontSize: 11, fontFamily: t.mono }}>
                        doi.org/{state.enrichPreview.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}
                      </a>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => applyEnrichment(row)}
                    style={{ background: t.good, color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', fontFamily: t.mono, fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em' }}
                  >
                    APPLY
                  </button>
                  <button
                    onClick={() => patchRowState(row.id, { status: 'idle', enrichPreview: null })}
                    style={{ background: 'none', color: t.muted, border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 10px', fontFamily: t.mono, fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em' }}
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            )}

            {state.status === 'no-match' && (
              <div style={{ marginTop: 6, fontFamily: t.mono, fontSize: 10, color: t.muted, letterSpacing: '0.05em' }}>
                NO OPENALEX MATCH.
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: t.mono, fontSize: 9, color: t.muted, letterSpacing: '0.08em', marginBottom: 4 }}>
                ANNOTATION
              </div>
              <textarea
                value={state.annotation ?? row.annotation ?? ''}
                onChange={(e) => patchRowState(row.id, { annotation: e.target.value, annotationDirty: e.target.value !== (row.annotation || ''), status: 'idle' })}
                placeholder="Why is this source relevant? (2-3 sentences)"
                rows={2}
                style={{
                  width: '100%',
                  background: t.card2,
                  border: `1px solid ${t.border}`,
                  borderRadius: 4,
                  padding: '8px 10px',
                  color: t.ink,
                  fontFamily: t.font,
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                <button
                  onClick={() => onSaveAnnotation(row)}
                  disabled={!state.annotationDirty || state.status === 'saving'}
                  style={{
                    background: state.annotationDirty ? t.good : 'none',
                    color: state.annotationDirty ? '#fff' : t.muted,
                    border: state.annotationDirty ? 'none' : `1px solid ${t.border}`,
                    borderRadius: 3,
                    padding: '4px 10px',
                    fontFamily: t.mono,
                    fontSize: 9,
                    cursor: state.annotationDirty ? 'pointer' : 'default',
                    letterSpacing: '0.08em',
                  }}
                >
                  {state.status === 'saving' ? 'SAVING…' : 'SAVE ANNOTATION'}
                </button>
                {state.error && (
                  <span style={{ color: t.bad, fontFamily: t.mono, fontSize: 10 }}>{state.error}</span>
                )}
                {state.status === 'done' && !state.annotationDirty && (
                  <span style={{ color: t.good, fontFamily: t.mono, fontSize: 10 }}>SAVED</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 10px', fontFamily: t.mono, fontSize: 10, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
          >
            ← PREV
          </button>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.muted }}>
            PAGE {page + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 3, padding: '4px 10px', fontFamily: t.mono, fontSize: 10, cursor: page >= pageCount - 1 ? 'default' : 'pointer', opacity: page >= pageCount - 1 ? 0.4 : 1 }}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}

function buildPatch(enriched, baseline, threshold) {
  if (!enriched) return null;
  const confidence = Number(enriched.matchConfidence || 0);
  const patch = {};
  if (enriched.doi && !(baseline.doi || baseline.doi_url)) patch.doi = String(enriched.doi);
  if (enriched.url && !baseline.url) patch.url = String(enriched.url);
  if (enriched.title && !baseline.title) patch.title = String(enriched.title);
  if (enriched.year && !baseline.year) patch.year = Number(enriched.year);
  if (enriched.abstract && !baseline.abstract) patch.abstract = String(enriched.abstract);
  if (enriched.venue && !baseline.source) patch.source = String(enriched.venue);
  if (enriched.authors && !baseline.authors) {
    patch.authors = Array.isArray(enriched.authors)
      ? enriched.authors.join(', ')
      : String(enriched.authors);
  }
  if (confidence >= threshold) patch.verification_status = 'verified';
  return Object.keys(patch).length ? patch : null;
}
