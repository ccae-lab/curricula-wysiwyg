import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useEditableBlock } from './EditableContentProvider.jsx';
import EditBadge from './EditBadge.jsx';

/**
 * EditableText: inline text editor with pencil affordance.
 *
 * Outside edit mode or without a provider, renders the fallback as-is.
 * In edit mode, shows a pencil icon; clicking opens an input or textarea.
 * Edits are staged locally; the EditorTray flushes them.
 *
 * For paragraphs and media-rich content, use EditableField instead. It
 * shares the same staging flow but opens a full textarea panel with a
 * toolbar (image, link, YouTube).
 *
 * @param {Object} props
 * @param {string} props.blockKey
 * @param {string} [props.fallback='']
 * @param {string|React.ElementType} [props.as='span'] - wrapper tag
 * @param {string} [props.className='']
 * @param {boolean} [props.multiline=false]
 * @param {string} [props.placeholder]
 * @param {string} [props.help] - tooltip on the pencil icon ("what is this block for?")
 * @param {Object} [props.classNames] - slots: wrapper, input, textarea, pencilButton
 * @param {Object} [props.badgeClassNames] - passed to EditBadge
 */

export default function EditableText({
  blockKey,
  fallback = '',
  as: Tag = 'span',
  className = '',
  multiline = false,
  placeholder,
  help,
  classNames = {},
  badgeClassNames,
  ...rest
}) {
  const { value, isEditing, canEdit, isDirty, setValue, drop, clear } = useEditableBlock(blockKey, fallback, 'text');
  const [draft, setDraft] = useState(null);
  const hasOverride = value !== fallback;

  const display = typeof value === 'string' ? value : value?.text ?? String(value ?? '');

  if (!isEditing || !canEdit) {
    return <Tag className={className} {...rest}>{display}</Tag>;
  }

  const commit = () => {
    if (draft !== null && draft !== display) setValue(draft);
    setDraft(null);
  };

  const editor = draft === null ? (
    <>
      <Tag className={className} {...rest}>{display}</Tag>
      <button
        type="button"
        onClick={() => setDraft(display)}
        className={classNames.pencilButton || ''}
        style={classNames.pencilButton ? undefined : {
          marginLeft: 4, display: 'inline-flex', alignItems: 'center',
          fontSize: 10, color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer',
        }}
        title={help ? `${help} (click to edit)` : 'Click to edit this block'}
      >
        <Pencil style={{ width: 12, height: 12 }} />
      </button>
    </>
  ) : multiline ? (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null); }}
      placeholder={placeholder}
      rows={3}
      className={classNames.textarea || ''}
      style={classNames.textarea ? undefined : {
        width: '100%', border: '1px solid #a5b4fc', background: '#eef2ff',
        color: 'inherit', padding: 4, fontSize: 'inherit',
      }}
      autoFocus
    />
  ) : (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      placeholder={placeholder}
      className={classNames.input || ''}
      style={classNames.input ? undefined : {
        border: '1px solid #a5b4fc', background: '#eef2ff',
        color: 'inherit', padding: '0 4px', fontSize: 'inherit',
      }}
      autoFocus
    />
  );

  return (
    <span
      className={classNames.wrapper || ''}
      style={classNames.wrapper ? undefined : { display: 'inline-flex', alignItems: 'baseline', gap: 0, position: 'relative' }}
    >
      {editor}
      <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
    </span>
  );
}
