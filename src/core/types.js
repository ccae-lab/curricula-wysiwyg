/**
 * @curricula/wysiwyg — core type definitions and adapter interfaces.
 *
 * These are documented via JSDoc, not TypeScript, because the consuming
 * projects are plain JS React/Vite apps.
 */

/**
 * @typedef {Object} BlockEntry
 * @property {'text'|'link'|'image'|'json'} type
 * @property {*} value — string for text, { label, href } for link,
 *   { src, alt } for image, arbitrary object/array for json
 */

/**
 * @typedef {Object} AuthAdapter
 * @property {() => ({ email: string, id?: string } | null)} getUser
 * @property {() => boolean} canEdit
 * @property {() => string | null} getAccessToken
 */

/**
 * @typedef {Object} PersistenceAdapter
 * @property {(scope: Object) => Promise<Record<string, BlockEntry>>} fetchBlocks
 * @property {(scope: Object, editorEmail: string, blocks: Record<string, BlockEntry>) => Promise<void>} upsertBlocks
 * @property {(scope: Object, blockKey: string) => Promise<void>} deleteBlock
 */

/**
 * @typedef {Object} StorageAdapter
 * @property {(file: File) => Promise<string>} uploadImage — returns public URL
 */

/**
 * BibliographyAdapter (0.3.0)
 *
 * Persists a reference (academic source) into a project's bibliography
 * store. The shape of the target table is project-specific; the adapter
 * hides that.
 *
 * As of 0.3.0 the adapter grew three optional members so referencePlugin
 * can dedupe against existing entries and enrich newly-created rows
 * without duplicating logic per-site.
 *
 * @typedef {Object} BibliographyEntry
 * @property {string}   id
 * @property {string}  [citation_key]
 * @property {string}  [authors]
 * @property {number}  [year]
 * @property {string}  [title]
 * @property {string}  [doi]
 * @property {string}  [doi_url]
 * @property {string}  [url]
 * @property {string}  [abstract]
 * @property {string}  [annotation]
 * @property {string}  [verification_status]
 *
 * @typedef {Object} BibliographyInput
 * @property {string} citation — full source line as the user typed it
 * @property {string} [annotation] — optional annotation / why it matters
 * @property {number} [year] — parsed year if detectable
 * @property {Object} [meta] — arbitrary extra fields for the adapter
 *
 * @typedef {Object} BibliographyResult
 * @property {string} [id]
 * @property {string} [citation_key]
 * @property {string} [inlineInsertion] — adapter-controlled string to append to the draft
 *
 * @typedef {Object} BibliographySearchQuery
 * @property {string}  citation — the raw string the user typed
 * @property {string} [doi]
 * @property {string} [firstAuthor]
 * @property {number} [year]
 * @property {string} [title]
 *
 * @typedef {Object} BibliographyListOptions
 * @property {number} [limit]
 * @property {number} [offset]
 * @property {string} [orderBy]
 * @property {boolean} [descending]
 *
 * @typedef {Object} BibliographyAdapter
 * @property {(input: BibliographyInput) => Promise<BibliographyResult | BibliographyEntry | void>} addReference
 * @property {(q: BibliographySearchQuery) => Promise<BibliographyEntry[]>} [searchReferences]
 * @property {(entry: BibliographyEntry) => string} [formatInline]
 * @property {(id: string, patch: Partial<BibliographyEntry>) => Promise<BibliographyEntry | void>} [enrichReference]
 * @property {(opts?: BibliographyListOptions) => Promise<BibliographyEntry[]>} [listReferences]
 * @property {(id: string, patch: Partial<BibliographyEntry>) => Promise<BibliographyEntry | void>} [updateReference]
 * @property {(id: string) => Promise<void>} [deleteReference]
 */

/**
 * EnrichmentAdapter (0.3.0)
 *
 * Turns a raw citation string into structured metadata by calling an
 * academic API (OpenAlex, Crossref, Semantic Scholar, ...) or an LLM
 * provider. referencePlugin invokes it after a new row is created so
 * the site can upgrade the row's authors / year / title / doi / abstract
 * and flip verification_status to 'verified' when confidence is high.
 *
 * @typedef {Object} EnrichmentInput
 * @property {string} citation
 * @property {string} [doi]
 *
 * @typedef {Object} EnrichmentResult
 * @property {string}  [doi]
 * @property {string}  [url]
 * @property {string[]|string} [authors]
 * @property {number}  [year]
 * @property {string}  [title]
 * @property {string}  [abstract]
 * @property {string}  [venue]
 * @property {number}   matchConfidence — 0..1, plugin flips to verified at ≥ threshold
 *
 * @typedef {Object} EnrichmentAdapter
 * @property {(input: EnrichmentInput) => Promise<EnrichmentResult | null>} enrich
 */

/**
 * GlossaryAdapter
 *
 * Persists a glossary term + definition. Same logic as BibliographyAdapter:
 * hides schema differences between projects. The UI only needs term and
 * definition; the adapter decides what else to write.
 *
 * @typedef {Object} GlossaryInput
 * @property {string} term
 * @property {string} definition
 * @property {string} [category]
 * @property {Object} [meta]
 *
 * @typedef {Object} GlossaryResult
 * @property {string} [id]
 * @property {string} [term]
 * @property {string} [inlineInsertion] — adapter-controlled string to append to the draft
 *
 * @typedef {Object} GlossaryAdapter
 * @property {(input: GlossaryInput) => Promise<GlossaryResult | void>} addTerm
 */

export default {};
