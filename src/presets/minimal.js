/**
 * Minimal preset — inline-style-friendly defaults for Learn / Solving for Zero.
 *
 * Returns empty classNames so all components fall back to their built-in
 * inline styles. This is the right preset for projects that don't use
 * Tailwind.
 *
 * Components check: if a className slot is truthy, use it; otherwise
 * apply inline styles. Passing empty strings (the default) triggers
 * inline styles — which is exactly what Learn needs.
 */

export const badgeClassNames = {};
export const editableTextClassNames = {};
export const editableLinkClassNames = {};
export const editableImageClassNames = {};
export const editableJSONClassNames = {};
export const editorTrayClassNames = {};
