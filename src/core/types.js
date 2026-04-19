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
 * BibliographyAdapter
 *
 * Persists a reference (academic source) into a project's bibliography
 * store. The shape of the target table is project-specific: Engage uses
 * a rich schema (authors, year, title, doi, ...), Learn and Solving for
 * Zero use a compact { citation, annotation, year } shape. The adapter
 * hides that by accepting the UI's minimal input and writing whatever
 * columns the host project needs.
 *
 * @typedef {Object} BibliographyInput
 * @property {string} citation — full source line as the user typed it
 * @property {string} [annotation] — optional annotation / why it matters
 * @property {number} [year] — parsed year if detectable
 * @property {Object} [meta] — arbitrary extra fields for the adapter
 *
 * @typedef {Object} BibliographyResult
 * @property {string} [id]
 * @property {string} [citation_key] — short label suitable for inline insertion
 * @property {string} [inlineInsertion] — adapter-controlled string to append to the draft
 *
 * @typedef {Object} BibliographyAdapter
 * @property {(input: BibliographyInput) => Promise<BibliographyResult | void>} addReference
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
