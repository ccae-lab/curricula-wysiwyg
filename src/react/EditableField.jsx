import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { useEditableBlock, useEditorTray } from './EditableContentProvider.jsx';
import EditBadge from './EditBadge.jsx';
import { ShortcodePrint, hasShortcode } from '../shortcodes/index.jsx';

/**
 * EditableField: rich content editor with configurable toolbar.
 *
 * Two wiring modes, chosen by which props you pass:
 *
 * 1. PROVIDER MODE (preferred)
 *    <EditableField blockKey="hero_intro" fallback="..." multiline
 *                   toolbar={[imageUploadPlugin(), youtubePlugin()]} />
 *    Reads the current value from useEditableBlock; SAVE stages the
 *    draft into the EditorTray dirty map; CANCEL drops the draft.
 *    Save-all happens in the tray, keeping staging semantics identical
 *    to the EditableText primitive.
 *
 * 2. CALLBACK MODE (back-compat with Learn's original EditableField)
 *    <EditableField value={v} onSave={(next) => ...} toolbar={[...]} />
 *    SAVE calls onSave(draft) directly. No staging, no tray involvement.
 *    Kept intact for modules that manage their own persistence.
 *
 * Shortcodes such as [youtube:ID] render as embeds when viewing the
 * field (not when editing). Edit mode always shows the raw text so
 * stewards can see and modify the shortcode itself.
 *
 * @param {Object} props
 * @param {string} [props.blockKey]
 * @param {string} [props.fallback]
 * @param {string} [props.value]
 * @param {(next: string) => void} [props.onSave]
 * @param {boolean} [props.multiline=true]
 * @param {string} [props.help] - tooltip/hint shown beside the editor title
 * @param {Array<ToolbarItem>} [props.toolbar]
 * @param {boolean} [props.shortcodes=true] - render shortcodes on display
 * @param {string|React.ElementType} [props.as='div'] - display wrapper tag
 * @param {string} [props.className]
 * @param {Object} [props.style]
 * @param {React.ReactNode} [props.renderDisplay]
 * @param {Object} [props.classNames]
 */
export default function EditableField({
  blockKey,
  fallback,
  value,
  onSave,
  multiline = true,
  help,
  toolbar = [],
  shortcodes = true,
  as = 'div',
  className = '',
  style,
  renderDisplay,
  classNames = {},
}) {
  const providerMode = typeof blockKey === 'string' && blockKey.length > 0;

  if (providerMode) {
    return (
      <ProviderBackedField
        blockKey={blockKey}
        fallback={fallback ?? ''}
        multiline={multiline}
        help={help}
        toolbar={toolbar}
        shortcodes={shortcodes}
        as={as}
        className={className}
        style={style}
        renderDisplay={renderDisplay}
        classNames={classNames}
      />
    );
  }

  return (
    <CallbackBackedField
      value={value ?? ''}
      onSave={onSave}
      multiline={multiline}
      help={help}
      toolbar={toolbar}
      shortcodes={shortcodes}
      as={as}
      className={className}
      style={style}
      renderDisplay={renderDisplay}
      classNames={classNames}
    />
  );
}

// ---------------------------------------------------------------------------
// Provider-backed: integrates with EditorTray staging flow
// ---------------------------------------------------------------------------

function ProviderBackedField({
  blockKey, fallback, multiline, help, toolbar, shortcodes,
  as, className, style, renderDisplay, classNames,
}) {
  const { value, isEditing, canEdit, isDirty, setValue, drop, clear } =
    useEditableBlock(blockKey, fallback, 'text');
  const hasOverride = value !== fallback;

  return (
    <FieldShell
      displayValue={value}
      isEditing={isEditing}
      canEdit={canEdit}
      isDirty={isDirty}
      hasOverride={hasOverride}
      onReset={drop}
      onClear={clear}
      onCommit={(draft) => setValue(draft)}
      commitLabel="SAVE"
      commitTitle="Stage this edit. Use Save all in the tray to publish."
      help={help}
      toolbar={toolbar}
      multiline={multiline}
      shortcodes={shortcodes}
      as={as}
      className={className}
      style={style}
      renderDisplay={renderDisplay}
      classNames={classNames}
    />
  );
}

// ---------------------------------------------------------------------------
// Callback-backed: direct onSave, no staging (Learn's original behaviour)
// ---------------------------------------------------------------------------

