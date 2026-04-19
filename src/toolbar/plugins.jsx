import React, { useRef, useState } from 'react';
import { extractYouTubeId } from '../shortcodes/youtube.js';
import { referencePlugin } from './bibliography.jsx';
import { glossaryTermPlugin } from './glossary.jsx';

export { referencePlugin } from './bibliography.jsx';
export { glossaryTermPlugin } from './glossary.jsx';

/**
 * Generic toolbar plugins for EditableField.
 *
 * Each plugin is a factory that returns a ToolbarItem:
 *   { key, label, color, onClick?(draft, setDraft, ctx), panel?(props) }
 *
 * Consumers compose their own toolbar arrays:
 *
 *   import { imageUploadPlugin, imageUrlPlugin, linkPlugin, youtubePlugin }
 *     from '@curricula/wysiwyg/toolbar/plugins';
 *
 *   <EditableField
 *     toolbar={[
 *       imageUploadPlugin(),
 *       imageUrlPlugin(),
 *       linkPlugin(),
 *       youtubePlugin(),
 *     ]}
 *   />
 *
 * Plugins prefer markdown syntax for inserts so the same content renders
 * through any markdown-aware display. Shortcodes are used where markdown
 * lacks native support (YouTube embeds).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendBlock(draft, block) {
  const trimmed = (draft || '').replace(/\s+$/, '');
  const sep = trimmed.length === 0 ? '' : '\n\n';
  return trimmed + sep + block + '\n';
}

// ---------------------------------------------------------------------------
// imageUploadPlugin: pick a local file, upload via StorageAdapter, insert ![alt](url)
// ---------------------------------------------------------------------------

function ImageUploadPanel({ draft, setDraft, onClose, storageAdapter }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [error, setError] = useState(null);
  const [alt, setAlt] = useState('');
  const fileRef = useRef(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!storageAdapter?.uploadImage) {
      setError('No storage adapter configured');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setError(null);
    try {
      const url = await storageAdapter.uploadImage(file);
      setDraft(appendBlock(draft, `![${alt || file.name}](${url})`));
      setStatus('done');
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Upload failed');
      setStatus('error');
    }
  }

  return (
    <div style={{ marginTop: 8, padding: 10, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12 }}>
      <label style={{ display: 'block', marginBottom: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>ALT TEXT</span>
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="What does this image show?"
          style={{ display: 'block', width: '100%', padding: 4, border: '1px solid #d1d5db', marginTop: 2 }}
        />
      </label>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} disabled={status === 'uploading'} />
      {status === 'uploading' && <p style={{ color: '#3b82f6', marginTop: 6 }}>Uploading…</p>}
      {status === 'error' && <p style={{ color: '#b91c1c', marginTop: 6 }}>Upload error: {error}</p>}
    </div>
  );
}

export function imageUploadPlugin({
  label = '+ IMAGE',
  color = '#f97316',
  storageAdapter: factoryStorageAdapter,
} = {}) {
  return {
    key: 'image-upload',
    label,
    color,
    title: 'Upload an image file. Inserts ![alt](url) into the text.',
    panel: (props) => (
      <ImageUploadPanel
        {...props}
        storageAdapter={factoryStorageAdapter || props.storageAdapter}
      />
    ),
  };
}

// ---------------------------------------------------------------------------
// imageUrlPlugin: prompt for URL + alt, insert ![alt](url)
// ---------------------------------------------------------------------------

export function imageUrlPlugin({ label = '+ IMAGE URL', color = '#eab308' } = {}) {
  return {
    key: 'image-url',
    label,
    color,
    title: 'Insert an image by pasting its URL.',
    onClick: (draft, setDraft) => {
      // eslint-disable-next-line no-alert
      const url = window.prompt('Image URL:');
      if (!url) return;
      // eslint-disable-next-line no-alert
      const alt = window.prompt('Alt text (describe the image):') || 'image';
      setDraft(appendBlock(draft, `![${alt}](${url})`));
    },
  };
}

// ---------------------------------------------------------------------------
// linkPlugin: prompt for href + label, insert [label](href)
// ---------------------------------------------------------------------------

export function linkPlugin({ label = '+ LINK', color = '#14b8a6' } = {}) {
  return {
    key: 'link',
    label,
    color,
    title: 'Insert a markdown link: [label](https://...)',
    onClick: (draft, setDraft) => {
      // eslint-disable-next-line no-alert
      const href = window.prompt('Link URL:');
      if (!href) return;
      // eslint-disable-next-line no-alert
      const text = window.prompt('Link text:') || href;
      const insertion = `[${text}](${href})`;
      // Append to the end preserving inline style (no extra newlines).
      setDraft((draft || '') + (draft && !draft.endsWith(' ') ? ' ' : '') + insertion);
    },
  };
}

// ---------------------------------------------------------------------------
// youtubePlugin: prompt for URL or ID, insert [youtube:ID]
// ---------------------------------------------------------------------------

export function youtubePlugin({ label = '+ YOUTUBE', color = '#dc2626' } = {}) {
  return {
    key: 'youtube',
    label,
    color,
    title: 'Embed a YouTube video. Paste a URL or the video ID.',
    onClick: (draft, setDraft) => {
      // eslint-disable-next-line no-alert
      const raw = window.prompt('YouTube URL or video ID:');
      if (!raw) return;
      const id = extractYouTubeId(raw);
      if (!id) {
        // eslint-disable-next-line no-alert
        window.alert('Could not recognise that as a YouTube URL or ID.');
        return;
      }
      setDraft(appendBlock(draft, `[youtube:${id}]`));
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: the generic set Learn and Engage both use
// ---------------------------------------------------------------------------

export function genericPlugins(opts = {}) {
  return [
    imageUploadPlugin(opts.image),
    imageUrlPlugin(opts.imageUrl),
    linkPlugin(opts.link),
    youtubePlugin(opts.youtube),
  ];
}

/**
 * Full 6-button toolbar shared by Engage and Learn.
 *
 * Order: IMAGE, REFERENCE, GLOSSARY TERM, LINK, IMAGE URL, YOUTUBE.
 * Each group can be tuned via the options bag. If `bibliography.adapter`
 * or `glossary.adapter` are omitted the corresponding button is skipped,
 * because those panels need a persistence target to function.
 *
 * Usage:
 *
 *   fullToolbar({
 *     bibliography: { adapter: engageBibliographyAdapter },
 *     glossary:     { adapter: engageGlossaryAdapter },
 *     // optional label/color/theme overrides per plugin
 *   })
 */
export function fullToolbar(opts = {}) {
  const toolbar = [imageUploadPlugin(opts.image)];
  if (opts.bibliography && opts.bibliography.adapter) {
    // Shallow-merge a top-level enrichmentAdapter into the bibliography opts
    // so callers can pass { enrichmentAdapter } once at the fullToolbar level.
    const bib = opts.enrichmentAdapter && !opts.bibliography.enrichmentAdapter
      ? { ...opts.bibliography, enrichmentAdapter: opts.enrichmentAdapter }
      : opts.bibliography;
    toolbar.push(referencePlugin(bib));
  }
  if (opts.glossary && opts.glossary.adapter) {
    toolbar.push(glossaryTermPlugin(opts.glossary));
  }
  toolbar.push(
    linkPlugin(opts.link),
    imageUrlPlugin(opts.imageUrl),
    youtubePlugin(opts.youtube),
  );
  return toolbar;
}
