import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * EditableContentProvider — adapter-driven content editing context.
 *
 * Wraps a content region (page, module, section) and provides:
 * - Read: blocks fetched via persistenceAdapter.fetchBlocks(scope)
 * - Stage: local edits held in a dirty map (no network until saveAll)
 * - Flush: single upsert of all dirty blocks via persistenceAdapter.upsertBlocks
 * - Clear: remove a saved override via persistenceAdapter.deleteBlock
 *
 * If no provider wraps a component, useEditableContent/useEditableBlock
 * return the fallback — graceful degradation by design.
 *
 * @param {Object} props
 * @param {Object} props.scope — opaque scope object passed to the persistence adapter
 *   (e.g. { pageSlug: 'X' } for Engage, { projectId, moduleId } for Learn)
 * @param {string} props.scopeLabel — human-readable label shown in the EditorTray
 * @param {import('../core/types').AuthAdapter} props.authAdapter
 * @param {import('../core/types').PersistenceAdapter} props.persistenceAdapter
 * @param {import('../core/types').StorageAdapter} [props.storageAdapter]
 * @param {React.ReactNode} props.children
 */

const EditableContentContext = createContext(null);

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export function EditableContentProvider({
  scope,
  scopeLabel,
  authAdapter,
  persistenceAdapter,
  storageAdapter,
  children,
}) {
  const [saved, setSaved] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setEditing] = useState(false);
  const [dirty, setDirty] = useState({});
  const [lastError, setLastError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const fetchedAtRef = useRef(0);
  const scopeKeyRef = useRef(null);

  // Stable scope key for dependency tracking
  const scopeKey = JSON.stringify(scope);

  // Fetch blocks on mount and when scope changes
  useEffect(() => {
    if (!scope) return;
    // Reset on scope change
    if (scopeKeyRef.current !== scopeKey) {
      scopeKeyRef.current = scopeKey;
      setDirty({});
      setLastError(null);
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const blocks = await persistenceAdapter.fetchBlocks(scope);
        if (!cancelled) {
          setSaved(blocks || {});
          fetchedAtRef.current = Date.now();
        }
      } catch {
        if (!cancelled) setSaved({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();

    return () => { cancelled = true; };
  }, [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch if data is stale on window focus
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - fetchedAtRef.current > STALE_MS && scope) {
        persistenceAdapter.fetchBlocks(scope).then((blocks) => {
          setSaved(blocks || {});
          fetchedAtRef.current = Date.now();
        }).catch(() => {});
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const user = authAdapter.getUser();
  const canEdit = !!(user && authAdapter.canEdit());

  const saveAll = useCallback(async () => {
    if (Object.keys(dirty).length === 0) return;
    setIsSaving(true);
    setLastError(null);
    try {
      await persistenceAdapter.upsertBlocks(scope, user?.email, dirty);
      // Merge dirty into saved
      setSaved((prev) => {
        const next = { ...prev };
        for (const [key, entry] of Object.entries(dirty)) {
          next[key] = entry;
        }
        return next;
      });
      setDirty({});
    } catch (err) {
      setLastError(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  }, [dirty, scope, user?.email, persistenceAdapter]);

  const clearOverride = useCallback(async (key) => {
    try {
      await persistenceAdapter.deleteBlock(scope, key);
      setSaved((prev) => {
        const { [key]: _gone, ...rest } = prev;
        return rest;
      });
      // Also drop from dirty if staged
      setDirty((d) => {
        const { [key]: _gone, ...rest } = d;
        return rest;
      });
    } catch (err) {
      setLastError(err.message || String(err));
    }
  }, [scope, persistenceAdapter]);

  const value = useMemo(() => ({
    scope,
    scopeLabel: scopeLabel || JSON.stringify(scope),
    canEdit,
    isEditing: canEdit && isEditing,
    setEditing,
    isLoading,
    saved,
    dirty,
    lastError,
    dirtyCount: Object.keys(dirty).length,
    storageAdapter: storageAdapter || null,

    stageBlock: (key, type, value) => {
      setDirty((d) => ({ ...d, [key]: { type, value } }));
    },

    dropStaged: (key) => {
      setDirty((d) => {
        const { [key]: _gone, ...rest } = d;
        return rest;
      });
    },

    clearOverride,
    saveAll,
    isSaving,
  }), [scope, scopeLabel, canEdit, isEditing, isLoading, saved, dirty, lastError, isSaving, storageAdapter, saveAll, clearOverride]);

  return (
    <EditableContentContext.Provider value={value}>
      {children}
    </EditableContentContext.Provider>
  );
}

/**
 * useEditableContent — read a single block with fallback.
 * Returns the saved/staged override if one exists, otherwise the fallback.
 */
export function useEditableContent(blockKey, fallback, type = 'text') {
  const ctx = useContext(EditableContentContext);
  if (!ctx || !blockKey) return { value: fallback, isEditing: false, canEdit: false };

  const staged = ctx.dirty[blockKey];
  if (staged) return { value: staged.value, isEditing: ctx.isEditing, canEdit: ctx.canEdit, isDirty: true, type };

  const savedEntry = ctx.saved[blockKey];
  if (savedEntry) return { value: savedEntry.value, isEditing: ctx.isEditing, canEdit: ctx.canEdit, isDirty: false, type };

  return { value: fallback, isEditing: ctx.isEditing, canEdit: ctx.canEdit, isDirty: false, type };
}

/**
 * useEditableBlock — read + write mutators for a single block.
 */
export function useEditableBlock(blockKey, fallback, type = 'text') {
  const ctx = useContext(EditableContentContext);
  const read = useEditableContent(blockKey, fallback, type);

  const setValue = useCallback((next) => {
    if (!ctx || !blockKey) return;
    ctx.stageBlock(blockKey, type, next);
  }, [ctx, blockKey, type]);

  const drop = useCallback(() => {
    if (!ctx || !blockKey) return;
    ctx.dropStaged(blockKey);
  }, [ctx, blockKey]);

  const clear = useCallback(() => {
    if (!ctx || !blockKey) return;
    ctx.clearOverride(blockKey);
  }, [ctx, blockKey]);

  return { ...read, setValue, drop, clear };
}

/**
 * useEditorTray — access full context for the EditorTray component.
 */
export function useEditorTray() {
  return useContext(EditableContentContext);
}

export { EditableContentContext };
