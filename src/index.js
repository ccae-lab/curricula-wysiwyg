// @curricula/wysiwyg : public API

// Provider + hooks
export {
  EditableContentProvider,
  useEditableContent,
  useEditableBlock,
  useEditorTray,
  EditableContentContext,
} from './react/EditableContentProvider.jsx';

// UI primitives
export { default as EditableText } from './react/EditableText.jsx';
export { default as EditableLink } from './react/EditableLink.jsx';
export { default as EditableImage } from './react/EditableImage.jsx';
export { default as EditableJSON } from './react/EditableJSON.jsx';
export { default as EditableField } from './react/EditableField.jsx';
export { default as EditBadge } from './react/EditBadge.jsx';
export { default as EditorTray } from './react/EditorTray.jsx';

// Shortcode rendering
export {
  ShortcodePrint,
  ShortcodeYouTube,
  matchYouTubeLine,
  extractYouTubeId,
  hasShortcode,
} from './shortcodes/index.jsx';

// Toolbar plugin factories (for use with EditableField's toolbar prop)
export {
  imageUploadPlugin,
  imageUrlPlugin,
  linkPlugin,
  youtubePlugin,
  referencePlugin,
  glossaryTermPlugin,
  genericPlugins,
  fullToolbar,
} from './toolbar/plugins.jsx';

// Citation helpers (shared with adapters; testable without React)
export {
  parseAPA,
  extractDoi,
  doiToUrl,
  firstAuthorSurname,
  defaultFormatInline,
} from './citations/helpers.js';

// Adapters are imported directly from subpaths:
//   import { createPostgRESTAdapter } from '@curricula/wysiwyg/adapters/postgrest'
//   import { createSupabaseSDKAdapter } from '@curricula/wysiwyg/adapters/supabase-sdk'
//   import { createSupabaseStorageAdapter } from '@curricula/wysiwyg/adapters/supabase-storage'
//
// Presets are imported from:
//   import * as tailwind from '@curricula/wysiwyg/presets/tailwind'
//   import * as minimal from '@curricula/wysiwyg/presets/minimal'
