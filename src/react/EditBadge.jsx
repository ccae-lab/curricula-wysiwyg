import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

/**
 * EditBadge — coloured dot + reset/clear buttons for edit state.
 *
 * Accepts classNames slots so consumers can style with Tailwind, inline
 * styles, or any other approach. Falls back to bare-minimum inline styles
 * when no classNames are provided.
 *
 * @param {Object} props
 * @param {boolean} props.isDirty — unsaved local edit
 * @param {boolean} props.hasOverride — saved override exists
 * @param {() => void} props.onReset — drop unsaved edit
 * @param {() => void} props.onClear — remove saved override
 * @param {Object} [props.classNames]
 * @param {string} [props.classNames.wrapper]
 * @param {string} [props.classNames.dot]
 * @param {string} [props.classNames.resetButton]
 * @param {string} [props.classNames.clearButton]
 */

const defaults = {
  wrapper: '',
  dot: '',
  resetButton: '',
  clearButton: '',
};

export default function EditBadge({ isDirty, hasOverride, onReset, onClear, classNames = {} }) {
  const cn = { ...defaults, ...classNames };

  const dotColor = isDirty ? '#f59e0b' : hasOverride ? '#10b981' : '#9ca3af';
  const dotTitle = isDirty ? 'Unsaved edit' : hasOverride ? 'Override in effect' : 'Fallback (no override)';

  return (
    <span className={cn.wrapper} style={cn.wrapper ? undefined : { display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
      <span
        className={cn.dot}
        style={cn.dot ? undefined : {
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          backgroundColor: dotColor, verticalAlign: 'middle',
        }}
        title={dotTitle}
      />
      {isDirty && (
        <button
          type="button"
          onClick={onReset}
          className={cn.resetButton}
          style={cn.resetButton ? undefined : {
            fontSize: 10, color: '#b45309', background: 'none', border: 'none',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2,
          }}
          title="Drop unsaved edit"
        >
          <RotateCcw style={{ width: 10, height: 10 }} /> reset
        </button>
      )}
      {hasOverride && !isDirty && (
        <button
          type="button"
          onClick={onClear}
          className={cn.clearButton}
          style={cn.clearButton ? undefined : {
            fontSize: 10, color: '#047857', background: 'none', border: 'none',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2,
          }}
          title="Remove override, restore fallback"
        >
          <Trash2 style={{ width: 10, height: 10 }} /> clear
        </button>
      )}
    </span>
  );
}
