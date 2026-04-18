import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useEditableBlock } from './EditableContentProvider.jsx';
import EditBadge from './EditBadge.jsx';

/**
 * EditableLink — inline link editor (label + href).
 */

export default function EditableLink({
  blockKey,
  fallback = { label: '', href: '' },
  className = '',
  classNames = {},
  badgeClassNames,
  ...rest
}) {
  const { value, isEditing, canEdit, isDirty, setValue, drop, clear } = useEditableBlock(blockKey, fallback, 'link');
  const [draft, setDraft] = useState(null);
  const resolved = typeof value === 'object' && value ? value : fallback;
  const hasOverride = resolved !== fallback;

  const view = (
    <a href={resolved.href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {resolved.label || resolved.href}
    </a>
  );

  if (!isEditing || !canEdit) return view;

  if (draft === null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
        {view}
        <button
          type="button"
          onClick={() => setDraft({ ...resolved })}
          className={classNames.pencilButton || ''}
          style={classNames.pencilButton ? undefined : {
            marginLeft: 4, display: 'inline-flex', alignItems: 'center',
            fontSize: 10, color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer',
          }}
          title="Edit link"
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </button>
        <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
      </span>
    );
  }

  const commit = () => {
    if (draft.label !== resolved.label || draft.href !== resolved.href) setValue(draft);
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
        value={draft.label || ''}
        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        placeholder="Label"
        className={classNames.input || ''}
        style={classNames.input ? undefined : { border: '1px solid #c7d2fe', padding: '0 4px' }}
      />
      <input
        value={draft.href || ''}
        onChange={(e) => setDraft((d) => ({ ...d, href: e.target.value }))}
        placeholder="https://..."
        onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null); if (e.key === 'Enter') commit(); }}
        onBlur={commit}
        className={classNames.input || ''}
        style={classNames.input ? undefined : { border: '1px solid #c7d2fe', padding: '0 4px' }}
      />
      <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
    </span>
  );
}
