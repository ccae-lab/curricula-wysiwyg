import React from 'react';
import { Pencil, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useEditorTray } from './EditableContentProvider.jsx';

/**
 * EditorTray — floating panel for content editors.
 *
 * Place inside an EditableContentProvider. When the current user can edit,
 * the tray pins to the bottom-right and offers:
 * - toggle edit mode (turns inline pencils on)
 * - staged edit count
 * - "Save all" → upsert all dirty blocks in one call
 *
 * Renders nothing outside a provider or for non-editors.
 *
 * @param {Object} [props.classNames] — slots: panel, header, headerTitle,
 *   toggleButton, body, scopeLabel, countLabel, blockList, blockItem,
 *   saveButton, errorMessage
 */

export default function EditorTray({ classNames = {} }) {
  const ctx = useEditorTray();
  if (!ctx || !ctx.canEdit) return null;

  const { scopeLabel, isEditing, setEditing, dirty, dirtyCount, saveAll, isSaving, lastError } = ctx;
  const cn = classNames;

  return (
    <div
      className={cn.panel || ''}
      style={cn.panel ? undefined : {
        position: 'fixed', bottom: 16, right: 16, zIndex: 80,
        width: 320, border: '1px solid #a5b4fc', background: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 14,
      }}
    >
      {/* Header */}
      <div
        className={cn.header || ''}
        style={cn.header ? undefined : {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #c7d2fe', background: '#eef2ff', padding: '8px 12px',
        }}
      >
        <p
          className={cn.headerTitle || ''}
          style={cn.headerTitle ? undefined : {
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#312e81', fontWeight: 600, margin: 0,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Pencil style={{ width: 12, height: 12 }} /> Content editor
        </p>
        <button
          type="button"
          onClick={() => setEditing(!isEditing)}
          className={cn.toggleButton || ''}
          style={cn.toggleButton ? undefined : {
            fontSize: 11, padding: '2px 8px', border: '1px solid #a5b4fc', cursor: 'pointer',
            background: isEditing ? '#4338ca' : '#fff',
            color: isEditing ? '#fff' : '#4338ca',
          }}
        >
          {isEditing ? 'Exit edit mode' : 'Enter edit mode'}
        </button>
      </div>

      {/* Body */}
      <div
        className={cn.body || ''}
        style={cn.body ? undefined : { padding: '8px 12px' }}
      >
        <p className={cn.scopeLabel || ''} style={cn.scopeLabel ? undefined : { fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>
          Scope: <span style={{ fontFamily: 'monospace' }}>{scopeLabel}</span>
        </p>
        <p className={cn.countLabel || ''} style={cn.countLabel ? undefined : { fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
          Staged edits: <span style={{ color: '#4338ca', fontWeight: 600 }}>{dirtyCount}</span>
        </p>

        {dirtyCount > 0 && (
          <ul
            className={cn.blockList || ''}
            style={cn.blockList ? undefined : {
              maxHeight: 112, overflow: 'auto', fontSize: 11, border: '1px solid #e0e7ff',
              padding: 4, margin: '0 0 8px', listStyle: 'none',
            }}
          >
            {Object.entries(dirty).map(([k, { type }]) => (
              <li key={k} className={cn.blockItem || ''} style={cn.blockItem ? undefined : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#4338ca', fontFamily: 'monospace' }}>{k}</span>{' '}
                <span style={{ color: '#6b7280' }}>· {type}</span>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={saveAll}
            disabled={dirtyCount === 0 || isSaving}
            className={cn.saveButton || ''}
            style={cn.saveButton ? undefined : {
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, background: '#4338ca', color: '#fff', border: 'none',
              padding: '4px 8px', cursor: 'pointer', opacity: (dirtyCount === 0 || isSaving) ? 0.4 : 1,
            }}
          >
            {isSaving
              ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
              : <Save style={{ width: 12, height: 12 }} />
            }
            Save all
          </button>
        </div>

        {lastError && (
          <p className={cn.errorMessage || ''} style={cn.errorMessage ? undefined : { fontSize: 10, color: '#b91c1c', marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <AlertTriangle style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0 }} /> {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
