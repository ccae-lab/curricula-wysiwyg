import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useEditableBlock } from './EditableContentProvider.jsx';
import EditBadge from './EditBadge.jsx';

/**
 * EditableImage — inline image editor (src + alt).
 */

export default function EditableImage({
  blockKey,
  fallback = { src: '', alt: '' },
  className = '',
  classNames = {},
  badgeClassNames,
  ...rest
}) {
  const { value, isEditing, canEdit, isDirty, setValue, drop, clear } = useEditableBlock(blockKey, fallback, 'image');
  const [draft, setDraft] = useState(null);
  const resolved = typeof value === 'object' && value ? value : fallback;
  const hasOverride = resolved !== fallback;

  const img = resolved.src ? (
    <img src={resolved.src} alt={resolved.alt || ''} className={className} {...rest} />
  ) : null;

  if (!isEditing || !canEdit) return img;

  if (draft === null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
        {img}
        <button
          type="button"
          onClick={() => setDraft({ ...resolved })}
          className={classNames.pencilButton || ''}
          style={classNames.pencilButton ? undefined : {
            marginLeft: 4, display: 'inline-flex', alignItems: 'center',
            fontSize: 10, color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer',
          }}
          title="Edit image"
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </button>
        <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
      </span>
    );
  }

  const commit = () => {
    if (draft.src !== resolved.src || draft.alt !== resolved.alt) setValue(draft);
    setDraft(null);
  };

  return (
    <span
      className={classNames.editor || ''}
      style={classNames.editor ? undefined : {
        display: 'inline-flex', flexDirection: 'column', gap: 4,
        border: '1px solid #a5b4fc', background: '#eef2ff', padding: 4, fontSize: 12,
      }}
    >
      <input
        value={draft.src || ''}
        onChange={(e) => setDraft((d) => ({ ...d, src: e.target.value }))}
        placeholder="https://..."
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null); if (e.key === 'Enter') commit(); }}
        className={classNames.input || ''}
        style={classNames.input ? undefined : { border: '1px solid #c7d2fe', padding: '0 4px' }}
      />
      <input
        value={draft.alt || ''}
        onChange={(e) => setDraft((d) => ({ ...d, alt: e.target.value }))}
        placeholder="alt text"
        onBlur={commit}
        className={classNames.input || ''}
        style={classNames.input ? undefined : { border: '1px solid #c7d2fe', padding: '0 4px' }}
      />
      <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
    </span>
  );
}