function CallbackBackedField({
  value, onSave, multiline, help, toolbar, shortcodes,
  as, className, style, renderDisplay, classNames,
}) {
  return (
    <FieldShell
      displayValue={value}
      isEditing
      canEdit
      isDirty={false}
      hasOverride={false}
      onCommit={(draft) => onSave?.(draft)}
      commitLabel="SAVE"
      commitTitle="Save this edit now"
      help={help}
      toolbar={toolbar}
      multiline={multiline}
      shortcodes={shortcodes}
      as={as}
      className={className}
      style={style}
      renderDisplay={renderDisplay}
      classNames={classNames}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared shell: display + edit panel + toolbar
// ---------------------------------------------------------------------------

function FieldShell({
  displayValue,
  isEditing,
  canEdit,
  isDirty,
  hasOverride,
  onReset,
  onClear,
  onCommit,
  commitLabel,
  commitTitle,
  help,
  toolbar,
  multiline,
  shortcodes,
  as: Tag,
  className,
  style,
  renderDisplay,
  classNames,
}) {
  const trayCtx = useEditorTray();
  const storageAdapter = trayCtx?.storageAdapter;

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(displayValue);
  const [activePanel, setActivePanel] = useState(null);
  const textRef = useRef(null);

  useEffect(() => { setDraft(displayValue); }, [displayValue]);

  // Display mode (not in edit-mode, or user doesn't have canEdit)
  if (!isEditing || !canEdit || !editorOpen) {
    return (
      <Tag
        className={`${classNames.wrapper || ''} ${className || ''}`.trim()}
        style={classNames.wrapper ? undefined : { position: 'relative', ...style }}
      >
        <DisplayContent
          value={displayValue}
          shortcodes={shortcodes}
          renderDisplay={renderDisplay}
          className={classNames.display || ''}
        />
        {isEditing && canEdit && (
          <div
            className={classNames.editHeader || ''}
            style={classNames.editHeader ? undefined : { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}
          >
            <button
              type="button"
              onClick={() => { setDraft(displayValue); setEditorOpen(true); }}
              title={help ? `${help} — click to edit` : 'Edit this block'}
              className={classNames.editButton || ''}
              style={classNames.editButton ? undefined : {
                background: '#4338ca', border: 'none', borderRadius: 3,
                padding: '4px 12px', color: '#fff', fontFamily: 'monospace',
                fontSize: 9, cursor: 'pointer', letterSpacing: '0.08em',
              }}
            >
              EDIT
            </button>
            {help && (
              <span
                title={help}
                style={{ display: 'inline-flex', alignItems: 'center', color: '#6366f1', cursor: 'help' }}
              >
                <Info style={{ width: 12, height: 12 }} />
              </span>
            )}
            <EditBadge
              isDirty={!!isDirty}
              hasOverride={!!hasOverride}
              onReset={onReset}
              onClear={onClear}
              classNames={classNames.badge}
            />
          </div>
        )}
      </Tag>
    );
  }

  const commit = () => {
    onCommit(draft);
    setEditorOpen(false);
    setActivePanel(null);
  };

  const cancel = () => {
    setDraft(displayValue);
    setEditorOpen(false);
    setActivePanel(null);
  };

  return (
    <div
      className={classNames.editorWrapper || ''}
      style={classNames.editorWrapper ? undefined : { ...style }}
    >
      {/* Editor title / help bar */}
      {help && (
        <div
          className={classNames.helpBar || ''}
          style={classNames.helpBar ? undefined : {
            display: 'flex', alignItems: 'flex-start', gap: 6,
            background: '#eef2ff', border: '1px solid #c7d2fe',
            borderRadius: 3, padding: '6px 8px', marginBottom: 6,
            fontSize: 11, color: '#312e81',
          }}
        >
          <HelpCircle style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0 }} />
          <span style={{ lineHeight: 1.5 }}>{help}</span>
        </div>
      )}

      {multiline ? (
        <textarea
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          rows={8}
          className={classNames.textarea || ''}
          style={classNames.textarea ? undefined : {
            width: '100%', background: '#f8fafc', border: '2px solid #4338ca',
            borderRadius: 4, padding: '10px 14px', color: '#1e293b',
            fontFamily: 'inherit', fontSize: 15, lineHeight: 1.7,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      ) : (
        <input
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
            if (e.key === 'Enter') commit();
          }}
          className={classNames.input || ''}
          style={classNames.input ? undefined : {
            width: '100%', background: '#f8fafc', border: '2px solid #4338ca',
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
          type="button"
          onClick={commit}
          title={commitTitle}
          className={classNames.saveButton || ''}
          style={classNames.saveButton ? undefined : {
            background: '#22c55e', border: 'none', borderRadius: 3, padding: '5px 14px',
            color: '#fff', fontFamily: 'monospace', fontSize: 10, cursor: 'pointer',
          }}
        >{commitLabel}</button>
        <button
          type="button"
          onClick={cancel}
          title="Discard this draft (Escape)"
          className={classNames.cancelButton || ''}
          style={classNames.cancelButton ? undefined : {
            background: 'none', border: '1px solid #d1d5db', borderRadius: 3,
            padding: '5px 14px', color: '#6b7280', fontFamily: 'monospace',
            fontSize: 10, cursor: 'pointer',
          }}
        >CANCEL</button>

        {toolbar.length > 0 && (
          <span style={{ width: 1, background: '#d1d5db', margin: '0 4px' }} />
        )}

        {toolbar.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.title || item.label}
            onClick={() => {
              if (item.panel) {
                setActivePanel(activePanel === item.key ? null : item.key);
              } else if (item.onClick) {
                item.onClick(draft, setDraft, { storageAdapter });
              }
            }}
            className={classNames.toolbarButton || ''}
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
            storageAdapter={storageAdapter}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display sub-component: shortcode-aware rendering
// ---------------------------------------------------------------------------

function DisplayContent({ value, shortcodes, renderDisplay, className }) {
  if (renderDisplay) {
    return <div className={className}>{renderDisplay(value)}</div>;
  }
  const str = typeof value === 'string' ? value : String(value ?? '');
  if (shortcodes && hasShortcode(str)) {
    return <div className={className}><ShortcodePrint text={str} /></div>;
  }
  if (str.includes('\n')) {
    return (
      <div className={className}>
        {str.split('\n').map((line, i) => (
          line.trim() === '' ? null : <p key={i} style={{ margin: '0 0 0.75em' }}>{line}</p>
        ))}
      </div>
    );
  }
  return <div className={className}>{str}</div>;
}
