import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useEditableBlock } from './EditableContentProvider.jsx';
import EditBadge from './EditBadge.jsx';

/**
 * EditableJSON — structured JSON editor for arrays, objects, etc.
 * Renders via a `render` prop; editor is a raw textarea with validation.
 */

export default function EditableJSON({
  blockKey,
  fallback,
  render,
  classNames = {},
  badgeClassNames,
}) {
  const { value, isEditing, canEdit, isDirty, setValue, drop, clear } = useEditableBlock(blockKey, fallback, 'json');
  const [draft, setDraft] = useState(null);
  const [parseErr, setParseErr] = useState(null);
  const hasOverride = value !== fallback;

  const resolved = value ?? fallback;

  if (!isEditing || !canEdit) return render(resolved);

  if (draft === null) {
    return (
      <div style={{ position: 'relative' }}>
        {render(resolved)}
        <button
          type="button"
          onClick={() => setDraft(JSON.stringify(resolved, null, 2))}
          className={classNames.editButton || ''}
          style={classNames.editButton ? undefined : {
            position: 'absolute', top: 0, right: 0, margin: 4,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: '#4338ca', background: 'white',
            border: '1px solid #a5b4fc', padding: '2px 4px', cursor: 'pointer',
          }}
          title="Edit data"
        >
          <Pencil style={{ width: 12, height: 12 }} /> edit data
          <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
        </button>
      </div>
    );
  }

  const commit = () => {
    try {
      const parsed = JSON.parse(draft);
      setValue(parsed);
      setDraft(null);
      setParseErr(null);
    } catch (err) {
      setParseErr(err.message);
    }
  };

  return (
    <div
      className={classNames.editor || ''}
      style={classNames.editor ? undefined : {
        border: '1px solid #a5b4fc', background: '#eef2ff', padding: 8, fontSize: 12,
      }}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(null); setParseErr(null); } }}
        rows={Math.min(16, Math.max(4, draft.split('\n').length))}
        className={classNames.textarea || ''}
        style={classNames.textarea ? undefined : {
          width: '100%', fontFamily: 'monospace', fontSize: 11,
          border: '1px solid #c7d2fe', padding: 4,
        }}
      />
      {parseErr && <p style={{ fontSize: 10, color: '#b91c1c', marginTop: 4 }}>{parseErr}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button" onClick={commit}
          className={classNames.stageButton || ''}
          style={classNames.stageButton ? undefined : {
            fontSize: 11, background: '#4338ca', color: 'white', border: 'none',
            padding: '2px 8px', cursor: 'pointer',
          }}
        >Stage</button>
        <button
          type="button" onClick={() => { setDraft(null); setParseErr(null); }}
          className={classNames.cancelButton || ''}
          style={classNames.cancelButton ? undefined : {
            fontSize: 11, background: 'none', border: '1px solid #a5b4fc',
            padding: '2px 8px', cursor: 'pointer',
          }}
        >Cancel</button>
        <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
      </div>
    </div>
  );
}
