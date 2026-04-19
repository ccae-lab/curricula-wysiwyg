/**
 * Citation parsing helpers shared across the bibliography plugin,
 * adapters, and any host-side code that needs to reason about APA-ish
 * strings. Pure functions, no React, no fetch — safe to unit-test.
 */

/**
 * Extract a DOI from free text. Recognises bare DOIs (10.xxxx/...) and
 * URL forms (doi.org/..., dx.doi.org/...). Returns null when none.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function extractDoi(text) {
  if (!text) return null;
  const m = String(text).match(
    /\b(?:doi:?\s*)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9%]+)/i
  );
  if (!m) return null;
  // Strip trailing punctuation that frequently glues on to the match.
  return m[1].replace(/[.,;)\]]+$/, '');
}

/**
 * Normalise a DOI to a hyperlink. Accepts bare DOI or URL.
 */
export function doiToUrl(doi) {
  if (!doi) return null;
  const s = String(doi).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://doi.org/${s.replace(/^doi:/i, '')}`;
}

/**
 * Best-effort parse of an APA-7-ish citation.
 *
 * Input examples we handle cleanly:
 *   "Meadows, D. H. (2008). Thinking in systems. Chelsea Green."
 *   "Freire, P. (1970). Pedagogy of the oppressed. Continuum."
 *
 * When we cannot detect a year the whole string becomes `title` and the
 * other fields are null. That keeps the row useful for a human to tidy.
 *
 * @param {string} raw
 * @returns {{ authors: string|null, year: number|null, title: string, source: string|null, doi: string|null }}
 */
export function parseAPA(raw) {
  const text = (raw || '').trim();
  if (!text) {
    return { authors: null, year: null, title: '', source: null, doi: null };
  }
  const doi = extractDoi(text);
  const yearMatch = text.match(/\((\d{4}[a-z]?)\)/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  if (!yearMatch) {
    return { authors: null, year: null, title: text, source: null, doi };
  }

  const authors = text.slice(0, yearMatch.index).replace(/[.,\s]+$/, '').trim() || null;
  const afterYear = text
    .slice(yearMatch.index + yearMatch[0].length)
    .replace(/^[.,\s]+/, '')
    .trim();
  const parts = afterYear.split('.').map((p) => p.trim()).filter(Boolean);
  const title = parts.length > 0 ? parts[0] : afterYear || text;
  const source = parts.length > 1 ? parts.slice(1).join('. ').trim() : null;

  return { authors, year, title, source: source || null, doi };
}

/**
 * First author's surname suitable for short labels ("Meadows", "Fals Borda").
 * Falls back to a sensible default when the name is missing or parsed wrong.
 */
export function firstAuthorSurname(authors) {
  if (!authors) return null;
  const src = Array.isArray(authors) ? authors[0] : String(authors).split(/;|,\s(?=[A-Z])|&/)[0];
  if (!src) return null;
  const tokens = src.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  // Last token is usually the surname in "Given M. Surname"; when the
  // name was already "Surname, G." splitting by ", " keeps the surname first.
  const first = tokens[0];
  if (first.endsWith(',')) return first.replace(/,$/, '');
  return tokens[tokens.length - 1];
}

/**
 * Canonical inline link for an entry. Exported so adapters can opt in to
 * the same formatting without re-implementing it.
 *
 *   { authors: 'Meadows, D. H.', year: 2008, doi: '10.1000/xyz' }
 *       → " [Meadows, 2008](https://doi.org/10.1000/xyz)"
 *
 *   { doi: '10.1000/xyz' } (enrichment failed, all we have is the DOI)
 *       → " [10.1000/xyz](https://doi.org/10.1000/xyz)"
 *
 * Falls back to a short title or the raw citation when nothing else is
 * available, so we never emit the mystery "Source, n.d." string.
 */
export function defaultFormatInline(entry) {
  if (!entry) return '';
  const surname = firstAuthorSurname(entry.authors);
  const year = entry.year || null;
  const href = doiToUrl(entry.doi_url || entry.doi) || entry.url || null;

  if (surname && year) {
    return href ? ` [${surname}, ${year}](${href})` : ` (${surname}, ${year})`;
  }
  if (surname) {
    return href ? ` [${surname}, n.d.](${href})` : ` (${surname}, n.d.)`;
  }
  if (entry.doi || entry.doi_url) {
    const bareDoi = String(entry.doi || entry.doi_url).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    return ` [${bareDoi}](${href || doiToUrl(bareDoi)})`;
  }
  if (entry.title) {
    const short = entry.title.length > 60 ? `${entry.title.slice(0, 57)}…` : entry.title;
    return href ? ` [${short}](${href})` : ` (${short})`;
  }
  if (entry.citation) {
    const short = entry.citation.length > 60 ? `${entry.citation.slice(0, 57)}…` : entry.citation;
    return href ? ` [${short}](${href})` : ` (${short})`;
  }
  return ' (reference)';
}
