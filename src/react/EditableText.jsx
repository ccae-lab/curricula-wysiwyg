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
 * @param {boolean} [props.multiline] - force a textarea or force an input.
 *   Left off, the editor decides from the text: anything past 80
 *   characters, or carrying a line break, opens as a textarea sized to
 *   the passage.
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
  multiline,
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

  // data-editable-key marks the block in the DOM whether or not edit
  // mode is on, so a steward can be shown where the editable passages
  // are before deciding to edit anything.
  if (!isEditing || !canEdit) {
    return <Tag className={className} data-editable-key={blockKey} {...rest}>{display}</Tag>;
  }

  const commit = () => {
    if (draft !== null && draft !== display) setValue(draft);
    setDraft(null);
  };

  // The editor sizes itself to the text. Passing multiline decides it
  // outright; otherwise a passage that runs past a line, or carries one
  // of its own, opens as a textarea. Callers were having to remember the
  // prop, and a 300-character paragraph that forgot it opened in a
  // single-line input about six words wide.
  const asTextarea = multiline === undefined
    ? (display.length > 80 || display.includes('\n'))
    : multiline;

  // Rows follow the length, so a long passage opens showing most of
  // itself. Roughly 90 characters to a line at this width. Measured on
  // the stored text, so the box holds still while the steward types and
  // any manual resize survives.
  const rows = Math.min(16, Math.max(3, Math.ceil(display.length / 90) + 1));

  // A textarea needs a block wrapper: the default wrapper is inline-flex,
  // which would shrink it back to its content.
  const wrapperStyle = asTextarea
    ? { display: 'block', width: '100%', position: 'relative' }
    : (classNames.wrapper ? undefined : { display: 'inline-flex', alignItems: 'baseline', gap: 0, position: 'relative' });

  const editor = draft === null ? (
    <>
      <Tag className={className} {...rest}>{display}</Tag>
      <button
        type="button"
        onClick={() => setDraft(display)}
        className={classNames.pencilButton || ''}
        style={classNames.pencilButton ? undefined : {
          marginLeft: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          // 24x24 hit area, the WCAG 2.2 Target Size (Minimum) 2.5.8 floor
          // for a control that sits inline in a sentence. The glyph stays
          // small enough not to disturb the line box.
          minWidth: 24, minHeight: 24,
          fontSize: 10, color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer',
        }}
        aria-label={help ? `Edit: ${help}` : `Edit this block (${blockKey})`}
        title={help ? `${help} (click to edit)` : 'Click to edit this block'}
      >
        <Pencil style={{ width: 14, height: 14 }} />
      </button>
    </>
  ) : asTextarea ? (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null); }}
      placeholder={placeholder}
      rows={rows}
      className={classNames.textarea || ''}
      // Width and height ride on the element even when a preset supplies
      // the class, because the class carries colour and border and has no
      // way to know how long this particular passage is.
      style={{
        width: '100%', minWidth: 0, resize: 'vertical', lineHeight: 1.5,
        ...(classNames.textarea ? {} : {
          border: '1px solid #a5b4fc', background: '#eef2ff',
          color: 'inherit', padding: 4, fontSize: 'inherit',
        }),
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
      // Short text still gets an editor as wide as the words in it,
      // with room to type past the end.
      size={Math.min(80, Math.max(12, display.length + 8))}
      className={classNames.input || ''}
      style={{
        maxWidth: '100%',
        ...(classNames.input ? {} : {
          border: '1px solid #a5b4fc', background: '#eef2ff',
          color: 'inherit', padding: '0 4px', fontSize: 'inherit',
        }),
      }}
      autoFocus
    />
  );

  return (
    <span
      className={classNames.wrapper || ''}
      data-editable-key={blockKey}
      style={wrapperStyle}
    >
      {editor}
      <EditBadge isDirty={isDirty} hasOverride={hasOverride} onReset={drop} onClear={clear} classNames={badgeClassNames} />
    </span>
  );
}
