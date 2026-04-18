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

export default {};
