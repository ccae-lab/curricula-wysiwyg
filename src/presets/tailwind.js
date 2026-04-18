/**
 * Tailwind preset — Engage/Bauhaus design system classNames.
 *
 * Import and spread into the classNames prop of each component
 * to restore the original Engage styling.
 */

export const badgeClassNames = {
  wrapper: 'inline-flex items-center gap-1 ml-1 align-baseline',
  dot: 'inline-block w-1.5 h-1.5 rounded-full align-middle',
  resetButton: 'text-[10px] text-amber-700 hover:text-amber-900 inline-flex items-center gap-0.5',
  clearButton: 'text-[10px] text-emerald-700 hover:text-red-700 inline-flex items-center gap-0.5',
};

export const editableTextClassNames = {
  wrapper: 'inline-flex items-baseline gap-0 relative',
  pencilButton: 'ml-1 inline-flex items-center text-[10px] text-indigo-700 hover:text-indigo-900 align-baseline',
  input: 'border border-indigo-300 bg-indigo-50 text-[inherit] px-1 text-sm',
  textarea: 'w-full border border-indigo-300 bg-indigo-50 text-[inherit] p-1 text-sm',
};

export const editableLinkClassNames = {
  pencilButton: 'ml-1 inline-flex items-center text-[10px] text-indigo-700 hover:text-indigo-900',
  editor: 'inline-flex flex-col gap-1 border border-indigo-300 bg-indigo-50 p-1 text-xs',
  input: 'border border-indigo-200 px-1',
};

export const editableImageClassNames = {
  pencilButton: 'ml-1 inline-flex items-center text-[10px] text-indigo-700 hover:text-indigo-900',
  editor: 'inline-flex flex-col gap-1 border border-indigo-300 bg-indigo-50 p-1 text-xs',
  input: 'border border-indigo-200 px-1',
};

export const editableJSONClassNames = {
  editButton: 'absolute top-0 right-0 m-1 inline-flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-300 px-1 py-0.5',
  editor: 'border border-indigo-300 bg-indigo-50 p-2 text-xs space-y-1',
  textarea: 'w-full font-mono text-[11px] border border-indigo-200 p-1',
  stageButton: 'text-[11px] bg-indigo-700 text-white px-2 py-0.5',
  cancelButton: 'text-[11px] border border-indigo-300 px-2 py-0.5',
};

export const editorTrayClassNames = {
  panel: 'fixed bottom-4 right-4 z-[80] w-80 border border-indigo-300 bg-white shadow-lg text-sm',
  header: 'flex items-center justify-between border-b border-indigo-200 bg-indigo-50 px-3 py-2',
  headerTitle: 'text-[10px] tracking-[0.2em] uppercase text-indigo-900 font-semibold inline-flex items-center gap-1',
  toggleButton: '', // dynamic, handled in component
  body: 'px-3 py-2 space-y-2',
  scopeLabel: 'text-[11px] text-bauhaus-grey-dark',
  countLabel: 'text-[11px] text-bauhaus-grey-dark',
  blockList: 'max-h-28 overflow-auto text-[11px] text-bauhaus-fg border border-indigo-100 p-1 space-y-0.5',
  blockItem: 'truncate',
  saveButton: 'inline-flex items-center gap-1 text-[11px] bg-indigo-700 text-white px-2 py-1 disabled:opacity-40',
  errorMessage: 'text-[10px] text-red-700 inline-flex items-start gap-1',
};
