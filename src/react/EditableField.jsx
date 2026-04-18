import React, { useState, useEffect, useRef } from 'react';
import { useEditorTray } from './EditableContentProvider.jsx';

/**
 * EditableField — rich content editor with configurable toolbar.
 *
 * Ported from learn.curricula.dev's inline EditableField. Unlike the
 * EditableText primitive (which stages into the EditorTray batch),
 * EditableField saves immediately on click via an onSave callback.
 * This makes it suitable for module-scoped content where each field
 * saves independently.
 *
 * Toolbar capabilities are injected via the `toolbar` prop so consumers
 * control which features are available (image upload, bibliography,
 * glossary, link, YouTube, etc.).
 *
 * @param {Object} props
 * @param {string} props.value — current content
 * @param {(newValue: string) => void} props.onSave — called on save
 * @param {boolean} [props.multiline=false]
 * @param {Object} [props.style] — inline styles for the display wrapper
 * @param {React.ReactNode} [props.renderDisplay] — custom display renderer
 * @param {Array<ToolbarItem>} [props.toolbar] — toolbar configuration
 * @param {Object} [props.classNames] — slots: wrapper, display, editButton,
 *   textarea, input, toolbarRow, saveButton, cancelButton
 *
 * ToolbarItem shape:
 * {
 *   key: string,        — unique key
 *   label: string,      — button label (e.g. "+ IMAGE")
 *   color: string,      — button background colour
 *   onClick: (draft, setDraft, ctx) => void | Promise<void>
 *     — called on click; receives current draft text, setter, and an
 *       optional context object with { storageAdapter }
 *   panel?: (props) => JSX — optional expanded panel component
 * }
 */

export default function EditableField({
  value,
  onSave,
  multiline = false,
  style,
  renderDisplay,
  toolbar = [],
  classNames = {},
}) {
  const ctx = useEditorTray();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [activePanel, setActivePanel] = useState(null);
  const textRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <div className={classNames.wrapper || ''} style={classNames.wrapper ? undefined : { position: 'relative', ...style }}>
        <div className={classNames.display || ''}>{renderDisplay ? renderDisplay(value) : value}</div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={classNames.editButton || ''}
          style={classNames.editButton ? undefined : {
            marginTop: 8, background: '#3b82f6', border: 'none', borderRadius: 3,
            padding: '4px 12px', color: '#fff', fontFamily: 'monospace',
            fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em',
          }}
        >
          EDIT
        </button>
      </div>
    );
  }

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
    setActivePanel(null);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
    setActivePanel(null);
  };

  return (
    <div className={classNames.wrapper || ''} style={classNames.wrapper ? undefined : style}>
      {multiline ? (
        <textarea
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className={classNames.textarea || ''}
          style={classNames.textarea ? undefined : {
            width: '100%', background: '#f8fafc', border: '2px solid #3b82f6',
            borderRadius: 4, padding: '10px 14px', color: '#1e293b',
            fontFamily: 'inherit', fontSize: 15, lineHeight: 1.7,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={classNames.input || ''}
          style={classNames.input ? undefined : {
            width: '100%', background: '#f8fafc', border: '2px solid #3b82f6',
            borderRadius: 4, padding: '10px 14px', color: '#1e293b',
            fontFamily: 'inherit', fontSize: 18, fontWeight: 700,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {/* Toolbar row */}
      <div
        className={classNames.toolbarRow || ''}
        style={classNames.toolbarRow ? undefined : { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
      >
        <button
          type="button" onClick={handleSave}
          className={classNames.saveButton || ''}
          style={classNames.saveButton ? undefined : {
            background: '#22c55e', border: 'none', borderRadius: 3, padding: '5px 14px',
            color: '#fff', fontFamily: 'monospace', fontSize: 10, cursor: 'pointer',
          }}
        >SAVE</button>
        <button
          type="button" onClick={handleCancel}
          className={classNames.cancelButton || ''}
          style={classNames.cancelButton ? undefined : {
            background: 'none', border: '1px solid #d1d5db', borderRadius: 3,
            padding: '5px 14px', color: '#9ca3af', fontFamily: 'monospace',
            fontSize: 10, cursor: 'pointer',
          }}
        >CANCEL</button>

        {toolbar.length > 0 && <span style={{ width: 1, background: '#d1d5db', margin: '0 4px' }} />}

        {toolbar.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.panel) {
                setActivePanel(activePanel === item.key ? null : item.key);
              } else if (item.onClick) {
                item.onClick(draft, setDraft, { storageAdapter: ctx?.storageAdapter });
              }
            }}
            style={{
              background: activePanel === item.key ? '#ef4444' : (item.color || '#6366f1'),
              border: 'none', borderRadius: 3, padding: '5px 14px',
              color: '#fff', fontFamily: 'monospace', fontSize: 10, cursor: 'pointer',
            }}
          >
            {activePanel === item.key ? 'CLOSE' : item.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {activePanel && toolbar.map((item) => {
        if (item.key !== activePanel || !item.panel) return null;
        const Panel = item.panel;
        return (
          <Panel
            key={item.key}
            draft={draft}
            setDraft={setDraft}
            onClose={() => setActivePanel(null)}
            storageAdapter={ctx?.storageAdapter}
          />
        );
      })}
    </div>
  );
}
